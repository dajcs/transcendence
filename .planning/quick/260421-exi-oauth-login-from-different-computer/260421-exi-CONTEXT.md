---
quick_task: 260421-exi
description: OAuth login from different computer
date: 2026-04-21
mode: discuss-validate
---

# Context

## Problem

OAuth login failed when the app was opened from another computer because the callback URI was generated with `localhost`. A second failure mode then showed the callback URI using `http://localhost:8443/...`, which 42 rejects.

## Decisions

- Keep OAuth auto-linking by email for existing local accounts.
- Derive the OAuth callback host from the incoming request when `OAUTH_REDIRECT_BASE` is unset.
- Preserve support for a fixed canonical callback base when `OAUTH_REDIRECT_BASE` is explicitly configured.
- Treat proxy headers as part of the root cause: Nginx must forward the original scheme so the backend can build `https://...` callback URIs.

## Expected Outcome

- OAuth initiation from `https://localhost:8443` produces `https://localhost:8443/api/auth/oauth/{provider}/callback`.
- OAuth initiation from another allowed host uses that host instead of forcing `localhost`.
- Invalid hosts are still rejected.
