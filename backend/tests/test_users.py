"""User profile & search tests — PROFILE-01 through PROFILE-04."""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.db.models.transaction import BpFundEntry, TpTransaction
from app.db.models.user import User


async def _register_and_login(client: AsyncClient, email: str, username: str) -> dict:
    """Helper: register and login. Returns the registered user data."""
    resp = await client.post("/api/auth/register", json={
        "email": email, "username": username, "password": "Passw0rd!",
    })
    assert resp.status_code == 201
    await client.post("/api/auth/login", json={"identifier": email, "password": "Passw0rd!"})
    return resp.json()


# ── PROFILE-01: GET /api/users/{username} ─────────────────────────────────────

@pytest.mark.asyncio
async def test_get_profile_unknown_user(client: AsyncClient):
    """PROFILE-01: unknown username returns 404."""
    resp = await client.get("/api/users/nobody")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_profile_inactive_user(client: AsyncClient, db_session):
    """PROFILE-01: inactive user is hidden (404)."""
    await _register_and_login(client, "inactive@example.com", "inactiveuser")

    user = (await db_session.execute(
        select(User).where(User.username == "inactiveuser")
    )).scalar_one()
    user.is_active = False
    await db_session.commit()

    resp = await client.get("/api/users/inactiveuser")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_profile_success(client: AsyncClient):
    """PROFILE-01: returns profile with correct username and zero default stats."""
    await _register_and_login(client, "alice@example.com", "alice")
    resp = await client.get("/api/users/alice")
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "alice"
    assert data["total_bets"] == 0
    assert data["win_rate"] == 0.0
    assert data["lp"] == 0
    assert "mission" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_get_profile_unauthenticated_no_friendship(client: AsyncClient):
    """PROFILE-01: unauthenticated request shows is_friend=False, no friendship_status."""
    await _register_and_login(client, "bob@example.com", "bob")
    client.cookies.clear()
    resp = await client.get("/api/users/bob")
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_friend"] is False
    assert data["friendship_status"] is None


# ── PROFILE-02: PUT /api/users/me ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_mission(client: AsyncClient):
    """PROFILE-02: authenticated user can update their mission and it persists."""
    await _register_and_login(client, "carol@example.com", "carol")
    resp = await client.put("/api/users/me", json={"mission": "Hello world"})
    assert resp.status_code == 200

    profile = await client.get("/api/users/carol")
    assert profile.json()["mission"] == "Hello world"


@pytest.mark.asyncio
async def test_update_username(client: AsyncClient):
    """PROFILE-02: authenticated user can change their username."""
    await _register_and_login(client, "dan@example.com", "dan")
    resp = await client.put("/api/users/me", json={"username": "dan2"})
    assert resp.status_code == 200
    assert resp.json()["username"] == "dan2"


