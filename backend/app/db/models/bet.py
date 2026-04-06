"""Bet, position, resolution, dispute, and comment models."""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Numeric, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Bet(Base):
    __tablename__ = "bets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proposer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    resolution_criteria: Mapped[str] = mapped_column(Text, nullable=False)
    resolution_source: Mapped[str | None] = mapped_column(Text, nullable=True)
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    market_type: Mapped[str] = mapped_column(Text, nullable=False, default="binary")
    choices: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    numeric_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    numeric_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="open")
    winning_side: Mapped[str | None] = mapped_column(Text, nullable=True)
    celery_task_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class BetPosition(Base):
    __tablename__ = "bet_positions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bets.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    side: Mapped[str] = mapped_column(Text, nullable=False)  # 'yes'|'no'
    bp_staked: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    placed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    refund_bp: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

    # No unique constraint — users can re-bet after withdrawal.
    # Application logic enforces at most one active position (withdrawn_at IS NULL).


class PositionHistory(Base):
    __tablename__ = "position_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bets.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    side: Mapped[str] = mapped_column(Text, nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Resolution(Base):
    __tablename__ = "resolutions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bets.id"), unique=True, nullable=False)
    tier: Mapped[int] = mapped_column(nullable=False)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    outcome: Mapped[str] = mapped_column(Text, nullable=False)
    justification: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    overturned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Dispute(Base):
    __tablename__ = "disputes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bets.id"), nullable=False)
    opened_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    closes_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="open")
    final_outcome: Mapped[str | None] = mapped_column(Text, nullable=True)


class DisputeVote(Base):
    __tablename__ = "dispute_votes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dispute_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("disputes.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    vote: Mapped[str] = mapped_column(Text, nullable=False)  # 'yes'|'no'
    weight: Mapped[float] = mapped_column(Numeric(3, 1), nullable=False)
    voted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint("dispute_id", "user_id"),)


class ResolutionReview(Base):
    """Tracks per-user accept/dispute votes during the proposer_resolved 48h window."""

    __tablename__ = "resolution_reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bets.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    vote: Mapped[str] = mapped_column(Text, nullable=False)  # 'accept' | 'dispute'
    voted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint("bet_id", "user_id"),)


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bets.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("comments.id"), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CommentUpvote(Base):
    __tablename__ = "comment_upvotes"

    comment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("comments.id"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class BetUpvote(Base):
    __tablename__ = "bet_upvotes"

    bet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bets.id"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
