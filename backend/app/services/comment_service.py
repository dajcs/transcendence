"""Comment service — create, list, upvote."""
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.bet import Bet, Comment, CommentUpvote
from app.db.models.transaction import KpEvent
from app.db.models.user import User
from app.schemas.comment import CommentCreate, CommentResponse


async def create_comment(
    db: AsyncSession,
    user_id: uuid.UUID,
    bet_id: uuid.UUID,
    data: CommentCreate,
) -> CommentResponse:
    market = (await db.execute(select(Bet).where(Bet.id == bet_id))).scalar_one_or_none()
    if market is None:
        raise HTTPException(status_code=404, detail="Market not found")

    if data.parent_id is not None:
        parent = (await db.execute(select(Comment).where(Comment.id == data.parent_id))).scalar_one_or_none()
        if parent is None:
            raise HTTPException(status_code=404, detail="Parent comment not found")
        if parent.bet_id != bet_id:
            raise HTTPException(status_code=422, detail="Parent comment belongs to another market")
        # Enforce max 5-level nesting by traversing ancestor chain
        depth = 0
        current = parent
        while current.parent_id is not None:
            current = (await db.execute(select(Comment).where(Comment.id == current.parent_id))).scalar_one()
            depth += 1
        if depth >= 4:
            raise HTTPException(status_code=422, detail="Maximum reply depth (5 levels) reached")

    comment = Comment(
        id=uuid.uuid4(),
        bet_id=bet_id,
        user_id=user_id,
        parent_id=data.parent_id,
        content=data.content,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    author = (await db.execute(select(User).where(User.id == user_id))).scalar_one()
    return CommentResponse(
        id=comment.id,
        bet_id=comment.bet_id,
        user_id=comment.user_id,
        author_username=author.username,
        parent_id=comment.parent_id,
        content=comment.content,
        created_at=comment.created_at,
        upvote_count=0,
    )


async def list_comments(db: AsyncSession, bet_id: uuid.UUID) -> list[CommentResponse]:
    rows = (
        await db.execute(
            select(Comment, User.username)
            .join(User, User.id == Comment.user_id)
            .where(Comment.bet_id == bet_id, Comment.deleted_at.is_(None))
            .order_by(Comment.created_at.asc())
        )
    ).all()

    response: list[CommentResponse] = []
    for comment, author_username in rows:
        upvote_count = (
            await db.execute(
                select(func.count(CommentUpvote.comment_id)).where(CommentUpvote.comment_id == comment.id)
            )
        ).scalar_one()
        response.append(
            CommentResponse(
                id=comment.id,
                bet_id=comment.bet_id,
                user_id=comment.user_id,
                author_username=author_username,
                parent_id=comment.parent_id,
                content=comment.content,
                created_at=comment.created_at,
                upvote_count=int(upvote_count),
            )
        )

    return response


async def upvote_comment(db: AsyncSession, voter_id: uuid.UUID, comment_id: uuid.UUID) -> None:
    comment = (await db.execute(select(Comment).where(Comment.id == comment_id))).scalar_one_or_none()
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id == voter_id:
        return  # self-upvote — silent no-op

    today = datetime.now(timezone.utc).date()
    try:
        db.add(CommentUpvote(comment_id=comment_id, user_id=voter_id))
        db.add(
            KpEvent(
                user_id=comment.user_id,
                amount=1,
                source_type="comment_upvote",
                source_id=comment_id,
                day_date=today,
            )
        )
        await db.commit()
    except IntegrityError:
        await db.rollback()  # already upvoted — treat as no-op
