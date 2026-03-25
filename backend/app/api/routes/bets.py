"""Bet routes."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.bet import BetPlaceRequest, BetPositionsListResponse, BetPositionResponse, BetWithdrawResponse
from app.services import auth_service, bet_service

router = APIRouter()


async def _get_current_user(request: Request, db: AsyncSession):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await auth_service.get_current_user(db, access_token)


@router.post("", response_model=BetPositionResponse, status_code=201)
async def place_bet(
    data: BetPlaceRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = await _get_current_user(request, db)
    return await bet_service.place_bet(db, user_id=user.id, data=data)


@router.delete("/{position_id}", response_model=BetWithdrawResponse)
async def withdraw_bet(
    position_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = await _get_current_user(request, db)
    return await bet_service.withdraw_bet(db, user_id=user.id, position_id=position_id)


@router.get("/positions", response_model=BetPositionsListResponse)
async def list_positions(request: Request, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user(request, db)
    return await bet_service.list_positions(db, user_id=user.id)
