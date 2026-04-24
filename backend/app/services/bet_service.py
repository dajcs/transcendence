"""Wager placement, withdrawal, and position listing service."""
import uuid
from datetime import datetime, timezone

import redis.asyncio as aioredis
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models.market import Market, MarketPosition, MarketPositionHistory
from app.schemas.bet import (
    BetPlaceRequest,
    BetPositionResponse,
    BetPositionWithMarket,
    BetPositionsListResponse,
    BetWithdrawResponse,
)
from app.services.economy_service import (
    compute_numeric_refund_bp,
    compute_refund_bp,
    credit_bp,
    deduct_bp,
    get_bet_odds,
)

_redis_client: aioredis.Redis | None = None


def _get_redis() -> aioredis.Redis:
    """Lazy-initialized shared Redis client."""
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


async def _emit_odds_update(db: AsyncSession, bet_id: uuid.UUID) -> None:
    """Emit bet:odds_updated with 500ms throttle via Redis NX key."""
    try:
        if settings.database_url.startswith("sqlite"):
            return
        from app.socket.server import sio
        r = _get_redis()
        throttle_key = f"throttle:odds:{bet_id}"
        if not await r.set(throttle_key, "1", nx=True, px=500):
            return  # within 500ms window — skip
        odds = await get_bet_odds(db, bet_id)
        # choice_counts covers numeric + multiple_choice markets
        rows = await db.execute(
            select(MarketPosition.side, func.count(MarketPosition.id))
            .where(MarketPosition.market_id == bet_id, MarketPosition.withdrawn_at.is_(None))
            .group_by(MarketPosition.side)
        )
        choice_counts = {side: int(count) for side, count in rows}
        position_count = sum(choice_counts.values())
        await sio.emit(
            "bet:odds_updated",
            {
                "bet_id": str(bet_id),
                "yes_pct": float(odds["yes_pct"]),
                "no_pct": float(odds["no_pct"]),
                "total_votes": int(odds.get("total_votes", 0)),
                "choice_counts": choice_counts,
                "position_count": position_count,
            },
            room=f"bet:{bet_id}",
        )
    except Exception:
        pass


async def _check_bet_cap(db: AsyncSession, user_id: uuid.UUID, amount: float) -> None:
    """BET-04: flat cap of 10 BP per position (D-09)."""
    if amount > 10:
        raise HTTPException(
            status_code=422,
            detail=f"Bet amount {amount} exceeds the maximum of 10 bp per position.",
        )


