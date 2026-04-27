"""Resolution Celery tasks.

Architecture: hybrid ETA + sweep scheduling.
  Per-bet ETA: market_service.py schedules resolve_market_at_deadline via send_task(eta=deadline)
    and stores the Celery task ID on Market.celery_task_id for revocation if the market is cancelled
    or its deadline changes.
  Fallback beat: check_auto_resolution runs every 60 seconds — catches open bets whose ETA task was
    lost (worker restart, broker flush, or pre-deploy markets).
  Dispute deadlines: check_dispute_deadlines runs every 15 min — closes expired disputes and
    finalizes uncontested proposer_resolved bets after the 48h review window.

Socket events: every status transition emits bet:status_changed so browser tabs update
  without polling. Final payout emits bet:resolved (from resolution_service.trigger_payout).

Resolution fires at deadline (no grace period). Sweep also uses deadline <= now.
"""
import json
import logging
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.market import Market, Dispute, Resolution
from app.db.session import make_task_session
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


def _map_weather_outcome(current: dict, condition: str) -> str | None:
    """Map Open-Meteo current response to outcome string.
    Binary (rain/snow): 'yes'/'no'. Numeric (temperature/wind): actual value as string.
    """
    try:
        if condition == "rain":
            return "yes" if float(current.get("rain") or 0) > 0.1 else "no"
        if condition == "snow":
            return "yes" if float(current.get("snowfall") or 0) > 0.1 else "no"
        if condition == "temperature":
            val = current.get("temperature_2m")
            return str(round(float(val), 1)) if val is not None else None
        if condition == "wind":
            val = current.get("wind_speed_10m")
            return str(round(float(val), 1)) if val is not None else None
    except (TypeError, ValueError):
        return None
    return None


async def _fetch_open_meteo_outcome(source: dict) -> str | None:
    """Geocode city + fetch current weather at deadline. Returns outcome string or None."""
    location = source.get("location", "")
    condition = source.get("condition", "")

    if not location or not condition:
        return None

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            geo_resp = await client.get(_GEOCODING_URL, params={"name": location, "count": 1})
            if geo_resp.status_code != 200:
                return None
            results = geo_resp.json().get("results")
            if not results:
                return None
            lat, lon = results[0]["latitude"], results[0]["longitude"]

            weather_resp = await client.get(
                _FORECAST_URL,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,rain,snowfall,wind_speed_10m",
                },
            )
            if weather_resp.status_code != 200:
                return None
            return _map_weather_outcome(weather_resp.json().get("current", {}), condition)
    except Exception as exc:
        logger.warning("Open-Meteo fetch failed: %s", exc)
        return None


async def _process_auto_resolution(db: AsyncSession) -> None:
    """Transition open expired bets; attempt Tier 1 or escalate."""
    now = datetime.now(timezone.utc)

    bets = (await db.execute(
        select(Market).where(
            Market.status == "open",
            Market.deadline <= now,
        )
    )).scalars().all()

    weather_payouts: list[tuple[object, str]] = []  # (bet_id, outcome) for immediate payout

    for bet in bets:
        bet.status = "pending_resolution"
        await db.flush()

        outcome: str | None = None
        source_config: dict = {}

        if bet.resolution_source:
            try:
                source_config = json.loads(bet.resolution_source)
                if source_config.get("provider") == "open-meteo":
                    outcome = await _fetch_open_meteo_outcome(source_config)
            except (json.JSONDecodeError, Exception) as exc:
                logger.warning("Tier 1 parse error for bet %s: %s", bet.id, exc)

        if outcome is not None:
            is_weather = source_config.get("provider") == "open-meteo"
            resolved_outcome = outcome

            db.add(Resolution(
                market_id=bet.id,
                tier=1,
                resolved_by=None,
                outcome=resolved_outcome,
                justification="Automatic resolution via Open-Meteo",
                overturned=False,
            ))
            bet.winning_side = resolved_outcome
            bet.status = "proposer_resolved"  # trigger_payout will close it
            if is_weather:
                weather_payouts.append((bet.id, resolved_outcome))
            await db.flush()
            logger.info("Market %s auto-resolved: %s", bet.id, resolved_outcome)
        else:
            logger.info("Market %s escalated to Tier 2 (proposer resolution)", bet.id)
            from app.services.notification_service import notify_resolution_due
            try:
                await notify_resolution_due(db, bet.proposer_id, bet.title, str(bet.id))
            except Exception as exc:
                logger.warning("Failed to notify proposer for bet %s: %s", bet.id, exc)

    await db.commit()

    # Immediate payouts for weather markets (no dispute window)
    for bet_id, resolved_outcome in weather_payouts:
        async with make_task_session()() as payout_db:
            from app.services.resolution_service import trigger_payout
            try:
                await trigger_payout(payout_db, bet_id, resolved_outcome, overturned=False)
            except Exception as exc:
                logger.warning("Payout failed for weather bet %s: %s", bet_id, exc)

    # Notify clients of status change so UIs refresh without polling
    from app.socket.server import celery_emit
    for b in bets:
        data = {"bet_id": str(b.id), "status": b.status}
        await celery_emit("bet:status_changed", data, room=f"bet:{b.id}")
        await celery_emit("bet:status_changed", data, room="global")


