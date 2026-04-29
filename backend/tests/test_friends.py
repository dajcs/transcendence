"""Friend service coverage for request, accept, decline, block, and list behavior."""
import uuid

import pytest
from fastapi import HTTPException

from app.db.models.social import FriendRequest
from app.db.models.user import User


async def _user(db_session, username: str) -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"{username}@friends.test",
        username=username,
        password_hash="x",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.mark.asyncio
async def test_friend_request_accept_decline_block_and_unblock(db_session, monkeypatch):
    import app.services.friend_service as service

    async def noop(*_args, **_kwargs):
        return None

    monkeypatch.setattr(service, "notify_friend_request", noop)
    monkeypatch.setattr(service, "notify_friend_accepted", noop)
    monkeypatch.setattr(service, "notify_friend_removed", noop)

    alice = await _user(db_session, "alice_friend")
    bob = await _user(db_session, "bob_friend")
    carol = await _user(db_session, "carol_friend")
    await db_session.commit()

    req = await service.send_friend_request(db_session, alice.id, bob.id)
    assert req.status == "pending"
    assert req.from_username == "alice_friend"

    with pytest.raises(HTTPException) as duplicate:
        await service.send_friend_request(db_session, alice.id, bob.id)
    assert duplicate.value.status_code == 409

    accepted = await service.accept_friend_request(db_session, req.id, bob.id)
    assert accepted.status == "accepted"
    assert await service.are_friends(db_session, alice.id, bob.id) is True

    friends = await service.get_friends_list(db_session, alice.id)
    assert [friend.username for friend in friends.friends] == ["bob_friend"]

    await service.remove_friend(db_session, alice.id, bob.id)
    assert await service.are_friends(db_session, alice.id, bob.id) is False

    declined_req = await service.send_friend_request(db_session, carol.id, alice.id)
    declined = await service.reject_friend_request(db_session, declined_req.id, alice.id)
    assert declined.status == "declined"

    resent = await service.send_friend_request(db_session, carol.id, alice.id)
    assert resent.status == "pending"
    await service.cancel_friend_request(db_session, resent.id, carol.id)

    await service.block_user(db_session, alice.id, carol.id)
    assert await service.is_blocked(db_session, alice.id, carol.id) is True
    blocked_list = await service.get_friends_list(db_session, alice.id)
    assert [blocked.username for blocked in blocked_list.blocked] == ["carol_friend"]

    with pytest.raises(HTTPException) as blocked:
        await service.send_friend_request(db_session, carol.id, alice.id)
    assert blocked.value.status_code == 403

    await service.unblock_user(db_session, alice.id, carol.id)
    assert await service.is_blocked(db_session, alice.id, carol.id) is False


@pytest.mark.asyncio
async def test_friend_service_rejects_wrong_actor_and_self_actions(db_session):
    import app.services.friend_service as service

    alice = await _user(db_session, "alice_guard")
    bob = await _user(db_session, "bob_guard")
    carol = await _user(db_session, "carol_guard")
    await db_session.commit()

    with pytest.raises(HTTPException) as self_req:
        await service.send_friend_request(db_session, alice.id, alice.id)
    assert self_req.value.status_code == 400

    req = FriendRequest(from_user_id=alice.id, to_user_id=bob.id, status="pending")
    db_session.add(req)
    await db_session.commit()

    with pytest.raises(HTTPException) as wrong_acceptor:
        await service.accept_friend_request(db_session, req.id, carol.id)
    assert wrong_acceptor.value.status_code == 403

    with pytest.raises(HTTPException) as wrong_cancel:
        await service.cancel_friend_request(db_session, req.id, bob.id)
    assert wrong_cancel.value.status_code == 403

    with pytest.raises(HTTPException) as wrong_decline:
        await service.reject_friend_request(db_session, req.id, carol.id)
    assert wrong_decline.value.status_code == 403
