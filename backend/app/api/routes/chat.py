"""Chat API routes: /api/chat/*"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.chat import ConversationResponse, MessageCreate, MessageResponse
from app.services import auth_service
from app.services import chat_service

router = APIRouter()


async def _get_current_user(request: Request, db: AsyncSession):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await auth_service.get_current_user(db, access_token)


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(request: Request, db: AsyncSession = Depends(get_db)):
    """List all chat conversations for the current user."""
    user = await _get_current_user(request, db)
    return await chat_service.get_conversations(db, user.id)


@router.get("/{user_id}/messages", response_model=list[MessageResponse])
async def get_messages(
    user_id: uuid.UUID,
    request: Request,
    limit: int = Query(default=50, ge=1, le=100),
    before: datetime | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Get message history with a specific user (paginated)."""
    user = await _get_current_user(request, db)
    return await chat_service.get_messages(db, user.id, user_id, limit=limit, before=before)


@router.post("/{user_id}/messages", response_model=MessageResponse, status_code=201)
async def send_message(
    user_id: uuid.UUID,
    body: MessageCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Send a direct message to a user (must be friends)."""
    user = await _get_current_user(request, db)
    return await chat_service.send_message(db, user.id, user_id, body.content)


@router.post("/{user_id}/read", status_code=200)
async def mark_read(
    user_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Mark all messages from user_id as read."""
    user = await _get_current_user(request, db)
    count = await chat_service.mark_messages_read(db, user.id, user_id)
    return {"marked_read": count}
