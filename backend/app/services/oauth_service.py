"""OAuth 2.0 Authorization Code + PKCE flow for Google, GitHub, 42."""
import base64
import hashlib
import json
import secrets
import uuid
from dataclasses import dataclass

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models.user import OauthAccount, User
from app.services.economy_service import credit_bp, convert_kp_to_bp
from app.utils.jwt import create_access_token, create_refresh_token

# ---------------------------------------------------------------------------
# Provider configuration
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class OAuthProvider:
    authorize_url: str
    token_url: str
    profile_url: str
    scopes: str
    client_id: str
    client_secret: str


def _get_provider(name: str) -> OAuthProvider:
    providers = {
        "google": OAuthProvider(
            authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
            token_url="https://oauth2.googleapis.com/token",
            profile_url="https://www.googleapis.com/oauth2/v2/userinfo",
            scopes="openid email profile",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
        ),
        "github": OAuthProvider(
            authorize_url="https://github.com/login/oauth/authorize",
            token_url="https://github.com/login/oauth/access_token",
            profile_url="https://api.github.com/user",
            scopes="user:email read:user",
            client_id=settings.github_client_id,
            client_secret=settings.github_client_secret,
        ),
        "42": OAuthProvider(
            authorize_url="https://api.intra.42.fr/oauth/authorize",
            token_url="https://api.intra.42.fr/oauth/token",
            profile_url="https://api.intra.42.fr/v2/me",
            scopes="public",
            client_id=settings.ft_client_id,
            client_secret=settings.ft_client_secret,
        ),
    }
    if name not in providers:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {name}")
    prov = providers[name]
    if not prov.client_id or not prov.client_secret:
        raise HTTPException(status_code=501, detail=f"OAuth provider '{name}' is not configured")
    return prov


# ---------------------------------------------------------------------------
# PKCE helpers
# ---------------------------------------------------------------------------

def _generate_pkce() -> tuple[str, str]:
    """Return (code_verifier, code_challenge) for S256 PKCE."""
    verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return verifier, challenge


# ---------------------------------------------------------------------------
# Redis state management
# ---------------------------------------------------------------------------

def _get_redis():
    import redis.asyncio as aioredis
    return aioredis.from_url(settings.redis_url, decode_responses=True)


async def build_authorize_url(provider_name: str, redirect_base: str | None = None) -> str:
    """Generate the OAuth authorize URL with PKCE + state, store in Redis."""
    prov = _get_provider(provider_name)
    state = secrets.token_urlsafe(32)
    verifier, challenge = _generate_pkce()

    redis = _get_redis()
    await redis.setex(
        f"oauth_state:{state}",
        600,  # 10 minutes TTL
        json.dumps({"provider": provider_name, "code_verifier": verifier}),
    )

    callback_url = f"{redirect_base or settings.oauth_redirect_base}/api/auth/oauth/{provider_name}/callback"

    params: dict[str, str] = {
        "client_id": prov.client_id,
        "redirect_uri": callback_url,
        "response_type": "code",
        "scope": prov.scopes,
        "state": state,
    }

    # Only Google supports PKCE; GitHub and 42 ignore it
    if provider_name == "google":
        params["code_challenge"] = challenge
        params["code_challenge_method"] = "S256"
        params["access_type"] = "offline"
        params["prompt"] = "consent"

    url = str(httpx.URL(prov.authorize_url, params=params))
    return url


async def handle_callback(
    provider_name: str,
    code: str,
    state: str,
    db: AsyncSession,
    redirect_base: str | None = None,
) -> tuple[User, str, str]:
    """
    Validate state, exchange code for token, fetch profile, upsert user.
    Returns (user, access_token, refresh_token).
    """
    # 1. Validate state from Redis
    redis = _get_redis()
    stored = await redis.get(f"oauth_state:{state}")
    if not stored:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    state_data = json.loads(stored)
    if state_data["provider"] != provider_name:
        raise HTTPException(status_code=400, detail="State/provider mismatch")

    code_verifier = state_data["code_verifier"]
    # Consume state (one-time use)
    await redis.delete(f"oauth_state:{state}")

    prov = _get_provider(provider_name)
    callback_url = f"{redirect_base or settings.oauth_redirect_base}/api/auth/oauth/{provider_name}/callback"

    # 2. Exchange authorization code for access token
    # Only pass code_verifier for providers that support PKCE (Google)
    token_data = await _exchange_code(prov, code, callback_url, code_verifier if provider_name == "google" else None)
    provider_access_token = token_data["access_token"]

    # 3. Fetch user profile from provider
    profile = await _fetch_profile(prov, provider_name, provider_access_token)

    # 4. Upsert user + oauth_account
    user = await _upsert_user(db, provider_name, profile)

    # 5. Convert any accumulated KP to BP on login
    kp_converted, bp_earned = await convert_kp_to_bp(db, user.id)
    if bp_earned > 0:
        await db.commit()
        from app.services.notification_service import notify_kp_converted
        await notify_kp_converted(db, user.id, kp_converted, bp_earned)

    # 6. Issue our JWT tokens
    access_token = create_access_token(str(user.id), user.email, user.username)
    refresh_token = create_refresh_token()
    await redis.setex(f"refresh:{refresh_token}", 604800, str(user.id))

    return user, access_token, refresh_token


# ---------------------------------------------------------------------------
# Token exchange
# ---------------------------------------------------------------------------