@pytest.mark.asyncio
async def test_update_username_conflict(client: AsyncClient):
    """PROFILE-02: taking an already-registered username returns 409."""
    await _register_and_login(client, "eve@example.com", "eve")
    await client.post("/api/auth/register", json={
        "email": "frank@example.com", "username": "frank", "password": "Passw0rd!",
    })
    resp = await client.put("/api/users/me", json={"username": "frank"})
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_update_profile_unauthenticated(client: AsyncClient):
    """PROFILE-02: unauthenticated update returns 401."""
    resp = await client.put("/api/users/me", json={"mission": "sneaky"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_my_settings_requires_auth(client: AsyncClient):
    resp = await client.get("/api/users/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_patch_my_settings_round_trip_and_hides_api_key(client: AsyncClient):
    await _register_and_login(client, "settings@example.com", "settingsuser")

    patch_resp = await client.patch(
        "/api/users/me",
        json={
            "llm_mode": "custom",
            "llm_provider": "openrouter",
            "llm_api_key": "secret-key",
            "llm_model": "openrouter/test-model",
        },
    )
    get_resp = await client.get("/api/users/me")

    assert patch_resp.status_code == 200
    assert patch_resp.json()["llm_api_key_set"] is True
    assert get_resp.status_code == 200
    assert get_resp.json() == {
        "llm_mode": "custom",
        "llm_provider": "openrouter",
        "llm_model": "openrouter/test-model",
        "llm_api_key_set": True,
    }


@pytest.mark.asyncio
async def test_patch_my_settings_empty_api_key_clears_saved_secret(client: AsyncClient):
    await _register_and_login(client, "clear-settings@example.com", "clearsettings")
    await client.patch(
        "/api/users/me",
        json={"llm_mode": "custom", "llm_provider": "openrouter", "llm_api_key": "secret-key"},
    )

    clear_resp = await client.patch("/api/users/me", json={"llm_api_key": ""})
    get_resp = await client.get("/api/users/me")

    assert clear_resp.status_code == 200
    assert clear_resp.json()["llm_api_key_set"] is False
    assert get_resp.json()["llm_api_key_set"] is False


@pytest.mark.asyncio
async def test_update_username_invalid_chars(client: AsyncClient):
    """PROFILE-02: username with URL-unsafe chars rejected with 422."""
    await _register_and_login(client, "grace@example.com", "grace")
    resp = await client.put("/api/users/me", json={"username": "gr ace/bad"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_update_mission_too_long(client: AsyncClient):
    """PROFILE-02: mission over 500 chars returns 422."""
    await _register_and_login(client, "heidi@example.com", "heidi")
    resp = await client.put("/api/users/me", json={"mission": "x" * 501})
    assert resp.status_code == 422


# ── PROFILE-03: GET /api/users/search ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_search_finds_user(client: AsyncClient):
    """PROFILE-03: prefix search returns matching active users."""
    await _register_and_login(client, "ivan@example.com", "ivan")
    client.cookies.clear()
    resp = await client.get("/api/users/search?q=iv")
    assert resp.status_code == 200
    assert any(u["username"] == "ivan" for u in resp.json())


@pytest.mark.asyncio
async def test_search_prefix_only(client: AsyncClient):
    """PROFILE-03: substring that is not a prefix should not match."""
    await _register_and_login(client, "julia@example.com", "julia")
    client.cookies.clear()
    resp = await client.get("/api/users/search?q=ulia")
    assert resp.status_code == 200
    assert not any(u["username"] == "julia" for u in resp.json())


@pytest.mark.asyncio
async def test_search_query_too_short(client: AsyncClient):
    """PROFILE-03: single-char query returns 422."""
    resp = await client.get("/api/users/search?q=a")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_search_excludes_inactive(client: AsyncClient, db_session):
    """PROFILE-03: inactive users do not appear in search results."""
    await _register_and_login(client, "karl@example.com", "karl")

    user = (await db_session.execute(
        select(User).where(User.username == "karl")
    )).scalar_one()
    user.is_active = False
    await db_session.commit()

    client.cookies.clear()
    resp = await client.get("/api/users/search?q=kar")
    assert resp.status_code == 200
    assert not any(u["username"] == "karl" for u in resp.json())


@pytest.mark.asyncio
async def test_hall_of_fame_lists_users_by_banked_bp_and_tp(client: AsyncClient, db_session):
    await _register_and_login(client, "hof1@example.com", "hof_alpha")
    await _register_and_login(client, "hof2@example.com", "hof_beta")

    alpha = (await db_session.execute(select(User).where(User.username == "hof_alpha"))).scalar_one()
    beta = (await db_session.execute(select(User).where(User.username == "hof_beta"))).scalar_one()

    db_session.add_all([
        BpFundEntry(market_id=uuid.uuid4(), user_id=alpha.id, amount=12.5, reason="numeric_cap_surplus"),
        BpFundEntry(market_id=uuid.uuid4(), user_id=alpha.id, amount=2.5, reason="cap_surplus"),
        BpFundEntry(market_id=uuid.uuid4(), user_id=beta.id, amount=9.0, reason="cap_surplus"),
        BpFundEntry(market_id=uuid.uuid4(), user_id=beta.id, amount=99.0, reason="numeric_surplus"),
        TpTransaction(user_id=beta.id, amount=3.25, bet_id=uuid.uuid4()),
        TpTransaction(user_id=alpha.id, amount=1.0, bet_id=uuid.uuid4()),
        TpTransaction(user_id=beta.id, amount=2.25, bet_id=uuid.uuid4()),
    ])
    await db_session.commit()

    client.cookies.clear()
    resp = await client.get("/api/users/hall-of-fame")
    assert resp.status_code == 200

    data = resp.json()
    assert data["total"] == 2
    assert data["entries"][0]["username"] == "hof_alpha"
    assert data["entries"][0]["banked_bp"] == 15.0
    assert data["entries"][1]["username"] == "hof_beta"
    assert data["entries"][1]["banked_bp"] == 9.0
    assert data["tp_entries"][0]["username"] == "hof_beta"
    assert data["tp_entries"][0]["truth_points"] == 5.5
    assert data["tp_entries"][0]["markets_count"] == 2
    assert data["tp_entries"][1]["username"] == "hof_alpha"
    assert data["tp_entries"][1]["truth_points"] == 1.0


def test_models_package_exports_bp_fund_entry():
    """Alembic metadata import must include BpFundEntry."""
    from app.db.models import BpFundEntry

    assert BpFundEntry.__tablename__ == "bp_fund_entries"


# ── PROFILE-04: friendship status on profile ──────────────────────────────────

@pytest.mark.asyncio
async def test_friendship_status_pending_after_request(client: AsyncClient):
    """PROFILE-04: after sending a friend request, target profile shows 'pending'."""
    await _register_and_login(client, "aaa@example.com", "aaa")
    bob = await client.post("/api/auth/register", json={
        "email": "bbb@example.com", "username": "bbb", "password": "Passw0rd!",
    })
    bob_id = bob.json()["id"]

    fr = await client.post(f"/api/friends/request/{bob_id}")
    assert fr.status_code in (200, 201)

    resp = await client.get("/api/users/bbb")
    assert resp.status_code == 200
    data = resp.json()
    assert data["friendship_status"] == "pending"
    assert data["is_friend"] is False


# ── Schema validation (username constraints) ──────────────────────────────────

@pytest.mark.asyncio
async def test_register_username_too_short(client: AsyncClient):
    """Registration rejects usernames under 3 characters."""
    resp = await client.post("/api/auth/register", json={
        "email": "xy@example.com", "username": "xy", "password": "Passw0rd!",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_username_invalid_chars(client: AsyncClient):
    """Registration rejects usernames with spaces or slashes."""
    resp = await client.post("/api/auth/register", json={
        "email": "bad@example.com", "username": "bad name!", "password": "Passw0rd!",
    })
    assert resp.status_code == 422
