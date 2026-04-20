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
from app.db.models.transaction import BpFundEntry, BpTransaction, TpTransaction
from app.services.economy_service import credit_bp


def compute_vote_weight(user_position_side: str | None, user_vote: str) -> float:
    """RES-04: Dispute vote weights based on position-vs-vote alignment.

    Intentional design: compares what the user BET ON (user_position_side) vs what they
    VOTED FOR (user_vote). This differs from the original spec which used position-vs-winning-side.
    The vote-vs-position semantics were chosen to reward courage regardless of which side is winning.

    - user_position_side is None (no stake, independent voter): 1.0x
    - vote matches own bet position (conflict of interest): 0.5x
    - vote contradicts own bet position (courage bonus): 2.0x
    """
    if user_position_side is None:
        return 1.0
    if user_position_side == user_vote:
        return 0.5
    return 2.0


def compute_tp_earned(t_win: float, t_bet: float) -> float:
    """RES-06: tp = t_win / t_bet (raw float, no truncation).
    t_win = seconds winner held winning position.
    t_bet = total bet duration in seconds (deadline - created_at).
    Returns 0.0 if t_bet <= 0."""
    if t_bet <= 0:
        return 0.0
    return t_win / t_bet


def compute_proposer_penalty(staked: float) -> float:
    """RES-05: Proposer loses 50% of staked bp if resolution overturned."""
    return max(0.0, staked * 0.5)


async def _compute_tp_for_user(
    db: AsyncSession,
    bet_id: uuid.UUID,
    user_id: uuid.UUID,
    winning_side: str,
    deadline: datetime,
    t_bet: float,
) -> float:
    """D-11 TP formula: time-based. tp = t_win / t_bet.
    t_win from PositionHistory via _compute_t_win.
    Returns 0.0 if user has no winning-side position history."""
    t_win = await _compute_t_win(db, bet_id, user_id, winning_side, deadline)
    return compute_tp_earned(t_win, t_bet)


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


