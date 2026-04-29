"""Chat service coverage for direct messaging behavior."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.db.models.social import FriendRequest, Message
from app.db.models.user import User


async def _user(db_session, username: str) -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"{username}@chat.test",
        username=username,
        password_hash="x",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.mark.asyncio
async def test_send_get_and_mark_messages_read(db_session, monkeypatch):
    import app.services.chat_service as service

    async def noop(*_args, **_kwargs):
        return None

    monkeypatch.setattr(service, "notify_new_message", noop)
    alice = await _user(db_session, "alice_chat")
    bob = await _user(db_session, "bob_chat")
    db_session.add(FriendRequest(from_user_id=alice.id, to_user_id=bob.id, status="accepted"))
    await db_session.commit()

    sent = await service.send_message(db_session, alice.id, bob.id, "  hello bob  ")
    assert sent.from_username == "alice_chat"
    assert sent.to_username == "bob_chat"
    assert sent.content == "hello bob"

    history = await service.get_messages(db_session, bob.id, alice.id)
    assert [message.content for message in history] == ["hello bob"]
    assert history[0].from_username == "alice_chat"

    count = await service.mark_messages_read(db_session, bob.id, alice.id)
    assert count == 1
    assert (await service.mark_messages_read(db_session, bob.id, alice.id)) == 0


@pytest.mark.asyncio
async def test_chat_guards_non_friend_self_missing_and_blocked(db_session):
    import app.services.chat_service as service

    alice = await _user(db_session, "alice_chat_guard")
    bob = await _user(db_session, "bob_chat_guard")
    carol = await _user(db_session, "carol_chat_guard")
    await db_session.commit()

    with pytest.raises(HTTPException) as self_msg:
        await service.send_message(db_session, alice.id, alice.id, "nope")
    assert self_msg.value.status_code == 400

    with pytest.raises(HTTPException) as missing:
        await service.get_messages(db_session, alice.id, uuid.uuid4())
    assert missing.value.status_code == 404

    with pytest.raises(HTTPException) as not_friends:
        await service.send_message(db_session, alice.id, bob.id, "hi")
    assert not_friends.value.status_code == 403

    db_session.add(FriendRequest(from_user_id=alice.id, to_user_id=carol.id, status="blocked"))
    await db_session.commit()

    with pytest.raises(HTTPException) as blocked:
        await service.get_messages(db_session, alice.id, carol.id)
    assert blocked.value.status_code == 403
    assert await service.mark_messages_read(db_session, alice.id, carol.id) == 0


@pytest.mark.asyncio
async def test_get_messages_respects_before_and_limit(db_session):
    import app.services.chat_service as service

    alice = await _user(db_session, "alice_chat_page")
    bob = await _user(db_session, "bob_chat_page")
    now = datetime.now(timezone.utc)
    db_session.add_all(
        [
            FriendRequest(from_user_id=alice.id, to_user_id=bob.id, status="accepted"),
            Message(from_user_id=alice.id, to_user_id=bob.id, content="old", sent_at=now - timedelta(hours=2)),
            Message(from_user_id=bob.id, to_user_id=alice.id, content="new", sent_at=now),
        ]
    )
    await db_session.commit()

    page = await service.get_messages(db_session, alice.id, bob.id, limit=1, before=now - timedelta(hours=1))
    assert [message.content for message in page] == ["old"]

