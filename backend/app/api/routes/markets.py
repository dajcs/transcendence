"""Market routes."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.db.models.market import Market, MarketPosition
from app.db.models.transaction import BpTransaction, TpTransaction
from app.db.models.user import User
from app.schemas.market import (
    AggregateStats,
    MarketCreate,
    MarketListResponse,
    MarketResponse,
    ParticipantEntry,
    ParticipantListResponse,
    PayoutEntry,
    PayoutListResponse,
)
from app.services import auth_service, market_service

router = APIRouter()


async def _get_current_user(request: Request, db: AsyncSession) -> object:
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await auth_service.get_current_user(db, access_token)


async def _get_current_user_optional(request: Request, db: AsyncSession):
    """Returns None if not authenticated (no exception)."""
    access_token = request.cookies.get("access_token")
    if not access_token:
        return None
    try:
        return await auth_service.get_current_user(db, access_token)
    except HTTPException:
        return None


@router.post("", response_model=MarketResponse, status_code=201)
async def create_market(
    data: MarketCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = await _get_current_user(request, db)
    return await market_service.create_market(db, proposer_id=user.id, data=data)


@router.get("", response_model=MarketListResponse)
async def list_markets(
    request: Request,
    sort: str = Query(default="deadline", pattern="^(deadline|active|newest)$"),
    sort_dir: str = Query(default="", pattern="^(asc|desc|)$"),
    status: str = Query(default="all", pattern="^(all|open|closed|disputed|resolved)$"),
    my_bets: bool = Query(default=False),
    my_markets: bool = Query(default=False),
    proposer_id: uuid.UUID | None = Query(default=None),
    q: str = Query(default=""),
    include_desc: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    current_user = await _get_current_user_optional(request, db)
    user_id = current_user.id if current_user else None
    if my_bets or my_markets:
        if user_id is None:
            raise HTTPException(status_code=401, detail="Login required for this filter")

    return await market_service.list_markets(
        db,
        sort=sort,
        sort_dir=sort_dir,
        status=status,
        my_bets=my_bets,
        my_markets=my_markets,
        user_id=user_id,
        proposer_id=proposer_id,
        q=q,
        include_desc=include_desc,
        page=page,
        limit=limit,
    )


@router.get("/{market_id}", response_model=MarketResponse)
async def get_market(market_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user_optional(request, db)
    current_user_id = user.id if user else None
    return await market_service.get_market(db, market_id, current_user_id=current_user_id)


@router.post("/{market_id}/upvote", status_code=201)
async def upvote_market(
    market_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = await _get_current_user(request, db)
    await market_service.upvote_market(db, user_id=user.id, market_id=market_id)


@router.delete("/{market_id}/upvote", status_code=200)
async def unlike_market(
    market_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = await _get_current_user(request, db)
    await market_service.unlike_market(db, user_id=user.id, market_id=market_id)
    return {"ok": True}


@router.get("/{market_id}/positions", response_model=ParticipantListResponse)
async def get_market_positions(
    market_id: uuid.UUID,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Get participant list and aggregate stats for a market. Public."""
    market = (await db.execute(select(Market).where(Market.id == market_id))).scalar_one_or_none()
    if market is None:
        raise HTTPException(status_code=404, detail="Market not found")

    # Active positions only (withdrawn_at IS NULL)
    base_q = (
        select(MarketPosition, User.username)
        .join(User, User.id == MarketPosition.user_id)
        .where(MarketPosition.market_id == market_id, MarketPosition.withdrawn_at.is_(None))
    )

    total_row = (await db.execute(
        select(func.count(MarketPosition.id))
        .where(MarketPosition.market_id == market_id, MarketPosition.withdrawn_at.is_(None))
    )).scalar_one()

    agg = (await db.execute(
        select(
            func.coalesce(func.sum(MarketPosition.bp_staked), 0).label("total_bp"),
            func.count(MarketPosition.id).label("total_participants"),
            func.coalesce(func.avg(MarketPosition.bp_staked), 0).label("avg_bp"),
        ).where(MarketPosition.market_id == market_id, MarketPosition.withdrawn_at.is_(None))
    )).one()

    side_counts_rows = (await db.execute(
        select(MarketPosition.side, func.count(MarketPosition.id))
        .where(MarketPosition.market_id == market_id, MarketPosition.withdrawn_at.is_(None))
        .group_by(MarketPosition.side)
    )).all()
    by_side = {side: int(cnt) for side, cnt in side_counts_rows}

    page_rows = (await db.execute(
        base_q.order_by(MarketPosition.placed_at.desc()).offset(offset).limit(limit)
    )).all()

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


@router.get("/{market_id}/payouts", response_model=PayoutListResponse)
async def get_market_payouts(
    market_id: uuid.UUID,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Get payout breakdown for a market. Public. Returns empty list for open markets."""
    market = (await db.execute(select(Market).where(Market.id == market_id))).scalar_one_or_none()
    if market is None:
        raise HTTPException(status_code=404, detail="Market not found")

    # Count total BP winners (reason="bet_win") for this market
    total = (await db.execute(
        select(func.count(func.distinct(BpTransaction.user_id)))
        .where(BpTransaction.bet_id == market_id, BpTransaction.reason == "bet_win")
    )).scalar_one()

    # BP winners with SQL-level pagination
    bp_rows = (await db.execute(
        select(BpTransaction.user_id, User.username, func.sum(BpTransaction.amount).label("bp_won"))
        .join(User, User.id == BpTransaction.user_id)
        .where(BpTransaction.bet_id == market_id, BpTransaction.reason == "bet_win")
        .group_by(BpTransaction.user_id, User.username)
        .offset(offset)
        .limit(limit)
    )).all()

    # TP winners (all TP for this bet — no pagination needed, merged by user_id)
    tp_rows = (await db.execute(
        select(TpTransaction.user_id, func.sum(TpTransaction.amount).label("tp_won"))
        .where(TpTransaction.bet_id == market_id)
        .group_by(TpTransaction.user_id)
    )).all()
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
