"""Notification system business logic."""
import json
import uuid

from fastapi import HTTPException
from sqlalchemy import desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.social import Notification
from app.schemas.notifications import NotificationListResponse, NotificationResponse


async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    type: str,
    payload: dict | None = None,
) -> Notification:
    """Create a new notification for a user."""
    notif = Notification(
        user_id=user_id,
        type=type,
        payload=json.dumps(payload) if payload else None,
        is_read=False,
    )
    db.add(notif)
    await db.commit()
    await db.refresh(notif)
    from app.socket.server import celery_emit
    await celery_emit(
        f"notification:{notif.type}",
        {
            "id": str(notif.id),
            "type": notif.type,
            "payload": notif.payload,
            "created_at": notif.created_at.isoformat(),
        },
        room=f"user:{user_id}",
    )
    return notif


async def get_notifications(
    db: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 50,
    unread_only: bool = False,
) -> NotificationListResponse:
    """Get notifications for a user."""
    query = select(Notification).where(Notification.user_id == user_id)

    if unread_only:
        query = query.where(Notification.is_read.is_(False))

    query = query.order_by(desc(Notification.created_at)).limit(limit)
    rows = (await db.execute(query)).scalars().all()

    unread_count = (await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.is_read.is_(False),
        )
    )).scalar_one()

    items = [
        NotificationResponse(
            id=n.id,
            type=n.type,
            payload=n.payload,
            is_read=n.is_read,
            created_at=n.created_at,
        )
        for n in rows
    ]

    return NotificationListResponse(items=items, unread_count=int(unread_count))


async def get_unread_count(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Get the count of unread notifications."""
    return int((await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.is_read.is_(False),
        )
    )).scalar_one())


async def mark_as_read(
    db: AsyncSession,
    user_id: uuid.UUID,
    notification_ids: list[uuid.UUID],
) -> int:
    """Mark specific notifications as read. Returns count marked."""
    result = await db.execute(
        update(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.id.in_(notification_ids),
            Notification.is_read.is_(False),
        )
        .values(is_read=True)
    )
    await db.commit()
    return result.rowcount  # type: ignore[return-value]


async def mark_all_as_read(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Mark all notifications as read for a user."""
    result = await db.execute(
        update(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.is_read.is_(False),
        )
        .values(is_read=True)
    )
    await db.commit()
    return result.rowcount  # type: ignore[return-value]


async def delete_notification(db: AsyncSession, user_id: uuid.UUID, notification_id: uuid.UUID) -> None:
    """Delete a single notification."""
    notif = (await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )).scalar_one_or_none()

    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    await db.delete(notif)
    await db.commit()


# --- Convenience helpers for triggering notifications from other services ---

async def notify_friend_request(db: AsyncSession, to_user_id: uuid.UUID, from_user_id: uuid.UUID, from_username: str) -> None:
    """Notify user about incoming friend request."""
    await create_notification(db, to_user_id, "friend_request", {
        "from_user_id": str(from_user_id),
        "from_username": from_username,
        "message": f"{from_username} sent you a friend request",
    })


async def notify_friend_accepted(db: AsyncSession, to_user_id: uuid.UUID, from_username: str) -> None:
    """Notify user that their friend request was accepted."""
    await create_notification(db, to_user_id, "friend_accepted", {
        "from_username": from_username,
        "message": f"{from_username} accepted your friend request",
    })


async def notify_new_message(db: AsyncSession, to_user_id: uuid.UUID, from_username: str) -> None:
    """Notify user about a new direct message."""
    await create_notification(db, to_user_id, "new_message", {
        "from_username": from_username,
        "message": f"New message from {from_username}",
    })


async def notify_bet_resolved(db: AsyncSession, user_id: uuid.UUID, market_title: str, outcome: str) -> None:
    """Notify user about bet resolution."""
    await create_notification(db, user_id, "bet_resolved", {
        "market_title": market_title,
        "outcome": outcome,
        "message": f"Market '{market_title}' resolved: {outcome}",
    })


async def notify_bet_disputed(db: AsyncSession, user_id: uuid.UUID, market_title: str) -> None:
    """Notify user about bet dispute."""
    await create_notification(db, user_id, "bet_disputed", {
        "market_title": market_title,
        "message": f"Market '{market_title}' is being disputed",
    })


async def notify_resolution_due(db: AsyncSession, proposer_id: uuid.UUID, market_title: str, market_id: str) -> None:
    """Notify market proposer that their market needs manual resolution."""
    await create_notification(db, proposer_id, "resolution_due", {
        "market_title": market_title,
        "market_id": market_id,
        "message": f"'{market_title}' needs your resolution — go to My Markets",
        "link": "/dashboard?tab=my_markets",
    })


async def notify_friend_removed(db: AsyncSession, user_id: uuid.UUID, by_username: str) -> None:
    """Notify user that someone ended the friendship."""
    await create_notification(db, user_id, "friend_removed", {
        "by_username": by_username,
        "message": f"{by_username} ended the friendship",
    })
    try:
        from app.socket.server import sio
        await sio.emit("friend:removed", {"by": by_username}, room=f"user:{user_id}")
    except Exception:
        pass
