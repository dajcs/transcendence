"""Add composite indexes on friend_requests(from_user_id, status) and (to_user_id, status).

Service queries filter by user + status on every list call; without these indexes
they degrade to full table scans as the table grows.

Revision ID: 007
Revises: 006
"""
from alembic import op

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("idx_friend_requests_from_status", "friend_requests", ["from_user_id", "status"])
    op.create_index("idx_friend_requests_to_status", "friend_requests", ["to_user_id", "status"])


def downgrade() -> None:
    op.drop_index("idx_friend_requests_from_status", table_name="friend_requests")
    op.drop_index("idx_friend_requests_to_status", table_name="friend_requests")
