"""Auth integration tests — AUTH-01 through AUTH-04."""
import uuid
import pytest
from httpx import AsyncClient
from fastapi import HTTPException
from starlette.requests import Request
from unittest.mock import AsyncMock, patch
from app.db.models.user import User


# ── AUTH-01: Registration ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register(client: AsyncClient):
    resp = await client.post("/api/auth/register", json={
        "email": "alice@example.com",
        "username": "alice",
        "password": "Passw0rd!",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "alice@example.com"
    assert data["username"] == "alice"
    assert "password_hash" not in data


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    payload = {"email": "bob@example.com", "username": "bob1", "password": "Passw0rd!"}
    await client.post("/api/auth/register", json=payload)
    payload2 = {"email": "bob@example.com", "username": "bob2", "password": "Passw0rd!"}
    resp = await client.post("/api/auth/register", json=payload2)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_register_weak_password(client: AsyncClient):
    resp = await client.post("/api/auth/register", json={
        "email": "weak@example.com",
        "username": "weakuser",
        "password": "short",
    })
    assert resp.status_code == 422


# ── AUTH-02: Login + cookies ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_sets_cookies(client: AsyncClient):
    # Register first
    await client.post("/api/auth/register", json={
        "email": "carol@example.com", "username": "carol", "password": "Passw0rd!",
    })
    # Login
    resp = await client.post("/api/auth/login", json={
        "identifier": "carol@example.com", "password": "Passw0rd!",
    })
    assert resp.status_code == 200
    cookies = resp.headers.get("set-cookie", "")
    assert "access_token" in cookies
    assert "refresh_token" in cookies
    assert "httponly" in cookies.lower()
    assert "path=/api/auth/refresh" in cookies.lower()


@pytest.mark.asyncio
async def test_login_invalid_credentials(client: AsyncClient):
    resp = await client.post("/api/auth/login", json={
        "identifier": "nobody@example.com", "password": "Wrongpass1",
    })
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid credentials"


@pytest.mark.asyncio
async def test_login_with_username(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "eve@example.com", "username": "eve", "password": "Passw0rd!",
    })
    resp = await client.post("/api/auth/login", json={
        "identifier": "eve", "password": "Passw0rd!",
    })
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_login_with_username_in_legacy_email_field(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "frank@example.com", "username": "frank", "password": "Passw0rd!",
    })
    resp = await client.post("/api/auth/login", json={
        "email": "frank", "password": "Passw0rd!",
    })
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_login_oauth_only_account_returns_guidance(client: AsyncClient, db_session):
    oauth_only_user = User(
        id=uuid.uuid4(),
        email="oauth-only@example.com",
        username="oauth_only",
        password_hash=None,
        is_active=True,
    )
    db_session.add(oauth_only_user)
    await db_session.commit()

    resp = await client.post("/api/auth/login", json={
        "identifier": "oauth-only@example.com",
        "password": "Passw0rd!",
    })

    assert resp.status_code == 401
    assert "OAuth sign-in" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_oauth_providers_endpoint_returns_configured_providers(client: AsyncClient, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "google_client_id", "google-id")
    monkeypatch.setattr(settings, "github_client_id", "github-id")
    monkeypatch.setattr(settings, "ft_client_id", "ft-id")

    resp = await client.get("/api/auth/oauth/providers")
    assert resp.status_code == 200
    assert resp.json() == {"providers": ["google", "github", "42"]}


def _build_request(host: str, scheme: str = "https") -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/auth/oauth/42",
            "headers": [(b"host", host.encode())],
            "scheme": scheme,
            "client": ("127.0.0.1", 12345),
        }
    )


def test_resolve_oauth_redirect_base_prefers_forwarded_proto_when_unset(monkeypatch):
    from app.api.routes.auth import _resolve_oauth_redirect_base
    from app.config import settings

    monkeypatch.setattr(settings, "oauth_redirect_base", "")
    monkeypatch.setattr(settings, "allowed_hosts", "localhost,voxpopuli.local")

    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/auth/oauth/42",
            "headers": [
                (b"host", b"localhost:8443"),
                (b"x-forwarded-proto", b"https"),
            ],
            "scheme": "http",
            "client": ("127.0.0.1", 12345),
        }
    )

    assert _resolve_oauth_redirect_base(request) == "https://localhost:8443"


@pytest.mark.asyncio
async def test_oauth_initiate_uses_request_host_when_redirect_base_unset(monkeypatch):
    from app.api.routes.auth import oauth_initiate
    from app.config import settings

    monkeypatch.setattr(settings, "oauth_redirect_base", "")
    monkeypatch.setattr(settings, "allowed_hosts", "localhost,voxpopuli.local")

    with patch("app.api.routes.auth.oauth_service.build_authorize_url", new=AsyncMock(return_value="https://provider.example/auth")) as mock_build:
        resp = await oauth_initiate("42", _build_request("voxpopuli.local:8443"))

    assert resp.status_code == 307
    mock_build.assert_awaited_once_with("42", redirect_base="https://voxpopuli.local:8443")


