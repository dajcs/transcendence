---
quick_task: 260421-exi
description: OAuth login from different computer
date: 2026-04-21
status: complete
---

# Plan

1. Confirm how OAuth callback URLs are derived in backend auth routes and services.
2. Reproduce the failure mode by tracing the callback host/scheme path through Nginx and FastAPI.
3. Fix config defaults so `localhost` is not forced when a dynamic callback host is intended.
4. Fix proxy headers so the backend receives the original HTTPS scheme.
5. Add targeted auth/config tests for request-host and forwarded-proto behavior.
6. Update deployment/planning docs to reflect the new callback-base behavior.
