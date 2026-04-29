"""Economy service tests — BET-03 (withdrawal refund), BET-04 (bet cap), BET-05 (atomic balance)."""
import uuid
from datetime import date

import pytest
from fastapi import HTTPException

from app.db.models.transaction import LpEvent
from app.db.models.user import User


@pytest.mark.asyncio
async def test_convert_lp_to_bp_caps_bp_and_resets_lp(db_session):
    """LP conversion should cap at 10 BP and zero out accumulated LP."""
    from app.services.economy_service import convert_lp_to_bp, get_balance

    user_id = uuid.uuid4()
    db_session.add(User(id=user_id, email="lp@test.com", username="lp_user", password_hash="x"))
    db_session.add(
        LpEvent(
            user_id=user_id,
            amount=2048,
            source_type="like_received",
            source_id=user_id,
            day_date=date(2026, 4, 22),
        )
    )
    await db_session.commit()

    lp_converted, bp_earned = await convert_lp_to_bp(db_session, user_id)

    assert lp_converted == 2048
    assert bp_earned == pytest.approx(10.0)

    balance = await get_balance(db_session, user_id)
    assert balance == {"bp": 10.0, "lp": 0, "tp": 0.0}


def test_withdrawal_refund_formula():
    """BET-03: compute_refund_bp(yes_count, no_count, side) -> float."""
    from app.services.economy_service import compute_refund_bp
    assert compute_refund_bp(80.0, 20.0, "yes") == 0.8
    assert compute_refund_bp(80.0, 20.0, "no") == 0.2
    assert compute_refund_bp(0.0, 0.0, "yes") == 0.5
    assert compute_refund_bp(50.0, 50.0, "yes") == 0.5


def test_numeric_refund_formula_clamps_by_market_span():
    from app.services.economy_service import compute_numeric_refund_bp

    assert compute_numeric_refund_bp(55.0, 50.0, 0.0, 100.0) == 0.95
    assert compute_numeric_refund_bp(0.0, 100.0, 0.0, 100.0) == 0.0
    assert compute_numeric_refund_bp(42.0, 42.0, 10.0, 10.0) == 1.0


@pytest.mark.asyncio
async def test_get_bet_odds_binary_uses_participant_counts_not_bp_stake(db_session):
    from datetime import datetime, timezone
    import uuid

    from app.db.models.market import Market, MarketPosition
    from app.db.models.user import User
    from app.services.economy_service import get_bet_odds

    proposer_id = uuid.uuid4()
    yes_user = uuid.uuid4()
    no_user_1 = uuid.uuid4()
    no_user_2 = uuid.uuid4()
    bet_id = uuid.uuid4()

    db_session.add_all([
        User(id=proposer_id, email="prop@test.com", username="prop", password_hash="x"),
        User(id=yes_user, email="yes@test.com", username="yesuser", password_hash="x"),
        User(id=no_user_1, email="no1@test.com", username="nouser1", password_hash="x"),
        User(id=no_user_2, email="no2@test.com", username="nouser2", password_hash="x"),
        Market(
            id=bet_id,
            proposer_id=proposer_id,
            title="Binary odds test",
            description="desc",
            resolution_criteria="criteria",
            deadline=datetime(2030, 1, 1, tzinfo=timezone.utc),
            market_type="binary",
            status="open",
        ),
        MarketPosition(id=uuid.uuid4(), bet_id=bet_id, user_id=yes_user, side="yes", bp_staked=10),
        MarketPosition(id=uuid.uuid4(), bet_id=bet_id, user_id=no_user_1, side="no", bp_staked=1),
        MarketPosition(id=uuid.uuid4(), bet_id=bet_id, user_id=no_user_2, side="no", bp_staked=1),
    ])
    await db_session.commit()

    odds = await get_bet_odds(db_session, bet_id)

    assert odds["yes_count"] == 1
    assert odds["no_count"] == 2
    assert odds["yes_pool"] == 10.0
    assert odds["no_pool"] == 2.0
    assert odds["yes_pct"] == pytest.approx(33.3)
    assert odds["no_pct"] == pytest.approx(66.7)
    assert odds["total_votes"] == 3


@pytest.mark.asyncio
async def test_get_bet_odds_empty_market_defaults_to_even_odds(db_session):
    from app.services.economy_service import get_bet_odds

    odds = await get_bet_odds(db_session, uuid.uuid4())

    assert odds == {
        "yes_pct": 50.0,
        "no_pct": 50.0,
        "yes_pool": 0.0,
        "no_pool": 0.0,
        "yes_count": 0,
        "no_count": 0,
        "total_votes": 0,
    }


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

    user_id = uuid.uuid4()
    user = User(id=user_id, email=f"{user_id}@test.com", username=str(user_id)[:20], is_active=True)
    db_session.add(user)
    await db_session.flush()
    await credit_bp(db_session, user_id, 5.0, "signup")
    with pytest.raises(HTTPException) as exc_info:
        await deduct_bp(db_session, user_id, 10.0, "bet_place")
    assert exc_info.value.status_code == 402


@pytest.mark.asyncio
async def test_deduct_bp_missing_user_raises_404(db_session):
    from app.services.economy_service import deduct_bp

    with pytest.raises(HTTPException) as exc_info:
        await deduct_bp(db_session, uuid.uuid4(), 1.0, "bet_place")
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_convert_lp_to_bp_with_no_lp_is_noop(db_session):
    from app.services.economy_service import convert_lp_to_bp

    user_id = uuid.uuid4()
    db_session.add(User(id=user_id, email="nolp@test.com", username="nolp_user", password_hash="x"))
    await db_session.commit()

    assert await convert_lp_to_bp(db_session, user_id) == (0, 0.0)
