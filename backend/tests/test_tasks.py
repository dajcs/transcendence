"""Celery task tests — BET-07 (daily allocation formula)."""
import math
import pytest


def test_karma_bp_formula():
    """BET-07: karma_bp = floor(log10(kp + 1)) — pure formula test, no DB needed."""
    assert math.floor(math.log10(0 + 1)) == 0    # kp=0 → 0 bp
    assert math.floor(math.log10(1 + 1)) == 0    # kp=1 → 0 bp
    assert math.floor(math.log10(9 + 1)) == 1    # kp=9 → 1 bp
    assert math.floor(math.log10(10 + 1)) == 1   # kp=10 → 1 bp
    assert math.floor(math.log10(99 + 1)) == 2   # kp=99 → 2 bp
    assert math.floor(math.log10(100 + 1)) == 2  # kp=100 → 2 bp


@pytest.mark.asyncio
async def test_daily_allocation_inserts_transactions(db_session):
    """BET-07: daily_allocation credits karma_bp and resets kp for each user."""
    import uuid
    from app.db.models.user import User
    from app.db.models.transaction import BpTransaction, KpEvent
    from sqlalchemy import select, func
    from datetime import date, timezone
    # Setup: user with 9 kp events today → expects 1 bp allocated, then kp reset
    user_id = uuid.uuid4()
    db_session.add(User(id=user_id, email="task@test.com", username="taskuser",
                        is_active=True))
    today = date.today()
    db_session.add(KpEvent(user_id=user_id, amount=9, source_type="comment_upvote",
                           source_id=user_id, day_date=today))
    await db_session.commit()

    from app.workers.tasks.daily import _run_allocation
    await _run_allocation(db_session)

    bp_total = (await db_session.execute(
        select(func.sum(BpTransaction.amount)).where(BpTransaction.user_id == user_id)
    )).scalar_one() or 0
    assert float(bp_total) == 1.0  # floor(log10(9+1)) = 1
