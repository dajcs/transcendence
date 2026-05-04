"""Public API rate limiting."""
import logging

from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)

PUBLIC_RATE_LIMIT_MAX_REQUESTS = 60
PUBLIC_RATE_LIMIT_WINDOW_SECONDS = 60
_redis = None


def _get_redis():
    global _redis
    if _redis is None:
        import redis.asyncio as aioredis

        from app.config import settings

        _redis = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=0.1,
            socket_timeout=0.1,
        )
    return _redis


def _client_identity(request: Request) -> str:
    real_ip = request.headers.get("x-real-ip", "").strip()
    if real_ip:
        return real_ip

    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        first_ip = forwarded_for.split(",", 1)[0].strip()
        if first_ip:
            return first_ip

    return request.client.host if request.client else "unknown"


async def enforce_public_rate_limit(request: Request) -> None:
    key = f"rate:public:{_client_identity(request)}"
    try:
        redis = _get_redis()
        current = await redis.incr(key)
        if current == 1:
            await redis.expire(key, PUBLIC_RATE_LIMIT_WINDOW_SECONDS)
        if current > PUBLIC_RATE_LIMIT_MAX_REQUESTS:
            raise HTTPException(
                status_code=429,
                detail="Public API rate limit exceeded",
                headers={"Retry-After": str(PUBLIC_RATE_LIMIT_WINDOW_SECONDS)},
            )
    except HTTPException:
        raise
    except Exception:
        logger.warning("Public API rate limiter unavailable", exc_info=True)
