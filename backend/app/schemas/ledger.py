"""Pydantic schemas for transaction ledger endpoints."""
import uuid
from datetime import datetime

from pydantic import BaseModel


class TransactionEntry(BaseModel):
    id: uuid.UUID
    date: datetime
    type: str
    description: str
    market_id: uuid.UUID | None
    market_title: str | None
    bp_delta: float
    tp_delta: float

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    transactions: list[TransactionEntry]
    total: int
