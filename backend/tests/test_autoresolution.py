"""Tests for resolution_source field on MarketCreate (auto-resolution wiring)."""
import pytest
from httpx import AsyncClient

BASE_BINARY = {
    "title": "Will it rain in Paris?",
    "description": "Test market for auto-resolution",
    "resolution_criteria": "Rain detected by Open-Meteo",
    "deadline": "2099-12-31T12:00:00Z",
    "market_type": "binary",
}

BASE_NUMERIC = {
    "title": "What temperature in Paris?",
    "description": "Temperature prediction market",
    "resolution_criteria": "Actual temperature via Open-Meteo",
    "deadline": "2099-12-31T12:00:00Z",
    "market_type": "numeric",
    "numeric_min": -50,
    "numeric_max": 60,
}

pytestmark = pytest.mark.asyncio


async def _register_and_login(client: AsyncClient, suffix: str = "") -> str:
    await client.post("/api/auth/register", json={
        "username": f"restest{suffix}",
        "email": f"restest{suffix}@example.com",
        "password": "Password1!",
    })
    resp = await client.post("/api/auth/login", json={
        "email": f"restest{suffix}@example.com",
        "password": "Password1!",
    })
    assert resp.status_code == 200
    return resp.cookies.get("access_token", "")


async def test_rain_source_accepted(client: AsyncClient):
    """Binary market with rain resolution_source returns 201."""
    await _register_and_login(client, "rain")
    resp = await client.post("/api/markets", json={
        **BASE_BINARY,
        "resolution_source": {"provider": "open-meteo", "location": "Paris", "condition": "rain"},
    })
    assert resp.status_code == 201


async def test_snow_source_accepted(client: AsyncClient):
    """Binary market with snow resolution_source returns 201."""
    await _register_and_login(client, "snow")
    resp = await client.post("/api/markets", json={
        **BASE_BINARY,
        "title": "Will it snow in Paris?",
        "resolution_source": {"provider": "open-meteo", "location": "Paris", "condition": "snow"},
    })
    assert resp.status_code == 201


async def test_temperature_source_accepted(client: AsyncClient):
    """Numeric market with temperature resolution_source returns 201."""
    await _register_and_login(client, "temp")
    resp = await client.post("/api/markets", json={
        **BASE_NUMERIC,
        "resolution_source": {"provider": "open-meteo", "location": "Paris", "condition": "temperature"},
    })
    assert resp.status_code == 201


async def test_wind_source_accepted(client: AsyncClient):
    """Numeric market with wind resolution_source returns 201."""
    await _register_and_login(client, "wind")
    resp = await client.post("/api/markets", json={
        "title": "What wind speed in Paris?",
        "description": "Wind prediction market",
        "resolution_criteria": "Actual wind speed via Open-Meteo",
        "deadline": "2099-12-31T12:00:00Z",
        "market_type": "numeric",
        "numeric_min": 0,
        "numeric_max": 220,
        "resolution_source": {"provider": "open-meteo", "location": "Paris", "condition": "wind"},
    })
    assert resp.status_code == 201


async def test_rain_on_numeric_rejected(client: AsyncClient):
    """Rain condition on numeric market returns 422."""
    await _register_and_login(client, "rainnum")
    resp = await client.post("/api/markets", json={
        **BASE_NUMERIC,
        "resolution_source": {"provider": "open-meteo", "location": "Paris", "condition": "rain"},
    })
    assert resp.status_code == 422


async def test_temperature_on_binary_rejected(client: AsyncClient):
    """Temperature condition on binary market returns 422."""
    await _register_and_login(client, "tempbin")
    resp = await client.post("/api/markets", json={
        **BASE_BINARY,
        "resolution_source": {"provider": "open-meteo", "location": "Paris", "condition": "temperature"},
    })
    assert resp.status_code == 422


async def test_resolution_source_wrong_provider(client: AsyncClient):
    """resolution_source with wrong provider returns 422."""
    await _register_and_login(client, "badprov")
    resp = await client.post("/api/markets", json={
        **BASE_BINARY,
        "resolution_source": {"provider": "open_meteo", "location": "Paris", "condition": "rain"},
    })
    assert resp.status_code == 422


async def test_resolution_source_missing_location(client: AsyncClient):
    """resolution_source without location returns 422."""
    await _register_and_login(client, "noloc")
    resp = await client.post("/api/markets", json={
        **BASE_BINARY,
        "resolution_source": {"provider": "open-meteo", "condition": "rain"},
    })
    assert resp.status_code == 422


async def test_resolution_source_on_multiple_choice_rejected(client: AsyncClient):
    """Multiple choice market with resolution_source returns 422."""
    await _register_and_login(client, "mc")
    resp = await client.post("/api/markets", json={
        "title": "Multiple choice market",
        "description": "Test",
        "resolution_criteria": "x",
        "deadline": "2099-12-31T12:00:00Z",
        "market_type": "multiple_choice",
        "choices": ["A", "B"],
        "resolution_source": {"provider": "open-meteo", "location": "Paris", "condition": "rain"},
    })
    assert resp.status_code == 422


async def test_market_no_resolution_source(client: AsyncClient):
    """Market without resolution_source still returns 201 (regression)."""
    await _register_and_login(client, "noreg")
    resp = await client.post("/api/markets", json=BASE_BINARY)
    assert resp.status_code == 201
