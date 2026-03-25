"""Pydantic schemas for bet endpoints."""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class BetPlaceRequest(BaseModel):
    bet_id: uuid.UUID
    side: Literal["yes", "no"]


class BetPositionResponse(BaseModel):
    id: uuid.UUID
    bet_id: uuid.UUID
    user_id: uuid.UUID
    side: str
    bp_staked: float
    placed_at: datetime
    withdrawn_at: datetime | None
    refund_bp: float | None

    model_config = {"from_attributes": True}


class BetWithdrawResponse(BaseModel):
    id: uuid.UUID
    refund_bp: float
    message: str


class BetPositionWithMarket(BaseModel):
    id: uuid.UUID
    bet_id: uuid.UUID
    side: str
    bp_staked: float
    placed_at: datetime
    withdrawn_at: datetime | None
    refund_bp: float | None
    market_title: str
    market_status: str
    yes_pct: float
    no_pct: float


class BetPositionsListResponse(BaseModel):
    active: list[BetPositionWithMarket]
    resolved: list[BetPositionWithMarket]
