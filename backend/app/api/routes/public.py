"""Read-only public API routes."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.db.models.market import Market, MarketPosition
from app.db.models.transaction import BpTransaction, TpTransaction
from app.db.models.user import User
from app.schemas.comment import CommentResponse
from app.schemas.market import (
    AggregateStats,
    MarketListResponse,
    MarketResponse,
    ParticipantEntry,
    ParticipantListResponse,
    PayoutEntry,
    PayoutListResponse,
)
from app.schemas.profile import HallOfFameResponse, PublicProfileResponse
from app.services import comment_service, market_service, profile_service
from app.services.public_rate_limit import enforce_public_rate_limit

router = APIRouter(tags=["public"], dependencies=[Depends(enforce_public_rate_limit)])


@router.get("/markets", response_model=MarketListResponse)
async def list_public_markets(
    sort: str = Query(default="deadline", pattern="^(deadline|active|newest)$"),
    sort_dir: str = Query(default="", pattern="^(asc|desc|)$"),
    status: str = Query(default="all", pattern="^(all|open|closed|disputed|resolved)$"),
    proposer_id: uuid.UUID | None = Query(default=None),
    q: str = Query(default=""),
    include_desc: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    return await market_service.list_markets(
        db,
        sort=sort,
        sort_dir=sort_dir,
        status=status,
        my_bets=False,
        my_markets=False,
        liked=False,
        user_id=None,
        proposer_id=proposer_id,
        q=q,
        include_desc=include_desc,
        page=page,
        limit=limit,
    )


@router.get("/markets/{market_id}", response_model=MarketResponse)
async def get_public_market(
    market_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    return await market_service.get_market(db, market_id, current_user_id=None)


@router.get("/markets/{market_id}/comments", response_model=list[CommentResponse])
async def list_public_comments(
    market_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    return await comment_service.list_comments(
        db,
        bet_id=market_id,
        current_user_id=None,
    )


@router.get("/markets/{market_id}/positions", response_model=ParticipantListResponse)
async def get_public_market_positions(
    market_id: uuid.UUID,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    market = (await db.execute(select(Market).where(Market.id == market_id))).scalar_one_or_none()
    if market is None:
        raise HTTPException(status_code=404, detail="Market not found")

    base_q = (
        select(MarketPosition, User.username)
        .join(User, User.id == MarketPosition.user_id)
        .where(MarketPosition.market_id == market_id, MarketPosition.withdrawn_at.is_(None))
    )

    total_row = (
        await db.execute(
            select(func.count(MarketPosition.id)).where(
                MarketPosition.market_id == market_id,
                MarketPosition.withdrawn_at.is_(None),
            )
        )
    ).scalar_one()

    agg = (
        await db.execute(
            select(
                func.coalesce(func.sum(MarketPosition.bp_staked), 0).label("total_bp"),
                func.count(MarketPosition.id).label("total_participants"),
                func.coalesce(func.avg(MarketPosition.bp_staked), 0).label("avg_bp"),
            ).where(MarketPosition.market_id == market_id, MarketPosition.withdrawn_at.is_(None))
        )
    ).one()

    side_counts_rows = (
        await db.execute(
            select(MarketPosition.side, func.count(MarketPosition.id))
            .where(MarketPosition.market_id == market_id, MarketPosition.withdrawn_at.is_(None))
            .group_by(MarketPosition.side)
        )
    ).all()
    by_side = {side: int(cnt) for side, cnt in side_counts_rows}

    page_rows = (
        await db.execute(
            base_q.order_by(MarketPosition.placed_at.desc()).offset(offset).limit(limit)
        )
    ).all()

    participants = [
        ParticipantEntry(
            user_id=pos.user_id,
            username=username,
            side=pos.side,
            bp_staked=float(pos.bp_staked),
            created_at=pos.placed_at,
        )
        for pos, username in page_rows
    ]

    return ParticipantListResponse(
        participants=participants,
        aggregate=AggregateStats(
            total_bp=float(agg.total_bp),
            total_participants=int(agg.total_participants),
            avg_bp=round(float(agg.avg_bp), 2),
            by_side=by_side,
        ),
        total=int(total_row),
    )


@router.get("/markets/{market_id}/payouts", response_model=PayoutListResponse)
async def get_public_market_payouts(
    market_id: uuid.UUID,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    market = (await db.execute(select(Market).where(Market.id == market_id))).scalar_one_or_none()
    if market is None:
        raise HTTPException(status_code=404, detail="Market not found")

    total = (
        await db.execute(
            select(func.count(func.distinct(BpTransaction.user_id))).where(
                BpTransaction.bet_id == market_id,
                BpTransaction.reason == "bet_win",
            )
        )
    ).scalar_one()

    bp_rows = (
        await db.execute(
            select(
                BpTransaction.user_id,
                User.username,
                func.sum(BpTransaction.amount).label("bp_won"),
            )
            .join(User, User.id == BpTransaction.user_id)
            .where(BpTransaction.bet_id == market_id, BpTransaction.reason == "bet_win")
            .group_by(BpTransaction.user_id, User.username)
            .offset(offset)
            .limit(limit)
        )
    ).all()

    tp_rows = (
        await db.execute(
            select(TpTransaction.user_id, func.sum(TpTransaction.amount).label("tp_won"))
            .where(TpTransaction.bet_id == market_id)
            .group_by(TpTransaction.user_id)
        )
    ).all()
    tp_map = {row.user_id: float(row.tp_won) for row in tp_rows}

    payouts = [
        PayoutEntry(
            user_id=row.user_id,
            username=row.username,
            bp_won=float(row.bp_won),
            tp_won=tp_map.get(row.user_id, 0.0),
        )
        for row in bp_rows
    ]

    return PayoutListResponse(payouts=payouts, total=total)


@router.get("/users/{username}", response_model=PublicProfileResponse)
async def get_public_profile(
    username: str,
    db: AsyncSession = Depends(get_db),
):
    return await profile_service.get_public_profile(db, username, current_user_id=None)


@router.get("/leaderboards", response_model=HallOfFameResponse)
async def get_public_leaderboards(
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    return await profile_service.get_hall_of_fame(db, limit=limit)
