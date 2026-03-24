"""Shared FastAPI dependency functions."""
from collections.abc import AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

# Re-export get_db for route handlers to import from deps
__all__ = ["get_db"]
