"""Pydantic schemas for comment endpoints."""
import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator


class CommentCreate(BaseModel):
    content: str
    parent_id: uuid.UUID | None = None

    @field_validator("content")
    @classmethod
    def not_empty(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field is required")
        if len(value) > 2000:
            raise ValueError("Comment must be 2000 characters or less")
        return value


class CommentResponse(BaseModel):
    id: uuid.UUID
    bet_id: uuid.UUID
    user_id: uuid.UUID
    author_username: str
    parent_id: uuid.UUID | None
    content: str
    created_at: datetime
    upvote_count: int = 0

    model_config = {"from_attributes": True}
