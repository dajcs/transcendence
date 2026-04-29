---
quick_id: 260427-jbh
status: pending-review
date: 2026-04-27
commit: uncommitted
---

# Quick Task 260427-jbh Summary

## Result

Implemented application-layer encryption for user-supplied LLM API keys without committing, per request.

## Changes

- Added `backend/app/utils/crypto.py` with Fernet encryption/decryption derived from `SECRET_KEY`.
- Updated `PATCH /api/users/me` to encrypt `llm_api_key` before assigning `User.llm_api_key`.
- Updated LLM summary and resolution-hint routes to decrypt saved user keys only at the custom provider call boundary.
- Updated the `User.llm_api_key` model comment from plaintext to encrypted storage.
- Added direct `cryptography` dependency metadata and refreshed `backend/uv.lock`.
- Added regression tests for encrypted storage and decrypted custom LLM provider use.

## Verification

- `DATABASE_URL=sqlite+aiosqlite:///:memory: SECRET_KEY=test-secret JWT_PRIVATE_KEY_PATH=/tmp/missing JWT_PUBLIC_KEY_PATH=/tmp/missing uv run pytest backend/tests/test_users.py::test_patch_my_settings_encrypts_api_key_at_rest backend/tests/test_llm_routes.py::test_custom_llm_summary_decrypts_saved_api_key -q` passed.
- `DATABASE_URL=sqlite+aiosqlite:///:memory: SECRET_KEY=test-secret JWT_PRIVATE_KEY_PATH=/tmp/missing JWT_PUBLIC_KEY_PATH=/tmp/missing uv run pytest backend/tests/test_users.py backend/tests/test_llm_routes.py -q` passed: 24 tests.

## Commit Status

No commit created. Awaiting review.
