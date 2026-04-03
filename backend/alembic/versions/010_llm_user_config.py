"""Replace llm_opt_out with llm_mode/provider/api_key columns.

Revision ID: 010
Revises: 009
Create Date: 2026-03-31
"""
import sqlalchemy as sa
from alembic import op

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("users", "llm_opt_out")
    op.add_column("users", sa.Column("llm_mode", sa.Text, nullable=False, server_default="default"))
    op.add_column("users", sa.Column("llm_provider", sa.Text, nullable=True))
    op.add_column("users", sa.Column("llm_api_key", sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_column("users", "llm_api_key")
    op.drop_column("users", "llm_provider")
    op.drop_column("users", "llm_mode")
    op.add_column("users", sa.Column("llm_opt_out", sa.Boolean, nullable=False, server_default=sa.false()))
