"""Auth API routes: /api/auth/*"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    ResetConfirmBody,
    ResetRequestBody,
    UserResponse,
)
from app.services import auth_service

router = APIRouter()


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Set httpOnly auth cookies per D-08. Access token: SameSite=Lax (for OAuth compat)."""
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=900,  # 15 minutes
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=604800,  # 7 days
        path="/api/auth/refresh",  # restrict to refresh endpoint only
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token", path="/api/auth/refresh")


@router.post("/register", status_code=201, response_model=UserResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    user = await auth_service.register(db, req)
    return user


@router.post("/login")
async def login(
    req: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    user, access_token, refresh_token = await auth_service.login(db, req, client_ip)
    _set_auth_cookies(response, access_token, refresh_token)
    return UserResponse.model_validate(user)


@router.get("/me", response_model=UserResponse)
async def me(request: Request, db: AsyncSession = Depends(get_db)):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = await auth_service.get_current_user(db, access_token)
    return user


@router.post("/refresh")
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    old_refresh = request.cookies.get("refresh_token")
    if not old_refresh:
        raise HTTPException(status_code=401, detail="No refresh token")
    user, new_access, new_refresh = await auth_service.refresh(db, old_refresh)
    _set_auth_cookies(response, new_access, new_refresh)
    return {"ok": True}


@router.post("/logout")
async def logout(request: Request, response: Response):
    refresh_token = request.cookies.get("refresh_token")
    await auth_service.logout(refresh_token)
    _clear_auth_cookies(response)
    return {"ok": True}


@router.post("/reset-request")
async def reset_request(req: ResetRequestBody, db: AsyncSession = Depends(get_db)):
    await auth_service.reset_request(db, req.email)
    return {"ok": True}  # Always 200 — no enumeration


@router.post("/reset-confirm")
async def reset_confirm(req: ResetConfirmBody, db: AsyncSession = Depends(get_db)):
    await auth_service.reset_confirm(db, req)
    return {"ok": True}
