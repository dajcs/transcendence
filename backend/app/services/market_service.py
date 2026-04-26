"""Market service — create, list, get."""
import json
import uuid
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.market import Market, MarketPosition, MarketUpvote, Comment, Resolution
from app.db.models.user import User
from app.schemas.market import MarketCreate, MarketListResponse, MarketResponse
from app.config import settings
from app.services.economy_service import deduct_bp, emit_balance_changed, get_bet_odds

_DEFAULT_DIRS: dict[str, str] = {"deadline": "asc", "newest": "desc", "active": "desc"}


async def create_market(
    db: AsyncSession, proposer_id: uuid.UUID, data: MarketCreate
) -> MarketResponse:
    """Create market and deduct 1 bp atomically."""
    market = Market(
        id=uuid.uuid4(),
        proposer_id=proposer_id,
        title=data.title,
        description=data.description,
        resolution_criteria=data.resolution_criteria,
        deadline=data.deadline,
        market_type=data.market_type,
        choices=data.choices,
        numeric_min=data.numeric_min,
        numeric_max=data.numeric_max,
        status="open",
        resolution_source=json.dumps(data.resolution_source) if data.resolution_source else None,
    )
    db.add(market)
    await db.flush()
    await deduct_bp(db, user_id=proposer_id, amount=1.0, reason="market_create", bet_id=market.id)
    await db.commit()
    await db.refresh(market)

    proposer = (await db.execute(select(User).where(User.id == proposer_id))).scalar_one_or_none()
    proposer_username = proposer.username if proposer else ""

    # Schedule per-market resolution callback exactly at deadline; store task_id for revocation
    try:
        if settings.database_url.startswith("sqlite"):
            raise RuntimeError("Skipping Celery scheduling for SQLite test database")
        from app.workers.celery_app import celery_app
        eta = market.deadline
        result = celery_app.send_task(
            "app.workers.tasks.resolution.resolve_market_at_deadline",
            args=[str(market.id)],
            eta=eta,
        )
        market.celery_task_id = result.id
        await db.commit()
    except Exception:
        pass  # celery unavailable in test/dev without worker

    return MarketResponse(
        id=market.id,
        title=market.title,
        description=market.description,
        resolution_criteria=market.resolution_criteria,
        deadline=market.deadline,
        status=market.status,
        proposer_id=market.proposer_id,
        proposer_username=proposer_username,
        created_at=market.created_at,
        market_type=market.market_type,
        choices=market.choices,
        numeric_min=market.numeric_min,
        numeric_max=market.numeric_max,
    )


def revoke_market_task(task_id: str, *, terminate: bool = False) -> None:
    """Revoke a scheduled Celery ETA task (e.g. on market cancel/deadline change).

    By default this only marks the task as revoked so a scheduled ETA task will not
    start. Forceful termination of an already-running task must be explicitly opted
    into because it can interrupt execution mid-flight and leave partial side effects.
    """
    try:
        from app.workers.celery_app import celery_app
        celery_app.control.revoke(task_id, terminate=terminate)
    except Exception:
        pass


async def _get_choice_counts(db: AsyncSession, bet_id: uuid.UUID) -> dict[str, int]:
    """Return vote count per side for a market (useful for multichoice)."""
    result = await db.execute(
        select(MarketPosition.side, func.count(MarketPosition.id))
        .where(MarketPosition.market_id == bet_id, MarketPosition.withdrawn_at.is_(None))
        .group_by(MarketPosition.side)
    )
    return {side: int(count) for side, count in result}