@pytest.mark.asyncio
async def test_oauth_initiate_uses_configured_redirect_base_when_set(monkeypatch):
    from app.api.routes.auth import oauth_initiate
    from app.config import settings

    monkeypatch.setattr(settings, "oauth_redirect_base", "https://auth.voxpopuli.test")
    monkeypatch.setattr(settings, "allowed_hosts", "localhost,voxpopuli.local")

    with patch("app.api.routes.auth.oauth_service.build_authorize_url", new=AsyncMock(return_value="https://provider.example/auth")) as mock_build:
        resp = await oauth_initiate("42", _build_request("voxpopuli.local:8443"))

    assert resp.status_code == 307
    mock_build.assert_awaited_once_with("42", redirect_base="https://auth.voxpopuli.test")


@pytest.mark.asyncio
async def test_oauth_initiate_rejects_invalid_host_when_redirect_base_unset(monkeypatch):
    from app.api.routes.auth import oauth_initiate
    from app.config import settings

    monkeypatch.setattr(settings, "oauth_redirect_base", "")
    monkeypatch.setattr(settings, "allowed_hosts", "localhost,voxpopuli.local")

    with pytest.raises(HTTPException, match="Invalid host header"):
        await oauth_initiate("42", _build_request("evil.example:8443"))


@pytest.mark.asyncio
async def test_oauth_callback_uses_request_host_when_redirect_base_unset(monkeypatch):
    from app.api.routes.auth import oauth_callback
    from app.config import settings

    monkeypatch.setattr(settings, "oauth_redirect_base", "")
    monkeypatch.setattr(settings, "allowed_hosts", "localhost,voxpopuli.local")

    with patch(
        "app.api.routes.auth.oauth_service.handle_callback",
        new=AsyncMock(return_value=(object(), "access-token", "refresh-token")),
    ) as mock_handle:
        resp = await oauth_callback(
            "42",
            _build_request("voxpopuli.local:8443"),
            code="test-code",
            state="test-state",
            db=None,
        )

    assert resp.status_code == 302
    mock_handle.assert_awaited_once()
    assert mock_handle.await_args.kwargs["redirect_base"] == "https://voxpopuli.local:8443"


@pytest.mark.asyncio
async def test_oauth_callback_invalid_host_redirects_to_login_error(monkeypatch):
    from app.api.routes.auth import oauth_callback
    from app.config import settings

    monkeypatch.setattr(settings, "oauth_redirect_base", "")
    monkeypatch.setattr(settings, "allowed_hosts", "localhost,voxpopuli.local")

    resp = await oauth_callback(
        "42",
        _build_request("evil.example:8443"),
        code="test-code",
        state="test-state",
        db=None,
    )

    assert resp.status_code == 302
    assert resp.headers["location"] == "/login?error=Invalid%20host%20header"


# ── AUTH-03: Password reset no enumeration ────────────────────────────────

@pytest.mark.asyncio
async def test_password_reset_no_enumeration(client: AsyncClient):
    """Unknown email must return 200, not 404."""
    resp = await client.post("/api/auth/reset-request", json={"email": "unknown@example.com"})
    assert resp.status_code == 200


# ── AUTH-04: Refresh token rotation ──────────────────────────────────────

@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_authenticated(client: AsyncClient):
    """Register, login, then /me returns the authenticated user."""
    await client.post("/api/auth/register", json={
        "email": "dave@example.com", "username": "dave", "password": "Passw0rd!",
    })
    await client.post("/api/auth/login", json={
        "identifier": "dave@example.com", "password": "Passw0rd!",
    })
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 200
    assert resp.json()["email"] == "dave@example.com"
    assert resp.json()["username"] == "dave"


@pytest.mark.asyncio
async def test_refresh_rotation(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "refresh@example.com", "username": "refreshuser", "password": "Passw0rd!",
    })
    login_resp = await client.post("/api/auth/login", json={
        "identifier": "refresh@example.com", "password": "Passw0rd!",
    })
    old_refresh = client.cookies.get("refresh_token")

    resp = await client.post("/api/auth/refresh")

    assert login_resp.status_code == 200
    assert old_refresh
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    assert client.cookies.get("refresh_token")
    assert client.cookies.get("access_token")


@pytest.mark.asyncio
async def test_logout_clears_cookies_and_revokes_authenticated_session(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "logout@example.com", "username": "logoutuser", "password": "Passw0rd!",
    })
    await client.post("/api/auth/login", json={
        "identifier": "logout@example.com", "password": "Passw0rd!",
    })

    resp = await client.post("/api/auth/logout")

    assert resp.status_code == 200
    set_cookie = resp.headers.get("set-cookie", "").lower()
    assert "access_token=\"\"" in set_cookie
    assert "refresh_token=\"\"" in set_cookie
    assert (await client.get("/api/auth/me")).status_code == 401
