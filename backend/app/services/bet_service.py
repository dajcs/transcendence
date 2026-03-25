"""Bet placement, withdrawal, and position listing service."""
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

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
    compute_refund_bp,
    credit_bp,
    deduct_bp,
    get_bet_odds,
)


async def _check_bet_cap(db: AsyncSession, user_id: uuid.UUID, bet_id: uuid.UUID) -> None:
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

    active_positions = (
        await db.execute(
            select(func.count(BetPosition.id)).where(
                BetPosition.bet_id == bet_id,
                BetPosition.user_id == user_id,
                BetPosition.withdrawn_at.is_(None),
            )
        )
    ).scalar_one()

    if int(active_positions) >= cap:
        raise HTTPException(status_code=422, detail=f"Bet cap reached for this market ({cap}).")


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

    await _check_bet_cap(db, user_id, data.bet_id)

    try:
        await deduct_bp(db, user_id=user_id, amount=1.0, reason="bet_place", bet_id=data.bet_id)
        position = BetPosition(
            id=uuid.uuid4(),
            bet_id=data.bet_id,
            user_id=user_id,
            side=data.side,
            bp_staked=1.0,
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
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="You already have a position in this market")

    return BetPositionResponse.model_validate(position)


async def withdraw_bet(db: AsyncSession, user_id: uuid.UUID, position_id: uuid.UUID) -> BetWithdrawResponse:
    position = (await db.execute(select(BetPosition).where(BetPosition.id == position_id))).scalar_one_or_none()
    if position is None:
        raise HTTPException(status_code=404, detail="Position not found")
    if position.user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if position.withdrawn_at is not None:
        raise HTTPException(status_code=409, detail="Position already withdrawn")

    odds = await get_bet_odds(db, position.bet_id)
    refund = compute_refund_bp(float(odds["yes_pool"]), float(odds["no_pool"]), position.side)

    await credit_bp(
        db,
        user_id=user_id,
        amount=refund,
        reason="withdrawal_refund",
        bet_id=position.bet_id,
    )
    position.withdrawn_at = datetime.now(timezone.utc)
    position.refund_bp = refund
    await db.commit()

    return BetWithdrawResponse(id=position.id, refund_bp=float(refund), message="Position withdrawn")


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
        if position.withdrawn_at is None and market.status == "open":
            active.append(record)
        else:
            resolved.append(record)

    return BetPositionsListResponse(active=active, resolved=resolved)
