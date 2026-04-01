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
from app.db.session import make_task_session
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
        closes_at = now + timedelta(days=3)
        dispute = Dispute(
            bet_id=bet.id,
            opened_by=bet.proposer_id,
            closes_at=closes_at,
            status="open",
        )
        db.add(dispute)
        bet.status = "disputed"
        await db.flush()
        logger.info("Bet %s auto-escalated to Tier 3 (proposer timeout)", bet.id)

        try:
            celery_app.send_task(
                "app.workers.tasks.resolution.close_dispute_at_deadline",
                args=[str(dispute.id)],
                eta=closes_at,
            )
        except Exception:
            pass

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
            async with make_task_session()() as payout_db:
                from app.services.resolution_service import trigger_payout
                await trigger_payout(payout_db, dispute.bet_id, original_outcome, overturned=False)
            continue

        # Compute weighted totals — plurality voting across any outcome value
        weight_by_outcome: dict[str, float] = {}
        for v in votes:
            weight_by_outcome[v.vote] = weight_by_outcome.get(v.vote, 0.0) + float(v.weight)

        if weight_by_outcome:
            best_outcome = max(weight_by_outcome, key=lambda k: weight_by_outcome[k])
            best_weight = weight_by_outcome[best_outcome]
            # Tie (multiple outcomes share the max): original resolution stands
            tied = sum(1 for w in weight_by_outcome.values() if w == best_weight) > 1
            final_outcome = original_outcome if tied else best_outcome
        else:
            final_outcome = original_outcome

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
        from app.socket.server import celery_emit
        await celery_emit(
            "dispute:closed",
            {"bet_id": str(dispute.bet_id), "outcome": final_outcome, "overturned": overturned},
            room=f"bet:{dispute.bet_id}",
        )


@celery_app.task(name="app.workers.tasks.resolution.close_dispute_at_deadline", max_retries=1)
def close_dispute_at_deadline(dispute_id: str) -> str:
    """Scheduled when a dispute opens, fires at closes_at to aggregate votes and resolve."""
    import asyncio
    asyncio.run(_close_single_dispute(dispute_id))
    return "ok"


async def _close_single_dispute(dispute_id_str: str) -> None:
    import uuid as _uuid
    from sqlalchemy import func

    from app.db.models.bet import BetPosition, DisputeVote

    dispute_id = _uuid.UUID(dispute_id_str)
    TaskSession = make_task_session()
    async with TaskSession() as db:
        dispute = (await db.execute(
            select(Dispute).where(Dispute.id == dispute_id, Dispute.status == "open")
        )).scalar_one_or_none()
        if dispute is None:
            return  # already closed or not found

        participant_count = (await db.execute(
            select(func.count(BetPosition.id)).where(
                BetPosition.bet_id == dispute.bet_id,
                BetPosition.withdrawn_at.is_(None),
            )
        )).scalar_one()

        votes = (await db.execute(
            select(DisputeVote).where(DisputeVote.dispute_id == dispute.id)
        )).scalars().all()

        resolution = (await db.execute(
            select(Resolution).where(Resolution.bet_id == dispute.bet_id)
        )).scalar_one_or_none()
        original_outcome = resolution.outcome if resolution else "no"

        min_voters = max(1, int(participant_count * 0.01))
        if len(votes) < min_voters:
            dispute.status = "closed"
            dispute.final_outcome = original_outcome
            await db.commit()
            async with TaskSession() as payout_db:
                from app.services.resolution_service import trigger_payout
                await trigger_payout(payout_db, dispute.bet_id, original_outcome, overturned=False)
            return

        weight_by_outcome: dict[str, float] = {}
        for v in votes:
            weight_by_outcome[v.vote] = weight_by_outcome.get(v.vote, 0.0) + float(v.weight)

        best_outcome = max(weight_by_outcome, key=lambda k: weight_by_outcome[k])
        best_weight = weight_by_outcome[best_outcome]
        tied = sum(1 for w in weight_by_outcome.values() if w == best_weight) > 1
        final_outcome = original_outcome if tied else best_outcome

        overturned = (final_outcome != original_outcome)
        if overturned and resolution:
            resolution.overturned = True

        dispute.status = "closed"
        dispute.final_outcome = final_outcome
        await db.commit()

        async with TaskSession() as payout_db:
            from app.services.resolution_service import trigger_payout
            await trigger_payout(payout_db, dispute.bet_id, final_outcome, overturned=overturned)

        from app.socket.server import celery_emit
        await celery_emit(
            "dispute:closed",
            {"bet_id": str(dispute.bet_id), "outcome": final_outcome, "overturned": overturned},
            room=f"bet:{dispute.bet_id}",
        )

        logger.info("Dispute %s closed — outcome: %s (overturned: %s)", dispute_id, final_outcome, overturned)


