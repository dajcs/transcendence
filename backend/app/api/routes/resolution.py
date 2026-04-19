"""Resolution routes.

POST /api/bets/{bet_id}/resolve           — Tier 2 proposer resolution
POST /api/bets/{bet_id}/accept-resolution — Vote to accept proposed resolution (free)
POST /api/bets/{bet_id}/dispute           — Vote to dispute proposed resolution (costs 1 BP)
POST /api/bets/{bet_id}/vote              — Cast vote in active Tier 3 community dispute
GET  /api/bets/{bet_id}/resolution        — Fetch resolution + review + dispute state
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.db.models.bet import Bet, BetPosition, Dispute, DisputeVote, Resolution, ResolutionReview
from app.db.models.user import User
from app.services import auth_service
from app.services.economy_service import deduct_bp
from app.services.resolution_service import compute_vote_weight, trigger_payout

router = APIRouter()
logger = logging.getLogger(__name__)

_REVIEW_WINDOW_HOURS = 48
_DISPUTE_THRESHOLD = 0.10  # >10% of participants → Tier 3
_ACCEPT_THRESHOLD = 0.90   # >90% of participants accept → immediate payout


async def _get_current_user(request: Request, db: AsyncSession) -> User:
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await auth_service.get_current_user(db, access_token)


async def _get_review_counts(db: AsyncSession, bet_id: uuid.UUID) -> dict:
    """Return accept/dispute vote counts, total participants, and threshold for a bet."""
    accept_count = (await db.execute(
        select(func.count(ResolutionReview.id)).where(
            ResolutionReview.bet_id == bet_id,
            ResolutionReview.vote == "accept",
        )
    )).scalar_one()

    dispute_count = (await db.execute(
        select(func.count(ResolutionReview.id)).where(
            ResolutionReview.bet_id == bet_id,
            ResolutionReview.vote == "dispute",
        )
    )).scalar_one()

    total_participants = (await db.execute(
        select(func.count(func.distinct(BetPosition.user_id))).where(
            BetPosition.bet_id == bet_id,
            BetPosition.withdrawn_at.is_(None),
        )
    )).scalar_one()

    threshold = max(1, int(total_participants * _DISPUTE_THRESHOLD))

    return {
        "accept_count": accept_count,
        "dispute_count": dispute_count,
        "total_participants": total_participants,
        "threshold": threshold,
    }


class ProposerResolveRequest(BaseModel):
    outcome: str = Field(..., min_length=1, max_length=200)
    justification: str = Field(..., min_length=20, max_length=2000)


class DisputeVoteRequest(BaseModel):
    vote: str = Field(..., min_length=1, max_length=200)


@router.post("/bets/{bet_id}/resolve")
async def proposer_resolve(
    bet_id: uuid.UUID,
    body: ProposerResolveRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """D-05: Proposer submits resolution. Sets status=proposer_resolved, creates Resolution record.
    48h review window begins — participants vote accept/dispute. Payout triggered by Celery if
    no dispute threshold is reached.
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

    # Notify all non-proposer participants to review the proposed resolution
    try:
        from app.services.notification_service import notify_resolution_proposed
        participant_ids = (await db.execute(
            select(func.distinct(BetPosition.user_id)).where(
                BetPosition.bet_id == bet_id,
                BetPosition.user_id != current_user.id,
                BetPosition.withdrawn_at.is_(None),
            )
        )).scalars().all()
        for participant_id in participant_ids:
            await notify_resolution_proposed(db, participant_id, bet.title, str(bet_id))
    except Exception:
        logger.exception("Failed to send resolution notifications for bet %s", bet_id)

    try:
        from app.socket.server import sio
        await sio.emit(
            "resolution:proposed",
            {"bet_id": str(bet_id), "outcome": body.outcome},
            room=f"bet:{bet_id}",
        )
        status_data = {"bet_id": str(bet_id), "status": "proposer_resolved"}
        await sio.emit("bet:status_changed", status_data, room=f"bet:{bet_id}")
        await sio.emit("bet:status_changed", status_data, room="global")
    except Exception:
        pass

    return {"status": "proposer_resolved", "outcome": body.outcome, "review_window_hours": 48}