def _compute_numeric_payouts(
    positions: list[tuple[uuid.UUID, float, str]],
    resolution_value: float,
) -> tuple[dict[uuid.UUID, float], float]:
    """Compute BP payouts for numeric markets (D-14 to D-17).

    Args:
        positions: list of (user_id, bp_staked, prediction_str) for all active positions
        resolution_value: the resolved numeric value

    Returns:
        (payouts: dict[user_id -> bp_to_credit], total_surplus: float)
    """
    if not positions:
        return {}, 0.0

    total_bp_pool = sum(bp for _, bp, _ in positions)

    parsed: list[tuple[uuid.UUID, float, float]] = []
    for uid, bp, side_str in positions:
        try:
            parsed.append((uid, bp, float(side_str)))
        except (ValueError, TypeError):
            pass

    # D-14: exact match
    exact_matches = [(uid, bp, pred) for uid, bp, pred in parsed if pred == resolution_value]
    if exact_matches:
        payouts: dict[uuid.UUID, float] = {}
        total_winner_payouts = 0.0
        for uid, bp, _ in exact_matches:
            payout = bp * 10
            payouts[uid] = payout
            total_winner_payouts += payout
        surplus = max(0.0, total_bp_pool - total_winner_payouts)
        return payouts, surplus

    # D-15: no exact match — expand window until ceil(total_bettors * 0.10) inside
    target_count = math.ceil(len(parsed) * 0.10)
    sorted_by_dist = sorted(parsed, key=lambda x: abs(x[2] - resolution_value))
    window = sorted_by_dist[:max(target_count, 1)]
    window_size = len(window)

    # D-16: linear interpolation — rank 0 (closest) = 10x, rank N-1 = 0.1x
    payouts = {}
    total_winner_payouts = 0.0
    for rank, (uid, bp, _) in enumerate(window):
        multiplier = 10.0 if window_size == 1 else 10.0 - (rank / (window_size - 1)) * 9.9
        payout = bp * multiplier
        payouts[uid] = payout
        total_winner_payouts += payout

    # D-17: surplus
    surplus = max(0.0, total_bp_pool - total_winner_payouts)
    return payouts, surplus


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

        # Compute total bet duration for TP formula (D-11)
        if bet.deadline.tzinfo is None:
            deadline_aware = bet.deadline.replace(tzinfo=timezone.utc)
        else:
            deadline_aware = bet.deadline
        if bet.created_at.tzinfo is None:
            created_aware = bet.created_at.replace(tzinfo=timezone.utc)
        else:
            created_aware = bet.created_at
        t_bet = max(0.0, (deadline_aware - created_aware).total_seconds())
        market_type = bet.market_type  # "binary", "multiple_choice", or "numeric"

        # D-12 BP payout: compute total pool and winning stake
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
        winner_payouts: list[tuple[uuid.UUID, float]] = []  # (user_id, bp_won) for notifications
        bet_title = bet.title

        if market_type == "numeric":
            # D-14–D-17: window-expansion + linear-interpolation payout
            all_positions_result = await db.execute(
                select(BetPosition.user_id, BetPosition.bp_staked, BetPosition.side).where(
                    BetPosition.bet_id == bet_id,
                    BetPosition.withdrawn_at.is_(None),
                )
            )
            all_positions = [(row.user_id, float(row.bp_staked), row.side) for row in all_positions_result]
            try:
                resolution_value = float(outcome)
            except (ValueError, TypeError):
                resolution_value = 0.0

            numeric_payouts, numeric_surplus = _compute_numeric_payouts(all_positions, resolution_value)

            for winner_id, winner_bp in numeric_payouts.items():
                if winner_bp > 0:
                    await credit_bp(db, winner_id, winner_bp, "bet_win", bet_id=bet_id)
                tp = await _compute_tp_for_user(db, bet_id, winner_id, outcome, deadline_aware, t_bet)
                if tp > 0:
                    db.add(TpTransaction(user_id=winner_id, amount=tp, bet_id=bet_id))
                    await db.flush()
                winner_payouts.append((winner_id, winner_bp))
                payout_count += 1

            if numeric_surplus > 0:
                db.add(BpFundEntry(
                    market_id=bet_id,
                    user_id=bet.proposer_id,
                    amount=numeric_surplus,
                    reason="numeric_surplus",
                ))
                await db.flush()

        else:
            # binary / multiple_choice: D-12 10x cap per winner; surplus → BpFundEntry
            fund_inserts: list[tuple[uuid.UUID, float]] = []
            for winner_id, user_winning_stake in winner_rows:
                if total_winning_stake > 0:
                    proportional_share = float(user_winning_stake) / total_winning_stake * total_bp_pool
                else:
                    proportional_share = 0.0
                cap = float(user_winning_stake) * 10
                winner_bp = min(cap, proportional_share)
                surplus = max(0.0, proportional_share - winner_bp)
                if surplus > 0:
                    fund_inserts.append((winner_id, surplus))

                if winner_bp > 0:
                    await credit_bp(db, winner_id, winner_bp, "bet_win", bet_id=bet_id)

                tp = await _compute_tp_for_user(db, bet_id, winner_id, outcome, deadline_aware, t_bet)
                if tp > 0:
                    db.add(TpTransaction(user_id=winner_id, amount=tp, bet_id=bet_id))
                    await db.flush()
                winner_payouts.append((winner_id, winner_bp))
                payout_count += 1

            for fund_user_id, surplus_amount in fund_inserts:
                db.add(BpFundEntry(
                    market_id=bet_id,
                    user_id=fund_user_id,
                    amount=surplus_amount,
                    reason="cap_surplus",
                ))
                await db.flush()

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

    # After commit: socket emit + payout notifications (fire-and-forget)
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

    from app.services.notification_service import notify_payout
    for winner_id, winner_bp in winner_payouts:
        if winner_bp > 0:
            try:
                await notify_payout(db, winner_id, bet_title, winner_bp, outcome, str(bet_id))
            except Exception:
                pass

    return payout_summary
