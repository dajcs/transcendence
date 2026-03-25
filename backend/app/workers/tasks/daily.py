"""Daily allocation tasks."""
import math
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.transaction import BpTransaction, KpEvent
from app.db.models.user import User
from app.db.session import AsyncSessionLocal
from app.workers.celery_app import celery_app


async def _apply_daily_allocation(db: AsyncSession, today) -> None:
    users = (await db.execute(select(User.id))).scalars().all()
    for user_id in users:
        kp_total = (
            await db.execute(
                select(func.sum(KpEvent.amount)).where(
                    KpEvent.user_id == user_id,
                    KpEvent.day_date == today,
                )
            )
        ).scalar_one()
        kp_value = int(kp_total or 0)
        karma_bp = math.floor(math.log10(kp_value + 1)) if kp_value >= 0 else 0

        if karma_bp > 0:
            db.add(
                BpTransaction(
                    user_id=user_id,
                    amount=float(karma_bp),
                    reason="daily_allocation",
                    bet_id=None,
                )
            )

        if kp_value != 0:
            db.add(
                KpEvent(
                    user_id=user_id,
                    amount=-kp_value,
                    source_type="daily_reset",
                    source_id=user_id,
                    day_date=today,
                )
            )

    await db.commit()


async def _run_allocation(db: AsyncSession | None = None) -> None:
    today = datetime.now(timezone.utc).date()

    if db is not None:
        await _apply_daily_allocation(db, today)
        return

    async with AsyncSessionLocal() as session:
        await _apply_daily_allocation(session, today)


@celery_app.task(name="app.workers.tasks.daily.daily_allocation")
def daily_allocation() -> str:
    """Sync Celery task wrapper for async daily allocation logic."""
    import asyncio

    asyncio.run(_run_allocation())
    return "ok"
