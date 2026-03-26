"""Drop unique constraint on bet_positions(bet_id, user_id) to allow re-betting after withdrawal.

Revision ID: 004
Revises: 003
"""

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None

from alembic import op


def upgrade() -> None:
    op.drop_constraint("bet_positions_bet_id_user_id_key", "bet_positions", type_="unique")


def downgrade() -> None:
    op.create_unique_constraint(
        "bet_positions_bet_id_user_id_key", "bet_positions", ["bet_id", "user_id"]
    )