async def _escalate_overdue_proposer(db: AsyncSession) -> None:
    """D-06: If proposer hasn't resolved within 7 days of deadline, open a system dispute."""
    now = datetime.now(timezone.utc)

    overdue_bets = (await db.execute(
        select(Market).where(
            Market.status == "pending_resolution",
            Market.deadline <= now - timedelta(days=7),
        )
    )).scalars().all()

    for bet in overdue_bets:
        # Check no existing dispute
        existing = (await db.execute(
            select(Dispute).where(Dispute.market_id == bet.id)
        )).scalar_one_or_none()
        if existing:
            continue

        # Open a system dispute (proposer is opener for accounting purposes)
        closes_at = now + timedelta(days=3)
        dispute = Dispute(
            market_id=bet.id,
            opened_by=bet.proposer_id,
            closes_at=closes_at,
            status="open",
        )
        db.add(dispute)
        bet.status = "disputed"
        await db.flush()
        logger.info("Market %s auto-escalated to Tier 3 (proposer timeout)", bet.id)

        try:
            celery_app.send_task(
                "app.workers.tasks.resolution.close_dispute_at_deadline",
                args=[str(dispute.id)],
                eta=closes_at,
            )
        except Exception:
            pass

    await db.commit()

    # Notify clients for each escalated bet
    from app.socket.server import celery_emit
    for bet in overdue_bets:
        if bet.status == "disputed":
            data = {"bet_id": str(bet.id), "status": "disputed"}
            await celery_emit("bet:status_changed", data, room=f"bet:{bet.id}")
            await celery_emit("bet:status_changed", data, room="global")


