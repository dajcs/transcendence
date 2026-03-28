"""Replace directional unique constraint with symmetric pair index on friend_requests.

Clears all existing friend_requests (test DB only), drops the old
uq_friend_request_pair constraint, and creates a functional unique index
on (LEAST(from,to), GREATEST(from,to)) so (A,B) and (B,A) are treated
as the same pair.

Revision ID: 006
Revises: 005
"""
from alembic import op

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Clear all rows — test DB only
    op.execute("DELETE FROM friend_requests")

    # Drop the old directional constraint if it exists
    op.execute("ALTER TABLE friend_requests DROP CONSTRAINT IF EXISTS uq_friend_request_pair")

    # Create symmetric unique index
    op.execute(
        """
        CREATE UNIQUE INDEX uq_friend_pair_symmetric
        ON friend_requests (
            LEAST(from_user_id::text, to_user_id::text),
            GREATEST(from_user_id::text, to_user_id::text)
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_friend_pair_symmetric")
    op.create_unique_constraint(
        "uq_friend_request_pair",
        "friend_requests",
        ["from_user_id", "to_user_id"],
    )