async def _exchange_code(
    prov: OAuthProvider,
    code: str,
    redirect_uri: str,
    code_verifier: str | None,
) -> dict:
    """Exchange authorization code for access token."""
    payload: dict[str, str] = {
        "client_id": prov.client_id,
        "client_secret": prov.client_secret,
        "code": code,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }
    if code_verifier:
        payload["code_verifier"] = code_verifier

    headers = {"Accept": "application/json"}

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(prov.token_url, data=payload, headers=headers)

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"OAuth token exchange failed: {resp.text[:200]}",
        )

    data = resp.json()
    if "access_token" not in data:
        error = data.get("error_description", data.get("error", "unknown"))
        raise HTTPException(status_code=502, detail=f"OAuth token error: {error}")

    return data


# ---------------------------------------------------------------------------
# Profile fetching (provider-specific normalization)
# ---------------------------------------------------------------------------

@dataclass
class OAuthProfile:
    provider_user_id: str
    email: str
    username: str
    avatar_url: str | None


async def _fetch_profile(prov: OAuthProvider, provider_name: str, access_token: str) -> OAuthProfile:
    """Fetch and normalize user profile from the OAuth provider."""
    headers = {"Authorization": f"Bearer {access_token}"}

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(prov.profile_url, headers=headers)

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to fetch OAuth profile")

    data = resp.json()

    if provider_name == "google":
        return OAuthProfile(
            provider_user_id=str(data["id"]),
            email=data["email"],
            username=data.get("name", data["email"].split("@")[0]),
            avatar_url=data.get("picture"),
        )
    elif provider_name == "github":
        email = data.get("email")
        if not email:
            # GitHub may not return email in profile — fetch from /user/emails
            email = await _fetch_github_email(access_token)
        return OAuthProfile(
            provider_user_id=str(data["id"]),
            email=email,
            username=data["login"],
            avatar_url=data.get("avatar_url"),
        )
    elif provider_name == "42":
        return OAuthProfile(
            provider_user_id=str(data["id"]),
            email=data["email"],
            username=data["login"],
            avatar_url=data.get("image", {}).get("link"),
        )
    else:
        raise HTTPException(status_code=500, detail="Unhandled provider")


async def _fetch_github_email(access_token: str) -> str:
    """Fetch primary email from GitHub /user/emails endpoint."""
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get("https://api.github.com/user/emails", headers=headers)

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to fetch GitHub email")

    emails = resp.json()
    # Prefer primary verified email
    for e in emails:
        if e.get("primary") and e.get("verified"):
            return e["email"]
    # Fallback to first verified
    for e in emails:
        if e.get("verified"):
            return e["email"]
    # Last resort
    if emails:
        return emails[0]["email"]
    raise HTTPException(status_code=502, detail="No email found on GitHub account")


# ---------------------------------------------------------------------------
# User upsert + account linking
# ---------------------------------------------------------------------------

async def _upsert_user(db: AsyncSession, provider_name: str, profile: OAuthProfile) -> User:
    """
    Account linking logic per AUTH.md:
    1. Look up oauth_accounts by (provider, provider_user_id) → login existing
    2. If not found, check if email matches existing user → link it
    3. If email is new → create new user
    """
    # 1. Check existing OAuth link
    oauth = (await db.execute(
        select(OauthAccount).where(
            OauthAccount.provider == provider_name,
            OauthAccount.provider_user_id == profile.provider_user_id,
        )
    )).scalar_one_or_none()

    if oauth:
        user = (await db.execute(select(User).where(User.id == oauth.user_id))).scalar_one()
        return user

    # 2. Check if email matches an existing user → link
    existing_user = (await db.execute(
        select(User).where(User.email == profile.email)
    )).scalar_one_or_none()

    if existing_user:
        oauth_link = OauthAccount(
            user_id=existing_user.id,
            provider=provider_name,
            provider_user_id=profile.provider_user_id,
        )
        db.add(oauth_link)
        await db.commit()
        return existing_user

    # 3. New user — ensure unique username
    username = await _ensure_unique_username(db, profile.username)

    user = User(
        id=uuid.uuid4(),
        email=profile.email,
        username=username,
        password_hash=None,  # OAuth-only users have no password
        avatar_url=profile.avatar_url,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    oauth_link = OauthAccount(
        user_id=user.id,
        provider=provider_name,
        provider_user_id=profile.provider_user_id,
    )
    db.add(oauth_link)
    await db.commit()
    await db.refresh(user)

    # Credit signup bonus
    await credit_bp(db, user.id, 10.0, "signup")
    await db.commit()

    return user


async def _ensure_unique_username(db: AsyncSession, base: str) -> str:
    """Append a random suffix if the username is already taken."""
    # Sanitize: keep only alphanumeric, underscore, hyphen
    import re
    clean = re.sub(r"[^A-Za-z0-9_\-]", "", base)
    if len(clean) < 3:
        clean = clean + "user"
    clean = clean[:28]  # leave room for suffix

    candidate = clean
    for _ in range(10):
        exists = (await db.execute(
            select(User.id).where(User.username == candidate)
        )).scalar_one_or_none()
        if not exists:
            return candidate
        candidate = f"{clean}_{secrets.token_hex(2)}"

    # Extremely unlikely fallback
    return f"{clean}_{secrets.token_hex(4)}"
