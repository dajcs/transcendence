"""Market (Bet) service — create, list, get."""
import uuid

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.bet import Bet, BetPosition
from app.schemas.market import MarketCreate, MarketListResponse, MarketResponse
from app.services.economy_service import deduct_bp, get_bet_odds


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
        status="open",
    )
    db.add(bet)
    await db.commit()
    await db.refresh(bet)

    return MarketResponse(
        id=bet.id,
        title=bet.title,
        description=bet.description,
        resolution_criteria=bet.resolution_criteria,
        deadline=bet.deadline,
        status=bet.status,
        proposer_id=bet.proposer_id,
        created_at=bet.created_at,
    )


async def list_markets(
    db: AsyncSession,
    sort: str = "deadline",
    status: str = "all",
    page: int = 1,
    limit: int = 20,
) -> MarketListResponse:
    query = select(Bet)

    if status == "open":
        query = query.where(Bet.status == "open")
    elif status == "resolved":
        query = query.where(Bet.status == "closed")

    if sort == "deadline":
        query = query.order_by(Bet.deadline.asc())
    elif sort == "newest":
        query = query.order_by(Bet.created_at.desc())
    elif sort == "active":
        active_count = (
            select(func.count(BetPosition.id))
            .where(BetPosition.bet_id == Bet.id, BetPosition.withdrawn_at.is_(None))
            .correlate(Bet)
            .scalar_subquery()
        )
        query = query.order_by(active_count.desc(), Bet.created_at.desc())

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
                yes_pct=float(odds["yes_pct"]),
                no_pct=float(odds["no_pct"]),
                position_count=int(position_count),
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

    return MarketResponse(
        id=market.id,
        title=market.title,
        description=market.description,
        resolution_criteria=market.resolution_criteria,
        deadline=market.deadline,
        status=market.status,
        proposer_id=market.proposer_id,
        created_at=market.created_at,
        yes_pct=float(odds["yes_pct"]),
        no_pct=float(odds["no_pct"]),
        position_count=int(position_count),
    )
