"""Email delivery service. Falls back to stdout when SMTP is not configured."""
import logging

from app.config import settings

logger = logging.getLogger(__name__)


async def send_password_reset_email(email: str, reset_url: str) -> None:
    """Send password reset email or log to stdout if SMTP not configured."""
    if not settings.smtp_host or settings.smtp_host == "localhost":
        # Dev fallback: log the reset URL so AUTH-03 is testable without SMTP
        logger.info("PASSWORD RESET URL (no SMTP configured): %s", reset_url)
        return

    import aiosmtplib
    from email.mime.text import MIMEText

    msg = MIMEText(f"Click to reset your password: {reset_url}")
    msg["Subject"] = "Reset your Vox Populi password"
    msg["From"] = settings.email_from
    msg["To"] = email

    await aiosmtplib.send(
        msg,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_user or None,
        password=settings.smtp_password or None,
    )
