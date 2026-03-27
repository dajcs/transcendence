"""FastAPI application entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.bets import router as bets_router
from app.api.routes.comments import router as comments_router
from app.api.routes.markets import router as markets_router
from app.api.routes.users import router as users_router
from app.config import settings
from app.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
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
app.include_router(comments_router, prefix="/api", tags=["comments"])
app.include_router(users_router, prefix="/api/users", tags=["users"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}
