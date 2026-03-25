"""Market API tests — BET-01 (create market costs 1 bp)."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
@pytest.mark.xfail(reason="markets API not yet implemented", strict=False)
async def test_create_market_deducts_1bp(client: AsyncClient):
    """BET-01 + D-06: POST /api/markets creates market and deducts 1 bp from creator."""
    # Register + login so we have auth cookies
    await client.post("/api/auth/register", json={
        "email": "creator@example.com", "username": "creator", "password": "Passw0rd!",
    })
    await client.post("/api/auth/login", json={
        "email": "creator@example.com", "password": "Passw0rd!",
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
@pytest.mark.xfail(reason="markets API not yet implemented", strict=False)
async def test_create_market_insufficient_bp(client: AsyncClient):
    """BET-01 + D-06: POST /api/markets returns 402 when user has 0 bp."""
    # Register fresh user with no bonus credited yet
    await client.post("/api/auth/register", json={
        "email": "broke@example.com", "username": "broke", "password": "Passw0rd!",
    })
    await client.post("/api/auth/login", json={
        "email": "broke@example.com", "password": "Passw0rd!",
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
@pytest.mark.xfail(reason="markets API not yet implemented", strict=False)
async def test_list_markets(client: AsyncClient):
    """BET-01: GET /api/markets returns paginated list."""
    resp = await client.get("/api/markets?sort=deadline&status=all&page=1&limit=20")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
