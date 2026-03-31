"""LLM routes — thread summarizer and resolution hint.

POST /api/bets/{bet_id}/summary          — LLM-01, LLM-03
POST /api/bets/{bet_id}/resolution-hint  — LLM-02, LLM-03
"""
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.db.models.bet import Bet, Comment
from app.db.models.user import User
from app.services import auth_service
from app.services.llm_service import (
    _check_budget,
    _get_redis,
    call_custom_provider,
    get_resolution_hint,
    summarize_thread,
)

router = APIRouter(tags=["llm"])


async def _get_current_user(request: Request, db: AsyncSession) -> User:
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await auth_service.get_current_user(db, access_token)


class ResolutionHintRequest(BaseModel):
    evidence: str = Field(..., max_length=500, description="Proposer-provided evidence text")


@router.post("/bets/{bet_id}/summary")
async def create_summary(
    bet_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """LLM-01: Generate neutral summary of bet discussion thread.
    Returns {summary: str | null}. 429 if daily limit exceeded. 503 if budget exceeded.
    """
    current_user = await _get_current_user(request, db)

    if current_user.llm_mode == "disabled":
        raise HTTPException(status_code=403, detail="LLM features disabled in your settings")

    bet = (await db.execute(select(Bet).where(Bet.id == bet_id))).scalar_one_or_none()
    if bet is None:
        raise HTTPException(status_code=404, detail="Bet not found")

    # Fetch recent comments (latest 20 for context)
    comments_result = await db.execute(
        select(Comment.content)
        .where(Comment.bet_id == bet_id, Comment.deleted_at.is_(None))
        .order_by(Comment.created_at.desc())
        .limit(20)
    )
    comment_texts = list(reversed(comments_result.scalars().all()))

    r = await _get_redis()

    # Pre-check rate limit (5/day) for early 429 before incrementing
    today = date.today().isoformat()
    key = f"llm_usage:summary:{current_user.id}:{today}"
    current_count = await r.get(key)
    if current_count and int(current_count) >= 5:
        raise HTTPException(status_code=429, detail="Daily summary limit (5) exceeded")

    if not await _check_budget(r):
        raise HTTPException(status_code=503, detail="LLM service temporarily unavailable")

    if current_user.llm_mode == "custom" and current_user.llm_provider and current_user.llm_api_key:
        from app.services.llm_service import _build_summarize_messages
        msgs = _build_summarize_messages(bet.title, bet.description, bet.resolution_criteria, comment_texts)
        summary = await call_custom_provider(msgs, current_user.llm_provider, current_user.llm_api_key)
    else:
        summary = await summarize_thread(
            bet_title=bet.title,
            bet_description=bet.description,
            resolution_criteria=bet.resolution_criteria,
            comments=comment_texts,
            redis=r,
            user_id=current_user.id,
        )
    return {"summary": summary}


@router.post("/bets/{bet_id}/resolution-hint")
async def create_resolution_hint(
    bet_id: uuid.UUID,
    body: ResolutionHintRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """LLM-02: Resolution assistant for proposer.
    Only the bet proposer can call this. 429 if daily limit exceeded. 503 if budget exceeded.
    """
    current_user = await _get_current_user(request, db)

    if current_user.llm_mode == "disabled":
        raise HTTPException(status_code=403, detail="LLM features disabled in your settings")

    bet = (await db.execute(select(Bet).where(Bet.id == bet_id))).scalar_one_or_none()
    if bet is None:
        raise HTTPException(status_code=404, detail="Bet not found")
    if bet.proposer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the proposer can request a resolution hint")

    r = await _get_redis()

    # Pre-check rate limit (3/day) for early 429 before incrementing
    today = date.today().isoformat()
    key = f"llm_usage:hint:{current_user.id}:{today}"
    current_count = await r.get(key)
    if current_count and int(current_count) >= 3:
        raise HTTPException(status_code=429, detail="Daily hint limit (3) exceeded")

    if not await _check_budget(r):
        raise HTTPException(status_code=503, detail="LLM service temporarily unavailable")

    if current_user.llm_mode == "custom" and current_user.llm_provider and current_user.llm_api_key:
        from app.services.llm_service import _build_hint_messages
        msgs = _build_hint_messages(bet.title, bet.description, bet.resolution_criteria, bet.deadline, body.evidence)
        hint = await call_custom_provider(msgs, current_user.llm_provider, current_user.llm_api_key)
    else:
        hint = await get_resolution_hint(
            bet_title=bet.title,
            bet_description=bet.description,
            resolution_criteria=bet.resolution_criteria,
            deadline=bet.deadline,
            evidence=body.evidence,
            redis=r,
            user_id=current_user.id,
        )
    return {"hint": hint}
