---
status: complete
task: oauth-login-daily-bonus
date: 2026-05-05
---

Implemented and confirmed by user OAuth login test.

Changes:
- Added regression coverage in `backend/tests/test_auth.py` for stale OAuth `/me` daily bonus requests.
- Made `_credit_daily_login_bonus` atomic by conditionally updating `users.last_login` before inserting the `daily_login` BP transaction.

Verification:
- `python -m py_compile app/services/auth_service.py tests/test_auth.py` passed.
- `docker compose exec backend uv run pytest -o addopts= tests/test_auth.py::test_daily_login_bonus_is_atomic_for_stale_oauth_me_requests -q` passed: 1 test passed.
- Host `uv run pytest` still timed out in this sandbox during SQLite setup.
- User confirmed OAuth login works after rotating expired 42 credentials.
