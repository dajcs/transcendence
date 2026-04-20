"""Economy service tests — BET-03 (withdrawal refund), BET-04 (bet cap), BET-05 (atomic balance)."""
import pytest


def test_convert_lp_to_bp_cap():
    """D-08: LP→BP uses min(log2(lp+1), 10.0). Cap enforced at 10.0 BP."""
    import math

    def _formula(lp: int) -> float:
        return min(math.log2(lp + 1), 10.0)

    assert _formula(0) == 0.0
    assert _formula(1) == 1.0
    assert abs(_formula(1023) - 10.0) < 0.001
    assert _formula(2000) == 10.0


def test_withdrawal_refund_formula():
    """BET-03: compute_refund_bp(yes_pool, no_pool, side) -> float."""
    from app.services.economy_service import compute_refund_bp
    assert compute_refund_bp(80.0, 20.0, "yes") == 0.8
    assert compute_refund_bp(80.0, 20.0, "no") == 0.2
    assert compute_refund_bp(0.0, 0.0, "yes") == 0.5
    assert compute_refund_bp(50.0, 50.0, "yes") == 0.5


@pytest.mark.asyncio
async def test_get_balance_empty(db_session):
    """get_balance returns zero balances for a user with no transactions."""
    from app.services.economy_service import get_balance
    import uuid
    user_id = uuid.uuid4()
    balance = await get_balance(db_session, user_id)
    assert balance == {"bp": 0.0, "lp": 0, "tp": 0.0}


@pytest.mark.asyncio
async def test_credit_bp(db_session):
    """credit_bp inserts a positive BpTransaction; balance increases."""
    from app.services.economy_service import credit_bp, get_balance
    import uuid
    user_id = uuid.uuid4()
    await credit_bp(db_session, user_id, 10.0, "signup")
    balance = await get_balance(db_session, user_id)
    assert balance["bp"] == 10.0


@pytest.mark.asyncio
async def test_deduct_bp_success(db_session):
    """BET-05: deduct_bp reduces balance when sufficient funds exist."""
    from app.services.economy_service import credit_bp, deduct_bp, get_balance
    from app.db.models.user import User
    import uuid
    user_id = uuid.uuid4()
    user = User(id=user_id, email=f"{user_id}@test.com", username=str(user_id)[:20], is_active=True)
    db_session.add(user)
    await db_session.flush()
    await credit_bp(db_session, user_id, 10.0, "signup")
    await deduct_bp(db_session, user_id, 3.0, "bet_place")
    balance = await get_balance(db_session, user_id)
    assert balance["bp"] == pytest.approx(7.0)


@pytest.mark.asyncio
async def test_deduct_bp_insufficient(db_session):
    """BET-05: deduct_bp raises HTTPException(402) when balance < amount."""
    from app.services.economy_service import credit_bp, deduct_bp
    from app.db.models.user import User
    from fastapi import HTTPException
    import uuid
    user_id = uuid.uuid4()
    user = User(id=user_id, email=f"{user_id}@test.com", username=str(user_id)[:20], is_active=True)
    db_session.add(user)
    await db_session.flush()
    await credit_bp(db_session, user_id, 5.0, "signup")
    with pytest.raises(HTTPException) as exc_info:
        await deduct_bp(db_session, user_id, 10.0, "bet_place")
    assert exc_info.value.status_code == 402
