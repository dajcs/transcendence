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
from app.config import settings
from app.services import auth_service
from app.services import oauth_service
from app.services.economy_service import get_balance

router = APIRouter()


def _resolve_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        first_ip = forwarded_for.split(",", 1)[0].strip()
        if first_ip:
            return first_ip
    return request.client.host if request.client else "unknown"


async def _to_user_response(db: AsyncSession, user) -> UserResponse:
    balances = await get_balance(db, user.id)
    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
        bp=float(balances["bp"]),
        kp=int(balances["kp"]),
        tp=float(balances["tp"]),
    )


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Set httpOnly auth cookies per D-08. Access token: SameSite=Lax (for OAuth compat)."""
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=18000,  # 5 hours
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
    return await _to_user_response(db, user)


@router.post("/login")
async def login(
    req: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    client_ip = _resolve_client_ip(request)
    user, access_token, refresh_token = await auth_service.login(db, req, client_ip)
    _set_auth_cookies(response, access_token, refresh_token)
    return await _to_user_response(db, user)


@router.get("/me", response_model=UserResponse)
async def me(request: Request, db: AsyncSession = Depends(get_db)):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = await auth_service.get_current_user(db, access_token)
    return await _to_user_response(db, user)


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


# ---------------------------------------------------------------------------
# OAuth 2.0 routes
# ---------------------------------------------------------------------------

@router.get("/oauth/providers")
async def oauth_providers():
    """Return which OAuth providers are configured (have client_id set)."""
    available = []
    if settings.google_client_id:
        available.append("google")
    if settings.github_client_id:
        available.append("github")
    if settings.ft_client_id:
        available.append("42")
    return {"providers": available}


@router.get("/oauth/{provider}")
async def oauth_initiate(provider: str):
    """Redirect user to the OAuth provider's authorization page."""
    from fastapi.responses import RedirectResponse
    url = await oauth_service.build_authorize_url(provider)
    return RedirectResponse(url=url)


@router.get("/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: str = "",
    state: str = "",
    error: str = "",
    db: AsyncSession = Depends(get_db),
):
    """Handle the OAuth callback — exchange code, upsert user, set cookies, redirect to dashboard."""
    from urllib.parse import quote
    from fastapi.responses import RedirectResponse

    if error or not code or not state:
        msg = quote(error or "OAuth authentication was cancelled or failed")
        return RedirectResponse(url=f"/login?error={msg}", status_code=302)

    try:
        user, access_token, refresh_token = await oauth_service.handle_callback(provider, code, state, db)
    except HTTPException as exc:
        msg = quote(exc.detail)
        return RedirectResponse(url=f"/login?error={msg}", status_code=302)

    redirect = RedirectResponse(url="/dashboard", status_code=302)
    redirect.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=18000,
    )
    redirect.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=604800,
        path="/api/auth/refresh",
    )
    return redirect
