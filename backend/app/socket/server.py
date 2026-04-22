"""Socket.IO AsyncServer singleton — import sio from here, never from main.py.

AsyncRedisManager is used as the client_manager so that sio.emit() from any
process (FastAPI or Celery worker) publishes to Redis pub/sub. The main server's
manager subscribes and delivers events to connected clients.
"""
import asyncio
import os

import socketio

from app.config import settings

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=[],   # Nginx handles CORS; wildcard conflicts with withCredentials
    client_manager=socketio.AsyncRedisManager(settings.redis_url),
)


async def celery_emit(event: str, data: dict, room: str | None = None) -> None:
    """Emit a socket event from a Celery worker via Redis pub/sub (write-only).

    Use this in Celery tasks instead of sio.emit() — the write-only manager
    publishes without needing the full ASGI lifecycle.
    """
    if os.getenv("PYTEST_CURRENT_TEST"):
        return

    try:
        mgr = socketio.AsyncRedisManager(settings.redis_url, write_only=True)
        # Redis is optional during tests and degraded local runs. Bound publish
        # latency so missing Redis never blocks payouts or test completion.
        await asyncio.wait_for(mgr.emit(event, data, room=room), timeout=0.2)
    except Exception:
        pass
