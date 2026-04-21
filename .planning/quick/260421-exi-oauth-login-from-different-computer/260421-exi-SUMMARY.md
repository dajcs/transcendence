---
quick_task: 260421-exi
description: OAuth login from different computer
date: 2026-04-21
status: complete
verification: Verified
commit: a363eed
---

# Quick Task Summary

OAuth callback generation now follows the initiating host and preserved HTTPS scheme instead of being pinned to `localhost` or downgraded to `http` behind Nginx.

## Accomplishments

- Changed backend config to leave `oauth_redirect_base` unset by default so request-host resolution can be used for local/LAN OAuth flows.
- Updated Nginx to forward `X-Forwarded-Proto` and the full host header to proxied services.
- Added targeted auth/config tests for request-host, canonical override, invalid-host rejection, and forwarded-proto handling.
- Updated deployment and Phase 06 planning docs to match the implemented behavior.

## Files

- `backend/app/config.py`
- `nginx/nginx.conf`
- `backend/tests/test_auth.py`
- `backend/tests/test_config.py`
- `.env.example`
- `plan/DEPLOYMENT.md`

## Verification Status

Verified by targeted automated tests. Live OAuth provider round-trip still requires a manual check in the running stack.
