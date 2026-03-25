"""Economy service tests — BET-03 (withdrawal refund), BET-04 (bet cap), BET-05 (atomic balance)."""
import pytest


@pytest.mark.xfail(reason="economy_service not yet implemented", strict=False)
def test_compute_bet_cap_formula():
    """BET-04: cap = floor(log10(kp+1)) + 1."""
    from app.services.economy_service import compute_bet_cap
    assert compute_bet_cap(0) == 1
    assert compute_bet_cap(9) == 1
    assert compute_bet_cap(10) == 2
    assert compute_bet_cap(99) == 2
    assert compute_bet_cap(100) == 3


@pytest.mark.xfail(reason="economy_service not yet implemented", strict=False)
def test_withdrawal_refund_formula():
    """BET-03: compute_refund_bp(yes_pool, no_pool, side) -> float."""
    from app.services.economy_service import compute_refund_bp
    assert compute_refund_bp(80.0, 20.0, "yes") == 0.8
    assert compute_refund_bp(80.0, 20.0, "no") == 0.2
    assert compute_refund_bp(0.0, 0.0, "yes") == 0.5
    assert compute_refund_bp(50.0, 50.0, "yes") == 0.5


@pytest.mark.asyncio
@pytest.mark.xfail(reason="economy_service not yet implemented", strict=False)
async def test_get_balance_empty(db_session):
    """get_balance returns zero balances for a user with no transactions."""
    from app.services.economy_service import get_balance
    import uuid
    user_id = uuid.uuid4()
    balance = await get_balance(db_session, user_id)
    assert balance == {"bp": 0.0, "kp": 0, "tp": 0.0}


@pytest.mark.asyncio
@pytest.mark.xfail(reason="economy_service not yet implemented", strict=False)
async def test_credit_bp(db_session):
    """credit_bp inserts a positive BpTransaction; balance increases."""
    from app.services.economy_service import credit_bp, get_balance
    import uuid
    user_id = uuid.uuid4()
    await credit_bp(db_session, user_id, 10.0, "signup")
    balance = await get_balance(db_session, user_id)
    assert balance["bp"] == 10.0


@pytest.mark.asyncio
@pytest.mark.xfail(reason="economy_service not yet implemented", strict=False)
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
@pytest.mark.xfail(reason="economy_service not yet implemented", strict=False)
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
