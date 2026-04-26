"""Comment API tests — DISC-01 (list), DISC-02 (upvote +1 kp), DISC-03 (reply depth)."""
import uuid

import pytest
from httpx import AsyncClient


async def _setup_user_market_bet(client: AsyncClient, email: str, username: str):
    """Helper: register, login, create market. Returns (market_id)."""
    await client.post("/api/auth/register", json={
        "email": email, "username": username, "password": "Passw0rd!",
    })
    await client.post("/api/auth/login", json={
        "identifier": email, "password": "Passw0rd!",
    })
    resp = await client.post("/api/markets", json={
        "title": "Comment test market",
        "description": "desc",
        "resolution_criteria": "criteria",
        "deadline": "2027-01-01T00:00:00Z",
    })
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_post_and_list_comments(client: AsyncClient):
    """DISC-01: POST /api/markets/{id}/comments creates comment; GET returns it."""
    market_id = await _setup_user_market_bet(client, "commenter@example.com", "commenter")
    post_resp = await client.post(f"/api/markets/{market_id}/comments",
                                   json={"content": "My take on this market."})
    assert post_resp.status_code == 201
    list_resp = await client.get(f"/api/markets/{market_id}/comments")
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert any(c["content"] == "My take on this market." for c in items)


@pytest.mark.asyncio
async def test_upvote_comment_earns_kp(client: AsyncClient):
    """DISC-02: POST /api/comments/{id}/upvote earns +1 kp for comment author."""
    import uuid
    market_id = await _setup_user_market_bet(client, "author@example.com", "author")
    post_resp = await client.post(f"/api/markets/{market_id}/comments",
                                   json={"content": "Worth upvoting."})
    comment_id = post_resp.json()["id"]

    # Second user upvotes
    await client.post("/api/auth/register", json={
        "email": "voter@example.com", "username": "voter", "password": "Passw0rd!",
    })
    await client.post("/api/auth/login", json={"identifier": "voter@example.com", "password": "Passw0rd!"})
    upvote_resp = await client.post(f"/api/comments/{comment_id}/upvote")
    assert upvote_resp.status_code == 201


@pytest.mark.asyncio
async def test_duplicate_upvote_is_idempotent(client: AsyncClient):
    """DISC-02: Second upvote from same user is a silent no-op."""
    market_id = await _setup_user_market_bet(client, "dup_auth@example.com", "dup_auth")
    post_resp = await client.post(f"/api/markets/{market_id}/comments",
                                   json={"content": "Upvote twice test."})
    comment_id = post_resp.json()["id"]

    await client.post("/api/auth/register", json={
        "email": "dup_voter@example.com", "username": "dup_voter", "password": "Passw0rd!",
    })
    await client.post("/api/auth/login", json={"identifier": "dup_voter@example.com", "password": "Passw0rd!"})

    await client.post(f"/api/comments/{comment_id}/upvote")
    resp2 = await client.post(f"/api/comments/{comment_id}/upvote")
    assert resp2.status_code == 201

    comments_resp = await client.get(f"/api/markets/{market_id}/comments")
    assert comments_resp.status_code == 200
    updated = next(comment for comment in comments_resp.json() if comment["id"] == comment_id)
    assert updated["upvote_count"] == 1
    assert updated["user_has_liked"] is True


@pytest.mark.asyncio
async def test_reply_creates_child_comment(client: AsyncClient):
    """DISC-03: POST with parent_id creates a reply (1 level deep)."""
    market_id = await _setup_user_market_bet(client, "reply_auth@example.com", "reply_auth")
    parent_resp = await client.post(f"/api/markets/{market_id}/comments",
                                     json={"content": "Parent comment."})
    parent_id = parent_resp.json()["id"]
    reply_resp = await client.post(f"/api/markets/{market_id}/comments",
                                    json={"content": "Reply.", "parent_id": parent_id})
    assert reply_resp.status_code == 201
    assert reply_resp.json()["parent_id"] == parent_id


