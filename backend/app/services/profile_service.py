"""User profile business logic."""
import uuid

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.bet import BetPosition, Resolution
from app.db.models.social import FriendRequest
from app.db.models.user import User
from app.schemas.profile import PublicProfileResponse, UpdateProfileRequest, UserSearchResult
from app.services.economy_service import get_balance


async def get_public_profile(
    db: AsyncSession, username: str, current_user_id: uuid.UUID | None = None
) -> PublicProfileResponse:
    """Fetch a user's public profile by username."""
    user = (await db.execute(
        select(User).where(User.username == username, User.is_active.is_(True))
    )).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    balances = await get_balance(db, user.id)

    # Bet stats
    total_bets = (await db.execute(
        select(func.count(BetPosition.id)).where(BetPosition.user_id == user.id)
    )).scalar_one()

    # Win rate: positions where user's side matches the resolution outcome
    won_bets = (await db.execute(
        select(func.count(BetPosition.id))
        .join(Resolution, Resolution.bet_id == BetPosition.bet_id)
        .where(
            BetPosition.user_id == user.id,
            BetPosition.withdrawn_at.is_(None),
            Resolution.outcome == BetPosition.side,
        )
    )).scalar_one()

    resolved_bets = (await db.execute(
        select(func.count(BetPosition.id))
        .join(Resolution, Resolution.bet_id == BetPosition.bet_id)
        .where(
            BetPosition.user_id == user.id,
            BetPosition.withdrawn_at.is_(None),
        )
    )).scalar_one()

    win_rate = (won_bets / resolved_bets * 100) if resolved_bets > 0 else 0.0

    # Friendship status
    is_friend = False
    friendship_status = None
    if current_user_id and current_user_id != user.id:
        fr = (await db.execute(
            select(FriendRequest).where(
                or_(
                    and_(FriendRequest.from_user_id == current_user_id, FriendRequest.to_user_id == user.id),
                    and_(FriendRequest.from_user_id == user.id, FriendRequest.to_user_id == current_user_id),
                )
            )
        )).scalar_one_or_none()
        if fr:
            friendship_status = fr.status
            is_friend = fr.status == "accepted"

    return PublicProfileResponse(
        id=user.id,
        username=user.username,
        avatar_url=user.avatar_url,
        bio=user.bio,
        created_at=user.created_at,
        lp=int(balances["lp"]),
        tp=float(balances["tp"]),
        total_bets=int(total_bets),
        win_rate=round(win_rate, 1),
        is_friend=is_friend,
        friendship_status=friendship_status,
    )


async def update_profile(db: AsyncSession, user_id: uuid.UUID, data: UpdateProfileRequest) -> User:
    """Update the current user's profile fields."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.username is not None and data.username != user.username:
        existing = (await db.execute(select(User).where(User.username == data.username))).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail="Username already taken")
        user.username = data.username

    if data.bio is not None:
        user.bio = data.bio

    if data.avatar_url is not None:
        user.avatar_url = data.avatar_url

    await db.commit()
    await db.refresh(user)
    return user


async def search_users(db: AsyncSession, q: str, limit: int = 20) -> list[UserSearchResult]:
    """Search users by username prefix."""
    if not q or len(q) < 2:
        return []

    results = (await db.execute(
        select(User)
        .where(User.username.ilike(f"{q}%"), User.is_active.is_(True))
        .order_by(User.username)
        .limit(limit)
    )).scalars().all()

    return [
        UserSearchResult(id=u.id, username=u.username, avatar_url=u.avatar_url)
        for u in results
    ]