async def _process_dispute_deadlines(db: AsyncSession) -> None:
    """D-10: Close expired disputes. Weighted majority -> outcome. Invalid -> restore."""
    from sqlalchemy import func

    from app.db.models.market import MarketPosition, DisputeVote

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
            select(func.count(MarketPosition.id)).where(
                MarketPosition.market_id == dispute.market_id,
                MarketPosition.withdrawn_at.is_(None),
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
            select(Resolution).where(Resolution.market_id == dispute.market_id)
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
                await trigger_payout(payout_db, dispute.market_id, original_outcome, overturned=False)
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

        async with make_task_session()() as payout_db:
            from app.services.resolution_service import trigger_payout
            await trigger_payout(payout_db, dispute.market_id, final_outcome, overturned=overturned)

        # Emit dispute:closed
        from app.socket.server import celery_emit
        await celery_emit(
            "dispute:closed",
            {"bet_id": str(dispute.market_id), "outcome": final_outcome, "overturned": overturned},
            room=f"bet:{dispute.market_id}",
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

    from app.db.models.market import MarketPosition, DisputeVote

    dispute_id = _uuid.UUID(dispute_id_str)
    TaskSession = make_task_session()
    async with TaskSession() as db:
        dispute = (await db.execute(
            select(Dispute).where(Dispute.id == dispute_id, Dispute.status == "open")
        )).scalar_one_or_none()
        if dispute is None:
            return  # already closed or not found

        participant_count = (await db.execute(
            select(func.count(MarketPosition.id)).where(
                MarketPosition.market_id == dispute.market_id,
                MarketPosition.withdrawn_at.is_(None),
            )
        )).scalar_one()

        votes = (await db.execute(
            select(DisputeVote).where(DisputeVote.dispute_id == dispute.id)
        )).scalars().all()

        resolution = (await db.execute(
            select(Resolution).where(Resolution.market_id == dispute.market_id)
        )).scalar_one_or_none()
        original_outcome = resolution.outcome if resolution else "no"

        min_voters = max(1, int(participant_count * 0.01))
        if len(votes) < min_voters:
            dispute.status = "closed"
            dispute.final_outcome = original_outcome
            await db.commit()
            async with TaskSession() as payout_db:
                from app.services.resolution_service import trigger_payout
                await trigger_payout(payout_db, dispute.market_id, original_outcome, overturned=False)
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
            await trigger_payout(payout_db, dispute.market_id, final_outcome, overturned=overturned)

        from app.socket.server import celery_emit
        await celery_emit(
            "dispute:closed",
            {"bet_id": str(dispute.market_id), "outcome": final_outcome, "overturned": overturned},
            room=f"bet:{dispute.market_id}",
        )

        logger.info("Dispute %s closed — outcome: %s (overturned: %s)", dispute_id, final_outcome, overturned)


@celery_app.task(name="app.workers.tasks.resolution.resolve_market_at_deadline", max_retries=1)
def resolve_market_at_deadline(bet_id: str) -> str:
    """Scheduled at market creation to fire at deadline.
    Attempts Tier 1 auto-resolution; if unavailable, notifies proposer immediately.
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
        bet = (await db.execute(select(Market).where(Market.id == bet_id))).scalar_one_or_none()
        if bet is None or bet.status != "open":
            return

        bet.status = "pending_resolution"
        await db.flush()

        outcome: str | None = None
        source_config: dict = {}
        if bet.resolution_source:
            try:
                source_config = json.loads(bet.resolution_source)
                if source_config.get("provider") == "open-meteo":
                    outcome = await _fetch_open_meteo_outcome(source_config)
            except Exception as exc:
                logger.warning("Tier 1 parse error for bet %s: %s", bet.id, exc)

        if outcome is not None:
            is_weather = source_config.get("provider") == "open-meteo"
            resolved_outcome = outcome

            db.add(Resolution(
                market_id=bet.id,
                tier=1,
                resolved_by=None,
                outcome=resolved_outcome,
                justification="Automatic resolution via Open-Meteo",
                overturned=False,
            ))
            bet.winning_side = resolved_outcome
            bet.status = "proposer_resolved"  # trigger_payout will close it
            await db.commit()
            logger.info("Market %s auto-resolved at deadline: %s", bet.id, resolved_outcome)

            if is_weather:
                async with TaskSession() as payout_db:
                    from app.services.resolution_service import trigger_payout
                    try:
                        await trigger_payout(payout_db, bet_id, resolved_outcome, overturned=False)
                    except Exception as exc:
                        logger.warning("Payout failed for weather bet %s: %s", bet_id, exc)
        else:
            proposer_id = bet.proposer_id
            market_title = bet.title
            market_id = str(bet.id)
            await db.commit()
            async with TaskSession() as notif_db:
                await notify_resolution_due(notif_db, proposer_id, market_title, market_id)
            logger.info("Market %s needs manual resolution — proposer notified", bet.id)

    from app.socket.server import celery_emit
    data = {"bet_id": bet_id_str, "status": bet.status}
    await celery_emit("bet:status_changed", data, room=f"bet:{bet_id}")
    await celery_emit("bet:status_changed", data, room="global")

    async with TaskSession() as db:
        await _escalate_overdue_proposer(db)


@celery_app.task(name="app.workers.tasks.resolution.check_auto_resolution", max_retries=1)
def check_auto_resolution() -> str:
    """Fallback beat poller — RES-01 safety net.

    Runs every 60s via Celery Beat. Finds open bets at or past deadline and resolves them
    inline. Safe alongside per-bet ETA tasks: status check prevents double-processing.
    """
    import asyncio
    asyncio.run(_run_auto_resolution())
    return "ok"


async def _run_auto_resolution() -> None:
    TaskSession = make_task_session()
    async with TaskSession() as db:
        await _process_auto_resolution(db)


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
        select(Market, Resolution)
        .join(Resolution, Resolution.market_id == Market.id)
        .where(Market.status == "proposer_resolved")
    )).all()

    for bet, resolution in overdue:
        resolved_at = resolution.resolved_at
        if resolved_at.tzinfo is None:
            resolved_at = resolved_at.replace(tzinfo=timezone.utc)
        if now < resolved_at + window:
            continue  # window not yet expired

        # Check no Dispute record — threshold was never reached
        existing_dispute = (await db.execute(
            select(Dispute).where(Dispute.market_id == bet.id)
        )).scalar_one_or_none()
        if existing_dispute:
            continue  # already escalated

        bet_id = bet.id
        outcome = resolution.outcome
        # Close the scanner session's read transaction before trigger_payout
        # opens its own payout transaction. trigger_payout is responsible for
        # marking the market closed after crediting winners.
        await db.commit()
        TaskSession = make_task_session()
        async with TaskSession() as payout_db:
            await trigger_payout(payout_db, bet_id, outcome, overturned=False)
        logger.info("Market %s finalized uncontested (outcome: %s)", bet_id, outcome)
