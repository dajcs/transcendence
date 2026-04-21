---
quick_task: 260421-exi
date: 2026-04-21
status: passed
---

# Verification

## Automated

- `uv run pytest tests/test_config.py -k oauth_redirect_base_defaults_to_empty -vv`
- `uv run pytest tests/test_auth.py -k "oauth_initiate or oauth_callback or forwarded_proto" -vv`

## Verified Behaviors

- `OAUTH_REDIRECT_BASE` defaults to empty, allowing callback host derivation from the request.
- OAuth initiation uses the request host when no canonical redirect base is configured.
- OAuth initiation still respects an explicit canonical redirect base when configured.
- Invalid host headers are rejected.
- OAuth callback resolution honors `X-Forwarded-Proto=https`.

## Remaining Manual Check

- Live end-to-end OAuth round-trip against the real 42 provider after reloading Nginx/backend in Docker Compose.
