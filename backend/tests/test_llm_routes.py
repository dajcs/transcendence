"""Tests for authenticated LLM API routes."""
import pytest
from sqlalchemy import select

from app.db.models.user import User


async def _register_and_login(client, email: str, username: str) -> None:
    reg = await client.post("/api/auth/register", json={
        "email": email,
        "username": username,
        "password": "Passw0rd!",
    })
    assert reg.status_code == 201
    login = await client.post("/api/auth/login", json={
        "identifier": email,
        "password": "Passw0rd!",
    })
    assert login.status_code == 200


@pytest.mark.asyncio
async def test_custom_llm_summary_decrypts_saved_api_key(client, db_session, monkeypatch):
    import app.api.routes.llm as llm_routes

    await _register_and_login(client, "llmcustom@example.com", "llmcustom")
    settings_resp = await client.patch(
        "/api/users/me",
        json={"llm_mode": "custom", "llm_provider": "openrouter", "llm_api_key": "secret-key"},
    )
    assert settings_resp.status_code == 200

    create = await client.post("/api/markets", json={
        "title": "LLM key market",
        "description": "desc",
        "resolution_criteria": "criteria",
        "deadline": "2027-01-01T00:00:00Z",
    })
    assert create.status_code == 201

    seen: dict[str, str] = {}

    async def fake_check_budget(_redis):
        return True

    async def fake_get_redis():
        return object()

    async def fake_call_custom_provider(messages, provider, api_key, model_override=None):
        seen["provider"] = provider
        seen["api_key"] = api_key
        return "summary"

    monkeypatch.setattr(llm_routes, "_check_budget", fake_check_budget)
    monkeypatch.setattr(llm_routes, "_get_redis", fake_get_redis)
    monkeypatch.setattr(llm_routes, "call_custom_provider", fake_call_custom_provider)

    resp = await client.post(f"/api/bets/{create.json()['id']}/summary")

    assert resp.status_code == 200
    assert resp.json() == {"summary": "summary"}
    assert seen == {"provider": "openrouter", "api_key": "secret-key"}

    user = (
        await db_session.execute(select(User).where(User.username == "llmcustom"))
    ).scalar_one()
    assert user.llm_api_key != "secret-key"
