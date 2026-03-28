"""Add bio column to users table.

Revision ID: 008
Revises: 007
"""
from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='users' AND column_name='bio'"
    ))
    if result.fetchone() is None:
        op.add_column("users", sa.Column("bio", sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_column("users", "bio")
