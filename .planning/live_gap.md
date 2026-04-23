# Live Gap Analysis

  1. High: uncontested resolved markets can close without paying winners.
     In backend/app/workers/tasks/resolution.py:517, the worker sets bet.status = "closed" and commits before calling trigger_payout. trigger_payout exits early when the bet is already closed, so the 48h no-dispute path can skip payouts.
  2. High: users can place bets after the deadline if the worker has not swept the market yet.
     backend/app/services/bet_service.py:80 checks market.status == "open" but does not check market.deadline > now. Any delayed Celery/beat run leaves an expired market bettable.
  3. High: user-supplied LLM API keys are stored plaintext.
     The model comment explicitly says plaintext at backend/app/db/models/user.py:28, and backend/app/api/routes/users.py:83 writes the raw key directly. For go-live this needs encryption at rest or removal of BYO-key storage.
  4. **fixed**: protected frontend routes are incomplete.
     frontend/src/proxy.ts:9 guards /markets, /friends, /chat, and /profile, but not /settings even though settings contains account export/delete and LLM key UI. Unauthenticated users hit client-side API failures instead of a clean redirect.
  5. Medium: password reset links are hardcoded to localhost.
     backend/app/services/auth_service.py:150 builds https://localhost:8443/reset-password?..., so production reset emails would be unusable unless this is made configurable.
  6. Medium: deployment config is still local-demo oriented.
     docker-compose.yml:86 hardcodes https://localhost:8443 for frontend public URLs, .env.example uses development secrets/default hosts, and TLS generation is self-signed. That is fine for 42/local demo, not public go-live.

##  Missing To Go Live

###  Core product gaps:

  - Admin/moderation tools: remove abusive markets/comments, suspend users, inspect disputes.
  - Human-only enforcement: CAPTCHA/email verification/device/IP abuse controls, not just login rate limit.
  - Production email setup: real SMTP, verified sender domain, configurable public base URL.
  - Production OAuth setup: real redirect URIs for Google/GitHub/42 and provider config validation.
  - Privacy/security hardening: encrypted API keys, CSRF strategy review for cookie auth, rate limits on writes, audit logging.
  - Operations: backups/restore, monitoring, structured logs, error reporting, health checks beyond “ok”.
  - Release proof: clean Docker build, migrations from empty DB, frontend type-check, Jest, backend pytest, and Playwright E2E in Chrome with no console warnings.

###  Verification

  - Working tree was clean.
  - npm run type-check failed because .next/types/validator.ts references missing frontend/src/app/(protected)/dashboard/page.js.
  - Backend pytest and Jest sessions produced no output for an extended period through this tool, so I’m not claiming they passed.