async def list_markets(
    db: AsyncSession,
    sort: str = "deadline",
    sort_dir: str = "",
    status: str = "all",
    my_bets: bool = False,
    my_markets: bool = False,
    liked: bool = False,
    user_id: uuid.UUID | None = None,
    proposer_id: uuid.UUID | None = None,
    q: str = "",
    include_desc: bool = False,
    page: int = 1,
    limit: int = 20,
) -> MarketListResponse:
    query = select(Market)

    # Status filter
    if status == "open":
        query = query.where(Market.status == "open")
    elif status == "closed":
        has_res = (
            select(func.count(Resolution.id))
            .where(Resolution.market_id == Market.id)
            .correlate(Market)
            .scalar_subquery()
        )
        query = query.where(Market.status == "closed", has_res == 0)
    elif status == "disputed":
        query = query.where(Market.status == "disputed")
    elif status == "resolved":
        has_res = (
            select(func.count(Resolution.id))
            .where(Resolution.market_id == Market.id)
            .correlate(Market)
            .scalar_subquery()
        )
        query = query.where(has_res > 0)

    # My bets filter
    if my_bets and user_id:
        query = query.where(
            Market.id.in_(
                select(MarketPosition.market_id).where(
                    MarketPosition.user_id == user_id,
                    MarketPosition.withdrawn_at.is_(None),
                )
            )
        )

    # My markets filter (markets created by user)
    if my_markets and user_id:
        query = query.where(Market.proposer_id == user_id)

    # Liked filter — markets the current user has upvoted
    if liked and user_id:
        query = query.where(
            Market.id.in_(
                select(MarketUpvote.market_id).where(MarketUpvote.user_id == user_id)
            )
        )

    # Public proposer filter — for profile page "My Markets" tab
    if proposer_id:
        query = query.where(Market.proposer_id == proposer_id)

    # Search
    if q:
        term = f"%{q}%"
        if include_desc:
            query = query.where(
                Market.title.ilike(term)
                | Market.description.ilike(term)
                | Market.resolution_criteria.ilike(term)
            )
        else:
            query = query.where(Market.title.ilike(term))

    # Sort (effective direction: explicit override or per-sort default)
    effective_dir = sort_dir if sort_dir in ("asc", "desc") else _DEFAULT_DIRS.get(sort, "asc")

    if sort == "deadline":
        query = query.order_by(Market.deadline.asc() if effective_dir == "asc" else Market.deadline.desc())
    elif sort == "newest":
        query = query.order_by(Market.created_at.desc() if effective_dir == "desc" else Market.created_at.asc())
    elif sort == "active":
        active_count = (
            select(func.count(MarketPosition.id))
            .where(MarketPosition.market_id == Market.id, MarketPosition.withdrawn_at.is_(None))
            .correlate(Market)
            .scalar_subquery()
        )
        if effective_dir == "desc":
            query = query.order_by(active_count.desc(), Market.created_at.desc())
        else:
            query = query.order_by(active_count.asc(), Market.created_at.desc())

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (await db.execute(query.offset(offset).limit(limit))).scalars().all()
    pages = max(1, (total + limit - 1) // limit)

    proposer_ids = {row.proposer_id for row in rows}
    username_map: dict[uuid.UUID, str] = {}
    bio_map: dict[uuid.UUID, str | None] = {}
    created_at_map: dict[uuid.UUID, object] = {}
    if proposer_ids:
        uname_rows = (await db.execute(
            select(User.id, User.username, User.mission, User.created_at).where(User.id.in_(proposer_ids))
        )).all()
        username_map = {uid: uname for uid, uname, _m, _cat in uname_rows}
        mission_map = {uid: m for uid, _uname, m, _cat in uname_rows}
        created_at_map = {uid: cat for uid, _uname, _m, cat in uname_rows}

    items: list[MarketResponse] = []
    for row in rows:
        odds = await get_bet_odds(db, row.id)
        position_count = (
            await db.execute(
                select(func.count(MarketPosition.id)).where(
                    MarketPosition.market_id == row.id,
                    MarketPosition.withdrawn_at.is_(None),
                )
            )
        ).scalar_one()
        comment_count = (
            await db.execute(
                select(func.count(Comment.id)).where(
                    Comment.market_id == row.id,
                    Comment.deleted_at.is_(None),
                )
            )
        ).scalar_one()
        choice_counts = await _get_choice_counts(db, row.id)
        upvote_count = (
            await db.execute(
                select(func.count(MarketUpvote.market_id)).where(MarketUpvote.market_id == row.id)
            )
        ).scalar_one()
        user_has_liked = False
        if user_id is not None:
            user_has_liked = (
                await db.execute(
                    select(MarketUpvote).where(
                        MarketUpvote.market_id == row.id,
                        MarketUpvote.user_id == user_id,
                    )
                )
            ).scalar_one_or_none() is not None
        items.append(
            MarketResponse(
                id=row.id,
                title=row.title,
                description=row.description,
                resolution_criteria=row.resolution_criteria,
                deadline=row.deadline,
                status=row.status,
                proposer_id=row.proposer_id,
                proposer_username=username_map.get(row.proposer_id, ""),
                proposer_mission=mission_map.get(row.proposer_id),
                proposer_created_at=created_at_map.get(row.proposer_id),
                created_at=row.created_at,
                market_type=row.market_type,
                choices=row.choices,
                numeric_min=row.numeric_min,
                numeric_max=row.numeric_max,
                yes_pct=float(odds["yes_pct"]),
                no_pct=float(odds["no_pct"]),
                yes_count=int(odds["yes_count"]),
                no_count=int(odds["no_count"]),
                position_count=int(position_count),
                comment_count=int(comment_count),
                choice_counts=choice_counts,
                upvote_count=int(upvote_count),
                user_has_liked=user_has_liked,
            )
        )

    return MarketListResponse(items=items, total=int(total), page=page, pages=pages)


async def get_market(
    db: AsyncSession,
    market_id: uuid.UUID,
    current_user_id: uuid.UUID | None = None,
) -> MarketResponse:
    market = (await db.execute(select(Market).where(Market.id == market_id))).scalar_one_or_none()
    if market is None:
        raise HTTPException(status_code=404, detail="Market not found")

    proposer = (await db.execute(select(User).where(User.id == market.proposer_id))).scalar_one_or_none()
    proposer_username = proposer.username if proposer else ""

    odds = await get_bet_odds(db, market.id)
    position_count = (
        await db.execute(
            select(func.count(MarketPosition.id)).where(
                MarketPosition.market_id == market.id,
                MarketPosition.withdrawn_at.is_(None),
            )
        )
    ).scalar_one()
    comment_count = (
        await db.execute(
            select(func.count(Comment.id)).where(
                Comment.market_id == market.id,
                Comment.deleted_at.is_(None),
            )
        )
    ).scalar_one()
    choice_counts = await _get_choice_counts(db, market.id)
    upvote_count = (
        await db.execute(
            select(func.count(MarketUpvote.market_id)).where(MarketUpvote.market_id == market.id)
        )
    ).scalar_one()

    user_has_liked = False
    if current_user_id is not None:
        user_has_liked = (
            await db.execute(
                select(MarketUpvote).where(
                    MarketUpvote.market_id == market_id,
                    MarketUpvote.user_id == current_user_id,
                )
            )
        ).scalar_one_or_none() is not None

    return MarketResponse(
        id=market.id,
        title=market.title,
        description=market.description,
        resolution_criteria=market.resolution_criteria,
        deadline=market.deadline,
        status=market.status,
        proposer_id=market.proposer_id,
        proposer_username=proposer_username,
        created_at=market.created_at,
        market_type=market.market_type,
        choices=market.choices,
        numeric_min=market.numeric_min,
        numeric_max=market.numeric_max,
        yes_pct=float(odds["yes_pct"]),
        no_pct=float(odds["no_pct"]),
        yes_count=int(odds["yes_count"]),
        no_count=int(odds["no_count"]),
        position_count=int(position_count),
        comment_count=int(comment_count),
        choice_counts=choice_counts,
        upvote_count=int(upvote_count),
        user_has_liked=user_has_liked,
    )


async def upvote_market(db: AsyncSession, user_id: uuid.UUID, market_id: uuid.UUID) -> None:
    from datetime import datetime, timezone
    from sqlalchemy.exc import IntegrityError
    from app.db.models.transaction import LpEvent

    market = (await db.execute(select(Market).where(Market.id == market_id))).scalar_one_or_none()
    if market is None:
        raise HTTPException(status_code=404, detail="Market not found")
    if market.proposer_id == user_id:
        return  # self-like not allowed
    try:
        db.add(MarketUpvote(market_id=market_id, user_id=user_id))
        db.add(LpEvent(
            user_id=market.proposer_id,
            amount=1,
            source_type="market_upvote",
            source_id=market_id,
            day_date=datetime.now(timezone.utc).date(),
        ))
        await db.commit()
        await emit_balance_changed(db, market.proposer_id)
    except IntegrityError:
        await db.rollback()  # already upvoted — treat as no-op


async def unlike_market(db: AsyncSession, user_id: uuid.UUID, market_id: uuid.UUID) -> None:
    """Remove upvote from market; decrement unconverted LP for proposer by 1."""
    from datetime import datetime, timezone
    from app.db.models.transaction import LpEvent

    market = (await db.execute(select(Market).where(Market.id == market_id))).scalar_one_or_none()
    if market is None:
        raise HTTPException(status_code=404, detail="Market not found")
    if market.proposer_id == user_id:
        return  # self-like state is always a no-op
    delete_result = await db.execute(
        delete(MarketUpvote).where(
            MarketUpvote.market_id == market_id,
            MarketUpvote.user_id == user_id,
        )
    )
    if delete_result.rowcount == 0:
        return  # not upvoted — no-op
    lp_total = (
        await db.execute(select(func.sum(LpEvent.amount)).where(LpEvent.user_id == market.proposer_id))
    ).scalar_one()
    lp_changed = int(lp_total or 0) > 0
    if lp_changed:
        db.add(LpEvent(
            user_id=market.proposer_id,
            amount=-1,
            source_type="market_upvote",
            source_id=market_id,
            day_date=datetime.now(timezone.utc).date(),
        ))
    await db.commit()
    if lp_changed:
        await emit_balance_changed(db, market.proposer_id)
