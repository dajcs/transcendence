"""Add market_type, choices, numeric range to bets table.

Revision ID: 002
Revises: 001
"""

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


def upgrade() -> None:
    op.add_column("bets", sa.Column("market_type", sa.Text(), nullable=False, server_default="binary"))
    op.add_column("bets", sa.Column("choices", JSONB(), nullable=True))
    op.add_column("bets", sa.Column("numeric_min", sa.Float(), nullable=True))
    op.add_column("bets", sa.Column("numeric_max", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("bets", "numeric_max")
    op.drop_column("bets", "numeric_min")
    op.drop_column("bets", "choices")
    op.drop_column("bets", "market_type")
