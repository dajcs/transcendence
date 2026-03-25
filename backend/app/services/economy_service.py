"""Economy service — balance queries, bp deduction, bet cap, refund calculation."""
import math
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.bet import BetPosition
from app.db.models.transaction import BpTransaction, KpEvent, TpTransaction
from app.db.models.user import User


def compute_bet_cap(kp: int) -> int:
    """BET-04: cap = floor(log10(kp+1)) + 1. Minimum 1."""
    return math.floor(math.log10(kp + 1)) + 1


def compute_refund_bp(yes_pool: float, no_pool: float, side: str) -> float:
    """BET-03/D-13: refund = round(win_probability_of_position, 2).
    If total pool is 0, return 0.5 (50/50 default)."""
    total = yes_pool + no_pool
    if total == 0:
        return 0.5
    if side == "yes":
        return round(yes_pool / total, 2)
    return round(no_pool / total, 2)


async def get_balance(db: AsyncSession, user_id: uuid.UUID) -> dict:
    """D-08/D-09: Compute bp, kp, tp balances from ledger tables.
    No balance columns on User — SUM aggregation is the source of truth."""
    bp_result = await db.execute(
        select(func.sum(BpTransaction.amount)).where(BpTransaction.user_id == user_id)
    )
    bp = float(bp_result.scalar_one() or 0)

    kp_result = await db.execute(
        select(func.sum(KpEvent.amount)).where(KpEvent.user_id == user_id)
    )
    kp = int(kp_result.scalar_one() or 0)

    tp_result = await db.execute(
        select(func.sum(TpTransaction.amount)).where(TpTransaction.user_id == user_id)
    )
    tp = float(tp_result.scalar_one() or 0)

    return {"bp": bp, "kp": kp, "tp": tp}


async def credit_bp(
    db: AsyncSession,
    user_id: uuid.UUID,
    amount: float,
    reason: str,
    bet_id: uuid.UUID | None = None,
) -> None:
    """Insert a positive BpTransaction. No lock needed — pure insert."""
    db.add(BpTransaction(user_id=user_id, amount=amount, reason=reason, bet_id=bet_id))
    await db.flush()


async def deduct_bp(
    db: AsyncSession,
    user_id: uuid.UUID,
    amount: float,
    reason: str,
    bet_id: uuid.UUID | None = None,
) -> None:
    """D-14: Atomically check and deduct bp using SELECT FOR UPDATE.
    Raises HTTPException(402) if balance < amount.
    Caller must be inside an active transaction (async with db.begin())."""
    # Lock user row to serialize concurrent deductions
    result = await db.execute(
        select(User).where(User.id == user_id).with_for_update()
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Compute current balance
    bal_result = await db.execute(
        select(func.sum(BpTransaction.amount)).where(BpTransaction.user_id == user_id)
    )
    balance = float(bal_result.scalar_one() or 0)

    if balance < amount:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient bp balance. Have: {balance:.2f}, need: {amount:.2f}",
        )

    db.add(BpTransaction(user_id=user_id, amount=-amount, reason=reason, bet_id=bet_id))
    await db.flush()


async def get_bet_odds(db: AsyncSession, bet_id: uuid.UUID) -> dict:
    """D-12: Compute yes_pct and no_pct from active positions (withdrawn_at IS NULL).
    Returns {"yes_pct": float, "no_pct": float, "yes_pool": float, "no_pool": float}."""
    result = await db.execute(
        select(BetPosition.side, func.sum(BetPosition.bp_staked))
        .where(BetPosition.bet_id == bet_id, BetPosition.withdrawn_at.is_(None))
        .group_by(BetPosition.side)
    )
    pools = {row[0]: float(row[1]) for row in result}
    yes = pools.get("yes", 0.0)
    no = pools.get("no", 0.0)
    total = yes + no
    if total == 0:
        return {"yes_pct": 50.0, "no_pct": 50.0, "yes_pool": 0.0, "no_pool": 0.0}
    return {
        "yes_pct": round(yes / total * 100, 1),
        "no_pct": round(no / total * 100, 1),
        "yes_pool": yes,
        "no_pool": no,
    }