async def place_bet(db: AsyncSession, user_id: uuid.UUID, data: BetPlaceRequest) -> BetPositionResponse:
    market = (await db.execute(select(Market).where(Market.id == data.bet_id))).scalar_one_or_none()
    if market is None:
        raise HTTPException(status_code=404, detail="Market not found")
    if market.status != "open":
        raise HTTPException(status_code=409, detail="Market is not open for betting")

    existing_position = (
        await db.execute(
            select(MarketPosition.id).where(
                MarketPosition.market_id == data.bet_id,
                MarketPosition.user_id == user_id,
                MarketPosition.withdrawn_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if existing_position is not None:
        raise HTTPException(status_code=409, detail="You already have a position in this market")

    await _check_bet_cap(db, user_id, data.amount)

    await deduct_bp(db, user_id=user_id, amount=data.amount, reason="bet_place", bet_id=data.bet_id)
    position = MarketPosition(
        id=uuid.uuid4(),
        market_id=data.bet_id,
        user_id=user_id,
        side=data.side,
        bp_staked=data.amount,
    )
    db.add(position)
    db.add(
        MarketPositionHistory(
            id=uuid.uuid4(),
            market_id=data.bet_id,
            user_id=user_id,
            side=data.side,
        )
    )
    await db.commit()
    await db.refresh(position)

    try:
        from app.socket.server import sio
        await _emit_odds_update(db, data.bet_id)
        await sio.emit(
            "bet:position_added",
            {
                "user_id": str(user_id),
                "side": data.side,
                "placed_at": position.placed_at.isoformat(),
            },
            room=f"bet:{data.bet_id}",
        )
    except Exception:
        pass

    return BetPositionResponse.model_validate(position)


async def withdraw_bet(db: AsyncSession, user_id: uuid.UUID, position_id: uuid.UUID) -> BetWithdrawResponse:
    position = (await db.execute(select(MarketPosition).where(MarketPosition.id == position_id))).scalar_one_or_none()
    if position is None:
        raise HTTPException(status_code=404, detail="Position not found")
    if position.user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if position.withdrawn_at is not None:
        raise HTTPException(status_code=409, detail="Position already withdrawn")

    market = (await db.execute(select(Market).where(Market.id == position.bet_id))).scalar_one()

    if market.market_type == "numeric":
        # Consensus proximity refund: 1 - |estimate - mean| / (max - min)
        estimates_result = await db.execute(
            select(MarketPosition.side).where(
                MarketPosition.market_id == position.bet_id,
                MarketPosition.withdrawn_at.is_(None),
            )
        )
        estimates = [float(row) for row in estimates_result.scalars() if _is_numeric(row)]
        mean_estimate = sum(estimates) / len(estimates) if estimates else float(position.side)
        refund = compute_numeric_refund_bp(
            float(position.side),
            mean_estimate,
            float(market.numeric_min or 0),
            float(market.numeric_max or 1),
        )
    elif market.market_type == "multiple_choice":
        counts_result = await db.execute(
            select(MarketPosition.side, func.count(MarketPosition.id))
            .where(
                MarketPosition.market_id == position.bet_id,
                MarketPosition.withdrawn_at.is_(None),
            )
            .group_by(MarketPosition.side)
        )
        choice_counts = {side: int(count) for side, count in counts_result.all()}
        total_positions = sum(choice_counts.values()) or 1
        refund = round((choice_counts.get(position.side, 0) / total_positions), 2)
    else:
        odds = await get_bet_odds(db, position.bet_id)
        refund = compute_refund_bp(float(odds["yes_count"]), float(odds["no_count"]), position.side)

    refund_total = round(refund * float(position.bp_staked), 2)

    await credit_bp(db, user_id=user_id, amount=refund_total, reason="withdrawal_refund", bet_id=position.bet_id)
    position.withdrawn_at = datetime.now(timezone.utc)
    position.refund_bp = refund_total
    await db.commit()

    try:
        from app.socket.server import sio
        await _emit_odds_update(db, position.bet_id)
        await sio.emit(
            "bet:position_withdrawn",
            {"user_id": str(user_id)},
            room=f"bet:{position.bet_id}",
        )
    except Exception:
        pass

    return BetWithdrawResponse(id=position.id, refund_bp=float(refund_total), message="Position withdrawn")


def _is_numeric(value: str) -> bool:
    try:
        float(value)
        return True
    except (ValueError, TypeError):
        return False


async def list_positions(db: AsyncSession, user_id: uuid.UUID) -> BetPositionsListResponse:
    rows = (
        await db.execute(
            select(MarketPosition, Market)
            .join(Market, Market.id == MarketPosition.market_id)
            .where(MarketPosition.user_id == user_id)
            .order_by(MarketPosition.placed_at.desc())
        )
    ).all()

    active: list[BetPositionWithMarket] = []
    resolved: list[BetPositionWithMarket] = []

    for position, market in rows:
        odds = await get_bet_odds(db, market.id)
        record = BetPositionWithMarket(
            id=position.id,
            bet_id=position.bet_id,
            side=position.side,
            bp_staked=float(position.bp_staked),
            placed_at=position.placed_at,
            withdrawn_at=position.withdrawn_at,
            refund_bp=float(position.refund_bp) if position.refund_bp is not None else None,
            market_title=market.title,
            market_status=market.status,
            yes_pct=float(odds["yes_pct"]),
            no_pct=float(odds["no_pct"]),
        )
        if position.withdrawn_at is None and market.status != "closed":
            active.append(record)
        else:
            resolved.append(record)

    return BetPositionsListResponse(active=active, resolved=resolved)
