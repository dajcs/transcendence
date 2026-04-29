"""Rename bio column to mission in users table.

Revision ID: 017
Revises: 016
"""
from alembic import op

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("users", "bio", new_column_name="mission")


def downgrade() -> None:
    op.alter_column("users", "mission", new_column_name="bio")
