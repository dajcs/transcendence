"""Pydantic schemas for chat endpoints."""
import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator


class MessageCreate(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Message content cannot be empty")
        if len(v) > 2000:
            raise ValueError("Message too long (max 2000 characters)")
        return v


class MessageResponse(BaseModel):
    id: uuid.UUID
    from_user_id: uuid.UUID
    from_username: str
    to_user_id: uuid.UUID
    to_username: str
    content: str
    sent_at: datetime
    read_at: datetime | None

    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    user_id: uuid.UUID
    username: str
    avatar_url: str | None
    last_message: str
    last_message_at: datetime
    unread_count: int

    model_config = {"from_attributes": True}
