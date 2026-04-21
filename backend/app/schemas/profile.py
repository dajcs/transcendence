"""Pydantic schemas for user profile endpoints."""
import re
import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator


class PublicProfileResponse(BaseModel):
    id: uuid.UUID
    username: str
    avatar_url: str | None
    bio: str | None
    created_at: datetime
    lp: int = 0
    tp: float = 0.0
    total_bets: int = 0
    win_rate: float = 0.0
    is_friend: bool = False
    friendship_status: str | None = None  # 'accepted'|'pending'|'blocked'|None

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    username: str | None = None
    bio: str | None = None
    avatar_url: str | None = None

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if len(v) < 3 or len(v) > 32:
            raise ValueError("Username must be 3-32 characters")
        if not re.fullmatch(r"[A-Za-z0-9_\-]+", v):
            raise ValueError("Username may only contain letters, digits, underscores, and hyphens")
        return v

    @field_validator("bio")
    @classmethod
    def bio_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 500:
            raise ValueError("Bio must be under 500 characters")
        return v


class UserSearchResult(BaseModel):
    id: uuid.UUID
    username: str
    avatar_url: str | None

    model_config = {"from_attributes": True}


class HallOfFameEntry(BaseModel):
    id: uuid.UUID
    username: str
    avatar_url: str | None
    banked_bp: float
    markets_count: int


class HallOfFameResponse(BaseModel):
    entries: list[HallOfFameEntry]
    total: int
