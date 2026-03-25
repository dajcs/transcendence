"""Pydantic schemas for market (Bet) endpoints."""
import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, field_validator


class MarketCreate(BaseModel):
    title: str
    description: str
    resolution_criteria: str
    deadline: datetime

    @field_validator("title")
    @classmethod
    def title_length(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3 or len(value) > 200:
            raise ValueError("Title must be 3–200 characters")
        return value

    @field_validator("description", "resolution_criteria")
    @classmethod
    def not_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("This field is required")
        return value

    @field_validator("deadline")
    @classmethod
    def must_be_future(cls, value: datetime) -> datetime:
        now = datetime.now(timezone.utc)
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        if value <= now:
            raise ValueError("Must be a future date")
        return value


class MarketResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    resolution_criteria: str
    deadline: datetime
    status: str
    proposer_id: uuid.UUID
    created_at: datetime
    yes_pct: float = 50.0
    no_pct: float = 50.0
    position_count: int = 0

    model_config = {"from_attributes": True}


class MarketListResponse(BaseModel):
    items: list[MarketResponse]
    total: int
    page: int
    pages: int
