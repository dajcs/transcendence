"""Resolution routes.

POST /api/bets/{bet_id}/resolve        — Tier 2 proposer resolution (D-04, D-05)
POST /api/bets/{bet_id}/dispute        — Open a community dispute (D-08)
POST /api/bets/{bet_id}/vote           — Cast dispute vote (D-09)
GET  /api/bets/{bet_id}/resolution     — Fetch current resolution + dispute state
"""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.db.models.bet import Bet, BetPosition, Dispute, DisputeVote, Resolution
from app.db.models.user import User
from app.services import auth_service
from app.services.economy_service import deduct_bp
from app.services.resolution_service import compute_vote_weight, trigger_payout

router = APIRouter()


async def _get_current_user(request: Request, db: AsyncSession) -> User:
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await auth_service.get_current_user(db, access_token)


class ProposerResolveRequest(BaseModel):
    outcome: str = Field(..., min_length=1, max_length=200)
    justification: str = Field(..., min_length=20, max_length=2000)


class DisputeVoteRequest(BaseModel):
    vote: str = Field(..., pattern="^(yes|no)$")


@router.post("/bets/{bet_id}/resolve")
async def proposer_resolve(
    bet_id: uuid.UUID,
    body: ProposerResolveRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """D-05: Proposer submits resolution. Sets status=proposer_resolved, creates Resolution record.
    48h dispute window begins. Payout NOT triggered here — triggered by check_dispute_deadlines.
    """
    current_user = await _get_current_user(request, db)

    bet = (await db.execute(select(Bet).where(Bet.id == bet_id))).scalar_one_or_none()
    if bet is None:
        raise HTTPException(status_code=404, detail="Bet not found")
    if bet.proposer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the proposer can resolve this bet")
    if bet.status != "pending_resolution":
        raise HTTPException(
            status_code=400,
            detail=f"Bet is not pending resolution (current status: {bet.status})"
        )

    # Check 7-day proposer window (D-06)
    seven_days = bet.deadline + timedelta(days=7)
    if datetime.now(timezone.utc) > seven_days:
        raise HTTPException(status_code=400, detail="Proposer resolution window has expired (7 days)")

    bet.status = "proposer_resolved"
    bet.winning_side = body.outcome

    resolution = Resolution(
        bet_id=bet_id,
        tier=2,
        resolved_by=current_user.id,
        outcome=body.outcome,
        justification=body.justification,
        overturned=False,
    )
    db.add(resolution)
    await db.commit()

    # Fire-and-forget notification
    try:
        from app.socket.server import sio
        await sio.emit(
            "dispute:opened",
            {"bet_id": str(bet_id), "message": "Proposer resolved — 48h dispute window open"},
            room=f"bet:{bet_id}",
        )
    except Exception:
        pass

    return {"status": "proposer_resolved", "outcome": body.outcome, "dispute_window_hours": 48}


@router.post("/bets/{bet_id}/dispute")
async def open_dispute(
    bet_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """D-08: Open a community dispute. Costs 1bp. Eligibility: active position, no prior dispute,
    no dispute opened by this user in last 24h globally.
    """
    current_user = await _get_current_user(request, db)

    bet = (await db.execute(select(Bet).where(Bet.id == bet_id))).scalar_one_or_none()
    if bet is None:
        raise HTTPException(status_code=404, detail="Bet not found")
    if bet.status != "proposer_resolved":
        raise HTTPException(status_code=400, detail="Bet is not in proposer_resolved status")

    # Check 48h window still open
    resolution = (await db.execute(
        select(Resolution).where(Resolution.bet_id == bet_id)
    )).scalar_one_or_none()
    if resolution is None:
        raise HTTPException(status_code=400, detail="No resolution found for this bet")

    resolved_at = resolution.resolved_at
    if resolved_at.tzinfo is None:
        resolved_at = resolved_at.replace(tzinfo=timezone.utc)
    dispute_window_end = resolved_at + timedelta(hours=48)
    if datetime.now(timezone.utc) > dispute_window_end:
        raise HTTPException(status_code=400, detail="Dispute window has expired (48h)")

    # Check user has active position
    position = (await db.execute(
        select(BetPosition).where(
            BetPosition.bet_id == bet_id,
            BetPosition.user_id == current_user.id,
            BetPosition.withdrawn_at.is_(None),
        )
    )).scalar_one_or_none()
    if position is None:
        raise HTTPException(status_code=403, detail="You must have an active position to open a dispute")

    # Check no existing dispute for this bet (one dispute round per bet)
    existing_dispute = (await db.execute(
        select(Dispute).where(Dispute.bet_id == bet_id)
    )).scalar_one_or_none()
    if existing_dispute is not None:
        raise HTTPException(status_code=400, detail="A dispute is already open for this bet")

    # Check 24h global dispute cooldown (D-08)
    recent_dispute = (await db.execute(
        select(Dispute).where(
            Dispute.opened_by == current_user.id,
            Dispute.opened_at >= datetime.now(timezone.utc) - timedelta(hours=24),
        )
    )).scalar_one_or_none()
    if recent_dispute is not None:
        raise HTTPException(status_code=429, detail="You can only open one dispute per 24 hours")

    await deduct_bp(db, current_user.id, 1.0, "dispute_open", bet_id=bet_id)

    dispute = Dispute(
        bet_id=bet_id,
        opened_by=current_user.id,
        closes_at=datetime.now(timezone.utc) + timedelta(hours=48),
        status="open",
    )
    db.add(dispute)
    bet.status = "disputed"
    await db.commit()

    # Socket emit: dispute:opened
    try:
        from app.socket.server import sio
        await sio.emit(
            "dispute:opened",
            {"bet_id": str(bet_id)},
            room=f"bet:{bet_id}",
        )
    except Exception:
        pass

    return {"status": "dispute_opened"}


@router.post("/bets/{bet_id}/vote")
async def cast_vote(
    bet_id: uuid.UUID,
    body: DisputeVoteRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """D-09: Cast a vote in an open dispute. Weight computed per RES-04."""
    current_user = await _get_current_user(request, db)

    dispute = (await db.execute(
        select(Dispute).where(
            Dispute.bet_id == bet_id,
            Dispute.status == "open",
        )
    )).scalar_one_or_none()
    if dispute is None:
        raise HTTPException(status_code=404, detail="No open dispute found for this bet")

    if datetime.now(timezone.utc) > dispute.closes_at:
        raise HTTPException(status_code=400, detail="Dispute voting window has closed")

    # Fetch original resolution outcome (to compute vote weight)
    resolution = (await db.execute(
        select(Resolution).where(Resolution.bet_id == bet_id)
    )).scalar_one_or_none()
    if resolution is None:
        raise HTTPException(status_code=400, detail="No resolution found")
    winning_side = resolution.outcome

    # Get user's position on this bet (may be None — neutral voters allowed)
    position = (await db.execute(
        select(BetPosition.side).where(
            BetPosition.bet_id == bet_id,
            BetPosition.user_id == current_user.id,
            BetPosition.withdrawn_at.is_(None),
        )
    )).scalar_one_or_none()

    weight = compute_vote_weight(position, winning_side)

    # UniqueConstraint(dispute_id, user_id) will raise IntegrityError on duplicate
    vote = DisputeVote(
        dispute_id=dispute.id,
        user_id=current_user.id,
        vote=body.vote,
        weight=weight,
    )
    db.add(vote)
    await db.commit()

    # Emit dispute:voted (anonymized: counts only)
    try:
        from app.socket.server import sio
        from sqlalchemy import func as sqlfunc

        yes_w = (await db.execute(
            select(sqlfunc.sum(DisputeVote.weight)).where(
                DisputeVote.dispute_id == dispute.id,
                DisputeVote.vote == "yes",
            )
        )).scalar_one() or 0
        no_w = (await db.execute(
            select(sqlfunc.sum(DisputeVote.weight)).where(
                DisputeVote.dispute_id == dispute.id,
                DisputeVote.vote == "no",
            )
        )).scalar_one() or 0

        await sio.emit(
            "dispute:voted",
            {"bet_id": str(bet_id), "yes_weight": float(yes_w), "no_weight": float(no_w)},
            room=f"bet:{bet_id}",
        )
    except Exception:
        pass

    return {"vote": body.vote, "weight": weight}


@router.get("/bets/{bet_id}/resolution")
async def get_resolution(
    bet_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Fetch current resolution + dispute state for the bet detail page."""
    current_user = await _get_current_user(request, db)

    resolution = (await db.execute(
        select(Resolution).where(Resolution.bet_id == bet_id)
    )).scalar_one_or_none()

    dispute = (await db.execute(
        select(Dispute).where(Dispute.bet_id == bet_id)
    )).scalar_one_or_none()

    dispute_data = None
    if dispute:
        yes_w = (await db.execute(
            select(func.sum(DisputeVote.weight)).where(
                DisputeVote.dispute_id == dispute.id,
                DisputeVote.vote == "yes",
            )
        )).scalar_one() or 0
        no_w = (await db.execute(
            select(func.sum(DisputeVote.weight)).where(
                DisputeVote.dispute_id == dispute.id,
                DisputeVote.vote == "no",
            )
        )).scalar_one() or 0
        dispute_data = {
            "id": str(dispute.id),
            "status": dispute.status,
            "closes_at": dispute.closes_at.isoformat(),
            "yes_weight": float(yes_w),
            "no_weight": float(no_w),
        }

    return {
        "resolution": {
            "tier": resolution.tier,
            "outcome": resolution.outcome,
            "justification": resolution.justification,
            "resolved_at": resolution.resolved_at.isoformat(),
            "overturned": resolution.overturned,
        } if resolution else None,
        "dispute": dispute_data,
    }
