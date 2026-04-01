"""Market (Bet) service — create, list, get."""
import uuid
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.bet import Bet, BetPosition, BetUpvote, Comment, Resolution
from app.schemas.market import MarketCreate, MarketListResponse, MarketResponse
from app.services.economy_service import deduct_bp, get_bet_odds

_DEFAULT_DIRS: dict[str, str] = {"deadline": "asc", "newest": "desc", "active": "desc"}


async def create_market(
    db: AsyncSession, proposer_id: uuid.UUID, data: MarketCreate
) -> MarketResponse:
    """Create market and deduct 1 bp atomically."""
    await deduct_bp(db, user_id=proposer_id, amount=1.0, reason="market_create")
    bet = Bet(
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
    )
    db.add(bet)
    await db.commit()
    await db.refresh(bet)

    # Schedule per-market resolution callback at deadline + 5 min grace
    try:
        from app.workers.celery_app import celery_app
        eta = bet.deadline + timedelta(minutes=5)
        celery_app.send_task(
            "app.workers.tasks.resolution.resolve_market_at_deadline",
            args=[str(bet.id)],
            eta=eta,
        )
    except Exception:
        pass  # celery unavailable in test/dev without worker

    return MarketResponse(
        id=bet.id,
        title=bet.title,
        description=bet.description,
        resolution_criteria=bet.resolution_criteria,
        deadline=bet.deadline,
        status=bet.status,
        proposer_id=bet.proposer_id,
        created_at=bet.created_at,
        market_type=bet.market_type,
        choices=bet.choices,
        numeric_min=bet.numeric_min,
        numeric_max=bet.numeric_max,
    )


async def _get_choice_counts(db: AsyncSession, bet_id: uuid.UUID) -> dict[str, int]:
    """Return vote count per side for a market (useful for multichoice)."""
    result = await db.execute(
        select(BetPosition.side, func.count(BetPosition.id))
        .where(BetPosition.bet_id == bet_id, BetPosition.withdrawn_at.is_(None))
        .group_by(BetPosition.side)
    )
    return {side: int(count) for side, count in result}


