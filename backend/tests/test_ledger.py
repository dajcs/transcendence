"""Tests for GET /api/users/{username}/transactions ledger endpoint."""
import re
from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.db.models.transaction import BpTransaction, LpEvent
from app.db.models.user import User


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


@pytest.mark.asyncio
async def test_daily_bonus_transactions_include_login_date_description(client: AsyncClient):
    await _register_and_login(client, "daily_bonus_user")

    resp = await client.get("/api/users/daily_bonus_user/transactions")
    assert resp.status_code == 200

    daily_bonus_rows = [
        tx for tx in resp.json()["transactions"]
        if tx["type"] == "daily_bonus"
    ]
    assert daily_bonus_rows, "Expected at least one daily bonus row in the ledger"
    assert all(
        isinstance(tx["description"], str)
        and re.fullmatch(r"\d{4}-\d{2}-\d{2}", tx["description"])
        for tx in daily_bonus_rows
    )


@pytest.mark.asyncio
async def test_lp_conversion_transaction_description_uses_converted_lp(
    client: AsyncClient,
    db_session,
):
    reg = await client.post("/api/auth/register", json={
        "email": "lpdesc@example.com",
        "username": "lpdesc",
        "password": "TestPass123!",
    })
    assert reg.status_code == 201

    user = (
        await db_session.execute(select(User).where(User.username == "lpdesc"))
    ).scalar_one()
    db_session.add(LpEvent(
        user_id=user.id,
        amount=21,
        source_type="comment_upvote",
        source_id=user.id,
        day_date=date.today(),
    ))
    await db_session.commit()

    login = await client.post("/api/auth/login", json={
        "email": "lpdesc@example.com",
        "password": "TestPass123!",
    })
    assert login.status_code == 200

    resp = await client.get("/api/users/lpdesc/transactions")
    assert resp.status_code == 200

    lp_rows = [
        tx for tx in resp.json()["transactions"]
        if tx["type"] == "lp_allocation" and tx["bp_delta"] > 0
    ]
    assert lp_rows, "Expected an LP conversion row in the ledger"
    assert lp_rows[0]["description"] == "21 ❤️"


@pytest.mark.asyncio
async def test_market_creation_transaction_uses_market_type_and_link_metadata(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "ledgermarket@example.com",
        "username": "ledgermarket",
        "password": "Passw0rd!",
    })
    await client.post("/api/auth/login", json={
        "identifier": "ledgermarket@example.com",
        "password": "Passw0rd!",
    })

    create = await client.post("/api/markets", json={
        "title": "Ledger market link",
        "description": "desc",
        "resolution_criteria": "criteria",
        "deadline": "2027-01-01T00:00:00Z",
    })
    assert create.status_code == 201
    market = create.json()

    resp = await client.get("/api/users/ledgermarket/transactions")
    assert resp.status_code == 200

    market_rows = [
        tx for tx in resp.json()["transactions"]
        if tx["type"] == "market"
    ]
    assert market_rows, "Expected a market creation row in the ledger"

    tx = market_rows[0]
    assert tx["market_id"] == market["id"]
    assert tx["market_title"] == "Ledger market link"
    assert tx["description"] == "Ledger market link"


@pytest.mark.asyncio
async def test_withdrawal_refund_transaction_uses_bet_refund_type(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "ledgerrefund@example.com",
        "username": "ledgerrefund",
        "password": "Passw0rd!",
    })
    await client.post("/api/auth/login", json={
        "identifier": "ledgerrefund@example.com",
        "password": "Passw0rd!",
    })

    create = await client.post("/api/markets", json={
        "title": "Refund ledger market",
        "description": "desc",
        "resolution_criteria": "criteria",
        "deadline": "2027-01-01T00:00:00Z",
    })
    assert create.status_code == 201

    place = await client.post("/api/bets", json={
        "bet_id": create.json()["id"],
        "side": "yes",
        "amount": 1,
    })
    assert place.status_code == 201

    withdraw = await client.delete(f"/api/bets/{place.json()['id']}")
    assert withdraw.status_code == 200

    resp = await client.get("/api/users/ledgerrefund/transactions")
    assert resp.status_code == 200

    refund_rows = [
        tx for tx in resp.json()["transactions"]
        if tx["type"] == "bet_refund"
    ]
    assert refund_rows, "Expected a bet refund row in the ledger"


@pytest.mark.asyncio
async def test_dispute_vote_transaction_uses_dispute_type(client: AsyncClient, db_session):
    await _register_and_login(client, "ledgerdispute")

    user = (
        await db_session.execute(select(User).where(User.username == "ledgerdispute"))
    ).scalar_one()
    db_session.add(BpTransaction(user_id=user.id, amount=-1.0, reason="dispute_vote"))
    await db_session.commit()

    resp = await client.get("/api/users/ledgerdispute/transactions")
    assert resp.status_code == 200

    dispute_rows = [
        tx for tx in resp.json()["transactions"]
        if tx["bp_delta"] == -1.0
    ]
    assert dispute_rows, "Expected a dispute cost row in the ledger"
    assert dispute_rows[0]["type"] == "dispute"
