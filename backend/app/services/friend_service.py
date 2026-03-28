"""Friend system business logic."""
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.social import FriendRequest
from app.db.models.user import User
from app.schemas.friends import BlockedUserResponse, FriendListResponse, FriendRequestResponse, FriendResponse


async def send_friend_request(db: AsyncSession, from_user_id: uuid.UUID, to_user_id: uuid.UUID) -> FriendRequestResponse:
    """Send a friend request. Raises 400/409 on invalid state."""
    if from_user_id == to_user_id:
        raise HTTPException(status_code=400, detail="Cannot send friend request to yourself")

    # Check target user exists
    target = (await db.execute(select(User).where(User.id == to_user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Check for existing relationship (either direction) — use .first() to tolerate duplicates
    existing = (await db.execute(
        select(FriendRequest).where(
            or_(
                and_(FriendRequest.from_user_id == from_user_id, FriendRequest.to_user_id == to_user_id),
                and_(FriendRequest.from_user_id == to_user_id, FriendRequest.to_user_id == from_user_id),
            )
        )
    )).scalars().first()

    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=409, detail="Already friends")
        if existing.status == "blocked":
            raise HTTPException(status_code=403, detail="Cannot send request to this user")
        if existing.status == "pending":
            # If they already sent us a request, auto-accept
            if existing.from_user_id == to_user_id:
                existing.status = "accepted"
                existing.updated_at = datetime.now(timezone.utc)
                await db.commit()
                await db.refresh(existing)
                return await _to_request_response(db, existing)
            raise HTTPException(status_code=409, detail="Friend request already sent")
        # If declined, allow re-sending by updating the existing record
        if existing.status == "declined":
            existing.from_user_id = from_user_id
            existing.to_user_id = to_user_id
            existing.status = "pending"
            existing.created_at = datetime.now(timezone.utc)
            existing.updated_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(existing)
            return await _to_request_response(db, existing)

    # Create new request
    req = FriendRequest(
        from_user_id=from_user_id,
        to_user_id=to_user_id,
        status="pending",
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return await _to_request_response(db, req)


async def accept_friend_request(db: AsyncSession, request_id: uuid.UUID, current_user_id: uuid.UUID) -> FriendRequestResponse:
    """Accept a pending friend request addressed to current_user_id."""
    req = (await db.execute(select(FriendRequest).where(FriendRequest.id == request_id))).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Friend request not found")
    if req.to_user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not your request to accept")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {req.status}")

    req.status = "accepted"
    req.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(req)
    return await _to_request_response(db, req)


async def cancel_friend_request(db: AsyncSession, request_id: uuid.UUID, current_user_id: uuid.UUID) -> None:
    """Cancel a pending friend request sent by current_user_id."""
    req = (await db.execute(select(FriendRequest).where(FriendRequest.id == request_id))).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Friend request not found")
    if req.from_user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not your request to cancel")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {req.status}")
    await db.delete(req)
    await db.commit()


async def reject_friend_request(db: AsyncSession, request_id: uuid.UUID, current_user_id: uuid.UUID) -> FriendRequestResponse:
    """Decline a pending friend request."""
    req = (await db.execute(select(FriendRequest).where(FriendRequest.id == request_id))).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Friend request not found")
    if req.to_user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not your request to decline")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {req.status}")

    req.status = "declined"
    req.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(req)
    return await _to_request_response(db, req)


async def remove_friend(db: AsyncSession, current_user_id: uuid.UUID, friend_user_id: uuid.UUID) -> None:
    """Remove an accepted friendship (either party can do this)."""
    req = (await db.execute(
        select(FriendRequest).where(
            FriendRequest.status == "accepted",
            or_(
                and_(FriendRequest.from_user_id == current_user_id, FriendRequest.to_user_id == friend_user_id),
                and_(FriendRequest.from_user_id == friend_user_id, FriendRequest.to_user_id == current_user_id),
            ),
        )
    )).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Friendship not found")

    await db.delete(req)
    await db.commit()


