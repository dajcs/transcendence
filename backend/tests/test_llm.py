"""Tests for LLM service: rate limiting, budget cap, response validation, and LLM routes."""
import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fakeredis.aioredis import FakeRedis

from app.services.llm_service import (
    check_and_increment_llm_usage,
    get_resolution_hint,
    summarize_thread,
    validate_response,
    call_openrouter,
)


@pytest.fixture
def fake_redis():
    """Fresh FakeRedis instance for each test."""
    return FakeRedis(decode_responses=True)


@pytest.mark.asyncio
async def test_rate_limit(fake_redis):
    """check_and_increment_llm_usage: allows up to limit, rejects at limit+1."""
    user_id = uuid.uuid4()
    # First 5 calls should be allowed
    for i in range(1, 6):
        result = await check_and_increment_llm_usage(fake_redis, user_id, "summary", limit=5)
        assert result is True, f"Call {i} should be allowed"
    # 6th call should be rejected
    result = await check_and_increment_llm_usage(fake_redis, user_id, "summary", limit=5)
    assert result is False, "Call 6 should be rejected (limit+1)"


@pytest.mark.asyncio
async def test_budget_cap(fake_redis):
    """call_openrouter returns None when monthly budget exceeded."""
    from app.config import settings
    from app.services.llm_service import _check_budget

    month_key = f"llm_spend:{datetime.now(timezone.utc).strftime('%Y-%m')}"
    # Set spend above default budget ($20)
    await fake_redis.set(month_key, "25.0")

    with patch("app.services.llm_service._get_redis", return_value=fake_redis):
        result = await call_openrouter(
            messages=[{"role": "user", "content": "test"}],
            redis=fake_redis,
        )
    assert result is None, "Should return None when budget exceeded"


@pytest.mark.asyncio
async def test_validate_response():
    """validate_response: rejects code blocks, HTML, >500 chars."""
    assert validate_response("Yes, the market resolved YES because criteria met.") is True
    assert validate_response("A" * 501) is False, "Too long"
    assert validate_response("Here is code: ```python print()```") is False, "Code block"
    assert validate_response("Here is <b>HTML</b>") is False, "HTML tag"


@pytest.mark.asyncio
async def test_summarize_thread_rate_limited(fake_redis):
    """summarize_thread returns None when user has exceeded daily limit."""
    user_id = uuid.uuid4()
    today = date.today().isoformat()
    key = f"llm_usage:summary:{user_id}:{today}"
    # Simulate 5 already used
    await fake_redis.set(key, "5")

    result = await summarize_thread(
        bet_title="Test Bet",
        bet_description="A test bet",
        resolution_criteria="Did X happen?",
        comments=["comment 1", "comment 2"],
        redis=fake_redis,
        user_id=user_id,
    )
    assert result is None, "Should return None when rate limit exceeded"
