"""Market routes."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.market import MarketCreate, MarketListResponse, MarketResponse
from app.services import auth_service, market_service

router = APIRouter()


async def _get_current_user(request: Request, db: AsyncSession) -> object:
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await auth_service.get_current_user(db, access_token)


@router.post("", response_model=MarketResponse, status_code=201)
async def create_market(
    data: MarketCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = await _get_current_user(request, db)
    return await market_service.create_market(db, proposer_id=user.id, data=data)


@router.get("", response_model=MarketListResponse)
async def list_markets(
    request: Request,
    sort: str = Query(default="deadline", pattern="^(deadline|active|newest)$"),
    sort_dir: str = Query(default="", pattern="^(asc|desc|)$"),
    status: str = Query(default="all", pattern="^(all|open|closed|disputed|resolved)$"),
    my_bets: bool = Query(default=False),
    my_markets: bool = Query(default=False),
    q: str = Query(default=""),
    include_desc: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    user_id = None
    if my_bets or my_markets:
        try:
            user = await _get_current_user(request, db)
            user_id = user.id
        except HTTPException:
            raise HTTPException(status_code=401, detail="Login required for this filter")

    return await market_service.list_markets(
        db,
        sort=sort,
        sort_dir=sort_dir,
        status=status,
        my_bets=my_bets,
        my_markets=my_markets,
        user_id=user_id,
        q=q,
        include_desc=include_desc,
        page=page,
        limit=limit,
    )


@router.get("/{market_id}", response_model=MarketResponse)
async def get_market(market_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await market_service.get_market(db, market_id)


@router.post("/{market_id}/upvote", status_code=201)
async def upvote_market(
    market_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = await _get_current_user(request, db)
    await market_service.upvote_market(db, user_id=user.id, market_id=market_id)
