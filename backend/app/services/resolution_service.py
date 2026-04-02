"""Resolution service — payout, vote weights, tp calculation, proposer penalty.

All DB writes go through a single async with db.begin() transaction.
Socket emit is fire-and-forget AFTER the transaction commits.
"""
import math
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.bet import Bet, BetPosition, PositionHistory
from app.db.models.transaction import BpTransaction, TpTransaction
from app.services.economy_service import credit_bp


def compute_vote_weight(user_position_side: str | None, user_vote: str) -> float:
    """RES-04: Vote weights per RESOLUTION.md.
    Compares what the user BET ON vs what they VOTED FOR:
    - No position (independent): 1.0x
    - Vote matches own bet position (conflict of interest): 0.5x
    - Vote contradicts own bet position (courageous): 2.0x
    """
    if user_position_side is None:
        return 1.0
    if user_position_side == user_vote:
        return 0.5
    return 2.0


def compute_tp_earned(t_win: float, t_bet: float) -> float:
    """RES-06: tp = floor(t_win / t_bet * 100) / 100.
    t_win = seconds winner held winning position (from PositionHistory.changed_at to deadline).
    t_bet = total bet duration in seconds (bet.deadline - bet.created_at).
    Returns 0.0 if t_bet <= 0.
    """
    if t_bet <= 0:
        return 0.0
    raw = t_win / t_bet
    return math.floor(raw * 100) / 100


def compute_proposer_penalty(staked: float) -> float:
    """RES-05: Proposer loses 50% of staked bp if resolution overturned.
    floor(staked * 0.5), minimum 0.
    """
    return max(0.0, math.floor(staked * 0.5))


async def _compute_tp_for_user(
    db: AsyncSession,
    bet_id: uuid.UUID,
    user_id: uuid.UUID,
    winning_side: str,
    total_winning_stake: float,
) -> float:
    """D-11 TP formula: per-position tp, losers earn 0, final = average across all positions.

    For each active position:
      winning: tp_i = floor(bp_staked / total_winning_stake * 100) / 100
      losing:  tp_i = 0
    Returns sum(tp_i) / count(positions). Returns 0.0 if user has no positions.
    """
    result = await db.execute(
        select(BetPosition.side, BetPosition.bp_staked).where(
            BetPosition.bet_id == bet_id,
            BetPosition.user_id == user_id,
            BetPosition.withdrawn_at.is_(None),
        )
    )
    positions = result.all()
    if not positions:
        return 0.0
    tp_values = []
    for side, bp_staked in positions:
        if side == winning_side and total_winning_stake > 0:
            tp_i = math.floor(float(bp_staked) / total_winning_stake * 100) / 100
        else:
            tp_i = 0.0
        tp_values.append(tp_i)
    return sum(tp_values) / len(tp_values)


async def _get_proposer_staked(db: AsyncSession, bet_id: uuid.UUID, proposer_id: uuid.UUID) -> float:
    """Sum of bp staked by proposer on active positions for this bet."""
    result = await db.execute(
        select(func.sum(BetPosition.bp_staked)).where(
            BetPosition.bet_id == bet_id,
            BetPosition.user_id == proposer_id,
            BetPosition.withdrawn_at.is_(None),
        )
    )
    return float(result.scalar_one() or 0)


async def _compute_t_win(
    db: AsyncSession, bet_id: uuid.UUID, user_id: uuid.UUID, winning_side: str, deadline: datetime
) -> float:
    """Compute t_win for a user: seconds from their last entry on winning side to deadline.
    Uses PositionHistory rows (handles users who changed sides).
    """
    result = await db.execute(
        select(PositionHistory.changed_at)
        .where(
            PositionHistory.bet_id == bet_id,
            PositionHistory.user_id == user_id,
            PositionHistory.side == winning_side,
        )
        .order_by(PositionHistory.changed_at.desc())
        .limit(1)
    )
    entry_time = result.scalar_one_or_none()
    if entry_time is None:
        return 0.0
    # Ensure timezone-aware comparison
    if entry_time.tzinfo is None:
        entry_time = entry_time.replace(tzinfo=timezone.utc)
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    return max(0.0, (deadline - entry_time).total_seconds())


