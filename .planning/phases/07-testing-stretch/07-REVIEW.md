---
phase: 07-testing-stretch
reviewed: 2026-04-22T07:00:19Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - backend/pyproject.toml
  - backend/tests/conftest.py
  - backend/tests/test_auth.py
  - backend/tests/test_economy.py
  - backend/tests/test_resolution.py
  - backend/tests/test_bets.py
  - backend/tests/test_users.py
  - frontend/package.json
  - frontend/jest.config.ts
  - frontend/src/components/auth/__tests__/LoginForm.test.tsx
  - frontend/src/components/nav/__tests__/TopNav.test.tsx
  - frontend/src/app/(protected)/profile/[username]/__tests__/profile-page.test.tsx
  - frontend/src/__tests__/NotificationBell.test.tsx
  - frontend/src/app/(protected)/markets/[id]/__tests__/market-detail.test.tsx
  - frontend/playwright.config.ts
  - frontend/e2e/auth.spec.ts
  - frontend/e2e/bet-lifecycle.spec.ts
  - frontend/e2e/dispute.spec.ts
  - frontend/e2e/notifications.spec.ts
  - backend/app/main.py
  - backend/app/api/routes/test_support.py
  - Makefile
  - docker-compose.yml
findings:
  critical: 0
  warning: 2
  info: 0
  total: 2
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-04-22T07:00:19Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Reviewed the Phase 07 backend pytest additions, frontend Jest additions, and the Playwright/E2E scaffolding against the current repository state. I did not find a product-code regression in the touched backend/frontend tests, but the Phase 07 automation layer is incomplete in two important ways: the checked-in Playwright path depends on a disabled-by-default backend helper with no committed enablement path, and the GitHub Actions workflows described by the phase summaries are not present in the repo.

## Warnings

### WR-01: Checked-in Playwright suite cannot seed its test data on the default stack

**File:** `frontend/e2e/auth.spec.ts:6`, `frontend/e2e/bet-lifecycle.spec.ts:12`, `frontend/e2e/dispute.spec.ts:12`, `frontend/e2e/notifications.spec.ts:12`, `backend/app/main.py:67-70`, `Makefile:11-17`, `docker-compose.yml:27-46`
**Issue:** Every Playwright spec starts by calling `/api/test-support/...`, but that router is only mounted when `ENABLE_E2E_TEST_SUPPORT` is set. The checked-in local runner (`make e2e`) and the checked-in Docker stack do not set that flag anywhere, so the first setup request will return `404` against the default repo runtime. This makes the E2E suite non-runnable from the committed automation path.
**Fix:**
```yaml
# docker-compose.e2e.override.yml
services:
  backend:
    environment:
      ENABLE_E2E_TEST_SUPPORT: "1"
```
Then make the dedicated E2E command/workflow bring up that override before running `npm run test:e2e`, instead of relying on the default stack.

### WR-02: The Phase 07 CI workflows described by the plan are missing from the repository

**File:** `.github/workflows/ci.yml (missing)`, `.github/workflows/e2e-manual.yml (missing)`
**Issue:** The phase artifacts claim a normal push/PR workflow and a manual Docker+Playwright workflow were added, but neither file exists in the current repo state. As a result, the new backend/frontend coverage commands and Playwright suite are not wired into GitHub Actions at all, which leaves the phase’s main CI deliverable unsatisfied.
**Fix:**
```yaml
# .github/workflows/ci.yml
on:
  push:
  pull_request:
```
Add the lightweight backend/frontend test workflow plus the separate `workflow_dispatch` E2E workflow that enables `ENABLE_E2E_TEST_SUPPORT` only for that manual path.

---

_Reviewed: 2026-04-22T07:00:19Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
