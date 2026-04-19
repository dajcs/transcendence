---
slug: login-from-mobile-failed
status: resolved
trigger: "login from mobile failed"
created: 2026-04-18
updated: 2026-04-18
---

## Symptoms

- **Expected**: User submits login form on mobile → authenticated → redirected to /markets
- **Actual**: Login appears to POST successfully (HTTP 200) but mobile user cannot get in
- **Error messages**: nginx error: "upstream sent no valid HTTP/1.0 header while reading response header from upstream" for `/_next/webpack-hmr`; mobile Chrome gets HTTP 009 on webpack-hmr
- **Timeline**: Unknown when first noticed; desktop appears to work
- **Reproduction**: Access `https://192.168.178.61:8443/login` from Android Firefox or Chrome mobile

## Raw Trace

```
frontend-1     |  POST /login 200 in 76ms (next.js: 4ms, proxy.ts: 43ms, application-code: 29ms)
nginx-1        | POST /login HTTP/1.1" 200 5812 (Firefox Android 16)
nginx-1        | GET /_next/static/chunks/...css HTTP/1.1" 304 (ok)
nginx-1        | GET /_next/static/chunks/...js HTTP/1.1" 304 (ok)
nginx-1        | [error] upstream sent no valid HTTP/1.0 header ... /_next/webpack-hmr ... upstream: http://172.18.0.7:3000/_next/webpack-hmr
nginx-1        | GET /_next/webpack-hmr HTTP/1.1" 009 12 (Chrome Android)
```

## Initial Evidence

- **nginx.conf `/` location**: Missing `proxy_http_version 1.1` — nginx defaults to HTTP/1.0 for the frontend upstream, breaking WebSocket/SSE upgrades (webpack-hmr uses SSE/WS)
- **nginx.conf comparison**: `/socket.io/` location DOES have `proxy_http_version 1.1`, `/api/` and `/` do NOT
- **ALLOWED_HOSTS env**: `.env` has `ALLOWED_HOSTS=localhost,127.0.0.1` — mobile accesses via `192.168.178.61`, which is NOT in `allowedDevOrigins` in next.config.ts
- **next.config.ts**: `allowedDevOrigins` built from ALLOWED_HOSTS env var — only localhost and 127.0.0.1 are allowed
- **proxy.ts**: Exports function named `proxy` (not `middleware`) at `src/proxy.ts` (not `src/middleware.ts`) — middleware manifest confirms NO middleware running
- **Cookie settings**: `access_token` is `secure=True, samesite=lax` — should work over HTTPS from same origin
- **Login flow**: `api.post("/api/auth/login")` → backend sets cookies → `bootstrap()` → `router.push("/markets")`

## Hypotheses

### H1 (Primary): `allowedDevOrigins` blocks 192.168.178.61 in Next.js 15 dev mode
Next.js 15 introduced `allowedDevOrigins` as a security measure. With `allowedDevOrigins = ["localhost", "127.0.0.1"]`, requests from `192.168.178.61` might be blocked or degraded — potentially causing the post-login navigation to fail or the page to not properly initialize.
- **Test**: Add `192.168.178.61` to ALLOWED_HOSTS in .env and rebuild

### H2 (Primary): nginx `/` location missing `proxy_http_version 1.1` breaks dev-mode page initialization
webpack-hmr (HMR) WebSocket/SSE fails with HTTP 009. While HMR failure shouldn't directly block login, it might cause JS errors in the dev client that prevent the React app from completing the login redirect flow.
- **Test**: Add `proxy_http_version 1.1` to `/` location in nginx.conf

### H3 (Secondary): `proxy.ts` middleware not running → no auth guards
The middleware exports `proxy` (not `middleware`) and lives at `src/proxy.ts` not `src/middleware.ts`. If Next.js isn't running auth middleware, protected routes may misbehave. However this wouldn't cause login to fail — it would cause the opposite (no redirect to login).
- **Test**: Check compiled middleware.js to confirm if proxy.ts is compiled as middleware

## Current Focus

```yaml
hypothesis: "H1: allowedDevOrigins excludes 192.168.178.61 — Next.js 15 dev server blocks/degrades mobile requests"
test: "Check Next.js 15 allowedDevOrigins behavior: does it block requests or just CORS? Check what happens when 192.168.178.61 not in list"
expecting: "Next.js 15 shows specific error or blocks non-listed origins; or nginx HTTP/1.1 issue prevents proper page load"
next_action: "Verify H1 by reading Next.js 15 source/docs on allowedDevOrigins behavior, then check if adding 192.168.178.61 to ALLOWED_HOSTS fixes it; also verify H2 by checking nginx proxy_http_version"
```

## Evidence Log

- timestamp: 2026-04-18T00:00:00Z
  observation: "POST /login returns 200 OK — login credential check succeeds"
  significance: "Backend auth works; failure is post-auth"

- timestamp: 2026-04-18T00:00:01Z
  observation: "webpack-hmr returns HTTP 009 — nginx upstream error for HTTP/1.0 header"
  significance: "nginx /  location missing proxy_http_version 1.1; SSE/WS upgrade fails"

- timestamp: 2026-04-18T00:00:02Z
  observation: "ALLOWED_HOSTS=localhost,127.0.0.1 in .env; mobile uses 192.168.178.61"
  significance: "192.168.178.61 not in allowedDevOrigins; Next.js 15 may block"

- timestamp: 2026-04-18T00:00:03Z
  observation: "middleware-manifest.json shows empty middleware object"
  significance: "proxy.ts may not be registered as Next.js middleware (wrong export name / location)"

## Eliminated Hypotheses

(none yet)

## Resolution

```yaml
root_cause: "Next.js 15 allowedDevOrigins security check blocked requests from 192.168.178.61 (mobile LAN IP). ALLOWED_HOSTS in .env only listed localhost and 127.0.0.1."
fix: "Added 192.168.178.61 to ALLOWED_HOSTS in .env — confirmed working by user"
verification: "User confirmed mobile login works after the env change"
files_changed: [".env"]
```
