"""JWT token creation and verification."""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from app.config import settings


def _read_private_key() -> bytes:
    with open(settings.jwt_private_key_path, "rb") as f:
        return f.read()


def _read_public_key() -> bytes:
    with open(settings.jwt_public_key_path, "rb") as f:
        return f.read()


def create_access_token(user_id: str, email: str, username: str) -> str:
    """RS256-signed access token, 15-minute expiry."""
    payload = {
        "sub": user_id,
        "email": email,
        "username": username,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
    }
    return jwt.encode(payload, _read_private_key(), algorithm="RS256")


def decode_access_token(token: str) -> dict:
    """Decode and verify RS256 access token. Raises jwt.InvalidTokenError on failure."""
    # algorithms= list is REQUIRED — prevents algorithm confusion attacks
    return jwt.decode(token, _read_public_key(), algorithms=["RS256"])


def create_refresh_token() -> str:
    """Generate a secure random refresh token (opaque, not JWT)."""
    return secrets.token_urlsafe(64)


def create_password_reset_token(email: str) -> str:
    """HMAC-SHA256 signed reset token with 1-hour TTL embedded."""
    expires = int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp())
    message = f"{email}:{expires}"
    sig = hmac.new(settings.secret_key.encode(), message.encode(), hashlib.sha256).hexdigest()
    return f"{message}:{sig}"


def verify_password_reset_token(token: str) -> str | None:
    """Returns email if token is valid and not expired, else None."""
    try:
        parts = token.rsplit(":", 2)
        if len(parts) != 3:
            return None
        email, expires_str, sig = parts
        expires = int(expires_str)
        if datetime.now(timezone.utc).timestamp() > expires:
            return None
        expected = hmac.new(settings.secret_key.encode(), f"{email}:{expires_str}".encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        return email
    except Exception:
        return None
