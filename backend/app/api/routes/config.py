"""App config endpoints — expose non-secret configuration flags."""
import os

from fastapi import APIRouter

router = APIRouter(tags=["config"])


@router.get("/config/llm-available")
async def llm_available():
    """Return whether OPENROUTER_API_KEY is configured in the environment.
    Never exposes the key value — only its presence.
    """
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    return {"available": bool(key)}
