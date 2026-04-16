"""Transaction ledger service — UNION query across BpTransaction, TpTransaction, KpEvent."""
import uuid

from fastapi import HTTPException
from sqlalchemy import cast, func, literal, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.types import String, Uuid

from app.db.models.bet import Bet
from app.db.models.transaction import BpTransaction, KpEvent, TpTransaction
from app.db.models.user import User
from app.schemas.ledger import TransactionEntry, TransactionListResponse

_REASON_TO_TYPE: dict[str, str] = {
    "market_create": "bet_placed",
    "bet_place": "bet_placed",
    "bet_refund": "withdrawal",
    "bet_win": "bet_won",
    "proposer_penalty": "bet_lost",
    "kp_conversion": "kp_allocation",
    "daily_login": "daily_bonus",
    "signup_bonus": "daily_bonus",
}


async def get_user_transactions(
    db: AsyncSession,
    username: str,
    offset: int = 0,
    limit: int = 25,
    sort_by: str = "date",
    sort_dir: str = "desc",
) -> TransactionListResponse:
    """Return paginated, sorted transaction ledger for a user."""
    user_row = (await db.execute(select(User).where(User.username == username))).scalar_one_or_none()
    if user_row is None:
        raise HTTPException(status_code=404, detail="User not found")
    user_id = user_row.id

    # BpTransaction sub-query
    bp_q = select(
        BpTransaction.id.label("id"),
        BpTransaction.created_at.label("date"),
        cast(BpTransaction.reason, String).label("reason"),
        BpTransaction.bet_id.label("bet_id"),
        cast(BpTransaction.amount, String).label("bp_delta"),
        literal("0").label("tp_delta"),
    ).where(BpTransaction.user_id == user_id)

    # TpTransaction sub-query (no reason field — always bet_won)
    tp_q = select(
        TpTransaction.id.label("id"),
        TpTransaction.created_at.label("date"),
        literal("bet_win").label("reason"),
        TpTransaction.bet_id.label("bet_id"),
        literal("0").label("bp_delta"),
        cast(TpTransaction.amount, String).label("tp_delta"),
    ).where(TpTransaction.user_id == user_id)

    # KpEvent sub-query (no bet_id column — use NULL; exclude resets where amount <= 0)
    # Use cast(None, Uuid) from sqlalchemy.types — NOT PG_UUID (breaks SQLite test env)
    kp_q = select(
        KpEvent.id.label("id"),
        KpEvent.created_at.label("date"),
        KpEvent.source_type.label("reason"),
        cast(None, Uuid).label("bet_id"),
        literal("0").label("bp_delta"),
        literal("0").label("tp_delta"),
    ).where(KpEvent.user_id == user_id, KpEvent.amount > 0)

    combined = union_all(bp_q, tp_q, kp_q).subquery()

    # Count total
    total = (await db.execute(select(func.count()).select_from(combined))).scalar_one()

    # Sort column selection
    sort_col = combined.c.date  # default
    if sort_by == "bp":
        sort_col = combined.c.bp_delta
    elif sort_by == "tp":
        sort_col = combined.c.tp_delta
    elif sort_by == "type":
        sort_col = combined.c.reason

    sort_expr = sort_col.asc() if sort_dir == "asc" else sort_col.desc()
    rows = (await db.execute(
        select(combined).order_by(sort_expr).offset(offset).limit(limit)
    )).all()

    # Fetch market titles for rows with bet_id
    bet_ids = {row.bet_id for row in rows if row.bet_id is not None}
    title_map: dict[uuid.UUID, str] = {}
    if bet_ids:
        bet_rows = (await db.execute(
            select(Bet.id, Bet.title).where(Bet.id.in_(bet_ids))
        )).all()
        title_map = {bid: title for bid, title in bet_rows}

    entries: list[TransactionEntry] = []
    for row in rows:
        reason = str(row.reason)
        tx_type = _REASON_TO_TYPE.get(
            reason,
            "kp_allocation" if reason in ("comment_upvote", "daily_allocation") else "daily_bonus",
        )
        market_id = row.bet_id
        market_title = title_map.get(market_id) if market_id else None
        entries.append(TransactionEntry(
            id=row.id,
            date=row.date,
            type=tx_type,
            description=market_title or reason,
            market_id=market_id,
            market_title=market_title,
            bp_delta=float(row.bp_delta),
            tp_delta=float(row.tp_delta),
        ))

    return TransactionListResponse(transactions=entries, total=int(total))
