"""Resolution Celery tasks.

check_auto_resolution: every 5 min — transitions expired open bets, attempts Tier 1 (Open-Meteo)
check_dispute_deadlines: every 15 min — closes expired disputes, triggers payout

Pitfall 3 from RESEARCH.md: query condition is deadline+5min <= now, NOT deadline <= now.
"""
import json
import logging
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.bet import Bet, Dispute, Resolution
from app.db.session import AsyncSessionLocal
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"


def map_weather_to_outcome(data: dict, condition: str) -> str | None:
    """RES-01: Map Open-Meteo response to YES/NO or None (fall through to Tier 2).
    Condition 'rain': precipitation_sum > 0.1mm -> 'yes', <= 0.1mm -> 'no', null/missing -> None.
    """
    try:
        if condition == "rain":
            precip = data["daily"]["precipitation_sum"][0]
            if precip is None:
                return None
            return "yes" if precip > 0.1 else "no"
    except (KeyError, IndexError, TypeError):
        return None
    return None  # unknown condition


async def _fetch_open_meteo_outcome(source: dict) -> str | None:
    """Geocode city + fetch historical weather. Returns 'yes'/'no'/None."""
    location = source.get("location", "")
    date_str = source.get("date", "")
    condition = source.get("condition", "")

    if not all([location, date_str, condition]):
        return None

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Step 1: geocode city name to lat/lon
            geo_resp = await client.get(
                _GEOCODING_URL,
                params={"name": location, "count": 1},
            )
            if geo_resp.status_code != 200:
                return None
            geo_data = geo_resp.json()
            results = geo_data.get("results")
            if not results:
                return None
            lat = results[0]["latitude"]
            lon = results[0]["longitude"]

            # Step 2: fetch historical weather
            weather_resp = await client.get(
                _ARCHIVE_URL,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "start_date": date_str,
                    "end_date": date_str,
                    "daily": "precipitation_sum",
                },
            )
            if weather_resp.status_code != 200:
                return None
            return map_weather_to_outcome(weather_resp.json(), condition)
    except Exception as exc:
        logger.warning("Open-Meteo fetch failed: %s", exc)
        return None


async def _process_auto_resolution(db: AsyncSession) -> None:
    """Transition open expired bets; attempt Tier 1 or escalate.
    Pitfall 3: grace period = deadline + 5 minutes.
    """
    now = datetime.now(timezone.utc)
    grace = now - timedelta(minutes=5)

    # Find open bets past deadline + grace
    bets = (await db.execute(
        select(Bet).where(
            Bet.status == "open",
            Bet.deadline <= grace,
        )
    )).scalars().all()

    for bet in bets:
        # Mark as pending_resolution first (prevents duplicate processing)
        bet.status = "pending_resolution"
        await db.flush()

        outcome: str | None = None

        # Attempt Tier 1 if resolution_source is configured
        if bet.resolution_source:
            try:
                source = json.loads(bet.resolution_source)
                if source.get("provider") == "open-meteo":
                    outcome = await _fetch_open_meteo_outcome(source)
            except (json.JSONDecodeError, Exception) as exc:
                logger.warning("Tier 1 parse error for bet %s: %s", bet.id, exc)

        if outcome is not None:
            # Tier 1 success: create Resolution(tier=1), mark as proposer_resolved
            db.add(Resolution(
                bet_id=bet.id,
                tier=1,
                resolved_by=None,
                outcome=outcome,
                justification="Automatic resolution via Open-Meteo",
                overturned=False,
            ))
            bet.status = "proposer_resolved"
            bet.winning_side = outcome
            await db.flush()
            logger.info("Bet %s auto-resolved: %s", bet.id, outcome)
        else:
            # Tier 1 failed or no source — stay pending_resolution for proposer
            logger.info("Bet %s escalated to Tier 2 (proposer resolution)", bet.id)

    await db.commit()


