"""Resolution service regression tests for payout, weighting, and numeric band logic."""
import math
import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.db.models.bet import Bet, BetPosition, PositionHistory
from app.db.models.transaction import BpFundEntry, BpTransaction, TpTransaction
from app.db.models.user import User


def test_vote_weights_follow_position_vs_vote_semantics():
    from app.services.resolution_service import compute_vote_weight

    assert compute_vote_weight("yes", "yes") == 0.5
    assert compute_vote_weight(None, "yes") == 1.0
    assert compute_vote_weight("yes", "no") == 2.0
    assert compute_vote_weight("no", "yes") == 2.0


def test_proposer_penalty_halves_current_stake_without_flooring():
    from app.services.resolution_service import compute_proposer_penalty

    assert compute_proposer_penalty(staked=10.0) == 5.0
    assert compute_proposer_penalty(staked=3.0) == 1.5
    assert compute_proposer_penalty(staked=0.0) == 0.0
    assert compute_proposer_penalty(staked=1.0) == 0.5


def test_tp_formula_returns_raw_fraction_and_handles_zero_duration():
    from app.services.resolution_service import compute_tp_earned

    t_bet = 3600.0
    assert compute_tp_earned(t_win=3600.0, t_bet=t_bet) == 1.0
    assert compute_tp_earned(t_win=1800.0, t_bet=t_bet) == 0.5
    tp = compute_tp_earned(t_win=60.0, t_bet=t_bet)
    assert math.isclose(tp, 60.0 / 3600.0)
    assert compute_tp_earned(t_win=0.0, t_bet=t_bet) == 0.0
    assert compute_tp_earned(t_win=100.0, t_bet=0.0) == 0.0


def test_d12_bp_cap_formula():
    total_bp_pool = 300.0
    total_winning_stake = 200.0
    user_stake = 100.0
    proportional = user_stake / total_winning_stake * total_bp_pool
    cap = user_stake * 10
    winner_bp = min(cap, proportional)
    surplus = max(0.0, proportional - winner_bp)
    assert winner_bp == 150.0
    assert surplus == 0.0

    user_stake2 = 5.0
    total_winning_stake2 = 5.0
    total_bp_pool2 = 200.0
    proportional2 = user_stake2 / total_winning_stake2 * total_bp_pool2
    cap2 = user_stake2 * 10
    winner_bp2 = min(cap2, proportional2)
    surplus2 = max(0.0, proportional2 - winner_bp2)
    assert winner_bp2 == 50.0
    assert surplus2 == 150.0


def test_numeric_payouts_use_closest_non_empty_band_and_full_pool():
    from app.services.resolution_service import _compute_numeric_payouts

    payouts, fund_inserts = _compute_numeric_payouts(
        positions=[
            (uuid.uuid4(), 3.0, "101.0"),
            (uuid.uuid4(), 1.0, "101.5"),
            (uuid.uuid4(), 5.0, "120.0"),
        ],
        resolution_value=100.0,
        range_min=0.0,
        range_max=200.0,
    )

    assert sorted(payouts.values()) == [2.25, 6.75]
    assert fund_inserts == []


def test_numeric_payouts_use_market_span_percentages_and_16pct_fallback_band():
    from app.services.resolution_service import _compute_numeric_payouts

    payouts, fund_inserts = _compute_numeric_payouts(
        positions=[
            (uuid.uuid4(), 3.0, "115.0"),  # 15% of 0..100 span
            (uuid.uuid4(), 1.0, "84.0"),   # 16% of 0..100 span
            (uuid.uuid4(), 5.0, "130.0"),  # 30% of span
        ],
        resolution_value=100.0,
        range_min=0.0,
        range_max=100.0,
    )

    assert sorted(payouts.values()) == [2.25, 6.75]
    assert fund_inserts == []


def test_numeric_payouts_have_no_winners_beyond_16pct_of_market_span():
    from app.services.resolution_service import _compute_numeric_payouts

    payouts, fund_inserts = _compute_numeric_payouts(
        positions=[
            (uuid.uuid4(), 3.0, "117.0"),
            (uuid.uuid4(), 1.0, "82.0"),
        ],
        resolution_value=100.0,
        range_min=0.0,
        range_max=100.0,
    )

    assert payouts == {}
    assert fund_inserts == []


def test_numeric_payouts_cap_each_winner_and_store_surplus_per_user():
    from app.services.resolution_service import _compute_numeric_payouts

    user_a = uuid.uuid4()
    user_b = uuid.uuid4()
    payouts, fund_inserts = _compute_numeric_payouts(
        positions=[
            (user_a, 1.0, "101.0"),
            (user_b, 1.0, "101.5"),
            (uuid.uuid4(), 98.0, "150.0"),
        ],
        resolution_value=100.0,
        range_min=0.0,
        range_max=200.0,
    )

    assert payouts[user_a] == 10.0
    assert payouts[user_b] == 10.0
    assert sorted(fund_inserts) == sorted([(user_a, 40.0), (user_b, 40.0)])


