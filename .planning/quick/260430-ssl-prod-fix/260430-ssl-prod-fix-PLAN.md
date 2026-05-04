---
type: quick
id: 260430-ssl-prod-fix
description: Mount production Let's Encrypt certificates directly into nginx
files_modified:
  - Makefile
  - docker-compose.prod.yml
  - nginx/nginx.prod.conf
  - plan/DEPLOYMENT.md
autonomous: true
commit: false
---

<objective>
Remove production SSL certificate staging from `make main`. Production nginx should mount `/etc/letsencrypt/live/voxpo.me` directly and read `cert.pem` and `privkey.pem`.
</objective>

<context>
Current production flow copies `/etc/letsencrypt/live/voxpo.me/cert.pem` and `privkey.pem` into `nginx/ssl-prod/`, then mounts `./nginx/ssl-prod` at `/etc/nginx/ssl`.

Requested target:
- `docker-compose.prod.yml` mounts `/etc/letsencrypt/live/voxpo.me` into the nginx container.
- `nginx/nginx.prod.conf` uses the live directory `cert.pem`.
- `nginx/nginx.prod.conf` uses the live directory `privkey.pem`.
- Do not commit until the user tests and confirms.
</context>

<tasks>
1. Confirm current production config still references `nginx/ssl-prod` and `key.pem`.
2. Remove certificate copy steps from `make main`.
3. Change production compose nginx volumes to bind `/etc/letsencrypt/live/voxpo.me` and its `/etc/letsencrypt/archive/voxpo.me` symlink target read-only.
4. Change production nginx cert paths from staged `/etc/nginx/ssl` files to the live directory `cert.pem` and `privkey.pem`.
5. Update deployment docs and GSD state to describe the new production certificate flow.
6. Verify rendered compose config and targeted text checks.
</tasks>

<success_criteria>
- `make main` no longer copies certificate files.
- Production compose mounts `/etc/letsencrypt/live/voxpo.me` read-only.
- Production nginx config uses `/etc/letsencrypt/live/voxpo.me/cert.pem` and `/etc/letsencrypt/live/voxpo.me/privkey.pem`.
- No commit is created.
</success_criteria>
