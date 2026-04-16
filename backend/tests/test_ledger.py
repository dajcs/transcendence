"""Tests for GET /api/users/{username}/transactions ledger endpoint."""
import pytest
from httpx import AsyncClient


async def _register_and_login(client: AsyncClient, username: str = "ledgeruser") -> dict:
    reg = await client.post("/api/auth/register", json={
        "email": f"{username}@test.com",
        "username": username,
        "password": "TestPass123!",
    })
    assert reg.status_code == 201
    login = await client.post("/api/auth/login", json={
        "email": f"{username}@test.com",
        "password": "TestPass123!",
    })
    assert login.status_code == 200
    return login.cookies


@pytest.mark.asyncio
async def test_get_user_transactions_empty(client: AsyncClient):
    """New user ledger returns 200 with correct structure (signup_bonus creates at least one entry)."""
    await _register_and_login(client, "empty_ledger_user")
    resp = await client.get("/api/users/empty_ledger_user/transactions")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data["transactions"], list)
    assert isinstance(data["total"], int)
    assert data["total"] >= 0


@pytest.mark.asyncio
async def test_transactions_public(client: AsyncClient):
    """Endpoint is fully public — no auth cookie should still return 200."""
    await _register_and_login(client, "pub_ledger_user")
    # Make request with no cookies
    resp = await client.get("/api/users/pub_ledger_user/transactions", cookies={})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_transactions_unknown_user(client: AsyncClient):
    """Unknown username returns 404."""
    resp = await client.get("/api/users/nonexistent_user_xyz/transactions")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_transactions_pagination(client: AsyncClient):
    """offset + limit params accepted; response has correct structure."""
    await _register_and_login(client, "pag_ledger_user")
    resp = await client.get(
        "/api/users/pag_ledger_user/transactions",
        params={"offset": 0, "limit": 10},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "transactions" in data
    assert isinstance(data["transactions"], list)
    assert isinstance(data["total"], int)


@pytest.mark.asyncio
async def test_transactions_sort_params(client: AsyncClient):
    """sort_by=date&sort_dir=asc accepted; sort_by=invalid returns 422."""
    await _register_and_login(client, "sort_ledger_user")
    ok = await client.get(
        "/api/users/sort_ledger_user/transactions",
        params={"sort_by": "date", "sort_dir": "asc"},
    )
    assert ok.status_code == 200

    bad = await client.get(
        "/api/users/sort_ledger_user/transactions",
        params={"sort_by": "invalid"},
    )
    assert bad.status_code == 422
