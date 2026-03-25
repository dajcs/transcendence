"""Celery application and task definitions."""
from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery(
    "voxpopuli",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "daily-allocation-midnight-utc": {
            "task": "app.workers.tasks.daily.daily_allocation",
            "schedule": crontab(minute=0, hour=0),
        }
    },
)

celery_app.autodiscover_tasks(["app.workers.tasks"])

import app.workers.tasks.daily  # noqa: E402,F401


@celery_app.task
def ping():
    """Health check task — proves the worker is running."""
    return "pong"
