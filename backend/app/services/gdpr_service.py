"""GDPR data export and account deletion with pseudonymization."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.bet import (
    Bet, BetPosition, BetUpvote, Comment, CommentUpvote,
    Dispute, DisputeVote, PositionHistory, Resolution, ResolutionReview,
)
from app.db.models.social import FriendRequest, Message, Notification
from app.db.models.transaction import BpTransaction, KpEvent, TpTransaction
from app.db.models.user import OauthAccount, User


async def export_user_data(db: AsyncSession, user: User) -> dict:
    """Export all data associated with a user (GDPR Art. 15 / Art. 20)."""
    uid = user.id

    # Account
    account = {
        "id": str(uid),
        "email": user.email,
        "username": user.username,
        "avatar_url": user.avatar_url,
        "bio": user.bio,
        "created_at": _iso(user.created_at),
        "last_login": _iso(user.last_login),
        "llm_mode": user.llm_mode,
        "llm_provider": user.llm_provider,
        "llm_model": user.llm_model,
    }

    # OAuth accounts
    rows = (await db.execute(select(OauthAccount).where(OauthAccount.user_id == uid))).scalars().all()
    oauth = [{"provider": r.provider, "provider_user_id": r.provider_user_id} for r in rows]

    # Markets created
    rows = (await db.execute(select(Bet).where(Bet.proposer_id == uid))).scalars().all()
    markets = [{"id": str(r.id), "title": r.title, "status": r.status, "created_at": _iso(r.created_at)} for r in rows]

    # Positions / bets placed
    rows = (await db.execute(select(BetPosition).where(BetPosition.user_id == uid))).scalars().all()
    positions = [{"bet_id": str(r.bet_id), "side": r.side, "bp_staked": float(r.bp_staked), "placed_at": _iso(r.placed_at)} for r in rows]

    # Comments
    rows = (await db.execute(select(Comment).where(Comment.user_id == uid))).scalars().all()
    comments = [{"id": str(r.id), "bet_id": str(r.bet_id), "content": r.content, "created_at": _iso(r.created_at)} for r in rows]

    # BP transactions
    rows = (await db.execute(select(BpTransaction).where(BpTransaction.user_id == uid))).scalars().all()
    bp_txns = [{"amount": float(r.amount), "reason": r.reason, "created_at": _iso(r.created_at)} for r in rows]

    # TP transactions
    rows = (await db.execute(select(TpTransaction).where(TpTransaction.user_id == uid))).scalars().all()
    tp_txns = [{"amount": float(r.amount), "bet_id": str(r.bet_id), "created_at": _iso(r.created_at)} for r in rows]

    # KP events
    rows = (await db.execute(select(KpEvent).where(KpEvent.user_id == uid))).scalars().all()
    kp_events = [{"amount": r.amount, "source_type": r.source_type, "day_date": str(r.day_date)} for r in rows]

    # Friends
    rows = (await db.execute(
        select(FriendRequest).where(
            (FriendRequest.from_user_id == uid) | (FriendRequest.to_user_id == uid)
        )
    )).scalars().all()
    friends = [{"from_user_id": str(r.from_user_id), "to_user_id": str(r.to_user_id), "status": r.status} for r in rows]

    # Messages
    rows = (await db.execute(
        select(Message).where((Message.from_user_id == uid) | (Message.to_user_id == uid))
    )).scalars().all()
    messages = [{"from_user_id": str(r.from_user_id), "to_user_id": str(r.to_user_id), "content": r.content, "sent_at": _iso(r.sent_at)} for r in rows]

    # Notifications
    rows = (await db.execute(select(Notification).where(Notification.user_id == uid))).scalars().all()
    notifications = [{"type": r.type, "payload": r.payload, "is_read": r.is_read, "created_at": _iso(r.created_at)} for r in rows]

    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "account": account,
        "oauth_accounts": oauth,
        "markets_created": markets,
        "positions": positions,
        "comments": comments,
        "bp_transactions": bp_txns,
        "tp_transactions": tp_txns,
        "kp_events": kp_events,
        "friend_requests": friends,
        "messages": messages,
        "notifications": notifications,
    }


async def delete_account(db: AsyncSession, user: User) -> None:
    """Delete account with pseudonymization (GDPR Art. 17).

    Strategy per PRIVACY.md:
    - User row: username → [deleted], email/password cleared
    - Bets proposed: kept for market integrity, proposer anonymized
    - BetPositions: kept for payout accuracy, user_id anonymized
    - Comments: content → [deleted], user_id anonymized
    - Transactions: user_id anonymized, amounts kept for audit
    - KP events: deleted entirely
    - OAuth tokens: deleted
    - Sessions: handled by caller (cookie clearing)
    - Messages: content → [deleted], user_id stays for thread integrity
    - Friend requests, notifications: deleted
    """
    uid = user.id
    anon_id = uuid.UUID("00000000-0000-0000-0000-000000000000")

    # Delete KP events entirely
    await db.execute(delete(KpEvent).where(KpEvent.user_id == uid))

    # Delete notifications
    await db.execute(delete(Notification).where(Notification.user_id == uid))

    # Delete friend requests
    await db.execute(delete(FriendRequest).where(
        (FriendRequest.from_user_id == uid) | (FriendRequest.to_user_id == uid)
    ))

    # Pseudonymize messages
    await db.execute(
        update(Message)
        .where(Message.from_user_id == uid)
        .values(content="[deleted]", from_user_id=anon_id)
    )
    await db.execute(
        update(Message)
        .where(Message.to_user_id == uid)
        .values(to_user_id=anon_id)
    )

    # Pseudonymize comments
    await db.execute(
        update(Comment)
        .where(Comment.user_id == uid)
        .values(content="[deleted]", user_id=anon_id, deleted_at=datetime.now(timezone.utc))
    )

    # Delete comment upvotes by this user
    await db.execute(delete(CommentUpvote).where(CommentUpvote.user_id == uid))
    await db.execute(delete(BetUpvote).where(BetUpvote.user_id == uid))

    # Pseudonymize bet positions
    await db.execute(
        update(BetPosition).where(BetPosition.user_id == uid).values(user_id=anon_id)
    )
    await db.execute(
        update(PositionHistory).where(PositionHistory.user_id == uid).values(user_id=anon_id)
    )

    # Pseudonymize bets proposed by this user
    await db.execute(
        update(Bet).where(Bet.proposer_id == uid).values(proposer_id=anon_id)
    )

    # Pseudonymize resolutions
    await db.execute(
        update(Resolution).where(Resolution.resolved_by == uid).values(resolved_by=anon_id)
    )

    # Pseudonymize disputes
    await db.execute(
        update(Dispute).where(Dispute.opened_by == uid).values(opened_by=anon_id)
    )
    await db.execute(
        update(DisputeVote).where(DisputeVote.user_id == uid).values(user_id=anon_id)
    )
    await db.execute(
        update(ResolutionReview).where(ResolutionReview.user_id == uid).values(user_id=anon_id)
    )

    # Pseudonymize transactions
    await db.execute(
        update(BpTransaction).where(BpTransaction.user_id == uid).values(user_id=anon_id)
    )
    await db.execute(
        update(TpTransaction).where(TpTransaction.user_id == uid).values(user_id=anon_id)
    )

    # Delete OAuth accounts
    await db.execute(delete(OauthAccount).where(OauthAccount.user_id == uid))

    # Pseudonymize and deactivate user record
    user.username = f"[deleted-{uid}]"
    user.email = f"deleted-{uid}@deleted.local"
    user.password_hash = None
    user.avatar_url = None
    user.bio = None
    user.is_active = False
    user.llm_api_key = None
    user.llm_mode = "disabled"
    user.llm_provider = None
    user.llm_model = None

    await db.commit()


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None
