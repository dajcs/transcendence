"""Pydantic schemas for market (Bet) endpoints."""
import uuid
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, field_validator, model_validator


class MarketCreate(BaseModel):
    title: str
    description: str
    resolution_criteria: str
    deadline: datetime
    market_type: Literal["binary", "multiple_choice", "numeric"] = "binary"
    choices: list[str] | None = None
    numeric_min: float | None = None
    numeric_max: float | None = None

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

    @model_validator(mode="after")
    def validate_type_fields(self) -> "MarketCreate":
        if self.market_type == "multiple_choice":
            if not self.choices or len(self.choices) < 2:
                raise ValueError("Multiple choice markets require at least 2 choices")
            if len(self.choices) > 10:
                raise ValueError("Maximum 10 choices allowed")
        if self.market_type == "numeric":
            if self.numeric_min is None or self.numeric_max is None:
                raise ValueError("Numeric markets require min and max values")
            if self.numeric_min >= self.numeric_max:
                raise ValueError("numeric_min must be less than numeric_max")
        return self


class MarketResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    resolution_criteria: str
    deadline: datetime
    status: str
    proposer_id: uuid.UUID
    created_at: datetime
    market_type: str = "binary"
    choices: list[str] | None = None
    numeric_min: float | None = None
    numeric_max: float | None = None
    yes_pct: float = 50.0
    no_pct: float = 50.0
    yes_count: int = 0
    no_count: int = 0
    position_count: int = 0
    comment_count: int = 0
    choice_counts: dict[str, int] = {}
    upvote_count: int = 0

    model_config = {"from_attributes": True}


class MarketListResponse(BaseModel):
    items: list[MarketResponse]
    total: int
    page: int
    pages: int
