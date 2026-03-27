"""Notification API routes: /api/notifications/*"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.notifications import MarkReadRequest, NotificationListResponse
from app.services import auth_service
from app.services import notification_service

router = APIRouter()


async def _get_current_user(request: Request, db: AsyncSession):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await auth_service.get_current_user(db, access_token)


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    request: Request,
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Get notifications for the current user."""
    user = await _get_current_user(request, db)
    return await notification_service.get_notifications(db, user.id, limit=limit, unread_only=unread_only)


@router.get("/unread-count")
async def unread_count(request: Request, db: AsyncSession = Depends(get_db)):
    """Get the count of unread notifications."""
    user = await _get_current_user(request, db)
    count = await notification_service.get_unread_count(db, user.id)
    return {"unread_count": count}


@router.post("/mark-read")
async def mark_read(
    body: MarkReadRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Mark specific notifications as read."""
    user = await _get_current_user(request, db)
    count = await notification_service.mark_as_read(db, user.id, body.notification_ids)
    return {"marked_read": count}


@router.post("/mark-all-read")
async def mark_all_read(request: Request, db: AsyncSession = Depends(get_db)):
    """Mark all notifications as read."""
    user = await _get_current_user(request, db)
    count = await notification_service.mark_all_as_read(db, user.id)
    return {"marked_read": count}


@router.delete("/{notification_id}", status_code=204)
async def delete_notification(
    notification_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Delete a notification."""
    user = await _get_current_user(request, db)
    await notification_service.delete_notification(db, user.id, notification_id)