async def list_markets(
    db: AsyncSession,
    sort: str = "deadline",
    sort_dir: str = "",
    status: str = "all",
    my_bets: bool = False,
    my_markets: bool = False,
    user_id: uuid.UUID | None = None,
    q: str = "",
    include_desc: bool = False,
    page: int = 1,
    limit: int = 20,
) -> MarketListResponse:
    query = select(Bet)

    # Status filter
    if status == "open":
        query = query.where(Bet.status == "open")
    elif status == "closed":
        has_res = (
            select(func.count(Resolution.id))
            .where(Resolution.bet_id == Bet.id)
            .correlate(Bet)
            .scalar_subquery()
        )
        query = query.where(Bet.status == "closed", has_res == 0)
    elif status == "resolved":
        has_res = (
            select(func.count(Resolution.id))
            .where(Resolution.bet_id == Bet.id)
            .correlate(Bet)
            .scalar_subquery()
        )
        query = query.where(has_res > 0)

    # My bets filter
    if my_bets and user_id:
        query = query.where(
            Bet.id.in_(
                select(BetPosition.bet_id).where(
                    BetPosition.user_id == user_id,
                    BetPosition.withdrawn_at.is_(None),
                )
            )
        )

    # My markets filter (markets created by user)
    if my_markets and user_id:
        query = query.where(Bet.proposer_id == user_id)

    # Search
    if q:
        term = f"%{q}%"
        if include_desc:
            query = query.where(
                Bet.title.ilike(term)
                | Bet.description.ilike(term)
                | Bet.resolution_criteria.ilike(term)
            )
        else:
            query = query.where(Bet.title.ilike(term))

    # Sort (effective direction: explicit override or per-sort default)
    effective_dir = sort_dir if sort_dir in ("asc", "desc") else _DEFAULT_DIRS.get(sort, "asc")

    if sort == "deadline":
        query = query.order_by(Bet.deadline.asc() if effective_dir == "asc" else Bet.deadline.desc())
    elif sort == "newest":
        query = query.order_by(Bet.created_at.desc() if effective_dir == "desc" else Bet.created_at.asc())
    elif sort == "active":
        active_count = (
            select(func.count(BetPosition.id))
            .where(BetPosition.bet_id == Bet.id, BetPosition.withdrawn_at.is_(None))
            .correlate(Bet)
            .scalar_subquery()
        )
        if effective_dir == "desc":
            query = query.order_by(active_count.desc(), Bet.created_at.desc())
        else:
            query = query.order_by(active_count.asc(), Bet.created_at.desc())

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (await db.execute(query.offset(offset).limit(limit))).scalars().all()
    pages = max(1, (total + limit - 1) // limit)

    items: list[MarketResponse] = []
    for row in rows:
        odds = await get_bet_odds(db, row.id)
        position_count = (
            await db.execute(
                select(func.count(BetPosition.id)).where(
                    BetPosition.bet_id == row.id,
                    BetPosition.withdrawn_at.is_(None),
                )
            )
        ).scalar_one()
        comment_count = (
            await db.execute(
                select(func.count(Comment.id)).where(
                    Comment.bet_id == row.id,
                    Comment.deleted_at.is_(None),
                )
            )
        ).scalar_one()
        choice_counts = await _get_choice_counts(db, row.id)
        upvote_count = (
            await db.execute(
                select(func.count(BetUpvote.bet_id)).where(BetUpvote.bet_id == row.id)
            )
        ).scalar_one()
        items.append(
            MarketResponse(
                id=row.id,
                title=row.title,
                description=row.description,
                resolution_criteria=row.resolution_criteria,
                deadline=row.deadline,
                status=row.status,
                proposer_id=row.proposer_id,
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
            )
        )

    return MarketListResponse(items=items, total=int(total), page=page, pages=pages)


async def get_market(db: AsyncSession, market_id: uuid.UUID) -> MarketResponse:
    market = (await db.execute(select(Bet).where(Bet.id == market_id))).scalar_one_or_none()
    if market is None:
        raise HTTPException(status_code=404, detail="Market not found")

    odds = await get_bet_odds(db, market.id)
    position_count = (
        await db.execute(
            select(func.count(BetPosition.id)).where(
                BetPosition.bet_id == market.id,
                BetPosition.withdrawn_at.is_(None),
            )
        )
    ).scalar_one()
    comment_count = (
        await db.execute(
            select(func.count(Comment.id)).where(
                Comment.bet_id == market.id,
                Comment.deleted_at.is_(None),
            )
        )
    ).scalar_one()
    choice_counts = await _get_choice_counts(db, market.id)
    upvote_count = (
        await db.execute(
            select(func.count(BetUpvote.bet_id)).where(BetUpvote.bet_id == market.id)
        )
    ).scalar_one()

    return MarketResponse(
        id=market.id,
        title=market.title,
        description=market.description,
        resolution_criteria=market.resolution_criteria,
        deadline=market.deadline,
        status=market.status,
        proposer_id=market.proposer_id,
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
    )


async def upvote_market(db: AsyncSession, user_id: uuid.UUID, market_id: uuid.UUID) -> None:
    from datetime import datetime, timezone
    from sqlalchemy.exc import IntegrityError
    from app.db.models.transaction import KpEvent

    market = (await db.execute(select(Bet).where(Bet.id == market_id))).scalar_one_or_none()
    if market is None:
        raise HTTPException(status_code=404, detail="Market not found")
    try:
        db.add(BetUpvote(bet_id=market_id, user_id=user_id))
        db.add(KpEvent(
            user_id=market.proposer_id,
            amount=1,
            source_type="market_upvote",
            source_id=market_id,
            day_date=datetime.now(timezone.utc).date(),
        ))
        await db.commit()
    except IntegrityError:
        await db.rollback()  # already upvoted — treat as no-op
