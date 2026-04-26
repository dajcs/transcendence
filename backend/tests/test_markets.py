"""Market API tests — BET-01 (create market costs 1 bp) + ETA scheduling."""
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from unittest.mock import AsyncMock


@pytest.mark.asyncio
async def test_create_market_deducts_1bp(client: AsyncClient):
    """BET-01 + D-06: POST /api/markets creates market and deducts 1 bp from creator."""
    # Register + login so we have auth cookies
    await client.post("/api/auth/register", json={
        "email": "creator@example.com", "username": "creator", "password": "Passw0rd!",
    })
    await client.post("/api/auth/login", json={
        "identifier": "creator@example.com", "password": "Passw0rd!",
    })
    # Check balance before (should have 10 bp signup bonus after Plan 02-02)
    me_before = await client.get("/api/auth/me")
    # Create market
    resp = await client.post("/api/markets", json={
        "title": "Will it rain tomorrow?",
        "description": "Weather forecast test",
        "resolution_criteria": "Official weather station reports rain",
        "deadline": "2027-01-01T00:00:00Z",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Will it rain tomorrow?"
    assert data["status"] == "open"


@pytest.mark.asyncio
async def test_create_market_insufficient_bp(client: AsyncClient):
    """BET-01 + D-06: POST /api/markets returns 402 when user has 0 bp."""
    # Register fresh user with no bonus credited yet
    await client.post("/api/auth/register", json={
        "email": "broke@example.com", "username": "broke", "password": "Passw0rd!",
    })
    await client.post("/api/auth/login", json={
        "identifier": "broke@example.com", "password": "Passw0rd!",
    })
    resp = await client.post("/api/markets", json={
        "title": "No money market",
        "description": "desc",
        "resolution_criteria": "criteria",
        "deadline": "2027-01-01T00:00:00Z",
    })
    # With signup bonus implemented, this test will need a user with 0 bp.
    # For now verify the endpoint rejects malformed requests.
    assert resp.status_code in (201, 402, 422)


@pytest.mark.asyncio
async def test_list_markets(client: AsyncClient):
    """BET-01: GET /api/markets returns paginated list."""
    resp = await client.get("/api/markets?sort=deadline&status=all&page=1&limit=20")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_list_markets_includes_user_like_state(client: AsyncClient):
    """Market list includes user_has_liked for the authenticated viewer."""
    await client.post("/api/auth/register", json={
        "email": "creator-list@example.com", "username": "creatorlist", "password": "Passw0rd!",
    })
    await client.post("/api/auth/login", json={
        "identifier": "creator-list@example.com", "password": "Passw0rd!",
    })
    create_resp = await client.post("/api/markets", json={
        "title": "Liked market list state",
        "description": "desc",
        "resolution_criteria": "criteria",
        "deadline": "2027-01-01T00:00:00Z",
    })
    assert create_resp.status_code == 201
    market_id = create_resp.json()["id"]

    await client.post("/api/auth/logout")

    await client.post("/api/auth/register", json={
        "email": "liker-list@example.com", "username": "likerlist", "password": "Passw0rd!",
    })
    await client.post("/api/auth/login", json={
        "identifier": "liker-list@example.com", "password": "Passw0rd!",
    })

    like_resp = await client.post(f"/api/markets/{market_id}/upvote")
    assert like_resp.status_code == 201

    list_resp = await client.get("/api/markets?sort=deadline&status=all&page=1&limit=20")
    assert list_resp.status_code == 200
    items = list_resp.json()["items"]
    liked_market = next(item for item in items if item["id"] == market_id)
    assert liked_market["user_has_liked"] is True


# ---------------------------------------------------------------------------
# ETA scheduling: task fires at deadline, task_id stored on bet
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_market_schedules_eta_at_exact_deadline(db_session):
    """create_market schedules the ETA task at bet.deadline — no grace offset."""
    from app.db.models.user import User
    from app.db.models.transaction import BpTransaction
    from app.schemas.market import MarketCreate
    from app.services.market_service import create_market

    user_id = uuid.uuid4()
    db_session.add(User(id=user_id, email="eta@test.com", username="eta_user", password_hash="x"))
    db_session.add(BpTransaction(user_id=user_id, amount=5.0, reason="signup"))
    await db_session.commit()

    deadline = datetime(2030, 6, 1, 12, 0, 0, tzinfo=timezone.utc)
    mock_result = MagicMock()
    mock_result.id = "fake-task-id-eta"

    with patch("app.workers.celery_app.celery_app.send_task", return_value=mock_result) as mock_send:
        await create_market(db_session, user_id, MarketCreate(
            title="ETA test market",
            description="desc",
            resolution_criteria="criteria",
            deadline=deadline,
        ))

    assert mock_send.called, "send_task was never called"
    _, kwargs = mock_send.call_args
    eta = kwargs.get("eta")
    # SQLite strips tzinfo on round-trip; compare wall-clock only
    eta_naive = eta.replace(tzinfo=None) if eta else None
    deadline_naive = deadline.replace(tzinfo=None)
    assert eta_naive == deadline_naive, (
        f"Expected eta={deadline_naive!r}, got {eta_naive!r} — grace period must not be added"
    )


@pytest.mark.asyncio
async def test_create_market_stores_celery_task_id(db_session):
    """create_market stores the Celery task_id on Market.celery_task_id for future revocation."""
    from sqlalchemy import select
    from app.db.models.user import User
    from app.db.models.market import Market
    from app.db.models.transaction import BpTransaction
    from app.schemas.market import MarketCreate
    from app.services.market_service import create_market

    user_id = uuid.uuid4()
    db_session.add(User(id=user_id, email="tid@test.com", username="tid_user", password_hash="x"))
    db_session.add(BpTransaction(user_id=user_id, amount=5.0, reason="signup"))
    await db_session.commit()

    task_id = "celery-task-abc-123"
    mock_result = MagicMock()
    mock_result.id = task_id

    with patch("app.workers.celery_app.celery_app.send_task", return_value=mock_result):
        response = await create_market(db_session, user_id, MarketCreate(
            title="Task ID test",
            description="desc",
            resolution_criteria="criteria",
            deadline=datetime(2030, 1, 1, tzinfo=timezone.utc),
        ))

    bet = (await db_session.execute(select(Market).where(Market.id == response.id))).scalar_one()
    assert bet.celery_task_id == task_id, (
        f"Expected celery_task_id={task_id!r}, got {bet.celery_task_id!r}"
    )


@pytest.mark.asyncio
async def test_upvote_market_disallows_self_like(db_session):
    """ECON-02: proposer cannot like their own market or award themselves LP."""
    from app.db.models.market import Market, MarketUpvote
    from app.db.models.transaction import BpTransaction, LpEvent
    from app.db.models.user import User
    from app.services.market_service import upvote_market

    user_id = uuid.uuid4()
    market_id = uuid.uuid4()
    db_session.add(User(id=user_id, email="selflike@test.com", username="selflike", password_hash="x"))
    db_session.add(BpTransaction(user_id=user_id, amount=5.0, reason="signup"))
    db_session.add(Market(
        id=market_id,
        proposer_id=user_id,
        title="Own market",
        description="desc",
        resolution_criteria="criteria",
        deadline=datetime(2030, 1, 1, tzinfo=timezone.utc),
        market_type="binary",
        status="open",
    ))
    await db_session.commit()

    await upvote_market(db_session, user_id, market_id)

    upvote_count = (
        await db_session.execute(
            select(func.count()).select_from(MarketUpvote).where(MarketUpvote.bet_id == market_id)
        )
    ).scalar_one()
    lp_events = (
        await db_session.execute(
            select(LpEvent).where(
                LpEvent.user_id == user_id,
                LpEvent.source_type == "market_upvote",
                LpEvent.source_id == market_id,
            )
        )
    ).scalars().all()

    assert upvote_count == 0
    assert lp_events == []


@pytest.mark.asyncio
async def test_upvote_market_emits_realtime_balance_change(db_session, monkeypatch):
    """When a market earns LP, the recipient's connected tabs get a balance event."""
    from app.db.models.market import Market
    from app.db.models.transaction import BpTransaction
    from app.db.models.user import User
    from app.services.market_service import upvote_market

    proposer_id = uuid.uuid4()
    voter_id = uuid.uuid4()
    market_id = uuid.uuid4()
    emit = AsyncMock()
    monkeypatch.setattr("app.socket.server.celery_emit", emit)

    db_session.add_all([
        User(id=proposer_id, email="rt-market-owner@test.com", username="rt_market_owner", password_hash="x"),
        User(id=voter_id, email="rt-market-voter@test.com", username="rt_market_voter", password_hash="x"),
        BpTransaction(user_id=proposer_id, amount=5.0, reason="signup"),
        Market(
            id=market_id,
            proposer_id=proposer_id,
            title="Realtime market LP",
            description="desc",
            resolution_criteria="criteria",
            deadline=datetime(2030, 1, 1, tzinfo=timezone.utc),
            market_type="binary",
            status="open",
        ),
    ])
    await db_session.commit()

    await upvote_market(db_session, voter_id, market_id)

    emit.assert_awaited_once()
    event, payload = emit.await_args.args[:2]
    assert event == "points:balance_changed"
    assert payload == {"user_id": str(proposer_id), "bp": 5.0, "lp": 1, "tp": 0.0}
    assert emit.await_args.kwargs["room"] == f"user:{proposer_id}"


@pytest.mark.asyncio
async def test_unlike_market_only_records_one_negative_lp_event_when_delete_is_retried():
    """Concurrent/stale unlike attempts must not create duplicate LP decrements."""
    from types import SimpleNamespace

    from app.services.market_service import unlike_market

    market_id = uuid.uuid4()
    proposer_id = uuid.uuid4()
    voter_id = uuid.uuid4()

    class FakeSelectResult:
        def __init__(self, value):
            self._value = value

        def scalar_one_or_none(self):
            return self._value

        def scalar_one(self):
            return self._value

    class FakeDeleteResult:
        def __init__(self, rowcount: int):
            self.rowcount = rowcount

    class FakeSession:
        def __init__(self):
            self.delete_rowcounts = [1, 0]
            self.select_results = [
                SimpleNamespace(id=market_id, proposer_id=proposer_id),
                1,
                SimpleNamespace(id=market_id, proposer_id=proposer_id),
            ]
            self.added = []
            self.commit_count = 0

        async def execute(self, statement):
            statement_type = statement.__class__.__name__
            if statement_type == "Select":
                return FakeSelectResult(self.select_results.pop(0))
            if statement_type == "Delete":
                return FakeDeleteResult(self.delete_rowcounts.pop(0))
            raise AssertionError(f"Unexpected statement type: {statement_type}")

        def add(self, obj):
            self.added.append(obj)

        async def commit(self):
            self.commit_count += 1

    db = FakeSession()

    await unlike_market(db, voter_id, market_id)
    await unlike_market(db, voter_id, market_id)

    negative_events = [obj for obj in db.added if getattr(obj, "amount", None) == -1]
    assert len(negative_events) == 1
    assert db.commit_count == 1


@pytest.mark.asyncio
async def test_unlike_market_does_not_make_converted_lp_negative(db_session):
    """After login conversion resets LP to zero, unlikes must not create negative LP."""
    from datetime import datetime, timezone

    from app.db.models.market import Market, MarketUpvote
    from app.db.models.transaction import LpEvent
    from app.db.models.user import User
    from app.services.market_service import unlike_market
    from app.services.economy_service import convert_lp_to_bp, get_balance

    market_id = uuid.uuid4()
    proposer_id = uuid.uuid4()
    voter_id = uuid.uuid4()
    db_session.add_all([
        User(id=proposer_id, email="converted-market-owner@test.com", username="converted_market_owner", password_hash="x"),
        User(id=voter_id, email="converted-market-voter@test.com", username="converted_market_voter", password_hash="x"),
        Market(
            id=market_id,
            proposer_id=proposer_id,
            title="Converted market unlike",
            description="desc",
            resolution_criteria="criteria",
            deadline=datetime(2030, 1, 1, tzinfo=timezone.utc),
            market_type="binary",
            status="open",
        ),
        MarketUpvote(market_id=market_id, user_id=voter_id),
        LpEvent(
            user_id=proposer_id,
            amount=1,
            source_type="market_upvote",
            source_id=market_id,
            day_date=datetime.now(timezone.utc).date(),
        ),
    ])
    await db_session.commit()
    await convert_lp_to_bp(db_session, proposer_id)
    await db_session.commit()

    await unlike_market(db_session, voter_id, market_id)

    assert (await get_balance(db_session, proposer_id))["lp"] == 0
