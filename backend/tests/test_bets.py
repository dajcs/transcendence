"""Market API tests — BET-02 (place YES/NO), BET-03 (withdraw), BET-05 (insufficient bp)."""
import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.db.models.market import Market


async def _setup_user_with_market(client: AsyncClient, email: str, username: str):
    """Helper: register, login, create market. Returns market_id."""
    await client.post("/api/auth/register", json={
        "email": email, "username": username, "password": "Passw0rd!",
    })
    await client.post("/api/auth/login", json={
        "identifier": email, "password": "Passw0rd!",
    })
    resp = await client.post("/api/markets", json={
        "title": "Test market",
        "description": "desc",
        "resolution_criteria": "criteria",
        "deadline": "2027-01-01T00:00:00Z",
    })
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_place_yes_bet(client: AsyncClient):
    """BET-02: POST /api/bets places a YES bet, deducts 1 bp, returns position."""
    market_id = await _setup_user_with_market(client, "bettor@example.com", "bettor")
    resp = await client.post("/api/bets", json={"bet_id": market_id, "side": "yes"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["side"] == "yes"
    assert float(data["bp_staked"]) == 1.0


@pytest.mark.asyncio
async def test_place_no_bet(client: AsyncClient):
    """BET-02: POST /api/bets places a NO bet."""
    market_id = await _setup_user_with_market(client, "bettor2@example.com", "bettor2")
    resp = await client.post("/api/bets", json={"bet_id": market_id, "side": "no"})
    assert resp.status_code == 201
    assert resp.json()["side"] == "no"


@pytest.mark.asyncio
async def test_duplicate_bet_rejected(client: AsyncClient):
    """BET-02: Second bet on same market returns 409 (unique constraint)."""
    market_id = await _setup_user_with_market(client, "dupe@example.com", "dupe")
    await client.post("/api/bets", json={"bet_id": market_id, "side": "yes"})
    resp = await client.post("/api/bets", json={"bet_id": market_id, "side": "no"})
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_place_bet_rejects_amount_above_cap(client: AsyncClient):
    market_id = await _setup_user_with_market(client, "capped@example.com", "capped")

    resp = await client.post("/api/bets", json={"bet_id": market_id, "side": "yes", "amount": 11})

    assert resp.status_code == 422
    assert "maximum of 10 bp" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_place_bet_rejects_closed_market(client: AsyncClient, db_session):
    market_id = await _setup_user_with_market(client, "closed@example.com", "closed_user")
    market = (await db_session.execute(select(Market).where(Market.id == uuid.UUID(market_id)))).scalar_one()
    market.status = "closed"
    await db_session.commit()

    resp = await client.post("/api/bets", json={"bet_id": market_id, "side": "yes"})

    assert resp.status_code == 409
    assert resp.json()["detail"] == "Market is not open for betting"


@pytest.mark.asyncio
async def test_withdraw_bet(client: AsyncClient):
    """BET-03: DELETE /api/bets/{position_id} withdraws position and credits refund."""
    market_id = await _setup_user_with_market(client, "withdrawer@example.com", "withdrawer")
    place_resp = await client.post("/api/bets", json={"bet_id": market_id, "side": "yes"})
    position_id = place_resp.json()["id"]
    resp = await client.delete(f"/api/bets/{position_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert "refund_bp" in data
    assert float(data["refund_bp"]) > 0


@pytest.mark.asyncio
async def test_withdraw_bet_refund_scales_with_bp_staked(client: AsyncClient):
    market_id = await _setup_user_with_market(client, "scaledrefund@example.com", "scaledrefund")

    await client.post("/api/auth/register", json={
        "email": "counterparty@example.com",
        "username": "counterparty",
        "password": "Passw0rd!",
    })
    await client.post("/api/auth/login", json={
        "identifier": "counterparty@example.com",
        "password": "Passw0rd!",
    })
    other_resp = await client.post("/api/bets", json={"bet_id": market_id, "side": "no", "amount": 1})
    assert other_resp.status_code == 201

    await client.post("/api/auth/login", json={
        "identifier": "scaledrefund@example.com",
        "password": "Passw0rd!",
    })
    place_resp = await client.post("/api/bets", json={"bet_id": market_id, "side": "yes", "amount": 3})
    assert place_resp.status_code == 201

    resp = await client.delete(f"/api/bets/{place_resp.json()['id']}")
    assert resp.status_code == 200
    assert float(resp.json()["refund_bp"]) == pytest.approx(1.5)


@pytest.mark.asyncio
async def test_withdraw_numeric_bet_refund_scales_with_bp_staked(db_session):
    from app.db.models.market import Market, MarketPosition
    from app.db.models.transaction import BpTransaction
    from app.db.models.user import User
    from app.services.bet_service import withdraw_bet

    user_id = uuid.uuid4()
    other_id = uuid.uuid4()
    market_id = uuid.uuid4()
    position_id = uuid.uuid4()

    db_session.add_all([
        User(id=user_id, email="numeric@test.com", username="numericuser", password_hash="x"),
        User(id=other_id, email="numericother@test.com", username="numericother", password_hash="x"),
        Market(
            id=market_id,
            proposer_id=other_id,
            title="Numeric market",
            description="desc",
            resolution_criteria="criteria",
            deadline=datetime(2030, 1, 1, tzinfo=timezone.utc),
            market_type="numeric",
            numeric_min=0,
            numeric_max=10,
            status="open",
        ),
        BpTransaction(user_id=user_id, amount=10, reason="signup"),
        MarketPosition(id=position_id, bet_id=market_id, user_id=user_id, side="4", bp_staked=2),
        MarketPosition(id=uuid.uuid4(), bet_id=market_id, user_id=other_id, side="6", bp_staked=1),
    ])
    await db_session.commit()

    result = await withdraw_bet(db_session, user_id, position_id)
    assert result.refund_bp == pytest.approx(1.8)


@pytest.mark.asyncio
async def test_positions_endpoint_splits_open_and_closed_markets(client: AsyncClient, db_session):
    market_id = await _setup_user_with_market(client, "positions@example.com", "positions_user")
    place_resp = await client.post("/api/bets", json={"bet_id": market_id, "side": "yes"})
    assert place_resp.status_code == 201

    market = (await db_session.execute(select(Market).where(Market.id == uuid.UUID(market_id)))).scalar_one()
    market.status = "closed"
    await db_session.commit()

    resp = await client.get("/api/bets/positions")

    assert resp.status_code == 200
    data = resp.json()
    assert data["active"] == []
    assert len(data["resolved"]) == 1
    assert data["resolved"][0]["market_status"] == "closed"


@pytest.mark.asyncio
async def test_positions_endpoint_can_list_another_users_positions(client: AsyncClient, db_session):
    market_id = await _setup_user_with_market(client, "owner@example.com", "market_owner")

    await client.post("/api/auth/register", json={
        "email": "viewer@example.com", "username": "viewer", "password": "Passw0rd!",
    })
    await client.post("/api/auth/register", json={
        "email": "otherbettor@example.com", "username": "otherbettor", "password": "Passw0rd!",
    })
    await client.post("/api/auth/login", json={
        "identifier": "otherbettor@example.com", "password": "Passw0rd!",
    })
    place_resp = await client.post("/api/bets", json={"bet_id": market_id, "side": "yes"})
    assert place_resp.status_code == 201

    from app.db.models.user import User
    other_user = (
        await db_session.execute(select(User).where(User.username == "otherbettor"))
    ).scalar_one()

    await client.post("/api/auth/login", json={
        "identifier": "viewer@example.com", "password": "Passw0rd!",
    })
    resp = await client.get(f"/api/bets/positions?user_id={other_user.id}")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["active"]) == 1
    assert data["active"][0]["id"] == place_resp.json()["id"]
