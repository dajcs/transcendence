"""Rename kp_events table to lp_events (KP -> LP).

Revision ID: 015
Revises: 014
Create Date: 2026-04-19
"""
from alembic import op

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.rename_table("kp_events", "lp_events")
    # Rename the auto-generated sequence so it tracks lp_events
    op.execute("ALTER SEQUENCE IF EXISTS kp_events_id_seq RENAME TO lp_events_id_seq")


def downgrade() -> None:
    op.rename_table("lp_events", "kp_events")
    op.execute("ALTER SEQUENCE IF EXISTS lp_events_id_seq RENAME TO kp_events_id_seq")
