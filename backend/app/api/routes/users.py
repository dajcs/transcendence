"""User profile API routes: /api/users/*"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.profile import PublicProfileResponse, UpdateProfileRequest, UserSearchResult
from app.services import auth_service
from app.services import profile_service

router = APIRouter()


async def _get_current_user(request: Request, db: AsyncSession):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await auth_service.get_current_user(db, access_token)


async def _get_optional_user(request: Request, db: AsyncSession):
    """Return current user or None if not authenticated."""
    access_token = request.cookies.get("access_token")
    if not access_token:
        return None
    try:
        return await auth_service.get_current_user(db, access_token)
    except HTTPException:
        return None


class UpdateUserRequest(BaseModel):
    llm_opt_out: bool | None = None


@router.get("/me")
async def get_my_settings(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Get per-user settings for the authenticated user."""
    user = await _get_current_user(request, db)
    return {"llm_opt_out": user.llm_opt_out}


@router.patch("/me")
async def patch_my_settings(
    data: UpdateUserRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Update per-user settings (e.g. LLM opt-out)."""
    user = await _get_current_user(request, db)
    if data.llm_opt_out is not None:
        user.llm_opt_out = data.llm_opt_out
    await db.commit()
    return {"ok": True, "llm_opt_out": user.llm_opt_out}


@router.put("/me", response_model=PublicProfileResponse)
async def update_my_profile(
    data: UpdateProfileRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Update the authenticated user's profile."""
    user = await _get_current_user(request, db)
    await profile_service.update_profile(db, user.id, data)
    return await profile_service.get_public_profile(db, user.username, user.id)


@router.get("/search", response_model=list[UserSearchResult])
async def search_users(
    q: str = Query(min_length=2, max_length=50),
    db: AsyncSession = Depends(get_db),
):
    """Search users by username."""
    return await profile_service.search_users(db, q)


@router.get("/{username}", response_model=PublicProfileResponse)
async def get_profile(
    username: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Get a user's public profile."""
    current_user = await _get_optional_user(request, db)
    current_user_id = current_user.id if current_user else None
    return await profile_service.get_public_profile(db, username, current_user_id)
