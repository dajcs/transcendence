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


# ---------------------------------------------------------------------------
# Resolution sweep — deadline condition (no grace period)
# ---------------------------------------------------------------------------

async def _make_bet(db_session, *, deadline: datetime, status: str = "open"):
    """Helper: insert a minimal bet and return its id."""
    from app.db.models.user import User
    from app.db.models.bet import Bet

    user_id = uuid.uuid4()
    bet_id = uuid.uuid4()
    db_session.add(User(id=user_id, email=f"{user_id}@t.com", username=str(user_id), password_hash="x"))
    db_session.add(Bet(
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
    from app.db.models.bet import Bet
    from app.workers.tasks.resolution import _process_auto_resolution

    past = datetime.now(timezone.utc) - timedelta(seconds=1)
    bet_id, _ = await _make_bet(db_session, deadline=past)

    await _process_auto_resolution(db_session)

    bet = (await db_session.execute(select(Bet).where(Bet.id == bet_id))).scalar_one()
    assert bet.status == "pending_resolution"


@pytest.mark.asyncio
async def test_sweep_ignores_future_bets(db_session):
    """_process_auto_resolution leaves bets with future deadlines untouched."""
    from sqlalchemy import select
    from app.db.models.bet import Bet
    from app.workers.tasks.resolution import _process_auto_resolution

    future = datetime.now(timezone.utc) + timedelta(hours=1)
    bet_id, _ = await _make_bet(db_session, deadline=future)

    await _process_auto_resolution(db_session)

    bet = (await db_session.execute(select(Bet).where(Bet.id == bet_id))).scalar_one()
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
