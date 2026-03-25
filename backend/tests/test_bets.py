"""Bet API tests — BET-02 (place YES/NO), BET-03 (withdraw), BET-05 (insufficient bp)."""
import pytest
from httpx import AsyncClient


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
