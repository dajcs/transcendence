"""Bet placement, withdrawal, and position listing service."""
import uuid
from datetime import datetime, timezone

import redis.asyncio as aioredis
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models.bet import Bet, BetPosition, PositionHistory
from app.db.models.transaction import KpEvent
from app.schemas.bet import (
    BetPlaceRequest,
    BetPositionResponse,
    BetPositionWithMarket,
    BetPositionsListResponse,
    BetWithdrawResponse,
)
from app.services.economy_service import (
    compute_bet_cap,
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
        from app.socket.server import sio
        r = _get_redis()
        throttle_key = f"throttle:odds:{bet_id}"
        if not await r.set(throttle_key, "1", nx=True, px=500):
            return  # within 500ms window — skip
        odds = await get_bet_odds(db, bet_id)
        # choice_counts covers numeric + multiple_choice markets
        rows = await db.execute(
            select(BetPosition.side, func.count(BetPosition.id))
            .where(BetPosition.bet_id == bet_id, BetPosition.withdrawn_at.is_(None))
            .group_by(BetPosition.side)
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
    """BET-04: reject if amount exceeds today's kp-based cap."""
    today = datetime.now(timezone.utc).date()
    kp = (
        await db.execute(
            select(func.sum(KpEvent.amount)).where(
                KpEvent.user_id == user_id,
                KpEvent.day_date == today,
            )
        )
    ).scalar_one()
    cap = compute_bet_cap(int(kp or 0))
    if amount > cap:
        raise HTTPException(
            status_code=422,
            detail=f"Bet amount {amount} exceeds your daily cap of {cap} bp.",
        )


async def place_bet(db: AsyncSession, user_id: uuid.UUID, data: BetPlaceRequest) -> BetPositionResponse:
    market = (await db.execute(select(Bet).where(Bet.id == data.bet_id))).scalar_one_or_none()
    if market is None:
        raise HTTPException(status_code=404, detail="Market not found")
    if market.status != "open":
        raise HTTPException(status_code=409, detail="Market is not open for betting")

    existing_position = (
        await db.execute(
            select(BetPosition.id).where(
                BetPosition.bet_id == data.bet_id,
                BetPosition.user_id == user_id,
                BetPosition.withdrawn_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if existing_position is not None:
        raise HTTPException(status_code=409, detail="You already have a position in this market")

    await _check_bet_cap(db, user_id, data.amount)

    await deduct_bp(db, user_id=user_id, amount=data.amount, reason="bet_place", bet_id=data.bet_id)
    if market.proposer_id == user_id:
        await credit_bp(db, user_id=user_id, amount=data.amount, reason="own_bet_vote", bet_id=data.bet_id)
    position = BetPosition(
        id=uuid.uuid4(),
        bet_id=data.bet_id,
        user_id=user_id,
        side=data.side,
        bp_staked=data.amount,
    )
    db.add(position)
    db.add(
        PositionHistory(
            id=uuid.uuid4(),
            bet_id=data.bet_id,
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
    position = (await db.execute(select(BetPosition).where(BetPosition.id == position_id))).scalar_one_or_none()
    if position is None:
        raise HTTPException(status_code=404, detail="Position not found")
    if position.user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if position.withdrawn_at is not None:
        raise HTTPException(status_code=409, detail="Position already withdrawn")

    market = (await db.execute(select(Bet).where(Bet.id == position.bet_id))).scalar_one()

    if market.market_type == "numeric":
        # Consensus proximity refund: 1 - |estimate - mean| / (max - min)
        estimates_result = await db.execute(
            select(BetPosition.side).where(
                BetPosition.bet_id == position.bet_id,
                BetPosition.withdrawn_at.is_(None),
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
    else:
        odds = await get_bet_odds(db, position.bet_id)
        refund = compute_refund_bp(float(odds["yes_pool"]), float(odds["no_pool"]), position.side)

    await credit_bp(db, user_id=user_id, amount=refund, reason="withdrawal_refund", bet_id=position.bet_id)
    position.withdrawn_at = datetime.now(timezone.utc)
    position.refund_bp = refund
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

    return BetWithdrawResponse(id=position.id, refund_bp=float(refund), message="Position withdrawn")


def _is_numeric(value: str) -> bool:
    try:
        float(value)
        return True
    except (ValueError, TypeError):
        return False


async def list_positions(db: AsyncSession, user_id: uuid.UUID) -> BetPositionsListResponse:
    rows = (
        await db.execute(
            select(BetPosition, Bet)
            .join(Bet, Bet.id == BetPosition.bet_id)
            .where(BetPosition.user_id == user_id)
            .order_by(BetPosition.placed_at.desc())
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