async def trigger_payout(
    db: AsyncSession,
    bet_id: uuid.UUID,
    outcome: str,
    overturned: bool = False,
) -> dict:
    """RES-06 + RES-05: Atomically pay winners and optionally penalize proposer.

    Must be called OUTSIDE an existing transaction — creates its own async with db.begin().
    Emits bet:resolved socket event after commit (fire-and-forget).
    Returns payout_summary dict for socket payload.
    """
    async with db.begin():
        # Lock bet row — prevents double-payout
        bet = (await db.execute(
            select(Bet).where(Bet.id == bet_id).with_for_update()
        )).scalar_one_or_none()

        if bet is None:
            raise HTTPException(status_code=404, detail="Bet not found")
        if bet.status == "closed":
            # Already paid out — idempotent guard
            return {"already_closed": True}

        # Set winning side and close the bet
        bet.status = "closed"
        bet.winning_side = outcome
        bet.closed_at = datetime.now(timezone.utc)
        await db.flush()

        # D-11 BP payout: compute total pool and winning stake
        total_pool_result = await db.execute(
            select(func.sum(BetPosition.bp_staked)).where(
                BetPosition.bet_id == bet_id,
                BetPosition.withdrawn_at.is_(None),
            )
        )
        total_bp_pool = float(total_pool_result.scalar_one() or 0)

        winning_stake_result = await db.execute(
            select(func.sum(BetPosition.bp_staked)).where(
                BetPosition.bet_id == bet_id,
                BetPosition.side == outcome,
                BetPosition.withdrawn_at.is_(None),
            )
        )
        total_winning_stake = float(winning_stake_result.scalar_one() or 0)

        # Collect distinct winner user IDs with their aggregated winning stake
        winners_result = await db.execute(
            select(BetPosition.user_id, func.sum(BetPosition.bp_staked).label("user_stake")).where(
                BetPosition.bet_id == bet_id,
                BetPosition.side == outcome,
                BetPosition.withdrawn_at.is_(None),
            ).group_by(BetPosition.user_id)
        )
        winner_rows = winners_result.all()  # list of (user_id, user_winning_stake)

        payout_count = 0
        for winner_id, user_winning_stake in winner_rows:
            # BP: proportional share of total pool (D-11)
            if total_winning_stake > 0:
                winner_bp = math.floor(float(user_winning_stake) / total_winning_stake * total_bp_pool)
            else:
                winner_bp = 0
            if winner_bp > 0:
                await credit_bp(db, winner_id, float(winner_bp), "bet_win", bet_id=bet_id)

            # TP: per-position average (D-11)
            tp = await _compute_tp_for_user(db, bet_id, winner_id, outcome, total_winning_stake)
            if tp > 0:
                db.add(TpTransaction(user_id=winner_id, amount=tp, bet_id=bet_id))
                await db.flush()
            payout_count += 1

        # Proposer penalty if overturned (RES-05) — unchanged
        penalty_applied = 0.0
        if overturned:
            staked = await _get_proposer_staked(db, bet_id, bet.proposer_id)
            penalty = compute_proposer_penalty(staked)
            if penalty > 0:
                # Clamp penalty to current balance to avoid going negative
                bp_result = await db.execute(
                    select(func.sum(BpTransaction.amount)).where(
                        BpTransaction.user_id == bet.proposer_id
                    )
                )
                current_balance = float(bp_result.scalar_one() or 0)
                actual_penalty = min(penalty, current_balance)
                if actual_penalty > 0:
                    db.add(BpTransaction(
                        user_id=bet.proposer_id,
                        amount=-actual_penalty,
                        reason="proposer_penalty",
                        bet_id=bet_id,
                    ))
                    await db.flush()
                penalty_applied = actual_penalty

    # After commit: fire-and-forget socket emit
    payout_summary = {
        "outcome": outcome,
        "winners": payout_count,
        "overturned": overturned,
        "penalty_applied": penalty_applied,
    }
    from app.socket.server import celery_emit
    await celery_emit(
        "bet:resolved",
        {"bet_id": str(bet_id), "outcome": outcome, "payout_summary": payout_summary},
        room=f"bet:{bet_id}",
    )

    return payout_summary
