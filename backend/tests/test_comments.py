"""Comment API tests — DISC-01 (list), DISC-02 (upvote +1 kp), DISC-03 (reply depth)."""
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
async def test_duplicate_upvote_returns_409(client: AsyncClient):
    """DISC-02: Second upvote from same user returns 409."""
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
    assert resp2.status_code == 409


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
    """DISC-03: Replying to a reply (depth >1) returns 422."""
    market_id = await _setup_user_market_bet(client, "deep@example.com", "deep")
    parent_resp = await client.post(f"/api/markets/{market_id}/comments",
                                     json={"content": "Level 0."})
    parent_id = parent_resp.json()["id"]
    reply_resp = await client.post(f"/api/markets/{market_id}/comments",
                                    json={"content": "Level 1.", "parent_id": parent_id})
    reply_id = reply_resp.json()["id"]
    deep_resp = await client.post(f"/api/markets/{market_id}/comments",
                                   json={"content": "Level 2 — invalid.", "parent_id": reply_id})
    assert deep_resp.status_code == 422
