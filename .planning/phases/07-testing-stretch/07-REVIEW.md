---
phase: 07-testing-stretch
reviewed: 2026-04-28T17:55:11Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - Makefile
  - backend/tests/test_comments.py
  - backend/tests/test_markets.py
  - frontend/src/components/__tests__/AuthBootstrap.test.tsx
  - frontend/e2e/auth.spec.ts
  - frontend/e2e/bet-lifecycle.spec.ts
  - frontend/e2e/dispute.spec.ts
  - frontend/e2e/notifications.spec.ts
findings:
  critical: 0
  warning: 3
  info: 0
  total: 3
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-04-28T17:55:11Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the requested Makefile target, backend pytest changes, frontend Jest test, and Playwright E2E specs. I found no production security issue in the reviewed files, but three backend tests are currently too permissive or incomplete and can let the exact behavior they describe regress without failing.

## Warnings

### WR-01: Market creation deduction test never verifies the deduction

**File:** `backend/tests/test_markets.py:22-34`
**Issue:** `test_create_market_deducts_1bp` fetches `/api/auth/me` before creating the market but never uses `me_before` or checks the balance afterward. A regression that creates markets for free would still pass as long as the endpoint returns `201`.
**Fix:**
```python
me_before = await client.get("/api/auth/me")
before_bp = me_before.json()["bp"]

resp = await client.post("/api/markets", json={...})
assert resp.status_code == 201

me_after = await client.get("/api/auth/me")
assert me_after.json()["bp"] == before_bp - 1
```

### WR-02: Insufficient-BP test accepts success and validation failures

**File:** `backend/tests/test_markets.py:37-55`
**Issue:** `test_create_market_insufficient_bp` claims to verify a `402` response, but it accepts `201`, `402`, or `422`. That means the test passes if an underfunded user can create a market, and also passes if the request is rejected for an unrelated validation reason.
**Fix:** Create a real zero-BP user through the database/session or remove the signup credit for this user, then assert the precise contract:
```python
resp = await client.post("/api/markets", json=valid_market_payload)
assert resp.status_code == 402
```

### WR-03: Comment upvote reward test only checks HTTP status

**File:** `backend/tests/test_comments.py:40-55`
**Issue:** `test_upvote_comment_earns_kp` says the comment author earns points, but it only asserts that the upvote request returns `201`. A regression that records the upvote without crediting the author would still pass.
**Fix:** Capture the author's balance before and after the second user upvotes, or query the LP event/balance directly, and assert the expected point increase. Also update the test name/docstring if the intended reward is LP rather than KP.

---

_Reviewed: 2026-04-28T17:55:11Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
