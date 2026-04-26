"""Economy service — balance queries, bp deduction, bet cap, refund calculation."""
import math
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.market import MarketPosition
from app.db.models.transaction import BpTransaction, LpEvent, TpTransaction
from app.db.models.user import User


def compute_refund_bp(yes_count: float, no_count: float, side: str) -> float:
    """Binary refund: probability of the position's side winning by participant count.
    If total count is 0, return 0.5 (50/50 default)."""
    total = yes_count + no_count
    if total == 0:
        return 0.5
    if side == "yes":
        return round(yes_count / total, 2)
    return round(no_count / total, 2)


def compute_numeric_refund_bp(estimate: float, mean_estimate: float, range_min: float, range_max: float) -> float:
    """Numeric refund: consensus proximity.
    refund = 1 - |estimate - mean| / (range_max - range_min), clamped to [0, 1].
    If only one participant, mean == estimate → full refund (1.0)."""
    span = range_max - range_min
    if span <= 0:
        return 1.0
    return round(max(0.0, 1.0 - abs(estimate - mean_estimate) / span), 2)


async def get_balance(db: AsyncSession, user_id: uuid.UUID) -> dict:
    """D-08/D-09: Compute bp, lp, tp balances from ledger tables.
    No balance columns on User — SUM aggregation is the source of truth."""
    bp_result = await db.execute(
        select(func.sum(BpTransaction.amount)).where(BpTransaction.user_id == user_id)
    )
    bp = float(bp_result.scalar_one() or 0)

    lp_result = await db.execute(
        select(func.sum(LpEvent.amount)).where(LpEvent.user_id == user_id)
    )
    lp = int(lp_result.scalar_one() or 0)

    tp_result = await db.execute(
        select(func.sum(TpTransaction.amount)).where(TpTransaction.user_id == user_id)
    )
    tp = float(tp_result.scalar_one() or 0)

    return {"bp": bp, "lp": lp, "tp": tp}


async def emit_balance_changed(db: AsyncSession, user_id: uuid.UUID) -> None:
    balances = await get_balance(db, user_id)
    from app.socket.server import celery_emit

    await celery_emit(
        "points:balance_changed",
        {
            "user_id": str(user_id),
            "bp": float(balances["bp"]),
            "lp": int(balances["lp"]),
            "tp": float(balances["tp"]),
        },
        room=f"user:{user_id}",
    )


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


async def convert_lp_to_bp(db: AsyncSession, user_id: uuid.UUID) -> tuple[int, float]:
    """Convert accumulated LP to BP using min(log2(lp+1), 10.0). Resets LP to 0.
    Returns (lp_converted, bp_earned) — both 0 if no LP."""
    lp_total = (
        await db.execute(select(func.sum(LpEvent.amount)).where(LpEvent.user_id == user_id))
    ).scalar_one()
    lp_value = int(lp_total or 0)
    if lp_value <= 0:
        return 0, 0.0

    karma_bp = min(math.log2(lp_value + 1), 10.0)
    today = datetime.now(timezone.utc).date()
    db.add(BpTransaction(user_id=user_id, amount=karma_bp, reason="lp_conversion", bet_id=None))
    db.add(LpEvent(user_id=user_id, amount=-lp_value, source_type="lp_reset_login", source_id=user_id, day_date=today))
    await db.flush()
    return lp_value, karma_bp


async def get_bet_odds(db: AsyncSession, bet_id: uuid.UUID) -> dict:
    """D-12: Compute binary winning probability from participant counts, not stake size.
    Returns {"yes_pct", "no_pct", "yes_pool", "no_pool", "yes_count", "no_count", "total_votes"}."""
    result = await db.execute(
        select(MarketPosition.side, func.sum(MarketPosition.bp_staked), func.count(MarketPosition.id))
        .where(MarketPosition.market_id == bet_id, MarketPosition.withdrawn_at.is_(None))
        .group_by(MarketPosition.side)
    )
    pools: dict[str, dict] = {}
    for side, staked, count in result:
        pools[side] = {"pool": float(staked), "count": int(count)}
    yes = pools.get("yes", {}).get("pool", 0.0)
    no = pools.get("no", {}).get("pool", 0.0)
    yes_count = pools.get("yes", {}).get("count", 0)
    no_count = pools.get("no", {}).get("count", 0)
    total_votes = yes_count + no_count
    if total_votes == 0:
        return {
            "yes_pct": 50.0,
            "no_pct": 50.0,
            "yes_pool": 0.0,
            "no_pool": 0.0,
            "yes_count": 0,
            "no_count": 0,
            "total_votes": 0,
        }
    return {
        "yes_pct": round(yes_count / total_votes * 100, 1),
        "no_pct": round(no_count / total_votes * 100, 1),
        "yes_pool": yes,
        "no_pool": no,
        "yes_count": yes_count,
        "no_count": no_count,
        "total_votes": total_votes,
    }
