"""Comment service — create, list, upvote."""
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.market import Market, Comment, CommentUpvote
from app.db.models.transaction import LpEvent
from app.db.models.user import User
from app.schemas.comment import CommentCreate, CommentResponse

MAX_COMMENT_DEPTH = 7


async def create_comment(
    db: AsyncSession,
    user_id: uuid.UUID,
    bet_id: uuid.UUID,
    data: CommentCreate,
) -> CommentResponse:
    market = (await db.execute(select(Market).where(Market.id == bet_id))).scalar_one_or_none()
    if market is None:
        raise HTTPException(status_code=404, detail="Market not found")

    if data.parent_id is not None:
        parent = (await db.execute(select(Comment).where(Comment.id == data.parent_id))).scalar_one_or_none()
        if parent is None:
            raise HTTPException(status_code=404, detail="Parent comment not found")
        if parent.market_id != bet_id:
            raise HTTPException(status_code=422, detail="Parent comment belongs to another market")
        # Enforce max 8-post thread depth by traversing ancestor chain.
        depth = 0
        current = parent
        while current.parent_id is not None:
            current = (await db.execute(select(Comment).where(Comment.id == current.parent_id))).scalar_one()
            depth += 1
        if depth >= MAX_COMMENT_DEPTH:
            raise HTTPException(status_code=422, detail="Maximum reply depth (8 posts) reached")

    comment = Comment(
        id=uuid.uuid4(),
        market_id=bet_id,
        user_id=user_id,
        parent_id=data.parent_id,
        content=data.content,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    author = (await db.execute(select(User).where(User.id == user_id))).scalar_one()
    response = CommentResponse(
        id=comment.id,
        bet_id=comment.market_id,
        user_id=comment.user_id,
        author_username=author.username,
        parent_id=comment.parent_id,
        content=comment.content,
        created_at=comment.created_at,
        upvote_count=0,
    )
    try:
        from app.socket.server import sio
        await sio.emit(
            "bet:comment_added",
            {
                "comment_id": str(comment.id),
                "user_id": str(comment.user_id),
                "content": comment.content,
                "created_at": comment.created_at.isoformat(),
            },
            room=f"bet:{bet_id}",
        )
    except Exception:
        pass
    return response


async def list_comments(
    db: AsyncSession,
    bet_id: uuid.UUID,
    current_user_id: uuid.UUID | None = None,
) -> list[CommentResponse]:
    rows = (
        await db.execute(
            select(Comment, User.username)
            .join(User, User.id == Comment.user_id)
            .where(Comment.market_id == bet_id, Comment.deleted_at.is_(None))
            .order_by(Comment.created_at.asc())
        )
    ).all()

    liked_ids: set[uuid.UUID] = set()
    if current_user_id is not None and rows:
        comment_ids = [comment.id for comment, _ in rows]
        liked_rows = await db.execute(
            select(CommentUpvote.comment_id).where(
                CommentUpvote.user_id == current_user_id,
                CommentUpvote.comment_id.in_(comment_ids),
            )
        )
        liked_ids = {row[0] for row in liked_rows}

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
                bet_id=comment.market_id,
                user_id=comment.user_id,
                author_username=author_username,
                parent_id=comment.parent_id,
                content=comment.content,
                created_at=comment.created_at,
                upvote_count=int(upvote_count),
                user_has_liked=comment.id in liked_ids,
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
            LpEvent(
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


async def unlike_comment(db: AsyncSession, voter_id: uuid.UUID, comment_id: uuid.UUID) -> None:
    """Remove upvote from comment; decrement unconverted LP for author by 1."""
    comment = (await db.execute(select(Comment).where(Comment.id == comment_id))).scalar_one_or_none()
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id == voter_id:
        return  # self-unlike — no-op
    delete_result = await db.execute(
        delete(CommentUpvote).where(
            CommentUpvote.comment_id == comment_id,
            CommentUpvote.user_id == voter_id,
        )
    )
    if delete_result.rowcount == 0:
        return  # not upvoted — no-op
    lp_total = (
        await db.execute(select(func.sum(LpEvent.amount)).where(LpEvent.user_id == comment.user_id))
    ).scalar_one()
    if int(lp_total or 0) > 0:
        today = datetime.now(timezone.utc).date()
        db.add(
            LpEvent(
                user_id=comment.user_id,
                amount=-1,
                source_type="comment_upvote",
                source_id=comment_id,
                day_date=today,
            )
        )
    await db.commit()