async def _escalate_overdue_proposer(db: AsyncSession) -> None:
    """D-06: If proposer hasn't resolved within 7 days of deadline, open a system dispute."""
    now = datetime.now(timezone.utc)

    overdue_bets = (await db.execute(
        select(Bet).where(
            Bet.status == "pending_resolution",
            Bet.deadline <= now - timedelta(days=7),
        )
    )).scalars().all()

    for bet in overdue_bets:
        # Check no existing dispute
        existing = (await db.execute(
            select(Dispute).where(Dispute.bet_id == bet.id)
        )).scalar_one_or_none()
        if existing:
            continue

        # Open a system dispute (proposer is opener for accounting purposes)
        dispute = Dispute(
            bet_id=bet.id,
            opened_by=bet.proposer_id,
            closes_at=now + timedelta(days=3),
            status="open",
        )
        db.add(dispute)
        bet.status = "disputed"
        await db.flush()
        logger.info("Bet %s auto-escalated to Tier 3 (proposer timeout)", bet.id)

    await db.commit()


async def _process_dispute_deadlines(db: AsyncSession) -> None:
    """D-10: Close expired disputes. Weighted majority -> outcome. Invalid -> restore."""
    from sqlalchemy import func

    from app.db.models.bet import BetPosition, DisputeVote

    now = datetime.now(timezone.utc)

    expired_disputes = (await db.execute(
        select(Dispute).where(
            Dispute.status == "open",
            Dispute.closes_at <= now,
        )
    )).scalars().all()

    for dispute in expired_disputes:
        # Count participants (unique active positions)
        participant_count = (await db.execute(
            select(func.count(BetPosition.id)).where(
                BetPosition.bet_id == dispute.bet_id,
                BetPosition.withdrawn_at.is_(None),
            )
        )).scalar_one()

        # Count votes
        votes = (await db.execute(
            select(DisputeVote).where(DisputeVote.dispute_id == dispute.id)
        )).scalars().all()

        min_voters = max(1, int(participant_count * 0.01))  # 1% minimum, at least 1
        vote_count = len(votes)

        # Fetch original resolution to determine if overturned
        resolution = (await db.execute(
            select(Resolution).where(Resolution.bet_id == dispute.bet_id)
        )).scalar_one_or_none()
        original_outcome = resolution.outcome if resolution else "no"

        if vote_count < min_voters:
            # Invalid dispute: original resolution stands
            dispute.status = "closed"
            dispute.final_outcome = original_outcome
            await db.flush()
            await db.commit()
            async with AsyncSessionLocal() as payout_db:
                from app.services.resolution_service import trigger_payout
                await trigger_payout(payout_db, dispute.bet_id, original_outcome, overturned=False)
            continue

        # Compute weighted totals
        yes_weight = sum(v.weight for v in votes if v.vote == "yes")
        no_weight = sum(v.weight for v in votes if v.vote == "no")

        if yes_weight > no_weight:
            final_outcome = "yes"
        elif no_weight > yes_weight:
            final_outcome = "no"
        else:
            final_outcome = original_outcome  # tie -> original stands

        overturned = (final_outcome != original_outcome)
        if overturned and resolution:
            resolution.overturned = True

        dispute.status = "closed"
        dispute.final_outcome = final_outcome
        await db.flush()
        await db.commit()

        async with AsyncSessionLocal() as payout_db:
            from app.services.resolution_service import trigger_payout
            await trigger_payout(payout_db, dispute.bet_id, final_outcome, overturned=overturned)

        # Emit dispute:closed
        try:
            from app.socket.server import sio
            await sio.emit(
                "dispute:closed",
                {"bet_id": str(dispute.bet_id), "outcome": final_outcome, "overturned": overturned},
                room=f"bet:{dispute.bet_id}",
            )
        except Exception:
            pass


@celery_app.task(name="app.workers.tasks.resolution.check_auto_resolution", max_retries=1)
def check_auto_resolution() -> str:
    """RES-01 + RES-03 (D-03): Every 5 min — process expired bets."""
    import asyncio
    asyncio.run(_run_auto_resolution())
    return "ok"


async def _run_auto_resolution() -> None:
    async with AsyncSessionLocal() as db:
        await _process_auto_resolution(db)
    async with AsyncSessionLocal() as db:
        await _escalate_overdue_proposer(db)


@celery_app.task(name="app.workers.tasks.resolution.check_dispute_deadlines", max_retries=1)
def check_dispute_deadlines() -> str:
    """RES-03 (D-10): Every 15 min — close expired disputes and trigger payout."""
    import asyncio
    asyncio.run(_run_dispute_deadlines())
    return "ok"


async def _run_dispute_deadlines() -> None:
    async with AsyncSessionLocal() as db:
        await _process_dispute_deadlines(db)
