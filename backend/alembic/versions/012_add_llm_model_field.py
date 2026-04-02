"""Add llm_model column to users table.

Revision ID: 012
Revises: 011
Create Date: 2026-04-01
"""
import sqlalchemy as sa
from alembic import op

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("llm_model", sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_column("users", "llm_model")
