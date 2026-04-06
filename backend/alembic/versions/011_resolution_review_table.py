"""Add resolution_reviews table for accept/dispute voting during proposer_resolved window.

Revision ID: 011
Revises: 010
Create Date: 2026-04-01
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "resolution_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("bet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bets.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("vote", sa.Text, nullable=False),
        sa.Column("voted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("bet_id", "user_id", name="uq_resolution_reviews_bet_user"),
    )
    op.create_index("ix_resolution_reviews_bet_id", "resolution_reviews", ["bet_id"])


def downgrade() -> None:
    op.drop_index("ix_resolution_reviews_bet_id", table_name="resolution_reviews")
    op.drop_table("resolution_reviews")
