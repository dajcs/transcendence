"""Tests for GET /api/markets/{id}/positions and GET /api/markets/{id}/payouts endpoints."""
import uuid
from datetime import datetime, timezone, timedelta

import pytest
from httpx import AsyncClient


MARKET_PAYLOAD = {
    "title": "Will it rain tomorrow?",
    "description": "Weather test market",
    "resolution_criteria": "Official weather station reports rain",
    "deadline": "2027-01-01T00:00:00Z",
}


async def _register_and_login(client: AsyncClient, suffix: str = "pos") -> dict:
    """Helper: register, login, return user info."""
    await client.post("/api/auth/register", json={
        "email": f"user_{suffix}@example.com",
        "username": f"user_{suffix}",
        "password": "Passw0rd!",
    })
    await client.post("/api/auth/login", json={
        "identifier": f"user_{suffix}@example.com",
        "password": "Passw0rd!",
    })
    me = await client.get("/api/auth/me")
    return me.json()


async def _create_market(client: AsyncClient) -> str:
    """Helper: create a binary market, return its id."""
    resp = await client.post("/api/markets", json=MARKET_PAYLOAD)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_get_positions_empty(client: AsyncClient):
    """GET /api/markets/{id}/positions on market with no bets returns empty aggregate."""
    await _register_and_login(client, "pos1")
    market_id = await _create_market(client)

    resp = await client.get(f"/api/markets/{market_id}/positions")
    assert resp.status_code == 200
    data = resp.json()
    assert data["participants"] == []
    assert data["total"] == 0
    agg = data["aggregate"]
    assert agg["total_bp"] == 0
    assert agg["total_participants"] == 0
    assert agg["avg_bp"] == 0
    assert agg["by_side"] == {}


@pytest.mark.asyncio
async def test_get_payouts_empty(client: AsyncClient):
    """GET /api/markets/{id}/payouts on any market returns empty list."""
    await _register_and_login(client, "pay1")
    market_id = await _create_market(client)

    resp = await client.get(f"/api/markets/{market_id}/payouts")
    assert resp.status_code == 200
    data = resp.json()
    assert data["payouts"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_positions_public(client: AsyncClient):
    """GET /api/markets/{id}/positions without auth cookie returns 200."""
    await _register_and_login(client, "pos3")
    market_id = await _create_market(client)

    # Clear cookies to simulate unauthenticated request
    client.cookies.clear()

    resp = await client.get(f"/api/markets/{market_id}/positions")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_positions_unknown_market(client: AsyncClient):
    """GET /api/markets/{unknown_id}/positions returns 404."""
    unknown_id = "00000000-0000-0000-0000-000000000000"
    resp = await client.get(f"/api/markets/{unknown_id}/positions")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_positions_pagination(client: AsyncClient):
    """offset=0&limit=10 query params accepted; response has correct shape."""
    await _register_and_login(client, "pos5")
    market_id = await _create_market(client)

    resp = await client.get(f"/api/markets/{market_id}/positions?offset=0&limit=10")
    assert resp.status_code == 200
    data = resp.json()
    assert "participants" in data
    assert isinstance(data["participants"], list)
    assert "aggregate" in data
    agg = data["aggregate"]
    assert "total_bp" in agg
    assert "total_participants" in agg
    assert "avg_bp" in agg
    assert "by_side" in agg
    assert "total" in data
    assert isinstance(data["total"], int)
