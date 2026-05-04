"""Chat / direct messaging business logic."""
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import and_, desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.social import FriendRequest, Message
from app.db.models.user import User
from app.schemas.chat import ConversationResponse, MessageResponse
from app.services.notification_service import notify_new_message


async def _check_not_blocked(db: AsyncSession, user_id: uuid.UUID, partner_id: uuid.UUID) -> None:
    """Raise 403 if either user has blocked the other."""
    blocked = (await db.execute(
        select(FriendRequest).where(
            FriendRequest.status == "blocked",
            or_(
                and_(FriendRequest.from_user_id == user_id, FriendRequest.to_user_id == partner_id),
                and_(FriendRequest.from_user_id == partner_id, FriendRequest.to_user_id == user_id),
            ),
        )
    )).scalar_one_or_none()
    if blocked:
        raise HTTPException(status_code=403, detail="Cannot access messages with this user")


async def get_conversations(db: AsyncSession, user_id: uuid.UUID) -> list[ConversationResponse]:
    """List all conversations for a user, ordered by most recent message.
    Excludes partners who are blocked (either direction)."""
    sent = select(Message.to_user_id.label("partner_id")).where(Message.from_user_id == user_id)
    received = select(Message.from_user_id.label("partner_id")).where(Message.to_user_id == user_id)
    partners_union = sent.union(received).subquery()
    all_partner_ids: list[uuid.UUID] = (
        await db.execute(select(partners_union.c.partner_id))
    ).scalars().all()

    if not all_partner_ids:
        return []

    # Filter out blocked partners (either direction)
    blocked_rows = (await db.execute(
        select(FriendRequest.from_user_id, FriendRequest.to_user_id).where(
            FriendRequest.status == "blocked",
            or_(
                FriendRequest.from_user_id == user_id,
                FriendRequest.to_user_id == user_id,
            ),
        )
    )).all()
    blocked_ids: set[uuid.UUID] = set()
    for row in blocked_rows:
        other = row.to_user_id if row.from_user_id == user_id else row.from_user_id
        blocked_ids.add(other)

    partner_ids = [p for p in all_partner_ids if p not in blocked_ids]
    if not partner_ids:
        return []

    # Bulk-fetch partner user records
    partners = (await db.execute(
        select(User).where(User.id.in_(partner_ids))
    )).scalars().all()
    partners_by_id: dict[uuid.UUID, User] = {p.id: p for p in partners}

    # Bulk-fetch last message per partner using a window function
    last_msg_subq = (
        select(
            Message.id.label("msg_id"),
            func.row_number().over(
                partition_by=func.least(
                    func.cast(Message.from_user_id, Message.from_user_id.type),
                    func.cast(Message.to_user_id, Message.to_user_id.type),
                ),
                order_by=desc(Message.sent_at),
            ).label("rn"),
        )
        .where(
            or_(
                and_(Message.from_user_id == user_id, Message.to_user_id.in_(partner_ids)),
                and_(Message.to_user_id == user_id, Message.from_user_id.in_(partner_ids)),
            )
        )
        .subquery()
    )
    latest_msgs = (await db.execute(
        select(Message).join(last_msg_subq, Message.id == last_msg_subq.c.msg_id).where(
            last_msg_subq.c.rn == 1
        )
    )).scalars().all()

    last_msg_by_partner: dict[uuid.UUID, Message] = {}
    for msg in latest_msgs:
        other = msg.to_user_id if msg.from_user_id == user_id else msg.from_user_id
        last_msg_by_partner[other] = msg

    # Bulk-fetch unread counts per partner in a single aggregated query
    unread_rows = (await db.execute(
        select(
            Message.from_user_id.label("partner_id"),
            func.count(Message.id).label("cnt"),
        )
        .where(
            Message.from_user_id.in_(partner_ids),
            Message.to_user_id == user_id,
            Message.read_at.is_(None),
        )
        .group_by(Message.from_user_id)
    )).all()
    unread_by_partner: dict[uuid.UUID, int] = {r.partner_id: int(r.cnt) for r in unread_rows}

    conversations: list[ConversationResponse] = []
    for partner_id in partner_ids:
        partner = partners_by_id.get(partner_id)
        last_msg = last_msg_by_partner.get(partner_id)
        if not partner or not last_msg:
            continue
        conversations.append(ConversationResponse(
            user_id=partner.id,
            username=partner.username,
            avatar_url=partner.avatar_url,
            last_message=last_msg.content[:100],
            last_message_at=last_msg.sent_at,
            unread_count=unread_by_partner.get(partner_id, 0),
        ))

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
    partner = (await db.execute(select(User).where(User.id == partner_id))).scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=404, detail="User not found")

    await _check_not_blocked(db, user_id, partner_id)

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
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one()

    messages = []
    for msg in reversed(rows):
        messages.append(MessageResponse(
            id=msg.id,
            from_user_id=msg.from_user_id,
            from_username=user.username if msg.from_user_id == user_id else partner.username,
            from_avatar_url=user.avatar_url if msg.from_user_id == user_id else partner.avatar_url,
            to_user_id=msg.to_user_id,
            to_username=partner.username if msg.to_user_id == partner_id else user.username,
            to_avatar_url=partner.avatar_url if msg.to_user_id == partner_id else user.avatar_url,
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

    recipient = (await db.execute(select(User).where(User.id == to_user_id))).scalar_one_or_none()
    if not recipient:
        raise HTTPException(status_code=404, detail="User not found")

    await _check_not_blocked(db, from_user_id, to_user_id)

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

    msg = Message(from_user_id=from_user_id, to_user_id=to_user_id, content=content.strip())
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    try:
        from app.socket.server import sio
        await sio.emit(
            "chat:message",
            {
                "from_user_id": str(from_user_id),
                "from_username": sender.username,
                "content": msg.content,
                "sent_at": msg.sent_at.isoformat(),
            },
            room=f"user:{to_user_id}",
        )
    except Exception:
        pass

    try:
        await notify_new_message(db, to_user_id, sender.username)
    except Exception:
        pass

    return MessageResponse(
        id=msg.id,
        from_user_id=msg.from_user_id,
        from_username=sender.username,
        from_avatar_url=sender.avatar_url,
        to_user_id=msg.to_user_id,
        to_username=recipient.username,
        to_avatar_url=recipient.avatar_url,
        content=msg.content,
        sent_at=msg.sent_at,
        read_at=msg.read_at,
    )


async def mark_messages_read(
    db: AsyncSession,
    user_id: uuid.UUID,
    partner_id: uuid.UUID,
) -> int:
    """Mark all unread messages from partner as read. Returns count updated."""
    # Skip silently if blocked — don't expose block status via error
    blocked = (await db.execute(
        select(FriendRequest).where(
            FriendRequest.status == "blocked",
            or_(
                and_(FriendRequest.from_user_id == user_id, FriendRequest.to_user_id == partner_id),
                and_(FriendRequest.from_user_id == partner_id, FriendRequest.to_user_id == user_id),
            ),
        )
    )).scalar_one_or_none()
    if blocked:
        return 0

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