@celery_app.task(name="app.workers.tasks.resolution.resolve_market_at_deadline", max_retries=1)
def resolve_market_at_deadline(bet_id: str) -> str:
    """Scheduled at market creation to fire at deadline+5min.
    Attempts Tier 1 auto-resolution; if unavailable, notifies proposer.
    """
    import asyncio
    asyncio.run(_resolve_single_market(bet_id))
    return "ok"


async def _resolve_single_market(bet_id_str: str) -> None:
    import uuid as _uuid
    from app.services.notification_service import notify_resolution_due

    bet_id = _uuid.UUID(bet_id_str)
    TaskSession = make_task_session()
    async with TaskSession() as db:
        bet = (await db.execute(select(Bet).where(Bet.id == bet_id))).scalar_one_or_none()
        if bet is None or bet.status != "open":
            return  # already handled or deleted

        bet.status = "pending_resolution"
        await db.flush()

        outcome: str | None = None
        if bet.resolution_source:
            try:
                source = json.loads(bet.resolution_source)
                if source.get("provider") == "open-meteo":
                    outcome = await _fetch_open_meteo_outcome(source)
            except Exception as exc:
                logger.warning("Tier 1 parse error for bet %s: %s", bet.id, exc)

        if outcome is not None:
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
            await db.commit()
            logger.info("Bet %s auto-resolved at deadline: %s", bet.id, outcome)
        else:
            # Tier 1 unavailable — notify proposer to resolve manually
            proposer_id = bet.proposer_id
            market_title = bet.title
            market_id = str(bet.id)
            await db.commit()
            async with TaskSession() as notif_db:
                await notify_resolution_due(notif_db, proposer_id, market_title, market_id)
            logger.info("Bet %s needs manual resolution — proposer notified", bet.id)

    async with TaskSession() as db:
        await _escalate_overdue_proposer(db)


@celery_app.task(name="app.workers.tasks.resolution.check_dispute_deadlines", max_retries=1)
def check_dispute_deadlines() -> str:
    """RES-03 (D-10): Every 15 min — close expired disputes and trigger payout."""
    import asyncio
    asyncio.run(_run_dispute_deadlines())
    return "ok"


async def _run_dispute_deadlines() -> None:
    TaskSession = make_task_session()
    async with TaskSession() as db:
        await _process_dispute_deadlines(db)
    async with TaskSession() as db:
        await _finalize_uncontested_resolutions(db)


async def _finalize_uncontested_resolutions(db: AsyncSession) -> None:
    """Auto-finalize proposer_resolved bets whose 48h review window expired without hitting
    the dispute threshold (i.e., no Dispute record was created)."""
    from app.services.resolution_service import trigger_payout

    now = datetime.now(timezone.utc)
    window = timedelta(hours=48)

    overdue = (await db.execute(
        select(Bet, Resolution)
        .join(Resolution, Resolution.bet_id == Bet.id)
        .where(Bet.status == "proposer_resolved")
    )).all()

    for bet, resolution in overdue:
        resolved_at = resolution.resolved_at
        if resolved_at.tzinfo is None:
            resolved_at = resolved_at.replace(tzinfo=timezone.utc)
        if now < resolved_at + window:
            continue  # window not yet expired

        # Check no Dispute record — threshold was never reached
        existing_dispute = (await db.execute(
            select(Dispute).where(Dispute.bet_id == bet.id)
        )).scalar_one_or_none()
        if existing_dispute:
            continue  # already escalated

        bet.status = "closed"
        await db.commit()
        TaskSession = make_task_session()
        async with TaskSession() as payout_db:
            await trigger_payout(payout_db, bet.id, resolution.outcome, overturned=False)
        logger.info("Bet %s finalized uncontested (outcome: %s)", bet.id, resolution.outcome)