def test_beat_schedule_has_check_auto_resolution():
    """Verify check_auto_resolution is registered in the Celery beat schedule."""
    from app.workers.celery_app import celery_app
    schedule = celery_app.conf.beat_schedule
    assert "check-auto-resolution-every-1min" in schedule
    entry = schedule["check-auto-resolution-every-1min"]
    assert entry["task"] == "app.workers.tasks.resolution.check_auto_resolution"


@pytest.mark.asyncio
async def test_compute_t_win_uses_latest_switch_to_winning_side(db_session):
    from app.services.resolution_service import _compute_t_win

    bet_id = uuid.uuid4()
    user_id = uuid.uuid4()
    proposer_id = uuid.uuid4()
    deadline = datetime(2030, 1, 1, 12, 0, tzinfo=timezone.utc)

    db_session.add_all(
        [
            User(id=proposer_id, email="prop@win.test", username="prop_win", password_hash="x"),
            User(id=user_id, email="winner@win.test", username="winner_win", password_hash="x"),
            Bet(
                id=bet_id,
                proposer_id=proposer_id,
                title="Switching sides",
                description="desc",
                resolution_criteria="criteria",
                deadline=deadline,
                market_type="binary",
                status="open",
                created_at=datetime(2030, 1, 1, 8, 0, tzinfo=timezone.utc),
            ),
            PositionHistory(
                id=uuid.uuid4(),
                bet_id=bet_id,
                user_id=user_id,
                side="no",
                changed_at=datetime(2030, 1, 1, 9, 0, tzinfo=timezone.utc),
            ),
            PositionHistory(
                id=uuid.uuid4(),
                bet_id=bet_id,
                user_id=user_id,
                side="yes",
                changed_at=datetime(2030, 1, 1, 10, 30, tzinfo=timezone.utc),
            ),
        ]
    )
    await db_session.commit()

    assert await _compute_t_win(db_session, bet_id, user_id, "yes", deadline) == 5400.0


@pytest.mark.asyncio
async def test_trigger_payout_closes_binary_market_and_records_surplus_and_tp(db_session):
    from app.services.resolution_service import trigger_payout

    bet_id = uuid.uuid4()
    proposer_id = uuid.uuid4()
    winner_id = uuid.uuid4()
    loser_id = uuid.uuid4()
    created_at = datetime(2030, 1, 1, 8, 0, tzinfo=timezone.utc)
    deadline = datetime(2030, 1, 1, 12, 0, tzinfo=timezone.utc)

    db_session.add_all(
        [
            User(id=proposer_id, email="prop@pay.test", username="prop_pay", password_hash="x"),
            User(id=winner_id, email="winner@pay.test", username="winner_pay", password_hash="x"),
            User(id=loser_id, email="loser@pay.test", username="loser_pay", password_hash="x"),
            BpTransaction(user_id=winner_id, amount=1.0, reason="signup"),
            BpTransaction(user_id=loser_id, amount=99.0, reason="signup"),
            Bet(
                id=bet_id,
                proposer_id=proposer_id,
                title="Binary payout",
                description="desc",
                resolution_criteria="criteria",
                deadline=deadline,
                created_at=created_at,
                market_type="binary",
                status="open",
            ),
            BetPosition(id=uuid.uuid4(), bet_id=bet_id, user_id=winner_id, side="yes", bp_staked=1.0),
            BetPosition(id=uuid.uuid4(), bet_id=bet_id, user_id=loser_id, side="no", bp_staked=99.0),
            PositionHistory(
                id=uuid.uuid4(),
                bet_id=bet_id,
                user_id=winner_id,
                side="yes",
                changed_at=datetime(2030, 1, 1, 9, 0, tzinfo=timezone.utc),
            ),
        ]
    )
    await db_session.commit()

    result = await trigger_payout(db_session, bet_id, "yes")

    assert result["bet_id"] == str(bet_id)
    assert result["outcome"] == "yes"
    assert result["payout_count"] == 1

    bet = (await db_session.execute(select(Bet).where(Bet.id == bet_id))).scalar_one()
    assert bet.status == "closed"
    assert bet.winning_side == "yes"

    tp_rows = (
        await db_session.execute(select(TpTransaction).where(TpTransaction.user_id == winner_id))
    ).scalars().all()
    assert len(tp_rows) == 1
    assert float(tp_rows[0].amount) == pytest.approx(0.75)

    surplus_rows = (
        await db_session.execute(select(BpFundEntry).where(BpFundEntry.user_id == winner_id))
    ).scalars().all()
    assert len(surplus_rows) == 1
    assert float(surplus_rows[0].amount) == pytest.approx(90.0)

    balance_rows = (
        await db_session.execute(select(BpTransaction).where(BpTransaction.user_id == winner_id))
    ).scalars().all()
    assert sum(float(row.amount) for row in balance_rows) == pytest.approx(11.0)
