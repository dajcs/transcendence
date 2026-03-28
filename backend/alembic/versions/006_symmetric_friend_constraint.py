"""Replace directional unique constraint with symmetric pair index on friend_requests.

Before creating the index, deduplicates any mirrored pairs (A→B and B→A that
both exist) by deleting the older row of each conflicting pair. Rows with no
mirror are untouched, so production data is preserved. On a clean DB the DELETE
matches nothing.

Drops the old uq_friend_request_pair directional constraint (IF EXISTS, since
migration 005 may not have applied it on all instances) and creates a functional
unique index on (LEAST(from,to), GREATEST(from,to)) so (A,B) and (B,A) are
treated as the same pair regardless of request direction.

Revision ID: 006
Revises: 005
"""
from alembic import op

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove mirrored duplicate pairs (A→B and B→A) before applying symmetric index.
    # Keeps the newer row of each conflicting pair; rows with no mirror are untouched.
    op.execute("""
        DELETE FROM friend_requests a
        USING friend_requests b
        WHERE a.from_user_id = b.to_user_id
          AND a.to_user_id = b.from_user_id
          AND a.created_at < b.created_at
    """)

    # Drop the old directional constraint if it exists
    op.execute("ALTER TABLE friend_requests DROP CONSTRAINT IF EXISTS uq_friend_request_pair")

    # Create symmetric unique index.
    # ::text cast is intentional: LEAST/GREATEST on UUID columns requires an
    # explicit cast in some PostgreSQL versions to avoid operator ambiguity.
    # The overhead (~20 bytes per entry) is acceptable at this scale.
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
