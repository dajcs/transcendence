"""Add unique constraint on friend_requests(from_user_id, to_user_id).

Revision ID: 005
Revises: 004
"""
from alembic import op

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_friend_request_pair",
        "friend_requests",
        ["from_user_id", "to_user_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_friend_request_pair", "friend_requests", type_="unique")
