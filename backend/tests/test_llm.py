"""Tests for Phase 5 LLM requirements: LLM-01 through LLM-04.
All tests are xfail until llm_service is implemented.
"""
import uuid
from datetime import date, datetime, timezone

import pytest

pytestmark = pytest.mark.asyncio


# LLM-01: Thread summarizer returns text or None on API failure
@pytest.mark.xfail(reason="llm_service not yet implemented", strict=False)
async def test_summarizer(fake_redis):
    from app.services.llm_service import summarize_thread

    # With empty API key → graceful None (no crash)
    result = await summarize_thread(
        bet_title="Will it rain in Paris on 2026-04-01?",
        bet_description="Standard weather bet.",
        resolution_criteria="Rain > 0.1mm on that date.",
        comments=["User: I think yes, the forecast shows 80% rain.",
                  "User: No way, it's been dry all month."],
        redis=fake_redis,
        user_id=uuid.uuid4(),
    )
    # With no API key configured, result must be None (not raise)
    assert result is None or isinstance(result, str)


# LLM-02: Resolution hint returns YES/NO + reasoning
@pytest.mark.xfail(reason="llm_service not yet implemented", strict=False)
async def test_resolution_hint(fake_redis):
    from app.services.llm_service import get_resolution_hint

    result = await get_resolution_hint(
        bet_title="Will it rain in Paris?",
        bet_description="Weather bet.",
        resolution_criteria="Rain > 0.1mm.",
        deadline=datetime(2026, 4, 1, tzinfo=timezone.utc),
        evidence="Meteo France confirmed 12mm of rain on that date.",
        redis=fake_redis,
        user_id=uuid.uuid4(),
    )
    # With no API key, result is None (graceful)
    assert result is None or isinstance(result, str)
    # If result is not None, validate format: no code blocks, < 500 chars
    if result is not None:
        assert "```" not in result
        assert len(result) < 500


# LLM-03: Per-user daily limit enforced (reject at limit+1)
@pytest.mark.xfail(reason="llm_service not yet implemented", strict=False)
async def test_rate_limit(fake_redis):
    from app.services.llm_service import check_and_increment_llm_usage

    user_id = uuid.uuid4()
    # First 5 calls allowed
    for _ in range(5):
        allowed = await check_and_increment_llm_usage(fake_redis, user_id, "summary", limit=5)
        assert allowed is True
    # 6th call rejected
    allowed = await check_and_increment_llm_usage(fake_redis, user_id, "summary", limit=5)
    assert allowed is False


# LLM-04: Monthly budget exceeded → graceful degradation (returns None)
@pytest.mark.xfail(reason="llm_service not yet implemented", strict=False)
async def test_budget_cap(fake_redis, monkeypatch):
    from app.services.llm_service import call_openrouter
    from app.config import settings

    # Simulate budget already at cap
    month_key = f"llm_spend:{datetime.now(timezone.utc).strftime('%Y-%m')}"
    await fake_redis.set(month_key, str(settings.llm_monthly_budget_usd + 1.0))

    # call_openrouter must return None when over budget
    result = await call_openrouter(
        messages=[{"role": "user", "content": "test"}],
        redis=fake_redis,
    )
    assert result is None
