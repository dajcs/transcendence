"""GDPR service export and pseudonymization coverage."""
import uuid
from datetime import date, datetime, timezone

import pytest
from sqlalchemy import select, text

from app.db.models.market import Comment, Market, MarketPosition
from app.db.models.social import FriendRequest, Message, Notification
from app.db.models.transaction import BpTransaction, LpEvent, TpTransaction
from app.db.models.user import OauthAccount, User


@pytest.mark.asyncio
async def test_export_user_data_contains_account_social_market_and_ledger_sections(db_session):
    from app.services.gdpr_service import export_user_data

    user = User(id=uuid.uuid4(), email="gdpr@test.com", username="gdpr_user", password_hash="x")
    other = User(id=uuid.uuid4(), email="gdpr-other@test.com", username="gdpr_other", password_hash="x")
    market_id = uuid.uuid4()
    db_session.add_all(
        [
            user,
            other,
            OauthAccount(user_id=user.id, provider="github", provider_user_id="gh-1"),
            Market(
                id=market_id,
                proposer_id=user.id,
                title="GDPR Market",
                description="desc",
                resolution_criteria="criteria",
                deadline=datetime(2030, 1, 1, tzinfo=timezone.utc),
                status="open",
            ),
            MarketPosition(market_id=market_id, user_id=user.id, side="yes", bp_staked=2),
            Comment(market_id=market_id, user_id=user.id, content="keep me"),
            BpTransaction(user_id=user.id, amount=3, reason="signup", bet_id=market_id),
            TpTransaction(user_id=user.id, amount=0.5, bet_id=market_id),
            LpEvent(user_id=user.id, amount=2, source_type="like_received", source_id=market_id, day_date=date.today()),
            FriendRequest(from_user_id=user.id, to_user_id=other.id, status="accepted"),
            Message(from_user_id=user.id, to_user_id=other.id, content="hello"),
            Notification(user_id=user.id, type="friend_request", payload="{}", is_read=False),
        ]
    )
    await db_session.commit()

    payload = await export_user_data(db_session, user)

    assert payload["account"]["email"] == "gdpr@test.com"
    assert payload["oauth_accounts"] == [{"provider": "github", "provider_user_id": "gh-1"}]
    assert payload["markets_created"][0]["title"] == "GDPR Market"
    assert payload["positions"][0]["side"] == "yes"
    assert payload["comments"][0]["content"] == "keep me"
    assert payload["bp_transactions"][0]["amount"] == 3.0
    assert payload["tp_transactions"][0]["amount"] == 0.5
    assert payload["lp_events"][0]["amount"] == 2
    assert payload["friend_requests"][0]["status"] == "accepted"
    assert payload["messages"][0]["content"] == "hello"
    assert payload["notifications"][0]["type"] == "friend_request"


@pytest.mark.asyncio
async def test_delete_account_pseudonymizes_user_content_and_deletes_private_edges(db_session):
    from app.services.gdpr_service import delete_account

    user = User(id=uuid.uuid4(), email="delete@test.com", username="delete_user", password_hash="x")
    other = User(id=uuid.uuid4(), email="delete-other@test.com", username="delete_other", password_hash="x")
    market_id = uuid.uuid4()
    db_session.add_all(
        [
            user,
            other,
            OauthAccount(user_id=user.id, provider="github", provider_user_id="gh-delete"),
            Market(
                id=market_id,
                proposer_id=user.id,
                title="Delete Market",
                description="desc",
                resolution_criteria="criteria",
                deadline=datetime(2030, 1, 1, tzinfo=timezone.utc),
                status="open",
            ),
            MarketPosition(market_id=market_id, user_id=user.id, side="yes", bp_staked=1),
            Comment(market_id=market_id, user_id=user.id, content="delete comment"),
            BpTransaction(user_id=user.id, amount=1, reason="signup", bet_id=market_id),
            TpTransaction(user_id=user.id, amount=1, bet_id=market_id),
            LpEvent(user_id=user.id, amount=1, source_type="like_received", source_id=market_id, day_date=date.today()),
            FriendRequest(from_user_id=user.id, to_user_id=other.id, status="pending"),
            Message(from_user_id=user.id, to_user_id=other.id, content="delete message"),
            Notification(user_id=user.id, type="friend_request", payload="{}", is_read=False),
        ]
    )
    await db_session.commit()

    await delete_account(db_session, user)

    anon_id = uuid.UUID("00000000-0000-0000-0000-000000000000")
    assert user.email == f"deleted-{user.id}@deleted.local"
    assert user.username == f"[deleted-{user.id}]"
    assert user.is_active is False

    market_row = (await db_session.execute(
        text("SELECT proposer_id FROM markets WHERE id = :market_id"),
        {"market_id": market_id.hex},
    )).one()
    assert market_row.proposer_id in {anon_id.hex, 0}

    comment_row = (await db_session.execute(
        text("SELECT user_id, content FROM comments WHERE market_id = :market_id"),
        {"market_id": market_id.hex},
    )).one()
    assert comment_row.user_id in {anon_id.hex, 0}
    assert comment_row.content == "[deleted]"

    message_row = (await db_session.execute(text("SELECT from_user_id, content FROM messages"))).one()
    assert message_row.from_user_id in {anon_id.hex, 0}
    assert message_row.content == "[deleted]"

    assert (await db_session.execute(select(LpEvent))).scalars().all() == []
    assert (await db_session.execute(select(FriendRequest))).scalars().all() == []
    assert (await db_session.execute(select(Notification))).scalars().all() == []
    assert (await db_session.execute(select(OauthAccount))).scalars().all() == []