@router.post("/bets/{bet_id}/accept-resolution")
async def accept_resolution(
    bet_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Record an accept vote during the 48h review window. Free. One vote per user per bet."""
    current_user = await _get_current_user(request, db)

    bet = (await db.execute(select(Bet).where(Bet.id == bet_id))).scalar_one_or_none()
    if bet is None:
        raise HTTPException(status_code=404, detail="Bet not found")
    if bet.proposer_id == current_user.id:
        raise HTTPException(status_code=403, detail="Proposer cannot vote on their own resolution")
    if bet.status != "proposer_resolved":
        raise HTTPException(status_code=400, detail="Bet is not in proposer_resolved status")

    resolution = (await db.execute(
        select(Resolution).where(Resolution.bet_id == bet_id)
    )).scalar_one_or_none()
    if resolution is None:
        raise HTTPException(status_code=400, detail="No resolution found")

    resolved_at = resolution.resolved_at
    if resolved_at.tzinfo is None:
        resolved_at = resolved_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > resolved_at + timedelta(hours=_REVIEW_WINDOW_HOURS):
        raise HTTPException(status_code=400, detail="Review window has expired (48h)")

    existing = (await db.execute(
        select(ResolutionReview).where(
            ResolutionReview.bet_id == bet_id,
            ResolutionReview.user_id == current_user.id,
        )
    )).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=400, detail="You have already voted on this resolution")

    db.add(ResolutionReview(bet_id=bet_id, user_id=current_user.id, vote="accept"))
    await db.commit()

    counts = await _get_review_counts(db, bet_id)

    # Auto-accept: >90% of *eligible* voters (non-proposer participants) accepted.
    # Proposer is excluded because they cannot vote on their own resolution.
    eligible_voters = (await db.execute(
        select(func.count(func.distinct(BetPosition.user_id))).where(
            BetPosition.bet_id == bet_id,
            BetPosition.user_id != bet.proposer_id,
            BetPosition.withdrawn_at.is_(None),
        )
    )).scalar_one()

    # Close the autobegun read transaction before calling trigger_payout.
    # After db.commit() above, SQLAlchemy autobegins a new transaction on the
    # first subsequent query. trigger_payout uses "async with db.begin()" which
    # raises InvalidRequestError if a transaction is already open on the session.
    await db.commit()

    auto_closed = False
    if eligible_voters > 0 and counts["accept_count"] / eligible_voters > _ACCEPT_THRESHOLD:
        await trigger_payout(db, bet_id, resolution.outcome, overturned=False)
        auto_closed = True

    try:
        from app.socket.server import sio
        await sio.emit("resolution:review_updated", {"bet_id": str(bet_id), **counts}, room=f"bet:{bet_id}")
        if auto_closed:
            status_data = {"bet_id": str(bet_id), "status": "closed"}
            await sio.emit("bet:status_changed", status_data, room=f"bet:{bet_id}")
            await sio.emit("bet:status_changed", status_data, room="global")
    except Exception:
        pass

    return {"vote": "accept", **counts, "auto_closed": auto_closed}


@router.post("/bets/{bet_id}/dispute")
async def vote_dispute(
    bet_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Record a dispute vote during the 48h review window. Costs 1 BP.
    If dispute votes exceed 10% of participants, market escalates to Tier 3 community vote.
    """
    current_user = await _get_current_user(request, db)

    bet = (await db.execute(select(Bet).where(Bet.id == bet_id))).scalar_one_or_none()
    if bet is None:
        raise HTTPException(status_code=404, detail="Bet not found")
    if bet.proposer_id == current_user.id:
        raise HTTPException(status_code=403, detail="Proposer cannot dispute their own resolution")
    if bet.status != "proposer_resolved":
        raise HTTPException(status_code=400, detail="Bet is not in proposer_resolved status")

    resolution = (await db.execute(
        select(Resolution).where(Resolution.bet_id == bet_id)
    )).scalar_one_or_none()
    if resolution is None:
        raise HTTPException(status_code=400, detail="No resolution found")

    resolved_at = resolution.resolved_at
    if resolved_at.tzinfo is None:
        resolved_at = resolved_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > resolved_at + timedelta(hours=_REVIEW_WINDOW_HOURS):
        raise HTTPException(status_code=400, detail="Review window has expired (48h)")

    # Check user has active position
    position = (await db.execute(
        select(BetPosition).where(
            BetPosition.bet_id == bet_id,
            BetPosition.user_id == current_user.id,
            BetPosition.withdrawn_at.is_(None),
        )
    )).scalar_one_or_none()
    if position is None:
        raise HTTPException(status_code=403, detail="You must have an active position to dispute")

    existing = (await db.execute(
        select(ResolutionReview).where(
            ResolutionReview.bet_id == bet_id,
            ResolutionReview.user_id == current_user.id,
        )
    )).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=400, detail="You have already voted on this resolution")

    await deduct_bp(db, current_user.id, 1.0, "dispute_vote", bet_id=bet_id)
    db.add(ResolutionReview(bet_id=bet_id, user_id=current_user.id, vote="dispute"))
    await db.flush()

    counts = await _get_review_counts(db, bet_id)

    # Check threshold — if reached, escalate to Tier 3
    dispute = None
    if counts["dispute_count"] >= counts["threshold"]:
        closes_at = datetime.now(timezone.utc) + timedelta(hours=48)
        dispute = Dispute(
            bet_id=bet_id,
            opened_by=current_user.id,
            closes_at=closes_at,
            status="open",
        )
        db.add(dispute)
        bet.status = "disputed"
        await db.flush()  # populate dispute.id before scheduling

    await db.commit()

    if dispute is not None:
        try:
            from app.workers.celery_app import celery_app as _celery
            _celery.send_task(
                "app.workers.tasks.resolution.close_dispute_at_deadline",
                args=[str(dispute.id)],
                eta=closes_at,
            )
        except Exception:
            pass

    try:
        from app.socket.server import sio
        await sio.emit("resolution:review_updated", {"bet_id": str(bet_id), **counts}, room=f"bet:{bet_id}")
        if bet.status == "disputed":
            await sio.emit("dispute:opened", {"bet_id": str(bet_id)}, room=f"bet:{bet_id}")
            status_data = {"bet_id": str(bet_id), "status": "disputed"}
            await sio.emit("bet:status_changed", status_data, room=f"bet:{bet_id}")
            await sio.emit("bet:status_changed", status_data, room="global")
    except Exception:
        pass

    return {"vote": "dispute", **counts, "escalated": bet.status == "disputed"}


