"""User search API routes: /api/users/*"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.db.models.user import User
from app.services import auth_service

router = APIRouter()


async def _get_current_user(request: Request, db: AsyncSession):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await auth_service.get_current_user(db, access_token)


@router.get("/search")
async def search_users(
    request: Request,
    q: str = Query(..., min_length=1, max_length=100),
    db: AsyncSession = Depends(get_db),
):
    """Search users by username (case-insensitive prefix match). Excludes current user."""
    user = await _get_current_user(request, db)

    results = (await db.execute(
        select(User.id, User.username, User.avatar_url)
        .where(
            func.lower(User.username).like(func.lower(f"{q}%")),
            User.id != user.id,
            User.is_active == True,
        )
        .limit(20)
    )).all()

    return [
        {"user_id": str(r.id), "username": r.username, "avatar_url": r.avatar_url}
        for r in results
    ]
