"""Tests for resolution_source field on MarketCreate (auto-resolution wiring)."""
import pytest
from httpx import AsyncClient

BASE_MARKET = {
    "title": "Will it rain in Paris?",
    "description": "Test market for auto-resolution",
    "resolution_criteria": "Rain detected by Open-Meteo",
    "deadline": "2099-12-31T12:00:00Z",
    "market_type": "binary",
}

VALID_SOURCE = {
    "provider": "open-meteo",
    "location": "Paris",
    "condition": "rain",
    "date": "2099-12-31",
}

pytestmark = pytest.mark.asyncio


async def _register_and_login(client: AsyncClient) -> str:
    """Register a user and return the auth cookie header value."""
    await client.post("/api/auth/register", json={
        "username": "restest",
        "email": "restest@example.com",
        "password": "Password1!",
    })
    resp = await client.post("/api/auth/login", json={
        "email": "restest@example.com",
        "password": "Password1!",
    })
    assert resp.status_code == 200
    return resp.cookies.get("access_token", "")


async def test_resolution_source_accepted(client: AsyncClient):
    """Binary market with valid resolution_source returns 201."""
    await _register_and_login(client)
    resp = await client.post("/api/markets", json={
        **BASE_MARKET,
        "resolution_source": VALID_SOURCE,
    })
    assert resp.status_code == 201


async def test_resolution_source_rejected_non_binary(client: AsyncClient):
    """Non-binary market with resolution_source returns 422."""
    await _register_and_login(client)
    resp = await client.post("/api/markets", json={
        "title": "Multi choice market",
        "description": "Test market",
        "resolution_criteria": "Some criteria",
        "deadline": "2099-12-31T12:00:00Z",
        "market_type": "multiple_choice",
        "choices": ["A", "B"],
        "resolution_source": VALID_SOURCE,
    })
    assert resp.status_code == 422


async def test_resolution_source_wrong_provider(client: AsyncClient):
    """resolution_source with wrong provider (underscore) returns 422."""
    await _register_and_login(client)
    resp = await client.post("/api/markets", json={
        **BASE_MARKET,
        "resolution_source": {
            "provider": "open_meteo",  # underscore — wrong
            "location": "Paris",
            "condition": "rain",
            "date": "2099-12-31",
        },
    })
    assert resp.status_code == 422


async def test_resolution_source_missing_location(client: AsyncClient):
    """resolution_source without location returns 422."""
    await _register_and_login(client)
    resp = await client.post("/api/markets", json={
        **BASE_MARKET,
        "resolution_source": {
            "provider": "open-meteo",
            "condition": "rain",
            "date": "2099-12-31",
        },
    })
    assert resp.status_code == 422


async def test_market_no_resolution_source(client: AsyncClient):
    """Market created without resolution_source still returns 201 (regression)."""
    await _register_and_login(client)
    resp = await client.post("/api/markets", json=BASE_MARKET)
    assert resp.status_code == 201


async def test_resolution_source_persisted(client: AsyncClient):
    """Market with resolution_source is created without error (no-crash check)."""
    await _register_and_login(client)
    resp = await client.post("/api/markets", json={
        **BASE_MARKET,
        "resolution_source": VALID_SOURCE,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data