@router.post("/bets/{bet_id}/vote")
async def cast_vote(
    bet_id: uuid.UUID,
    body: DisputeVoteRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """D-09: Cast a vote in an open Tier 3 community dispute. Weight computed per RES-04."""
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

    resolution = (await db.execute(
        select(Resolution).where(Resolution.bet_id == bet_id)
    )).scalar_one_or_none()
    if resolution is None:
        raise HTTPException(status_code=400, detail="No resolution found")

    position = (await db.execute(
        select(BetPosition.side).where(
            BetPosition.bet_id == bet_id,
            BetPosition.user_id == current_user.id,
            BetPosition.withdrawn_at.is_(None),
        )
    )).scalar_one_or_none()

    weight = compute_vote_weight(position, body.vote)

    existing_vote = (await db.execute(
        select(DisputeVote).where(
            DisputeVote.dispute_id == dispute.id,
            DisputeVote.user_id == current_user.id,
        )
    )).scalar_one_or_none()

    if existing_vote is not None:
        existing_vote.vote = body.vote
        existing_vote.weight = weight
    else:
        db.add(DisputeVote(
            dispute_id=dispute.id,
            user_id=current_user.id,
            vote=body.vote,
            weight=weight,
        ))
    await db.commit()

    try:
        from app.socket.server import sio
        from sqlalchemy import func as sqlfunc

        rows = (await db.execute(
            select(DisputeVote.vote, sqlfunc.sum(DisputeVote.weight))
            .where(DisputeVote.dispute_id == dispute.id)
            .group_by(DisputeVote.vote)
        )).all()
        vote_weights = {r[0]: float(r[1]) for r in rows}

        await sio.emit(
            "dispute:voted",
            {"bet_id": str(bet_id), "vote_weights": vote_weights},
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
    """Fetch resolution + review vote summary + dispute state."""
    current_user = await _get_current_user(request, db)

    resolution = (await db.execute(
        select(Resolution).where(Resolution.bet_id == bet_id)
    )).scalar_one_or_none()

    dispute = (await db.execute(
        select(Dispute).where(Dispute.bet_id == bet_id)
    )).scalar_one_or_none()

    dispute_data = None
    if dispute:
        rows = (await db.execute(
            select(DisputeVote.vote, func.sum(DisputeVote.weight))
            .where(DisputeVote.dispute_id == dispute.id)
            .group_by(DisputeVote.vote)
        )).all()
        vote_weights = {r[0]: float(r[1]) for r in rows}
        user_dv = (await db.execute(
            select(DisputeVote.vote, DisputeVote.weight).where(
                DisputeVote.dispute_id == dispute.id,
                DisputeVote.user_id == current_user.id,
            )
        )).one_or_none()
        dispute_data = {
            "id": str(dispute.id),
            "status": dispute.status,
            "closes_at": dispute.closes_at.isoformat(),
            "vote_weights": vote_weights,
            "user_vote": user_dv[0] if user_dv else None,
            "user_weight": float(user_dv[1]) if user_dv else None,
        }

    review_data = None
    if resolution:
        counts = await _get_review_counts(db, bet_id)
        user_review = (await db.execute(
            select(ResolutionReview.vote).where(
                ResolutionReview.bet_id == bet_id,
                ResolutionReview.user_id == current_user.id,
            )
        )).scalar_one_or_none()

        resolved_at = resolution.resolved_at
        if resolved_at.tzinfo is None:
            resolved_at = resolved_at.replace(tzinfo=timezone.utc)

        review_data = {
            **counts,
            "user_vote": user_review,
            "closes_at": (resolved_at + timedelta(hours=_REVIEW_WINDOW_HOURS)).isoformat(),
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
        "review": review_data,
    }
