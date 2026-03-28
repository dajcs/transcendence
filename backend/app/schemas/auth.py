"""Pydantic schemas for auth endpoints."""
import re
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator, model_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        if len(v) < 3 or len(v) > 32:
            raise ValueError("Username must be 3–32 characters")
        if not re.fullmatch(r"[A-Za-z0-9_\-]+", v):
            raise ValueError("Username may only contain letters, digits, underscores, and hyphens")
        return v


class LoginRequest(BaseModel):
    identifier: str | None = None
    email: str | None = None
    password: str

    @model_validator(mode="after")
    def validate_identifier_or_email(self):
        candidate = self.identifier if self.identifier is not None else self.email
        if candidate is None or not str(candidate).strip():
            raise ValueError("Email or username is required")
        self.identifier = str(candidate).strip()
        return self


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    avatar_url: str | None
    created_at: datetime
    bp: float = 0.0
    kp: int = 0
    tp: float = 0.0

    model_config = {"from_attributes": True}


class ResetRequestBody(BaseModel):
    email: EmailStr


class ResetConfirmBody(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain an uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain a digit")
        return v
