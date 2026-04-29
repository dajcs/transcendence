"""Add celery_task_id column to markets table.

Revision ID: 013
Revises: 012
Create Date: 2026-04-03
"""
import sqlalchemy as sa
from alembic import op

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("markets", sa.Column("celery_task_id", sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_column("markets", "celery_task_id")
