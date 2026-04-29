"""Application-layer encryption helpers for user-owned secrets."""
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

_PREFIX = "fernet:"


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.secret_key.encode()).digest())
    return Fernet(key)


def encrypt_secret(value: str | None) -> str | None:
    """Encrypt a nullable secret for storage."""
    if value is None:
        return None
    token = _fernet().encrypt(value.encode()).decode()
    return f"{_PREFIX}{token}"


def decrypt_secret(value: str | None) -> str | None:
    """Decrypt a nullable secret, accepting legacy plaintext values."""
    if value is None:
        return None
    if not value.startswith(_PREFIX):
        return value
    token = value[len(_PREFIX):].encode()
    try:
        return _fernet().decrypt(token).decode()
    except InvalidToken:
        raise ValueError("Stored secret could not be decrypted") from None
