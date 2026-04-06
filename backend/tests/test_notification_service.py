"""Tests for notify_resolution_due: bell notification + email delivery."""
import uuid
from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_notify_resolution_due_creates_bell_notification(db_session):
    """notify_resolution_due persists a DB notification of type resolution_due."""
    from sqlalchemy import select
    from app.db.models.user import User
    from app.db.models.social import Notification
    from app.services.notification_service import notify_resolution_due

    user_id = uuid.uuid4()
    db_session.add(User(id=user_id, email="prop@test.com", username="proposer", password_hash="x"))
    await db_session.commit()

    market_id = str(uuid.uuid4())

    with patch("app.socket.server.celery_emit", new_callable=AsyncMock), \
         patch("app.services.email_service.send_resolution_due_email", new_callable=AsyncMock):
        await notify_resolution_due(db_session, user_id, "Will it rain?", market_id)

    notif = (await db_session.execute(
        select(Notification).where(Notification.user_id == user_id, Notification.type == "resolution_due")
    )).scalar_one_or_none()
    assert notif is not None
    assert market_id in (notif.payload or "")


@pytest.mark.asyncio
async def test_notify_resolution_due_sends_email_to_proposer(db_session):
    """notify_resolution_due calls send_resolution_due_email with proposer's email."""
    from app.db.models.user import User
    from app.services.notification_service import notify_resolution_due

    user_id = uuid.uuid4()
    email = "owner@example.com"
    db_session.add(User(id=user_id, email=email, username="owner", password_hash="x"))
    await db_session.commit()

    market_id = str(uuid.uuid4())
    market_title = "Test Market"

    with patch("app.socket.server.celery_emit", new_callable=AsyncMock), \
         patch("app.services.email_service.send_resolution_due_email", new_callable=AsyncMock) as mock_email:
        await notify_resolution_due(db_session, user_id, market_title, market_id)

    mock_email.assert_called_once()
    call_email, call_title, call_url = mock_email.call_args.args
    assert call_email == email
    assert call_title == market_title
    assert market_id in call_url


@pytest.mark.asyncio
async def test_notify_resolution_due_email_failure_does_not_raise(db_session):
    """Email failure is silently logged — resolution flow must not be interrupted."""
    from app.db.models.user import User
    from app.services.notification_service import notify_resolution_due

    user_id = uuid.uuid4()
    db_session.add(User(id=user_id, email="safe@test.com", username="safeuser", password_hash="x"))
    await db_session.commit()

    with patch("app.socket.server.celery_emit", new_callable=AsyncMock), \
         patch("app.services.email_service.send_resolution_due_email",
               new_callable=AsyncMock, side_effect=Exception("SMTP down")):
        # Must not raise
        await notify_resolution_due(db_session, user_id, "Market", str(uuid.uuid4()))


@pytest.mark.asyncio
async def test_send_resolution_due_email_logs_when_no_smtp():
    """send_resolution_due_email logs and returns cleanly when SMTP host is 'localhost'."""
    from app.config import settings
    from app.services.email_service import send_resolution_due_email

    # Default config has smtp_host="localhost" — should log, not raise
    assert settings.smtp_host == "localhost"
    # Raises no exception
    await send_resolution_due_email("user@test.com", "My Market", "https://localhost/markets/123")


@pytest.mark.asyncio
async def test_send_resolution_due_email_sends_via_smtp(monkeypatch):
    """send_resolution_due_email calls aiosmtplib.send when SMTP is configured."""
    from app.config import settings
    from app.services.email_service import send_resolution_due_email

    monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(settings, "smtp_port", 587)
    monkeypatch.setattr(settings, "email_from", "noreply@voxpopuli.test")

    with patch("aiosmtplib.send", new_callable=AsyncMock) as mock_send:
        await send_resolution_due_email("owner@example.com", "My Market", "https://app/markets/1")

    mock_send.assert_called_once()
    _, kwargs = mock_send.call_args
    assert kwargs["hostname"] == "smtp.example.com"
