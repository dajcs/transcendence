"""Chat / direct messaging business logic."""
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import and_, case, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.social import FriendRequest, Message
from app.db.models.user import User
from app.schemas.chat import ConversationResponse, MessageResponse


async def get_conversations(db: AsyncSession, user_id: uuid.UUID) -> list[ConversationResponse]:
    """List all conversations for a user, ordered by most recent message."""
    # Get all distinct conversation partners
    sent = select(Message.to_user_id.label("partner_id")).where(Message.from_user_id == user_id)
    received = select(Message.from_user_id.label("partner_id")).where(Message.to_user_id == user_id)
    partners_union = sent.union(received).subquery()

    partner_ids = (await db.execute(select(partners_union.c.partner_id))).scalars().all()

    conversations: list[ConversationResponse] = []
    for partner_id in partner_ids:
        # Get partner info
        partner = (await db.execute(select(User).where(User.id == partner_id))).scalar_one_or_none()
        if not partner:
            continue

        # Get last message between the two users
        last_msg = (await db.execute(
            select(Message)
            .where(
                or_(
                    and_(Message.from_user_id == user_id, Message.to_user_id == partner_id),
                    and_(Message.from_user_id == partner_id, Message.to_user_id == user_id),
                )
            )
            .order_by(desc(Message.sent_at))
            .limit(1)
        )).scalar_one_or_none()

        if not last_msg:
            continue

        # Count unread messages from partner
        unread_count = (await db.execute(
            select(func.count(Message.id)).where(
                Message.from_user_id == partner_id,
                Message.to_user_id == user_id,
                Message.read_at.is_(None),
            )
        )).scalar_one()

        conversations.append(ConversationResponse(
            user_id=partner.id,
            username=partner.username,
            avatar_url=partner.avatar_url,
            last_message=last_msg.content[:100],  # truncate for preview
            last_message_at=last_msg.sent_at,
            unread_count=int(unread_count),
        ))

    # Sort by most recent
    conversations.sort(key=lambda c: c.last_message_at, reverse=True)
    return conversations


async def get_messages(
    db: AsyncSession,
    user_id: uuid.UUID,
    partner_id: uuid.UUID,
    limit: int = 50,
    before: datetime | None = None,
) -> list[MessageResponse]:
    """Get message history between two users, paginated by timestamp."""
    # Verify partner exists
    partner = (await db.execute(select(User).where(User.id == partner_id))).scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=404, detail="User not found")

    query = (
        select(Message)
        .where(
            or_(
                and_(Message.from_user_id == user_id, Message.to_user_id == partner_id),
                and_(Message.from_user_id == partner_id, Message.to_user_id == user_id),
            )
        )
        .order_by(desc(Message.sent_at))
        .limit(limit)
    )

    if before:
        query = query.where(Message.sent_at < before)

    rows = (await db.execute(query)).scalars().all()

    # Load user info for response
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one()

    messages = []
    for msg in reversed(rows):  # Return in chronological order
        messages.append(MessageResponse(
            id=msg.id,
            from_user_id=msg.from_user_id,
            from_username=user.username if msg.from_user_id == user_id else partner.username,
            to_user_id=msg.to_user_id,
            to_username=partner.username if msg.to_user_id == partner_id else user.username,
            content=msg.content,
            sent_at=msg.sent_at,
            read_at=msg.read_at,
        ))

    return messages


async def send_message(
    db: AsyncSession,
    from_user_id: uuid.UUID,
    to_user_id: uuid.UUID,
    content: str,
) -> MessageResponse:
    """Send a direct message. Users must be friends (not blocked)."""
    if from_user_id == to_user_id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    # Check recipient exists
    recipient = (await db.execute(select(User).where(User.id == to_user_id))).scalar_one_or_none()
    if not recipient:
        raise HTTPException(status_code=404, detail="User not found")

    # Check not blocked (either direction)
    blocked = (await db.execute(
        select(FriendRequest).where(
            FriendRequest.status == "blocked",
            or_(
                and_(FriendRequest.from_user_id == from_user_id, FriendRequest.to_user_id == to_user_id),
                and_(FriendRequest.from_user_id == to_user_id, FriendRequest.to_user_id == from_user_id),
            ),
        )
    )).scalar_one_or_none()
    if blocked:
        raise HTTPException(status_code=403, detail="Cannot message this user")

    # Check friendship (must be friends to DM)
    friendship = (await db.execute(
        select(FriendRequest).where(
            FriendRequest.status == "accepted",
            or_(
                and_(FriendRequest.from_user_id == from_user_id, FriendRequest.to_user_id == to_user_id),
                and_(FriendRequest.from_user_id == to_user_id, FriendRequest.to_user_id == from_user_id),
            ),
        )
    )).scalar_one_or_none()
    if not friendship:
        raise HTTPException(status_code=403, detail="You must be friends to send messages")

    sender = (await db.execute(select(User).where(User.id == from_user_id))).scalar_one()

    msg = Message(
        from_user_id=from_user_id,
        to_user_id=to_user_id,
        content=content.strip(),
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    return MessageResponse(
        id=msg.id,
        from_user_id=msg.from_user_id,
        from_username=sender.username,
        to_user_id=msg.to_user_id,
        to_username=recipient.username,
        content=msg.content,
        sent_at=msg.sent_at,
        read_at=msg.read_at,
    )


async def mark_messages_read(
    db: AsyncSession,
    user_id: uuid.UUID,
    partner_id: uuid.UUID,
) -> int:
    """Mark all unread messages from partner as read. Returns count."""
    from sqlalchemy import update

    result = await db.execute(
        update(Message)
        .where(
            Message.from_user_id == partner_id,
            Message.to_user_id == user_id,
            Message.read_at.is_(None),
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return result.rowcount  # type: ignore[return-value]
