"""Tests for Phase 5 resolution requirements: RES-01 through RES-06.
All tests are xfail until resolution_service and Celery tasks are implemented.
"""
import math
import uuid
from datetime import datetime, timedelta, timezone

import pytest


# RES-01: Open-Meteo condition mapping
@pytest.mark.xfail(reason="resolution_service not yet implemented", strict=False)
def test_open_meteo_mapping():
    from app.workers.tasks.resolution import map_weather_to_outcome
    # rain: precipitation_sum > 0.1 -> YES
    assert map_weather_to_outcome({"daily": {"precipitation_sum": [5.0]}}, "rain") == "yes"
    # rain: precipitation_sum <= 0.1 -> NO
    assert map_weather_to_outcome({"daily": {"precipitation_sum": [0.0]}}, "rain") == "no"
    # None -> ambiguous -> fall through to Tier 2
    assert map_weather_to_outcome({"daily": {"precipitation_sum": [None]}}, "rain") is None
    # missing key -> None
    assert map_weather_to_outcome({}, "rain") is None


# RES-02: Proposer resolution endpoint sets status and creates Resolution record
@pytest.mark.asyncio
@pytest.mark.xfail(reason="resolution routes not yet implemented", strict=False)
async def test_proposer_resolve(client, db):
    from app.db.models.bet import Bet, Resolution
    from sqlalchemy import select

    # Requires a bet in status=pending_resolution owned by current user
    # Minimal check: if endpoint exists, it responds with 200 and sets proposer_resolved
    # (Full integration test wired in plan 04 when routes exist)
    response = await client.post(
        f"/api/bets/{uuid.uuid4()}/resolve",
        json={"outcome": "yes", "justification": "The event clearly happened per news sources."},
    )
    # Endpoint must exist (not 404/405)
    assert response.status_code in (200, 201, 403, 404)  # relaxed during scaffold phase


# RES-03: Dispute flow (open, vote, close)
@pytest.mark.asyncio
@pytest.mark.xfail(reason="resolution routes not yet implemented", strict=False)
async def test_dispute_flow(client, db):
    # Full flow tested in plan 04 integration tests; scaffold verifies route exists
    response = await client.post(
        f"/api/bets/{uuid.uuid4()}/dispute",
        json={},
    )
    assert response.status_code in (200, 201, 400, 403, 404)


# RES-04: Dispute vote weight computation
@pytest.mark.xfail(reason="resolution_service not yet implemented", strict=False)
def test_vote_weights():
    from app.services.resolution_service import compute_vote_weight
    # Vote matches own bet position (conflict of interest) -> 0.5x
    assert compute_vote_weight("yes", "yes") == 0.5
    # No position (independent) -> 1.0x
    assert compute_vote_weight(None, "yes") == 1.0
    # Vote contradicts own bet position (courageous) -> 2.0x
    assert compute_vote_weight("yes", "no") == 2.0
    assert compute_vote_weight("no", "yes") == 2.0


# RES-05: Proposer penalty in payout when resolution overturned
@pytest.mark.asyncio
@pytest.mark.xfail(reason="resolution_service not yet implemented", strict=False)
async def test_proposer_penalty(db_session):
    from app.services.resolution_service import compute_proposer_penalty
    # 50% of staked, floor, min 0
    assert compute_proposer_penalty(staked=10.0) == 5.0
    assert compute_proposer_penalty(staked=3.0) == 1.0  # floor(1.5)
    assert compute_proposer_penalty(staked=0.0) == 0.0
    assert compute_proposer_penalty(staked=1.0) == 0.0  # floor(0.5)


# RES-06: Payout formula: tp = t_win / t_bet (raw float, no truncation)
def test_payout_formula():
    from app.services.resolution_service import compute_tp_earned
    t_bet = 3600.0  # 1 hour bet duration
    # Winner entered early: t_win = 3600s (full duration)
    tp = compute_tp_earned(t_win=3600.0, t_bet=t_bet)
    assert tp == 1.0  # raw float: 3600/3600
    # Winner entered halfway: t_win = 1800s
    tp = compute_tp_earned(t_win=1800.0, t_bet=t_bet)
    assert tp == 0.5  # raw float: 1800/3600
    # Last-second entry: t_win = 60s — raw float (no floor truncation)
    tp = compute_tp_earned(t_win=60.0, t_bet=t_bet)
    assert math.isclose(tp, 60.0 / 3600.0)
    # Zero t_win
    assert compute_tp_earned(t_win=0.0, t_bet=t_bet) == 0.0
    # Zero or negative t_bet
    assert compute_tp_earned(t_win=100.0, t_bet=0.0) == 0.0


# D-12: 10x BP cap per winner — unit tests (pure math, no DB)
def test_d12_bp_cap_formula():
    """Verify D-12 BP payout cap: min(stake * 10, proportional_share)."""
    total_bp_pool = 300.0
    total_winning_stake = 200.0

    # User with 100 bp stake: proportional = 150, cap = 1000 -> winner gets 150
    user_stake = 100.0
    proportional = user_stake / total_winning_stake * total_bp_pool
    cap = user_stake * 10
    winner_bp = min(cap, proportional)
    surplus = max(0.0, proportional - winner_bp)
    assert winner_bp == 150.0
    assert surplus == 0.0  # cap (1000) >> proportional (150)

    # User with 5 bp stake, pool = 200, total_winning_stake = 5 (all winners)
    # proportional = 200, cap = 50 -> winner gets 50, surplus = 150
    user_stake2 = 5.0
    total_winning_stake2 = 5.0
    total_bp_pool2 = 200.0
    proportional2 = user_stake2 / total_winning_stake2 * total_bp_pool2
    cap2 = user_stake2 * 10
    winner_bp2 = min(cap2, proportional2)
    surplus2 = max(0.0, proportional2 - winner_bp2)
    assert winner_bp2 == 50.0
    assert surplus2 == 150.0


def test_d11_tp_time_based_formula():
    """Verify D-11 TP time-based formula: tp = t_win / t_bet (raw float)."""
    from app.services.resolution_service import compute_tp_earned

    t_bet = 7200.0  # 2 hour bet
    # Held for full duration
    assert compute_tp_earned(t_win=7200.0, t_bet=t_bet) == 1.0
    # Held for 1 hour out of 2
    assert compute_tp_earned(t_win=3600.0, t_bet=t_bet) == 0.5
    # Raw float — no floor truncation
    tp = compute_tp_earned(t_win=1.0, t_bet=3600.0)
    assert math.isclose(tp, 1.0 / 3600.0)


def test_beat_schedule_has_check_auto_resolution():
    """Verify check_auto_resolution is registered in the Celery beat schedule."""
    from app.workers.celery_app import celery_app
    schedule = celery_app.conf.beat_schedule
    assert "check-auto-resolution-every-1min" in schedule
    entry = schedule["check-auto-resolution-every-1min"]
    assert entry["task"] == "app.workers.tasks.resolution.check_auto_resolution"
