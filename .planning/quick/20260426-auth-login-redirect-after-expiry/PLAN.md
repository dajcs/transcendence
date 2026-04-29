---
quick_id: 20260426
slug: auth-login-redirect-after-expiry
status: in-progress
created_at: "2026-04-26T07:17:08Z"
---

# Fix Login Redirect After Expired Session

## Goal
When a user is redirected to `/login` after an expired/inactive session and then submits valid credentials, the app must leave `/login` and land on `/markets`.

## Root Cause Hypothesis
The backend login succeeds and `/api/auth/me` succeeds, so auth state is restored. The remaining failure is frontend navigation: the Next App Router may reuse cached server navigation state from the prior unauthenticated `/markets` redirect unless the router is refreshed after the cookie changes.

## Steps
1. Add a regression test for successful login that requires App Router refresh and history replacement after auth bootstrap.
2. Update `LoginForm` post-login navigation to refresh cookie-aware server state and replace `/login` with `/markets`.
3. Run focused frontend tests.
4. Record summary and update project state without touching unrelated user edits.
