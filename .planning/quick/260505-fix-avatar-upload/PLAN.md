---
status: awaiting-user-test
created: 2026-05-05
slug: fix-avatar-upload
---

# Quick Task 260505: Fix Avatar Upload

## Goal

Fix avatar uploads from `/profile/[username]` where selecting an image shows "Avatar upload failed."

## Root Cause

The shared frontend Axios client forced `Content-Type: application/json` for every request. Avatar upload sends `FormData` to `/api/users/me/avatar`, which must be sent as multipart form data with a generated boundary. A global JSON content type can prevent FastAPI from parsing the uploaded file.

## Tasks

1. Add a regression test proving the API client does not force a default JSON `Content-Type`.
2. Remove the global `Content-Type` header while preserving cookie credentials for JSON and multipart requests.
3. Run focused frontend and backend avatar/profile tests.

## Commit Policy

Do not commit. The user explicitly asked to check functionality first.