async def block_user(db: AsyncSession, current_user_id: uuid.UUID, target_user_id: uuid.UUID) -> None:
    """Block a user. Removes existing friendship if any."""
    if current_user_id == target_user_id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")

    target = (await db.execute(select(User).where(User.id == target_user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Find any existing relationship
    existing = (await db.execute(
        select(FriendRequest).where(
            or_(
                and_(FriendRequest.from_user_id == current_user_id, FriendRequest.to_user_id == target_user_id),
                and_(FriendRequest.from_user_id == target_user_id, FriendRequest.to_user_id == current_user_id),
            )
        )
    )).scalars().first()

    if existing:
        # Prevent blocked user from overwriting original block via block+unblock
        if existing.status == "blocked" and existing.from_user_id != current_user_id:
            raise HTTPException(status_code=403, detail="Cannot block this user")
        existing.from_user_id = current_user_id
        existing.to_user_id = target_user_id
        existing.status = "blocked"
        existing.updated_at = datetime.now(timezone.utc)
    else:
        db.add(FriendRequest(
            from_user_id=current_user_id,
            to_user_id=target_user_id,
            status="blocked",
        ))

    await db.commit()


async def unblock_user(db: AsyncSession, current_user_id: uuid.UUID, target_user_id: uuid.UUID) -> None:
    """Unblock a user (only the blocker can unblock)."""
    req = (await db.execute(
        select(FriendRequest).where(
            FriendRequest.from_user_id == current_user_id,
            FriendRequest.to_user_id == target_user_id,
            FriendRequest.status == "blocked",
        )
    )).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Block not found")

    await db.delete(req)
    await db.commit()


async def get_friends_list(db: AsyncSession, current_user_id: uuid.UUID) -> FriendListResponse:
    """Return friends, pending received, and pending sent requests."""
    # Get all friend requests involving current user
    all_requests = (await db.execute(
        select(FriendRequest).where(
            or_(
                FriendRequest.from_user_id == current_user_id,
                FriendRequest.to_user_id == current_user_id,
            )
        )
    )).scalars().all()

    # Batch-fetch all involved user IDs to avoid N+1 queries
    user_ids: set[uuid.UUID] = set()
    for req in all_requests:
        user_ids.add(req.from_user_id)
        user_ids.add(req.to_user_id)
    user_ids.discard(current_user_id)

    users_map: dict[uuid.UUID, User] = {}
    if user_ids:
        users = (await db.execute(
            select(User).where(User.id.in_(user_ids))
        )).scalars().all()
        users_map = {u.id: u for u in users}

    friends: list[FriendResponse] = []
    pending_received: list[FriendRequestResponse] = []
    pending_sent: list[FriendRequestResponse] = []
    blocked: list[BlockedUserResponse] = []

    for req in all_requests:
        if req.status == "accepted":
            friend_id = req.to_user_id if req.from_user_id == current_user_id else req.from_user_id
            friend_user = users_map.get(friend_id)
            if friend_user:
                friends.append(FriendResponse(
                    user_id=friend_user.id,
                    username=friend_user.username,
                    avatar_url=friend_user.avatar_url,
                    is_online=False,
                    since=req.updated_at or req.created_at,
                ))
        elif req.status == "pending":
            from_user = users_map.get(req.from_user_id)
            to_user = users_map.get(req.to_user_id)
            # If either user was deleted, skip this request
            if req.from_user_id == current_user_id:
                from_username = "You"
                to_username = to_user.username if to_user else "Unknown"
            else:
                from_username = from_user.username if from_user else "Unknown"
                to_username = "You"

            resp = FriendRequestResponse(
                id=req.id,
                from_user_id=req.from_user_id,
                from_username=from_username,
                to_user_id=req.to_user_id,
                to_username=to_username,
                status=req.status,
                created_at=req.created_at,
            )
            if req.to_user_id == current_user_id:
                pending_received.append(resp)
            else:
                pending_sent.append(resp)
        elif req.status == "blocked" and req.from_user_id == current_user_id:
            blocked_user = users_map.get(req.to_user_id)
            if blocked_user:
                blocked.append(BlockedUserResponse(
                    user_id=blocked_user.id,
                    username=blocked_user.username,
                    avatar_url=blocked_user.avatar_url,
                ))

    return FriendListResponse(
        friends=friends,
        pending_received=pending_received,
        pending_sent=pending_sent,
        blocked=blocked,
    )


async def are_friends(db: AsyncSession, user_a: uuid.UUID, user_b: uuid.UUID) -> bool:
    """Check if two users are friends."""
    result = (await db.execute(
        select(FriendRequest).where(
            FriendRequest.status == "accepted",
            or_(
                and_(FriendRequest.from_user_id == user_a, FriendRequest.to_user_id == user_b),
                and_(FriendRequest.from_user_id == user_b, FriendRequest.to_user_id == user_a),
            ),
        )
    )).scalar_one_or_none()
    return result is not None


async def is_blocked(db: AsyncSession, blocker_id: uuid.UUID, blocked_id: uuid.UUID) -> bool:
    """Check if blocker has blocked blocked_id."""
    result = (await db.execute(
        select(FriendRequest).where(
            FriendRequest.from_user_id == blocker_id,
            FriendRequest.to_user_id == blocked_id,
            FriendRequest.status == "blocked",
        )
    )).scalar_one_or_none()
    return result is not None


async def _to_request_response(db: AsyncSession, req: FriendRequest) -> FriendRequestResponse:
    """Convert a FriendRequest model to its response schema with usernames."""
    from_user = (await db.execute(select(User).where(User.id == req.from_user_id))).scalar_one_or_none()
    to_user = (await db.execute(select(User).where(User.id == req.to_user_id))).scalar_one_or_none()
    if not from_user or not to_user:
        raise HTTPException(status_code=404, detail="Referenced user no longer exists")
    return FriendRequestResponse(
        id=req.id,
        from_user_id=req.from_user_id,
        from_username=from_user.username,
        to_user_id=req.to_user_id,
        to_username=to_user.username,
        status=req.status,
        created_at=req.created_at,
    )
