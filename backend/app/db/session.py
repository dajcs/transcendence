"""Async database session management."""
from collections.abc import AsyncGenerator

from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

engine = create_async_engine(settings.database_url, pool_pre_ping=True, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


def make_task_session() -> async_sessionmaker:
    """NullPool engine for Celery tasks — avoids event-loop mismatch after fork."""
    task_engine = create_async_engine(settings.database_url, poolclass=NullPool)
    return async_sessionmaker(task_engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
