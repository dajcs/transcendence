"""Worker task tests — current login conversion architecture + resolution sweep + socket emit."""
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest


def test_daily_task_module_is_a_stub_after_lp_login_conversion():
    """BET-07 moved to login-time LP conversion; daily worker no longer exposes allocation hooks."""
    import app.workers.tasks.daily as daily_module

    assert daily_module.__doc__ is None
    assert not hasattr(daily_module, "_run_allocation")


def test_open_meteo_outcome_mapping_handles_binary_numeric_and_invalid_values():
    from app.workers.tasks.resolution import _map_weather_outcome

    current = {
        "rain": 0.2,
        "snowfall": 0,
        "temperature_2m": 21.26,
        "wind_speed_10m": 8.14,
    }

    assert _map_weather_outcome(current, "rain") == "yes"
    assert _map_weather_outcome(current, "snow") == "no"
    assert _map_weather_outcome(current, "temperature") == "21.3"
    assert _map_weather_outcome(current, "wind") == "8.1"
    assert _map_weather_outcome({"temperature_2m": "bad"}, "temperature") is None
    assert _map_weather_outcome(current, "unknown") is None


# ---------------------------------------------------------------------------
# Resolution sweep — deadline condition (no grace period)
# ---------------------------------------------------------------------------

async def _make_bet(db_session, *, deadline: datetime, status: str = "open"):
    """Helper: insert a minimal bet and return its id."""
    from app.db.models.user import User
    from app.db.models.market import Market

    user_id = uuid.uuid4()
    bet_id = uuid.uuid4()
    db_session.add(User(id=user_id, email=f"{user_id}@t.com", username=str(user_id), password_hash="x"))
    db_session.add(Market(
        id=bet_id, proposer_id=user_id, title="T", description="D",
        resolution_criteria="C", status=status, market_type="binary",
        deadline=deadline,
    ))
    await db_session.commit()
    return bet_id, user_id


@pytest.mark.asyncio
async def test_sweep_picks_up_bet_at_deadline(db_session):
    """_process_auto_resolution transitions a bet whose deadline == now to pending_resolution."""
    from sqlalchemy import select
    from app.db.models.market import Market
    from app.workers.tasks.resolution import _process_auto_resolution

    past = datetime.now(timezone.utc) - timedelta(seconds=1)
    bet_id, _ = await _make_bet(db_session, deadline=past)

    await _process_auto_resolution(db_session)

    bet = (await db_session.execute(select(Market).where(Market.id == bet_id))).scalar_one()
    assert bet.status == "pending_resolution"


@pytest.mark.asyncio
async def test_sweep_ignores_future_bets(db_session):
    """_process_auto_resolution leaves bets with future deadlines untouched."""
    from sqlalchemy import select
    from app.db.models.market import Market
    from app.workers.tasks.resolution import _process_auto_resolution

    future = datetime.now(timezone.utc) + timedelta(hours=1)
    bet_id, _ = await _make_bet(db_session, deadline=future)

    await _process_auto_resolution(db_session)

    bet = (await db_session.execute(select(Market).where(Market.id == bet_id))).scalar_one()
    assert bet.status == "open"


@pytest.mark.asyncio
async def test_resolve_single_market_emits_status_changed(db_session, db_engine):
    """_resolve_single_market emits bet:status_changed after the status transition."""
    from sqlalchemy.ext.asyncio import async_sessionmaker
    from app.workers.tasks.resolution import _resolve_single_market

    past = datetime.now(timezone.utc) - timedelta(seconds=1)
    bet_id, _ = await _make_bet(db_session, deadline=past)

    # Provide task sessions from the same in-memory engine
    test_factory = async_sessionmaker(db_engine, expire_on_commit=False)

    with patch("app.workers.tasks.resolution.make_task_session", return_value=test_factory), \
         patch("app.socket.server.celery_emit", new_callable=AsyncMock) as mock_emit, \
         patch("app.services.notification_service.create_notification", new_callable=AsyncMock):
        await _resolve_single_market(str(bet_id))

    # At least one call should be bet:status_changed for this bet
    status_calls = [
        c for c in mock_emit.call_args_list
        if c.args and c.args[0] == "bet:status_changed"
        and c.kwargs.get("room") == f"bet:{bet_id}"
    ]
    assert status_calls, f"Expected bet:status_changed emit; got {mock_emit.call_args_list}"


@pytest.mark.asyncio
async def test_process_auto_resolution_weather_market_records_tier1_resolution(db_session, db_engine, monkeypatch):
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker

    import app.workers.tasks.resolution as tasks
    from app.db.models.market import Market, Resolution

    past = datetime.now(timezone.utc) - timedelta(seconds=1)
    bet_id, _ = await _make_bet(db_session, deadline=past)
    bet = (await db_session.execute(select(Market).where(Market.id == bet_id))).scalar_one()
    bet.resolution_source = '{"provider":"open-meteo","location":"Paris","condition":"rain"}'
    await db_session.commit()

    TaskSession = async_sessionmaker(db_engine, expire_on_commit=False)

    async def fake_outcome(_source):
        return "yes"

    async def fake_payout(_db, payout_bet_id, outcome, overturned=False):
        assert payout_bet_id == bet_id
        assert outcome == "yes"

    monkeypatch.setattr(tasks, "make_task_session", lambda: TaskSession)
    monkeypatch.setattr(tasks, "_fetch_open_meteo_outcome", fake_outcome)
    monkeypatch.setattr("app.services.resolution_service.trigger_payout", fake_payout)

    with patch("app.socket.server.celery_emit", new_callable=AsyncMock):
        await tasks._process_auto_resolution(db_session)

    refreshed = (await db_session.execute(select(Market).where(Market.id == bet_id))).scalar_one()
    resolution = (await db_session.execute(select(Resolution).where(Resolution.market_id == bet_id))).scalar_one()
    assert refreshed.status == "proposer_resolved"
    assert refreshed.winning_side == "yes"
    assert resolution.tier == 1


@pytest.mark.asyncio
async def test_escalate_overdue_proposer_opens_system_dispute(db_session, monkeypatch):
    from sqlalchemy import select

    import app.workers.tasks.resolution as tasks
    from app.db.models.market import Dispute, Market

    deadline = datetime.now(timezone.utc) - timedelta(days=8)
    bet_id, _ = await _make_bet(db_session, deadline=deadline, status="pending_resolution")

    class Celery:
        def send_task(self, *_args, **_kwargs):
            return None

    monkeypatch.setattr(tasks, "celery_app", Celery())
    with patch("app.socket.server.celery_emit", new_callable=AsyncMock):
        await tasks._escalate_overdue_proposer(db_session)

    bet = (await db_session.execute(select(Market).where(Market.id == bet_id))).scalar_one()
    dispute = (await db_session.execute(select(Dispute).where(Dispute.market_id == bet_id))).scalar_one()
    assert bet.status == "disputed"
    assert dispute.status == "open"
