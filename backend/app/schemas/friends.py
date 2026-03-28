"""Pydantic schemas for friend endpoints."""
import uuid
from datetime import datetime

from pydantic import BaseModel


class FriendRequestResponse(BaseModel):
    id: uuid.UUID
    from_user_id: uuid.UUID
    from_username: str
    to_user_id: uuid.UUID
    to_username: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class FriendResponse(BaseModel):
    user_id: uuid.UUID
    username: str
    avatar_url: str | None
    is_online: bool = False
    since: datetime  # when the friendship was accepted

    model_config = {"from_attributes": True}


class BlockedUserResponse(BaseModel):
    user_id: uuid.UUID
    username: str
    avatar_url: str | None = None

    model_config = {"from_attributes": True}


class FriendListResponse(BaseModel):
    friends: list[FriendResponse]
    pending_received: list[FriendRequestResponse]
    pending_sent: list[FriendRequestResponse]
    blocked: list[BlockedUserResponse] = []
