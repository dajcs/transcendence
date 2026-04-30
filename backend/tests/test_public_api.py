"""Public read-only API tests for STRETCH-01."""
import uuid

import pytest
from fakeredis.aioredis import FakeRedis
from httpx import AsyncClient


async def _register_and_login(client: AsyncClient, email: str, username: str) -> dict:
    resp = await client.post(
        "/api/auth/register",
        json={"email": email, "username": username, "password": "Passw0rd!"},
    )
    assert resp.status_code == 201, resp.text
    login = await client.post(
        "/api/auth/login",
        json={"identifier": email, "password": "Passw0rd!"},
    )
    assert login.status_code == 200, login.text
    return resp.json()


async def _create_market(client: AsyncClient, title: str = "Public API test market") -> str:
    resp = await client.post(
        "/api/markets",
        json={
            "title": title,
            "description": "A market visible through the public API.",
            "resolution_criteria": "Resolved by public evidence.",
            "deadline": "2027-01-01T00:00:00Z",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_public_api_lists_and_reads_markets_without_auth(client: AsyncClient):
    await _register_and_login(client, "public-market@example.com", "publicmarket")
    market_id = await _create_market(client)
    client.cookies.clear()

    list_resp = await client.get("/api/public/markets?page=1&limit=20")
    detail_resp = await client.get(f"/api/public/markets/{market_id}")

    assert list_resp.status_code == 200
    data = list_resp.json()
    assert "items" in data
    assert "total" in data
    assert any(item["id"] == market_id for item in data["items"])
    assert detail_resp.status_code == 200
    assert detail_resp.json()["id"] == market_id
    assert detail_resp.json()["user_has_liked"] is False


@pytest.mark.asyncio
async def test_public_api_exposes_comments_positions_and_payouts_without_auth(
    client: AsyncClient,
):
    await _register_and_login(client, "public-related@example.com", "publicrelated")
    market_id = await _create_market(client, title="Public related resources")
    comment = await client.post(
        f"/api/markets/{market_id}/comments",
        json={"content": "A public comment."},
    )
    assert comment.status_code == 201, comment.text
    client.cookies.clear()

    comments_resp = await client.get(f"/api/public/markets/{market_id}/comments")
    positions_resp = await client.get(
        f"/api/public/markets/{market_id}/positions?offset=0&limit=10"
    )
    payouts_resp = await client.get(
        f"/api/public/markets/{market_id}/payouts?offset=0&limit=10"
    )

    assert comments_resp.status_code == 200
    assert isinstance(comments_resp.json(), list)
    assert any(item["content"] == "A public comment." for item in comments_resp.json())
    assert positions_resp.status_code == 200
    positions = positions_resp.json()
    assert "participants" in positions
    assert "aggregate" in positions
    assert "total" in positions
    assert payouts_resp.status_code == 200
    payouts = payouts_resp.json()
    assert "payouts" in payouts
    assert "total" in payouts


@pytest.mark.asyncio
async def test_public_api_exposes_public_profile_and_leaderboards_without_auth(
    client: AsyncClient,
):
    await _register_and_login(client, "public-profile@example.com", "publicprofile")
    client.cookies.clear()

    profile_resp = await client.get("/api/public/users/publicprofile")
    leaderboard_resp = await client.get("/api/public/leaderboards?limit=10")

    assert profile_resp.status_code == 200
    profile = profile_resp.json()
    assert profile["username"] == "publicprofile"
    for field in ["lp", "bp", "tp", "total_bets", "win_rate"]:
        assert field in profile
    for private_field in ["email", "llm_api_key", "llm_mode", "llm_provider"]:
        assert private_field not in profile
    assert leaderboard_resp.status_code == 200
    leaderboard = leaderboard_resp.json()
    assert "entries" in leaderboard
    assert "tp_entries" in leaderboard
    assert "total" in leaderboard


@pytest.mark.asyncio
async def test_public_api_rejects_write_methods(client: AsyncClient):
    market_id = uuid.uuid4()

    responses = [
        await client.post("/api/public/markets", json={}),
        await client.post(f"/api/public/markets/{market_id}/comments", json={}),
        await client.patch("/api/public/users/someone", json={}),
        await client.delete("/api/public/users/someone"),
    ]

    assert all(resp.status_code in {404, 405} for resp in responses)
    assert all(resp.status_code not in {200, 201} for resp in responses)


@pytest.mark.asyncio
async def test_public_api_openapi_documents_public_paths(client: AsyncClient):
    resp = await client.get("/openapi.json")

    assert resp.status_code == 200
    paths = resp.json()["paths"]
    required_paths = [
        "/api/public/markets",
        "/api/public/markets/{market_id}",
        "/api/public/markets/{market_id}/comments",
        "/api/public/markets/{market_id}/positions",
        "/api/public/markets/{market_id}/payouts",
        "/api/public/users/{username}",
        "/api/public/leaderboards",
    ]
    for path in required_paths:
        assert path in paths
        assert "get" in paths[path]
        assert "public" in paths[path]["get"]["tags"]


@pytest.mark.asyncio
async def test_public_api_rate_limit_returns_429(client: AsyncClient, monkeypatch):
    import app.services.public_rate_limit as public_rate_limit

    fake_redis = FakeRedis(decode_responses=True)
    monkeypatch.setattr(public_rate_limit, "_redis", fake_redis)
    monkeypatch.setattr(public_rate_limit, "PUBLIC_RATE_LIMIT_MAX_REQUESTS", 2)

    first = await client.get("/api/public/markets")
    second = await client.get("/api/public/markets")
    third = await client.get("/api/public/markets")

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
    assert third.headers["Retry-After"] == "60"
    await fake_redis.aclose()
