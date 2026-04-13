"""FastAPI application entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.bets import router as bets_router
from app.api.routes.chat import router as chat_router
from app.api.routes.comments import router as comments_router
from app.api.routes.config import router as config_router
from app.api.routes.friends import router as friends_router
from app.api.routes.llm import router as llm_router
from app.api.routes.resolution import router as resolution_router
from app.api.routes.markets import router as markets_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.users import router as users_router
from app.config import settings
from sqlalchemy import text

from app.db.session import AsyncSessionLocal, engine

_NIL_UUID = "00000000-0000-0000-0000-000000000000"


async def _seed_deleted_user() -> None:
    """Ensure the sentinel [deleted] user exists (GDPR pseudonymization target)."""
    async with AsyncSessionLocal() as db:
        await db.execute(text("""
            INSERT INTO users (id, email, username, is_active, llm_mode)
            VALUES (:id, 'deleted@deleted.local', '[deleted]', false, 'disabled')
            ON CONFLICT (id) DO NOTHING
        """), {"id": _NIL_UUID})
        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _seed_deleted_user()
    yield
    await engine.dispose()


app = FastAPI(title="Vox Populi API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_hosts.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(markets_router, prefix="/api/markets", tags=["markets"])
app.include_router(bets_router, prefix="/api/bets", tags=["bets"])
app.include_router(chat_router, prefix="/api/chat", tags=["chat"])
app.include_router(comments_router, prefix="/api", tags=["comments"])
app.include_router(config_router, prefix="/api", tags=["config"])
app.include_router(friends_router, prefix="/api/friends", tags=["friends"])
app.include_router(notifications_router, prefix="/api/notifications", tags=["notifications"])
app.include_router(users_router, prefix="/api/users", tags=["users"])
app.include_router(llm_router, prefix="/api", tags=["llm"])
app.include_router(resolution_router, prefix="/api", tags=["resolution"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# --- Socket.IO ASGI wrapper ---
# Import events module to register @sio.on decorators at import time.
# Use importlib to avoid shadowing the `app` FastAPI variable above.
import importlib as _importlib
import socketio as _socketio
from app.socket.server import sio as _sio

_importlib.import_module("app.socket.events")  # registers @sio.on decorators

socket_app = _socketio.ASGIApp(_sio, app)
# Uvicorn runs socket_app; tests use app (FastAPI instance) directly.