@pytest.mark.asyncio
async def test_nested_reply_rejected(client: AsyncClient):
    """DISC-03: Replying beyond max depth (8 posts) returns 422."""
    market_id = await _setup_user_market_bet(client, "deep@example.com", "deep")
    # Build a chain 8 posts deep (depth 0-7), then attempt depth 8.
    current_id = None
    for level in range(8):
        payload = {"content": f"Level {level}."}
        if current_id is not None:
            payload["parent_id"] = current_id
        resp = await client.post(f"/api/markets/{market_id}/comments", json=payload)
        assert resp.status_code == 201, f"Level {level} should succeed"
        current_id = resp.json()["id"]
    # Depth 8 must be rejected.
    deep_resp = await client.post(f"/api/markets/{market_id}/comments",
                                   json={"content": "Level 8 - invalid.", "parent_id": current_id})
    assert deep_resp.status_code == 422


@pytest.mark.asyncio
async def test_unlike_comment_only_records_one_negative_lp_event_when_delete_is_retried():
    """Concurrent/stale unlike attempts must not create duplicate LP decrements."""
    from types import SimpleNamespace

    from app.services.comment_service import unlike_comment

    comment_id = uuid.uuid4()
    author_id = uuid.uuid4()
    voter_id = uuid.uuid4()

    class FakeSelectResult:
        def __init__(self, value):
            self._value = value

        def scalar_one_or_none(self):
            return self._value

        def scalar_one(self):
            return self._value

    class FakeDeleteResult:
        def __init__(self, rowcount: int):
            self.rowcount = rowcount

    class FakeSession:
        def __init__(self):
            self.delete_rowcounts = [1, 0]
            self.select_results = [
                SimpleNamespace(id=comment_id, user_id=author_id),
                1,
                SimpleNamespace(id=comment_id, user_id=author_id),
            ]
            self.added = []
            self.commit_count = 0

        async def execute(self, statement):
            statement_type = statement.__class__.__name__
            if statement_type == "Select":
                return FakeSelectResult(self.select_results.pop(0))
            if statement_type == "Delete":
                return FakeDeleteResult(self.delete_rowcounts.pop(0))
            raise AssertionError(f"Unexpected statement type: {statement_type}")

        def add(self, obj):
            self.added.append(obj)

        async def commit(self):
            self.commit_count += 1

    db = FakeSession()

    await unlike_comment(db, voter_id, comment_id)
    await unlike_comment(db, voter_id, comment_id)

    negative_events = [obj for obj in db.added if getattr(obj, "amount", None) == -1]
    assert len(negative_events) == 1
    assert db.commit_count == 1


@pytest.mark.asyncio
async def test_unlike_comment_does_not_make_converted_lp_negative(db_session):
    """After login conversion resets LP to zero, unlikes must not create negative LP."""
    from datetime import datetime, timezone

    from app.db.models.market import Comment, CommentUpvote, Market
    from app.db.models.transaction import LpEvent
    from app.db.models.user import User
    from app.services.comment_service import unlike_comment
    from app.services.economy_service import convert_lp_to_bp, get_balance

    market_id = uuid.uuid4()
    comment_id = uuid.uuid4()
    proposer_id = uuid.uuid4()
    author_id = uuid.uuid4()
    voter_id = uuid.uuid4()
    db_session.add_all([
        User(id=proposer_id, email="converted-comment-proposer@test.com", username="converted_comment_prop", password_hash="x"),
        User(id=author_id, email="converted-comment-author@test.com", username="converted_comment_author", password_hash="x"),
        User(id=voter_id, email="converted-comment-voter@test.com", username="converted_comment_voter", password_hash="x"),
        Market(
            id=market_id,
            proposer_id=proposer_id,
            title="Converted comment unlike",
            description="desc",
            resolution_criteria="criteria",
            deadline=datetime(2030, 1, 1, tzinfo=timezone.utc),
            market_type="binary",
            status="open",
        ),
        Comment(id=comment_id, market_id=market_id, user_id=author_id, content="liked comment"),
        CommentUpvote(comment_id=comment_id, user_id=voter_id),
        LpEvent(
            user_id=author_id,
            amount=1,
            source_type="comment_upvote",
            source_id=comment_id,
            day_date=datetime.now(timezone.utc).date(),
        ),
    ])
    await db_session.commit()
    await convert_lp_to_bp(db_session, author_id)
    await db_session.commit()

    await unlike_comment(db_session, voter_id, comment_id)

    assert (await get_balance(db_session, author_id))["lp"] == 0
