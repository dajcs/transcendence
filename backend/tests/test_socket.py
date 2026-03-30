"""Socket.IO unit tests for RT-01, RT-02, RT-03.

Uses unittest.mock.AsyncMock to patch sio.emit — no live socket server needed.
Redis throttle key covered by fakeredis.
"""
import uuid

import pytest
from unittest.mock import AsyncMock, patch


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
    async def test_bet_emits_odds(self, db_session, rsa_key_pair, monkeypatch, patch_jwt_key_paths):
        """place_bet() emits bet:odds_updated to bet:{id} room after commit."""
        from datetime import date, timezone
        from fakeredis.aioredis import FakeRedis
        from app.db.models.user import User
        from app.db.models.bet import Bet
        from app.db.models.transaction import KpEvent, BpTransaction
        from app.services.bet_service import place_bet
        from app.schemas.bet import BetPlaceRequest
        from app.socket.server import sio

        from datetime import datetime, timedelta
        user_id = uuid.uuid4()
        bet_id = uuid.uuid4()
        user = User(id=user_id, email="u@t.com", username="tester", password_hash="x")
        bet = Bet(id=bet_id, proposer_id=user_id, title="T", description="D",
                  resolution_criteria="C", status="open", market_type="binary",
                  deadline=datetime.now(timezone.utc) + timedelta(days=1))
        # Give user enough bp balance and kp (for bet cap check)
        bp_tx = BpTransaction(user_id=user_id, amount=10.0, reason="signup")
        kp_event = KpEvent(user_id=user_id, amount=0, source_type="signup",
                           source_id=user_id, day_date=date.today())
        db_session.add_all([user, bet, bp_tx, kp_event])
        await db_session.commit()

        fake_redis = FakeRedis(decode_responses=True)

        with patch("app.services.bet_service.aioredis.from_url", return_value=fake_redis), \
             patch.object(sio, "emit", new_callable=AsyncMock) as mock_emit:
            await place_bet(db_session, user_id, BetPlaceRequest(bet_id=bet_id, side="yes", amount=1))

        calls = [str(c) for c in mock_emit.call_args_list]
        assert any("bet:odds_updated" in c for c in calls), f"Expected bet:odds_updated in {calls}"

    @pytest.mark.asyncio
    async def test_odds_throttle(self, db_session, patch_jwt_key_paths):
        """Second place_bet within 500ms throttle window skips bet:odds_updated emit."""
        from fakeredis.aioredis import FakeRedis
        from app.services.bet_service import _emit_odds_update
        from app.socket.server import sio

        fake_redis = FakeRedis(decode_responses=True)
        bet_id = uuid.uuid4()

        # Pre-set the throttle key so the window is active
        await fake_redis.set(f"throttle:odds:{bet_id}", "1", px=500)

        # Patch _get_redis directly — the singleton may already be set from a prior test,
        # so patching aioredis.from_url wouldn't route to our fake instance.
        with patch("app.services.bet_service._get_redis", return_value=fake_redis), \
             patch.object(sio, "emit", new_callable=AsyncMock) as mock_emit:
            await _emit_odds_update(db_session, bet_id)

        mock_emit.assert_not_called()


class TestCommentEmits:
    """RT-02: create_comment emits bet:comment_added."""

    @pytest.mark.asyncio
    async def test_comment_emits(self, db_session, patch_jwt_key_paths):
        """create_comment() emits bet:comment_added to bet:{id} room."""
        from app.db.models.user import User
        from app.db.models.bet import Bet
        from app.services.comment_service import create_comment
        from app.schemas.comment import CommentCreate
        from app.socket.server import sio

        user_id = uuid.uuid4()
        bet_id = uuid.uuid4()
        from datetime import datetime, timezone, timedelta
        user = User(id=user_id, email="c@t.com", username="commenter", password_hash="x")
        bet = Bet(id=bet_id, proposer_id=user_id, title="T", description="D",
                  resolution_criteria="C", status="open", market_type="binary",
                  deadline=datetime.now(timezone.utc) + timedelta(days=1))
        db_session.add_all([user, bet])
        await db_session.commit()

        with patch.object(sio, "emit", new_callable=AsyncMock) as mock_emit:
            await create_comment(db_session, user_id, bet_id, CommentCreate(content="hello", parent_id=None))

        calls = [str(c) for c in mock_emit.call_args_list]
        assert any("bet:comment_added" in c for c in calls), f"Expected bet:comment_added in {calls}"


class TestNotificationEmits:
    """RT-03: create_notification emits notification:{type}."""

    @pytest.mark.asyncio
    async def test_notification_emits(self, db_session, patch_jwt_key_paths):
        """create_notification() emits notification:{type} to user:{id} room."""
        from app.db.models.user import User
        from app.services.notification_service import create_notification
        from app.socket.server import sio

        user_id = uuid.uuid4()
        user = User(id=user_id, email="n@t.com", username="notifuser", password_hash="x")
        db_session.add(user)
        await db_session.commit()

        with patch.object(sio, "emit", new_callable=AsyncMock) as mock_emit:
            await create_notification(db_session, user_id, "friend_request", {"from_username": "alice"})

        calls = [str(c) for c in mock_emit.call_args_list]
        assert any("notification:friend_request" in c for c in calls), f"Expected notification:friend_request in {calls}"
