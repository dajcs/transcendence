"""Socket.IO event handlers — imported by main.py to register decorators."""
from app.socket.server import sio
from app.utils.jwt import decode_access_token


def _extract_cookie(cookie_header: str, name: str) -> str | None:
    """Extract a named cookie value from a raw Cookie header string."""
    for part in cookie_header.split(";"):
        key, _, val = part.strip().partition("=")
        if key.strip() == name:
            return val.strip()
    return None


@sio.on("connect")
async def on_connect(sid: str, environ: dict, auth: dict | None = None) -> None:
    """Authenticate via httpOnly access_token cookie forwarded in ASGI scope."""
    scope = environ.get("asgi.scope", {})
    headers = dict(scope.get("headers", []))
    cookie_header = headers.get(b"cookie", b"").decode("utf-8", errors="ignore")

    token = _extract_cookie(cookie_header, "access_token")
    if not token:
        raise ConnectionRefusedError("authentication required")

    try:
        payload = decode_access_token(token)
    except Exception:
        raise ConnectionRefusedError("invalid token")

    user_id = payload["sub"]
    await sio.save_session(sid, {"user_id": user_id})
    await sio.enter_room(sid, f"user:{user_id}")
    await sio.enter_room(sid, "global")


@sio.on("disconnect")
async def on_disconnect(sid: str) -> None:
    pass  # python-socketio cleans up rooms automatically


@sio.on("join_bet")
async def on_join_bet(sid: str, data: dict) -> None:
    bet_id = data.get("bet_id")
    if bet_id:
        await sio.enter_room(sid, f"bet:{bet_id}")


@sio.on("leave_bet")
async def on_leave_bet(sid: str, data: dict) -> None:
    bet_id = data.get("bet_id")
    if bet_id:
        await sio.leave_room(sid, f"bet:{bet_id}")
