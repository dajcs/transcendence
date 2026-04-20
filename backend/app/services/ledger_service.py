"""Transaction ledger service — UNION + window functions for O(page) memory usage."""
import uuid

from fastapi import HTTPException
from sqlalchemy import and_, case, cast, func, literal, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.types import Float, String, Uuid

from app.db.models.bet import Bet
from app.db.models.transaction import BpTransaction, LpEvent, TpTransaction
from app.db.models.user import User
from app.schemas.ledger import TransactionEntry, TransactionListResponse


async def get_user_transactions(
    db: AsyncSession,
    username: str,
    offset: int = 0,
    limit: int = 25,
    sort_by: str = "date",
    sort_dir: str = "desc",
) -> TransactionListResponse:
    """Return paginated, sorted ledger with running balances via SQL window functions."""
    user_row = (await db.execute(select(User).where(User.username == username))).scalar_one_or_none()
    if user_row is None:
        raise HTTPException(status_code=404, detail="User not found")
    user_id = user_row.id

    bp_q = select(
        BpTransaction.id.label("id"),
        BpTransaction.created_at.label("date"),
        cast(BpTransaction.reason, String).label("reason"),
        BpTransaction.bet_id.label("bet_id"),
        cast(BpTransaction.amount, Float).label("bp_delta"),
        literal(0.0).label("tp_delta"),
    ).where(BpTransaction.user_id == user_id)

    tp_q = select(
        TpTransaction.id.label("id"),
        TpTransaction.created_at.label("date"),
        literal("bet_win").label("reason"),
        TpTransaction.bet_id.label("bet_id"),
        literal(0.0).label("bp_delta"),
        cast(TpTransaction.amount, Float).label("tp_delta"),
    ).where(TpTransaction.user_id == user_id)

    lp_q = select(
        LpEvent.id.label("id"),
        LpEvent.created_at.label("date"),
        LpEvent.source_type.label("reason"),
        cast(None, Uuid).label("bet_id"),
        literal(0.0).label("bp_delta"),
        literal(0.0).label("tp_delta"),
    ).where(LpEvent.user_id == user_id, LpEvent.amount > 0)

    combined = union_all(bp_q, tp_q, lp_q).subquery()

    # Merge BP + TP rows for the same bet_win event at the SQL level.
    # group_key = bet_id for bet_win rows (merges the pair), id for everything else.
    group_key = case(
        (and_(combined.c.reason == "bet_win", combined.c.bet_id.isnot(None)),
         cast(combined.c.bet_id, String)),
        else_=cast(combined.c.id, String),
    )

    # PostgreSQL has no min/max aggregate for UUID — cast to text, aggregate, cast back.
    merged = select(
        cast(func.min(cast(combined.c.id, String)), Uuid).label("id"),
        func.min(combined.c.date).label("date"),
        func.max(combined.c.reason).label("reason"),
        cast(func.max(cast(combined.c.bet_id, String)), Uuid).label("bet_id"),
        func.sum(combined.c.bp_delta).label("bp_delta"),
        func.sum(combined.c.tp_delta).label("tp_delta"),
    ).group_by(group_key).subquery()

    tx_type = case(
        (merged.c.reason == "market_create", "bet_placed"),
        (merged.c.reason == "bet_place", "bet_placed"),
        (merged.c.reason == "bet_refund", "withdrawal"),
        (merged.c.reason == "bet_win", "bet_won"),
        (merged.c.reason == "proposer_penalty", "bet_lost"),
        (merged.c.reason == "lp_conversion", "lp_allocation"),
        (merged.c.reason == "daily_login", "daily_bonus"),
        (merged.c.reason == "signup_bonus", "daily_bonus"),
        (merged.c.reason.in_(["comment_upvote", "daily_allocation"]), "lp_allocation"),
        else_="daily_bonus",
    ).label("tx_type")

    # Running balances computed in chronological order — only the requested page is transmitted.
    bp_balance = func.sum(merged.c.bp_delta).over(
        order_by=merged.c.date.asc(),
        rows=(None, 0),
    ).label("bp_balance")

    tp_balance = func.sum(merged.c.tp_delta).over(
        order_by=merged.c.date.asc(),
        rows=(None, 0),
    ).label("tp_balance")

    # COUNT(*) OVER () captures total before LIMIT/OFFSET without a second query.
    total_count = func.count(literal(1)).over().label("total_count")

    with_balances = select(
        merged.c.id,
        merged.c.date,
        merged.c.reason,
        merged.c.bet_id,
        merged.c.bp_delta,
        merged.c.tp_delta,
        tx_type,
        bp_balance,
        tp_balance,
        total_count,
    ).subquery()

    sort_col = {
        "date": with_balances.c.date,
        "bp": with_balances.c.bp_delta,
        "tp": with_balances.c.tp_delta,
        "type": with_balances.c.tx_type,
    }.get(sort_by, with_balances.c.date)

    order = sort_col.desc() if sort_dir == "desc" else sort_col.asc()

    rows = (await db.execute(
        # id tiebreaker makes pagination deterministic when sort column has ties.
        select(with_balances).order_by(order, with_balances.c.id.asc()).limit(limit).offset(offset)
    )).all()

    total = rows[0].total_count if rows else 0

    # Title lookup only for the current page's bet_ids.
    bet_ids = {row.bet_id for row in rows if row.bet_id is not None}
    title_map: dict[uuid.UUID, str] = {}
    if bet_ids:
        bet_rows = (await db.execute(
            select(Bet.id, Bet.title).where(Bet.id.in_(bet_ids))
        )).all()
        title_map = {bid: title for bid, title in bet_rows}

    entries = [
        TransactionEntry(
            id=row.id,
            date=row.date,
            type=row.tx_type,
            description=title_map.get(row.bet_id) if row.bet_id else "",
            market_id=row.bet_id,
            market_title=title_map.get(row.bet_id) if row.bet_id else None,
            bp_delta=round(row.bp_delta, 1),
            bp_balance=round(row.bp_balance, 1),
            tp_delta=round(row.tp_delta, 1),
            tp_balance=round(row.tp_balance, 1),
        )
        for row in rows
    ]

    return TransactionListResponse(transactions=entries, total=total)
