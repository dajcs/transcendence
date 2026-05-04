---
quick_id: 260430-ssl
status: incomplete
date: 2026-04-30
commit: pending
---

# Quick Task 260430-ssl Summary

## Result

Production nginx certificate handling now mounts the Let's Encrypt live directory directly instead of copying certificate files into `nginx/ssl-prod`. The archive directory is also mounted read-only so Let's Encrypt's relative symlinks resolve inside the container.

## Changes

- Removed the certificate copy steps from `make main`.
- Changed `docker-compose.prod.yml` to mount `/etc/letsencrypt/live/voxpo.me` and `/etc/letsencrypt/archive/voxpo.me` read-only.
- Changed `nginx/nginx.prod.conf` to use `/etc/letsencrypt/live/voxpo.me/cert.pem` and `/etc/letsencrypt/live/voxpo.me/privkey.pem`.
- Updated deployment documentation for the new production SSL flow.

## Verification

- Pre-change checks confirmed `make main` staged certs, production compose mounted `./nginx/ssl-prod`, and nginx referenced `key.pem`.
- Targeted post-change checks passed for removal of staging commands, direct Let's Encrypt live/archive mounts, and `privkey.pem`.
- `docker compose -f docker-compose.yml -f docker-compose.prod.yml config` rendered successfully and showed the direct `/etc/letsencrypt/live/voxpo.me` nginx bind mount plus the archive symlink target bind mount.

Last action: awaiting user production test and confirmation before commit.
