"""Transaction ledger service — UNION query across BpTransaction, TpTransaction, KpEvent."""
import uuid

from fastapi import HTTPException
from sqlalchemy import cast, literal, select, union_all
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
    """Return paginated, sorted transaction ledger with running balances."""
    user_row = (await db.execute(select(User).where(User.username == username))).scalar_one_or_none()
    if user_row is None:
        raise HTTPException(status_code=404, detail="User not found")
    user_id = user_row.id

    bp_q = select(
        BpTransaction.id.label("id"),
        BpTransaction.created_at.label("date"),
        cast(BpTransaction.reason, String).label("reason"),
        BpTransaction.bet_id.label("bet_id"),
        cast(BpTransaction.amount, String).label("bp_delta"),
        literal("0").label("tp_delta"),
    ).where(BpTransaction.user_id == user_id)

    tp_q = select(
        TpTransaction.id.label("id"),
        TpTransaction.created_at.label("date"),
        literal("bet_win").label("reason"),
        TpTransaction.bet_id.label("bet_id"),
        literal("0").label("bp_delta"),
        cast(TpTransaction.amount, String).label("tp_delta"),
    ).where(TpTransaction.user_id == user_id)

    kp_q = select(
        KpEvent.id.label("id"),
        KpEvent.created_at.label("date"),
        KpEvent.source_type.label("reason"),
        cast(None, Uuid).label("bet_id"),
        literal("0").label("bp_delta"),
        literal("0").label("tp_delta"),
    ).where(KpEvent.user_id == user_id, KpEvent.amount > 0)

    combined = union_all(bp_q, tp_q, kp_q).subquery()

    # Fetch all rows sorted chronologically — needed for running balance computation
    all_rows = (await db.execute(
        select(combined).order_by(combined.c.date.asc())
    )).all()

    bet_ids = {row.bet_id for row in all_rows if row.bet_id is not None}
    title_map: dict[uuid.UUID, str] = {}
    if bet_ids:
        bet_rows = (await db.execute(
            select(Bet.id, Bet.title).where(Bet.id.in_(bet_ids))
        )).all()
        title_map = {bid: title for bid, title in bet_rows}

    # Build raw dicts
    raw: list[dict] = []
    for row in all_rows:
        reason = str(row.reason)
        tx_type = _REASON_TO_TYPE.get(
            reason,
            "kp_allocation" if reason in ("comment_upvote", "daily_allocation") else "daily_bonus",
        )
        raw.append({
            "id": row.id,
            "date": row.date,
            "type": tx_type,
            "bet_id": row.bet_id,
            "bp_delta": float(row.bp_delta),
            "tp_delta": float(row.tp_delta),
            "market_title": title_map.get(row.bet_id) if row.bet_id else None,
        })

    # Merge BP + TP rows for the same bet_won event into a single row
    bet_won_groups: dict[str, list[dict]] = {}
    other: list[dict] = []
    for e in raw:
        if e["type"] == "bet_won" and e["bet_id"] is not None:
            key = str(e["bet_id"])
            bet_won_groups.setdefault(key, []).append(e)
        else:
            other.append(e)

    merged: list[dict] = list(other)
    for group in bet_won_groups.values():
        if len(group) == 2:
            bp_e = next((e for e in group if e["bp_delta"] != 0), group[0])
            tp_e = next((e for e in group if e["tp_delta"] != 0), group[1])
            merged.append({**bp_e, "tp_delta": tp_e["tp_delta"]})
        else:
            merged.extend(group)

    # Sort chronologically to compute running balances
    merged.sort(key=lambda e: e["date"])
    bp_running = 0.0
    tp_running = 0.0
    for e in merged:
        bp_running += e["bp_delta"]
        tp_running += e["tp_delta"]
        e["bp_balance"] = round(bp_running, 1)
        e["tp_balance"] = round(tp_running, 1)

    # Apply requested sort after balance computation
    reverse = sort_dir == "desc"
    sort_key = {
        "date": lambda e: e["date"],
        "bp": lambda e: e["bp_delta"],
        "tp": lambda e: e["tp_delta"],
        "type": lambda e: e["type"],
    }.get(sort_by, lambda e: e["date"])
    merged.sort(key=sort_key, reverse=reverse)

    total = len(merged)
    page = merged[offset: offset + limit]

    entries = [
        TransactionEntry(
            id=e["id"],
            date=e["date"],
            type=e["type"],
            description=e["market_title"] or "",
            market_id=e["bet_id"],
            market_title=e["market_title"],
            bp_delta=round(e["bp_delta"], 1),
            bp_balance=e["bp_balance"],
            tp_delta=round(e["tp_delta"], 1),
            tp_balance=e["tp_balance"],
        )
        for e in page
    ]

    return TransactionListResponse(transactions=entries, total=total)
