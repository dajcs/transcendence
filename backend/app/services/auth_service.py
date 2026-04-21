"""Authentication business logic."""
import logging
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, ResetConfirmBody
from app.services.economy_service import credit_bp, convert_lp_to_bp
from app.services.email_service import send_password_reset_email
from app.utils.jwt import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    decode_access_token,
    verify_password_reset_token,
)
from app.utils.password import hash_password, verify_password

logger = logging.getLogger(__name__)

# Redis client (lazy import to avoid circular; gets redis_url from settings)
_redis = None


def _get_redis():
    global _redis
    if _redis is None:
        import redis.asyncio as aioredis
        from app.config import settings
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def register(db: AsyncSession, req: RegisterRequest) -> User:
    """Create a new user. Raises 409 if email or username is taken."""
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    result = await db.execute(select(User).where(User.username == req.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already taken")

    user = User(
        id=uuid.uuid4(),
        email=req.email,
        username=req.username,
        password_hash=hash_password(req.password),
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    await credit_bp(db, user.id, 10.0, "signup")
    await db.commit()
    return user


async def _credit_daily_login_bonus(db: AsyncSession, user: User) -> None:
    """Credit +1 bp on first authenticated request of the UTC day."""
    now = datetime.now(timezone.utc)
    today = now.date()
    if user.last_login is not None and user.last_login.astimezone(timezone.utc).date() == today:
        return

    await credit_bp(db, user.id, 1.0, "daily_login")
    user.last_login = now
    await db.commit()


async def login(db: AsyncSession, req: LoginRequest, client_ip: str) -> tuple[User, str, str]:
    """Authenticate user. Returns (user, access_token, refresh_token).
    Raises 401 on invalid credentials. Rate limited: 5 attempts / 15 min / IP.
    """
    redis = _get_redis()
    rate_key = f"rate:login:{client_ip}"

    identifier = (req.identifier or req.email or "").strip()
    result = await db.execute(
        select(User).where(or_(User.email == identifier, User.username == identifier))
    )
    user = result.scalar_one_or_none()

    if not user or (user.password_hash and not verify_password(req.password, user.password_hash)):
        attempts = await redis.incr(rate_key)
        if attempts == 1:
            await redis.expire(rate_key, 900)  # 15 minutes
        if attempts > 5:
            raise HTTPException(
                status_code=429,
                detail="Too many login attempts",
                headers={"Retry-After": "900"},
            )
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.password_hash:
        raise HTTPException(
            status_code=401,
            detail="This account uses OAuth sign-in. Use Google/GitHub/42 or reset password to add password login.",
        )

    await redis.delete(rate_key)

    # Convert any accumulated LP to BP on login
    lp_converted, bp_earned = await convert_lp_to_bp(db, user.id)
    if bp_earned > 0:
        await db.commit()
        from app.services.notification_service import notify_lp_converted
        await notify_lp_converted(db, user.id, lp_converted, bp_earned, user.username)

    access_token = create_access_token(str(user.id), user.email, user.username)
    refresh_token = create_refresh_token()

    # Store refresh token in Redis with 7-day TTL
    await redis.setex(f"refresh:{refresh_token}", 604800, str(user.id))

    return user, access_token, refresh_token


async def get_current_user(db: AsyncSession, access_token: str) -> User:
    """Validate access token and return the user. Raises 401 if invalid."""
    try:
        payload = decode_access_token(access_token)
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    await _credit_daily_login_bonus(db, user)
    return user


async def refresh(db: AsyncSession, old_refresh_token: str) -> tuple[User, str, str]:
    """Rotate refresh token. Returns (user, new_access_token, new_refresh_token).
    Raises 401 if refresh token is invalid or expired.
    """
    redis = _get_redis()
    user_id = await redis.get(f"refresh:{old_refresh_token}")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")

    # Rotate: delete old, issue new
    await redis.delete(f"refresh:{old_refresh_token}")
    new_access = create_access_token(str(user.id), user.email, user.username)
    new_refresh = create_refresh_token()
    await redis.setex(f"refresh:{new_refresh}", 604800, str(user.id))

    return user, new_access, new_refresh


async def logout(refresh_token: str | None) -> None:
    """Invalidate refresh token in Redis."""
    if refresh_token:
        redis = _get_redis()
        await redis.delete(f"refresh:{refresh_token}")


async def reset_request(db: AsyncSession, email: str) -> None:
    """Send reset email. Always returns without error — no enumeration."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        token = create_password_reset_token(email)
        reset_url = f"https://localhost:8443/reset-password?token={token}"
        await send_password_reset_email(email, reset_url)
    # If user not found, silently succeed (anti-enumeration)


async def reset_confirm(db: AsyncSession, req: ResetConfirmBody) -> None:
    """Validate reset token and update password hash."""
    email = verify_password_reset_token(req.token)
    if not email:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid token")

    user.password_hash = hash_password(req.new_password)
    await db.commit()
