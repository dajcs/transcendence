---
status: complete
date: 2026-05-03
commit: cad8e8b
---

# Summary

Implemented custom avatar uploads and propagated uploaded avatar images across the main user surfaces. User reviewed the behavior and approved commit on 2026-05-03.

## Changed

- Added `POST /api/users/me/avatar` accepting authenticated multipart JPG/PNG uploads.
- Added avatar upload config for storage path and max size.
- Mounted `/uploads` in FastAPI and proxied `/uploads/` through local and production Nginx configs.
- Persisted uploads in Docker Compose via `./backend/uploads:/app/uploads`.
- Added own-profile avatar file picker UI with the exact hover tooltip `Upload custom avatar image`.
- Updated auth store avatar state so the current session sees the new avatar immediately.
- Added shared frontend Avatar component and used uploaded avatar images on markets, market detail, friends, chat, hall of fame, and user search.
- Added proposer avatar URLs to market responses and avatar URLs to friend request and chat message responses.
- Added backend and frontend regression tests.

## Verification

- `npm test -- --runTestsByPath src/app/'(protected)'/profile/'[username]'/__tests__/profile-page.test.tsx src/store/__tests__/auth-store.test.ts --runInBand --detectOpenHandles` passed.
- `npm test -- --runTestsByPath src/components/__tests__/Avatar.test.tsx src/app/'(protected)'/markets/__tests__/markets-page.test.tsx src/app/'(protected)'/profile/'[username]'/__tests__/profile-page.test.tsx --runInBand` passed.
- `npm test -- --runTestsByPath src/components/__tests__/UserSearch.test.tsx src/app/'(protected)'/markets/'[id]'/__tests__/market-detail.test.tsx --runInBand` passed.
- `npm run type-check` passed.
- `env UV_CACHE_DIR=/mnt/c/Users/dajcs/code/transcendence/.cache/uv timeout 30s uv run python -m py_compile app/schemas/market.py app/services/market_service.py app/schemas/friends.py app/services/friend_service.py app/schemas/chat.py app/services/chat_service.py` passed.
- `env UV_CACHE_DIR=/mnt/c/Users/dajcs/code/transcendence/.cache/uv timeout 30s uv run python -m py_compile app/api/routes/users.py app/config.py app/main.py` passed.
- Backend pytest for avatar tests was attempted, but both the new avatar test and the existing `test_get_profile_success` baseline timed out locally, so backend behavioral pytest remains unverified in this environment.
