"""Comment routes."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.comment import CommentCreate, CommentResponse
from app.services import auth_service, comment_service

router = APIRouter()


async def _get_current_user(request: Request, db: AsyncSession):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await auth_service.get_current_user(db, access_token)


async def _get_current_user_optional(request: Request, db: AsyncSession):
    """Returns None if not authenticated (no exception)."""
    access_token = request.cookies.get("access_token")
    if not access_token:
        return None
    try:
        return await auth_service.get_current_user(db, access_token)
    except HTTPException:
        return None


@router.post("/markets/{bet_id}/comments", response_model=CommentResponse, status_code=201)
async def create_comment(
    bet_id: uuid.UUID,
    data: CommentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = await _get_current_user(request, db)
    return await comment_service.create_comment(db, user_id=user.id, bet_id=bet_id, data=data)


@router.get("/markets/{bet_id}/comments", response_model=list[CommentResponse])
async def list_comments(bet_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user_optional(request, db)
    current_user_id = user.id if user else None
    return await comment_service.list_comments(db, bet_id=bet_id, current_user_id=current_user_id)


@router.post("/comments/{comment_id}/upvote", status_code=201)
async def upvote_comment(
    comment_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = await _get_current_user(request, db)
    await comment_service.upvote_comment(db, voter_id=user.id, comment_id=comment_id)
    return {"ok": True}


@router.delete("/comments/{comment_id}/upvote", status_code=200)
async def unlike_comment(
    comment_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = await _get_current_user(request, db)
    await comment_service.unlike_comment(db, voter_id=user.id, comment_id=comment_id)
    return {"ok": True}
