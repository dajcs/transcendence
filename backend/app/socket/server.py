"""Socket.IO AsyncServer singleton — import sio from here, never from main.py."""
import socketio

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=[],   # Nginx handles CORS; wildcard conflicts with withCredentials
    # Single-server setup — default in-memory manager delivers events directly.
    # AsyncRedisManager is only needed for horizontal scaling (multiple instances).
)
