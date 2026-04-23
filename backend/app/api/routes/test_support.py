"""Test-only setup helpers for Playwright E2E.

Disabled by default. The router is registered only when ENABLE_E2E_TEST_SUPPORT
is explicitly enabled in the backend process environment.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base
from app.db.models.bet import Bet, BetPosition, Resolution
from app.db.models.social import Notification
from app.db.models.transaction import BpTransaction
from app.db.models.user import User
from app.db.session import AsyncSessionLocal
from app.schemas.auth import RegisterRequest
from app.services import auth_service

router = APIRouter()

_DEFAULT_PASSWORD = "Password123"


class ScenarioResponse(BaseModel):
    users: dict[str, dict[str, str]]
    market: dict[str, str] | None = None
    notification: dict[str, str] | None = None


async def _reset_database(db: AsyncSession) -> None:
    for table in reversed(Base.metadata.sorted_tables):
        await db.execute(delete(table))
    await db.commit()
    await db.execute(
        text(
            """
            INSERT INTO users (id, email, username, is_active, llm_mode)
            VALUES (:id, 'deleted@deleted.local', '[deleted]', false, 'disabled')
            ON CONFLICT (id) DO NOTHING
            """
        ),
        {"id": "00000000-0000-0000-0000-000000000000"},
    )
    await db.commit()

    redis = auth_service._get_redis()
    await redis.flushdb()


async def _ensure_user(
    db: AsyncSession,
    *,
    email: str,
    username: str,
    password: str = _DEFAULT_PASSWORD,
) -> User:
    return await auth_service.register(
        db,
        RegisterRequest(email=email, username=username, password=password),
    )


async def _seed_open_market(db: AsyncSession) -> ScenarioResponse:
    proposer = await _ensure_user(db, email="proposer@example.com", username="proposer")
    bettor = await _ensure_user(db, email="bettor@example.com", username="bettor")

    market = Bet(
        id=uuid.uuid4(),
        proposer_id=proposer.id,
        title="Will CI stay green this week?",
        description="Critical E2E seed market for placing a bet.",
        resolution_criteria="Resolves YES if the manual E2E workflow stays green through the week.",
        deadline=datetime.now(timezone.utc) + timedelta(days=3),
        market_type="binary",
        status="open",
    )
    db.add(market)
    await db.commit()

    return ScenarioResponse(
        users={
            "proposer": {"email": proposer.email, "username": proposer.username, "password": _DEFAULT_PASSWORD},
            "bettor": {"email": bettor.email, "username": bettor.username, "password": _DEFAULT_PASSWORD},
        },
        market={"id": str(market.id), "title": market.title},
    )


async def _seed_dispute_market(db: AsyncSession) -> ScenarioResponse:
    proposer = await _ensure_user(db, email="proposer@example.com", username="proposer")
    bettor = await _ensure_user(db, email="bettor@example.com", username="bettor")
    reviewer = await _ensure_user(db, email="reviewer@example.com", username="reviewer")

    market = Bet(
        id=uuid.uuid4(),
        proposer_id=proposer.id,
        title="Will the release ship before Friday?",
        description="Critical E2E seed market for dispute escalation.",
        resolution_criteria="Resolves YES if the tagged release is published before Friday 23:59 UTC.",
        deadline=datetime.now(timezone.utc) - timedelta(hours=2),
        market_type="binary",
        status="proposer_resolved",
        winning_side="yes",
    )
    db.add(market)
    await db.flush()

    db.add_all(
        [
            BetPosition(id=uuid.uuid4(), bet_id=market.id, user_id=proposer.id, side="yes", bp_staked=2.0),
            BetPosition(id=uuid.uuid4(), bet_id=market.id, user_id=bettor.id, side="no", bp_staked=3.0),
            BetPosition(id=uuid.uuid4(), bet_id=market.id, user_id=reviewer.id, side="yes", bp_staked=1.0),
            Resolution(
                id=uuid.uuid4(),
                bet_id=market.id,
                tier=2,
                resolved_by=proposer.id,
                outcome="yes",
                justification="Deployment evidence indicates the release landed before the review deadline.",
                resolved_at=datetime.now(timezone.utc) - timedelta(minutes=30),
                overturned=False,
            ),
        ]
    )
    await db.commit()

    return ScenarioResponse(
        users={
            "proposer": {"email": proposer.email, "username": proposer.username, "password": _DEFAULT_PASSWORD},
            "bettor": {"email": bettor.email, "username": bettor.username, "password": _DEFAULT_PASSWORD},
            "reviewer": {"email": reviewer.email, "username": reviewer.username, "password": _DEFAULT_PASSWORD},
        },
        market={"id": str(market.id), "title": market.title},
    )


async def _seed_notification_market(db: AsyncSession) -> ScenarioResponse:
    proposer = await _ensure_user(db, email="proposer@example.com", username="proposer")
    bettor = await _ensure_user(db, email="bettor@example.com", username="bettor")

    market = Bet(
        id=uuid.uuid4(),
        proposer_id=proposer.id,
        title="Will the alert badge clear correctly?",
        description="Critical E2E seed market for notification coverage.",
        resolution_criteria="Resolves YES if the unread badge clears after opening the seeded notification.",
        deadline=datetime.now(timezone.utc) + timedelta(days=1),
        market_type="binary",
        status="open",
    )
    db.add(market)
    await db.flush()

    db.add(BpTransaction(user_id=bettor.id, amount=10.0, reason="manual_adjustment"))

    payload = {
        "bet_id": str(market.id),
        "message": "Review the proposer resolution for this market.",
    }
    notification = Notification(
        id=uuid.uuid4(),
        user_id=bettor.id,
        type="resolution_proposed",
        payload=json.dumps(payload),
        is_read=False,
    )
    db.add(notification)
    await db.commit()

    return ScenarioResponse(
        users={
            "proposer": {"email": proposer.email, "username": proposer.username, "password": _DEFAULT_PASSWORD},
            "bettor": {"email": bettor.email, "username": bettor.username, "password": _DEFAULT_PASSWORD},
        },
        market={"id": str(market.id), "title": market.title},
        notification={"id": str(notification.id), "type": notification.type},
    )


@router.post("/reset", response_model=dict[str, bool])
async def reset() -> dict[str, bool]:
    async with AsyncSessionLocal() as db:
        await _reset_database(db)
    return {"ok": True}


@router.post("/scenarios/{name}", response_model=ScenarioResponse)
async def seed_scenario(name: str) -> ScenarioResponse:
    async with AsyncSessionLocal() as db:
        await _reset_database(db)

        if name == "bet-lifecycle":
            return await _seed_open_market(db)
        if name == "dispute":
            return await _seed_dispute_market(db)
        if name == "notifications":
            return await _seed_notification_market(db)

    raise HTTPException(status_code=404, detail=f"Unknown scenario: {name}")
