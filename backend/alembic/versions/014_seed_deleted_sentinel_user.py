"""Seed sentinel deleted user for GDPR pseudonymization.

Revision ID: 014
Revises: 013
Create Date: 2026-04-07
"""
from alembic import op

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None

NIL_UUID = "00000000-0000-0000-0000-000000000000"


def upgrade() -> None:
    op.execute(f"""
        INSERT INTO users (id, email, username, is_active, llm_mode)
        VALUES (
            '{NIL_UUID}',
            'deleted@deleted.local',
            '[deleted]',
            false,
            'disabled'
        )
        ON CONFLICT (id) DO NOTHING
    """)


def downgrade() -> None:
    op.execute(f"DELETE FROM users WHERE id = '{NIL_UUID}'")
