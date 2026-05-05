---
status: incomplete
date: 2026-05-05
commit: pending
---

# Summary

Implemented a focused fix for avatar uploads, pending user manual verification before commit.

## Changed

- Removed the shared Axios client's forced `Content-Type: application/json` default so `FormData` uploads can use browser-generated multipart boundaries.
- Added a frontend regression test for the API client content-type default.

## Verification

- Red check: temporarily restored the forced Axios `Content-Type` default, then `timeout 120s npm test -- api.test.ts --runInBand` failed with `Received: "application/json"`.
- `timeout 60s npm test -- api.test.ts --runInBand` passed.
- `timeout 120s npm test -- api.test.ts --runInBand` passed after restoring the fix.
- `timeout 180s npm test -- profile-page.test.tsx --runInBand --testNamePattern uploads` passed.
- `timeout 120s uv run pytest -o addopts= tests/test_users.py::test_upload_avatar_accepts_png_and_updates_profile tests/test_users.py::test_upload_avatar_rejects_non_image -q` passed.
- Initial backend run without `-o addopts=` showed both selected tests passing, then failed the repo-wide coverage threshold because only two tests were selected.

## Status

Awaiting user functionality check. No commit made.
