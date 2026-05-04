---
quick_id: 260503-avt
slug: custom-avatar-upload
date: 2026-05-03
status: complete
---

# Custom Avatar Upload

Implement authenticated custom avatar image upload for JPG/PNG files from the profile avatar on `/profile/[username]`.

## Scope

- Add a backend multipart upload endpoint for the current user's avatar.
- Validate uploads as JPG or PNG image data and enforce a conservative size limit.
- Store uploaded avatar images under backend-managed upload storage and expose them at `/uploads/avatars/...`.
- Update the own-profile avatar UI so hover shows `Upload custom avatar image`, click opens the file picker, and a successful upload updates the displayed avatar.
- Propagate uploaded avatar images to user surfaces across markets, friends, chat, hall of fame, and user search.
- Commit after user review approval.

## Verification

- Frontend focused Jest tests.
- Frontend TypeScript check.
- Backend compile check.
- Backend pytest attempted, but local baseline profile tests timed out in this environment.
- User review accepted on 2026-05-03.
