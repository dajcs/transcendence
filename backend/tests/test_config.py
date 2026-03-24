"""Tests for INFRA-05: env var validation at startup."""
import os
import importlib

import pytest
from pydantic import ValidationError


def test_missing_env_var(monkeypatch):
    """Settings should raise ValidationError if a required env var is missing."""
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.setenv("SECRET_KEY", "")
    # Re-import to trigger Settings() instantiation
    import app.config as config_module
    with pytest.raises((ValidationError, SystemExit)):
        config_module.Settings()


def test_settings_has_required_fields():
    """Settings class must declare all required env vars."""
    from app.config import Settings
    fields = Settings.model_fields
    required = ["postgres_db", "postgres_user", "postgres_password", "database_url",
                "redis_url", "secret_key", "jwt_private_key_path", "jwt_public_key_path"]
    for field in required:
        assert field in fields, f"Missing required field: {field}"
