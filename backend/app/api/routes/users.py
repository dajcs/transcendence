"""User profile API routes: /api/users/*"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.profile import PublicProfileResponse, UpdateProfileRequest, UserSearchResult
from app.services import auth_service
from app.services import profile_service
from app.services import gdpr_service

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


_VALID_MODES = {"default", "disabled", "custom"}
_VALID_PROVIDERS = {"anthropic", "openai", "gemini", "grok", "openrouter"}


class UpdateUserRequest(BaseModel):
    llm_mode: str | None = None
    llm_provider: str | None = None
    llm_api_key: str | None = None  # empty string clears the key
    llm_model: str | None = None


@router.get("/me")
async def get_my_settings(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Get per-user LLM settings. API key is never returned, only whether it is set."""
    user = await _get_current_user(request, db)
    return {
        "llm_mode": user.llm_mode,
        "llm_provider": user.llm_provider,
        "llm_model": user.llm_model,
        "llm_api_key_set": bool(user.llm_api_key),
    }


@router.patch("/me")
async def patch_my_settings(
    data: UpdateUserRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Update per-user LLM settings."""
    user = await _get_current_user(request, db)
    if data.llm_mode is not None:
        if data.llm_mode not in _VALID_MODES:
            raise HTTPException(status_code=422, detail=f"llm_mode must be one of {_VALID_MODES}")
        user.llm_mode = data.llm_mode
    if data.llm_provider is not None:
        if data.llm_provider not in _VALID_PROVIDERS:
            raise HTTPException(status_code=422, detail=f"llm_provider must be one of {_VALID_PROVIDERS}")
        user.llm_provider = data.llm_provider
    if data.llm_api_key is not None:
        user.llm_api_key = data.llm_api_key or None  # empty string → NULL
    if data.llm_model is not None:
        user.llm_model = data.llm_model or None  # empty string → NULL
    await db.commit()
    return {"ok": True, "llm_mode": user.llm_mode, "llm_provider": user.llm_provider, "llm_model": user.llm_model, "llm_api_key_set": bool(user.llm_api_key)}


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


@router.get("/data-export")
async def export_my_data(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Export all user data as JSON (GDPR Art. 15 / Art. 20)."""
    user = await _get_current_user(request, db)
    data = await gdpr_service.export_user_data(db, user)
    return JSONResponse(
        content=data,
        headers={"Content-Disposition": f'attachment; filename="voxpopuli-data-export.json"'},
    )


@router.delete("/account")
async def delete_my_account(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Delete account with pseudonymization (GDPR Art. 17)."""
    user = await _get_current_user(request, db)
    await gdpr_service.delete_account(db, user)
    response = JSONResponse(content={"ok": True, "message": "Account deleted and data pseudonymized."})
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/auth/refresh")
    return response


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
