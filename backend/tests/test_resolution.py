"""Resolution service regression tests for payout, weighting, and numeric band logic."""
import math
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.db.models.market import Dispute, Market, MarketPosition, MarketPositionHistory, Resolution
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
            Market(
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
            MarketPositionHistory(
                id=uuid.uuid4(),
                bet_id=bet_id,
                user_id=user_id,
                side="no",
                changed_at=datetime(2030, 1, 1, 9, 0, tzinfo=timezone.utc),
            ),
            MarketPositionHistory(
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
            Market(
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
            MarketPosition(id=uuid.uuid4(), bet_id=bet_id, user_id=winner_id, side="yes", bp_staked=1.0),
            MarketPosition(id=uuid.uuid4(), bet_id=bet_id, user_id=loser_id, side="no", bp_staked=99.0),
            MarketPositionHistory(
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

    bet = (await db_session.execute(select(Market).where(Market.id == bet_id))).scalar_one()
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


@pytest.mark.asyncio
async def test_uncontested_resolution_finalizer_pays_winners(db_engine, db_session, monkeypatch):
    from sqlalchemy.ext.asyncio import async_sessionmaker

    import app.workers.tasks.resolution as resolution_tasks

    TaskSession = async_sessionmaker(db_engine, expire_on_commit=False)
    monkeypatch.setattr(resolution_tasks, "make_task_session", lambda: TaskSession)

    bet_id = uuid.uuid4()
    proposer_id = uuid.uuid4()
    winner_id = uuid.uuid4()
    loser_id = uuid.uuid4()
    created_at = datetime(2030, 1, 1, 8, 0, tzinfo=timezone.utc)
    deadline = datetime(2030, 1, 1, 12, 0, tzinfo=timezone.utc)
    resolved_at = datetime.now(timezone.utc) - timedelta(hours=49)

    db_session.add_all(
        [
            User(id=proposer_id, email="prop@uncontested.test", username="prop_uncontested", password_hash="x"),
            User(id=winner_id, email="winner@uncontested.test", username="winner_uncontested", password_hash="x"),
            User(id=loser_id, email="loser@uncontested.test", username="loser_uncontested", password_hash="x"),
            BpTransaction(user_id=winner_id, amount=5.0, reason="signup"),
            BpTransaction(user_id=loser_id, amount=15.0, reason="signup"),
            Market(
                id=bet_id,
                proposer_id=proposer_id,
                title="Uncontested payout",
                description="desc",
                resolution_criteria="criteria",
                deadline=deadline,
                created_at=created_at,
                market_type="binary",
                status="proposer_resolved",
            ),
            Resolution(
                id=uuid.uuid4(),
                market_id=bet_id,
                tier=1,
                resolved_by=proposer_id,
                outcome="yes",
                resolved_at=resolved_at,
            ),
            MarketPosition(id=uuid.uuid4(), bet_id=bet_id, user_id=winner_id, side="yes", bp_staked=5.0),
            MarketPosition(id=uuid.uuid4(), bet_id=bet_id, user_id=loser_id, side="no", bp_staked=15.0),
            MarketPositionHistory(
                id=uuid.uuid4(),
                bet_id=bet_id,
                user_id=winner_id,
                side="yes",
                changed_at=datetime(2030, 1, 1, 9, 0, tzinfo=timezone.utc),
            ),
        ]
    )
    await db_session.commit()

    await resolution_tasks._finalize_uncontested_resolutions(db_session)

    bet = (await db_session.execute(select(Market).where(Market.id == bet_id))).scalar_one()
    assert bet.status == "closed"
    assert bet.winning_side == "yes"

    balance_rows = (
        await db_session.execute(select(BpTransaction).where(BpTransaction.user_id == winner_id))
    ).scalars().all()
    assert sum(float(row.amount) for row in balance_rows) == pytest.approx(25.0)

    tp_rows = (
        await db_session.execute(select(TpTransaction).where(TpTransaction.user_id == winner_id))
    ).scalars().all()
    assert len(tp_rows) == 1


@pytest.mark.asyncio
async def test_proposer_resolve_route_creates_resolution_and_rejects_non_proposer(db_session, monkeypatch):
    import app.api.routes.resolution as routes

    proposer_id = uuid.uuid4()
    other_id = uuid.uuid4()
    bet_id = uuid.uuid4()
    db_session.add_all(
        [
            User(id=proposer_id, email="route-prop@test.com", username="route_prop", password_hash="x"),
            User(id=other_id, email="route-other@test.com", username="route_other", password_hash="x"),
            Market(
                id=bet_id,
                proposer_id=proposer_id,
                title="Route resolve",
                description="desc",
                resolution_criteria="criteria",
                deadline=datetime.now(timezone.utc) - timedelta(hours=1),
                status="pending_resolution",
            ),
        ]
    )
    await db_session.commit()

    class Request:
        cookies = {}

    async def current_proposer(_request, _db):
        return User(id=proposer_id, email="route-prop@test.com", username="route_prop", password_hash="x")

    monkeypatch.setattr(routes, "_get_current_user", current_proposer)
    body = routes.ProposerResolveRequest(outcome="yes", justification="Enough evidence to resolve this market.")
    result = await routes.proposer_resolve(bet_id, body, Request(), db_session)

    assert result["status"] == "proposer_resolved"
    resolution = (await db_session.execute(select(Resolution).where(Resolution.market_id == bet_id))).scalar_one()
    assert resolution.tier == 2
    assert resolution.outcome == "yes"

    async def current_other(_request, _db):
        return User(id=other_id, email="route-other@test.com", username="route_other", password_hash="x")

    monkeypatch.setattr(routes, "_get_current_user", current_other)
    with pytest.raises(Exception) as exc:
        await routes.proposer_resolve(bet_id, body, Request(), db_session)
    assert exc.value.status_code in {400, 403}


@pytest.mark.asyncio
async def test_accept_resolution_auto_closes_when_all_eligible_voters_accept(db_session, monkeypatch):
    import app.api.routes.resolution as routes

    proposer_id = uuid.uuid4()
    voter_id = uuid.uuid4()
    bet_id = uuid.uuid4()
    db_session.add_all(
        [
            User(id=proposer_id, email="accept-prop@test.com", username="accept_prop", password_hash="x"),
            User(id=voter_id, email="accept-voter@test.com", username="accept_voter", password_hash="x"),
            Market(
                id=bet_id,
                proposer_id=proposer_id,
                title="Accept route",
                description="desc",
                resolution_criteria="criteria",
                deadline=datetime.now(timezone.utc) - timedelta(hours=1),
                status="proposer_resolved",
            ),
            Resolution(market_id=bet_id, tier=2, resolved_by=proposer_id, outcome="yes"),
            MarketPosition(market_id=bet_id, user_id=voter_id, side="yes", bp_staked=1),
        ]
    )
    await db_session.commit()

    class Request:
        cookies = {}

    async def current_voter(_request, _db):
        return User(id=voter_id, email="accept-voter@test.com", username="accept_voter", password_hash="x")

    async def fake_payout(_db, payout_bet_id, outcome, overturned=False):
        assert payout_bet_id == bet_id
        assert outcome == "yes"

    monkeypatch.setattr(routes, "_get_current_user", current_voter)
    monkeypatch.setattr(routes, "trigger_payout", fake_payout)

    result = await routes.accept_resolution(bet_id, Request(), db_session)

    assert result["vote"] == "accept"
    assert result["accept_count"] == 1
    assert result["auto_closed"] is True


@pytest.mark.asyncio
async def test_dispute_route_deducts_bp_and_escalates_to_dispute(db_session, monkeypatch):
    import app.api.routes.resolution as routes

    proposer_id = uuid.uuid4()
    voter_id = uuid.uuid4()
    bet_id = uuid.uuid4()
    db_session.add_all(
        [
            User(id=proposer_id, email="dispute-prop@test.com", username="dispute_prop", password_hash="x"),
            User(id=voter_id, email="dispute-voter@test.com", username="dispute_voter", password_hash="x"),
            BpTransaction(user_id=voter_id, amount=3, reason="signup", bet_id=None),
            Market(
                id=bet_id,
                proposer_id=proposer_id,
                title="Dispute route",
                description="desc",
                resolution_criteria="criteria",
                deadline=datetime.now(timezone.utc) - timedelta(hours=1),
                status="proposer_resolved",
            ),
            Resolution(market_id=bet_id, tier=2, resolved_by=proposer_id, outcome="yes"),
            MarketPosition(market_id=bet_id, user_id=voter_id, side="no", bp_staked=1),
        ]
    )
    await db_session.commit()

    class Request:
        cookies = {}

    async def current_voter(_request, _db):
        return User(id=voter_id, email="dispute-voter@test.com", username="dispute_voter", password_hash="x")

    class Celery:
        def send_task(self, *_args, **_kwargs):
            return None

    monkeypatch.setattr(routes, "_get_current_user", current_voter)
    monkeypatch.setattr("app.workers.celery_app.celery_app", Celery())

    result = await routes.vote_dispute(bet_id, Request(), db_session)

    assert result["vote"] == "dispute"
    assert result["dispute_count"] == 1
    assert result["escalated"] is True


@pytest.mark.asyncio
async def test_cast_vote_updates_existing_vote_and_get_resolution_returns_dispute_state(db_session, monkeypatch):
    import app.api.routes.resolution as routes

    proposer_id = uuid.uuid4()
    voter_id = uuid.uuid4()
    bet_id = uuid.uuid4()
    dispute_id = uuid.uuid4()
    db_session.add_all(
        [
            User(id=proposer_id, email="vote-prop@test.com", username="vote_prop", password_hash="x"),
            User(id=voter_id, email="vote-voter@test.com", username="vote_voter", password_hash="x"),
            Market(
                id=bet_id,
                proposer_id=proposer_id,
                title="Vote route",
                description="desc",
                resolution_criteria="criteria",
                deadline=datetime.now(timezone.utc) - timedelta(hours=1),
                status="disputed",
            ),
            Resolution(market_id=bet_id, tier=2, resolved_by=proposer_id, outcome="yes"),
            Dispute(id=dispute_id, market_id=bet_id, opened_by=voter_id, closes_at=datetime.now(timezone.utc) + timedelta(hours=1)),
            MarketPosition(market_id=bet_id, user_id=voter_id, side="no", bp_staked=1),
        ]
    )
    await db_session.commit()

    class Request:
        cookies = {}

    async def current_voter(_request, _db):
        return User(id=voter_id, email="vote-voter@test.com", username="vote_voter", password_hash="x")

    monkeypatch.setattr(routes, "_get_current_user", current_voter)

    first = await routes.cast_vote(bet_id, routes.DisputeVoteRequest(vote="no"), Request(), db_session)
    second = await routes.cast_vote(bet_id, routes.DisputeVoteRequest(vote="yes"), Request(), db_session)
    resolution_state = await routes.get_resolution(bet_id, Request(), db_session)

    assert first == {"vote": "no", "weight": 0.5}
    assert second == {"vote": "yes", "weight": 2.0}
    assert resolution_state["resolution"]["outcome"] == "yes"
    assert resolution_state["dispute"]["user_vote"] == "yes"
    assert resolution_state["dispute"]["vote_weights"] == {"yes": 2.0}
