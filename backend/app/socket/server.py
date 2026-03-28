"""Socket.IO AsyncServer singleton — import sio from here, never from main.py."""
import socketio
from app.config import settings

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=[],   # Nginx handles CORS; wildcard conflicts with withCredentials
    client_manager=socketio.AsyncRedisManager(settings.redis_url),
)
