"""Friend system API routes: /api/friends/*"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.friends import FriendListResponse, FriendRequestResponse
from app.services import auth_service
from app.services import friend_service

router = APIRouter()


async def _get_current_user(request: Request, db: AsyncSession):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await auth_service.get_current_user(db, access_token)


@router.get("", response_model=FriendListResponse)
async def list_friends(request: Request, db: AsyncSession = Depends(get_db)):
    """Get friends list, pending received, and pending sent requests."""
    user = await _get_current_user(request, db)
    return await friend_service.get_friends_list(db, user.id)


@router.post("/request/{user_id}", status_code=200)
async def send_request(user_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db)):
    """Send a friend request to user_id. Always returns 200 to avoid browser console errors."""
    user = await _get_current_user(request, db)
    try:
        await friend_service.send_friend_request(db, user.id, user_id)
        return {"success": True}
    except HTTPException as e:
        return {"success": False, "detail": e.detail}


@router.post("/accept/{request_id}", response_model=FriendRequestResponse)
async def accept_request(request_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db)):
    """Accept a pending friend request."""
    user = await _get_current_user(request, db)
    return await friend_service.accept_friend_request(db, request_id, user.id)


@router.delete("/request/{request_id}", status_code=204)
async def cancel_request(request_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db)):
    """Cancel a pending friend request sent by the current user."""
    user = await _get_current_user(request, db)
    await friend_service.cancel_friend_request(db, request_id, user.id)


@router.post("/reject/{request_id}", response_model=FriendRequestResponse)
async def reject_request(request_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db)):
    """Decline a pending friend request."""
    user = await _get_current_user(request, db)
    return await friend_service.reject_friend_request(db, request_id, user.id)


@router.delete("/{user_id}", status_code=204)
async def remove_friend(user_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db)):
    """Remove an existing friend."""
    user = await _get_current_user(request, db)
    await friend_service.remove_friend(db, user.id, user_id)


@router.post("/block/{user_id}", status_code=204)
async def block_user(user_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db)):
    """Block a user."""
    user = await _get_current_user(request, db)
    await friend_service.block_user(db, user.id, user_id)


@router.post("/unblock/{user_id}", status_code=204)
async def unblock_user(user_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db)):
    """Unblock a previously blocked user."""
    user = await _get_current_user(request, db)
    await friend_service.unblock_user(db, user.id, user_id)
