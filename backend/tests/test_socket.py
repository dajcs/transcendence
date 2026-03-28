"""Socket.IO unit tests for RT-01, RT-02, RT-03.

Uses unittest.mock.AsyncMock to patch sio.emit — no live socket server needed.
Redis throttle key covered by fakeredis fixture from conftest.py.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


class TestConnectAuth:
    """RT-01..03: connect handler authenticates via cookie."""

    @pytest.mark.asyncio
    async def test_connect_auth_valid_token(self, rsa_key_pair, monkeypatch):
        """Valid access_token cookie → session saved, user room joined."""
        from app.utils.jwt import create_access_token
        from app.config import settings
        priv_path, pub_path = rsa_key_pair
        monkeypatch.setattr(settings, "jwt_private_key_path", priv_path)
        monkeypatch.setattr(settings, "jwt_public_key_path", pub_path)

        token = create_access_token("user-123", "test@test.com", "testuser")
        cookie_header = f"access_token={token}".encode()

        environ = {
            "asgi.scope": {
                "headers": [(b"cookie", cookie_header)],
            }
        }

        from app.socket.server import sio
        with patch.object(sio, "save_session", new_callable=AsyncMock) as mock_save, \
             patch.object(sio, "enter_room", new_callable=AsyncMock) as mock_enter:
            from app.socket.events import on_connect
            await on_connect("sid-abc", environ, None)
            mock_save.assert_called_once_with("sid-abc", {"user_id": "user-123"})
            assert any("user:user-123" in str(c) for c in mock_enter.call_args_list)

    @pytest.mark.asyncio
    async def test_connect_auth_missing_cookie(self):
        """No cookie → ConnectionRefusedError."""
        environ = {"asgi.scope": {"headers": []}}
        from app.socket.events import on_connect
        with pytest.raises(ConnectionRefusedError, match="authentication required"):
            await on_connect("sid-xyz", environ, None)

    @pytest.mark.asyncio
    async def test_connect_auth_invalid_token(self):
        """Tampered token → ConnectionRefusedError."""
        environ = {
            "asgi.scope": {
                "headers": [(b"cookie", b"access_token=not.a.valid.jwt")],
            }
        }
        from app.socket.events import on_connect
        with pytest.raises(ConnectionRefusedError, match="invalid token"):
            await on_connect("sid-xyz", environ, None)


class TestBetEmits:
    """RT-01: place_bet and withdraw_bet emit bet:odds_updated."""

    @pytest.mark.asyncio
    async def test_bet_emits_odds(self, db_session):
        """place_bet() emits bet:odds_updated to bet:{id} room after commit."""
        pytest.skip("Wired in plan 04-02")

    @pytest.mark.asyncio
    async def test_odds_throttle(self, db_session):
        """Second place_bet within 500ms does not emit bet:odds_updated again."""
        pytest.skip("Wired in plan 04-02")


class TestCommentEmits:
    """RT-02: create_comment emits bet:comment_added."""

    @pytest.mark.asyncio
    async def test_comment_emits(self, db_session):
        """create_comment() emits bet:comment_added to bet:{id} room."""
        pytest.skip("Wired in plan 04-02")


class TestNotificationEmits:
    """RT-03: create_notification emits notification:{type}."""

    @pytest.mark.asyncio
    async def test_notification_emits(self, db_session):
        """create_notification() emits notification:{type} to user:{id} room."""
        pytest.skip("Wired in plan 04-02")
