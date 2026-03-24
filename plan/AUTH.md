# Authentication Specification

## Overview

Three auth methods, all producing the same JWT session:

1. Email + password (primary)
2. OAuth 2.0 — Google, GitHub, 42 school
3. JWT refresh flow

---

## Email / Password

### Signup
1. Validate email format + password strength (min 8 chars, 1 uppercase, 1 digit)
2. Check email uniqueness
3. Hash password: `bcrypt` with cost factor 12
4. Insert user row + issue token pair

### Login
1. Fetch user by email
2. `bcrypt.checkpw(password, hash)`
3. On success: issue access token + refresh token
4. On failure: return generic "Invalid credentials" (no email-enumeration)
5. Rate limit: 5 failed attempts per IP per 15 minutes → 429 with Retry-After header

### Password Reset
1. POST `/auth/reset-request` with email → always return 200 (no enumeration)
2. Generate a signed time-limited token (HMAC-SHA256, expires 1 hour)
3. Email link: `https://app/reset?token=...`
4. POST `/auth/reset-confirm` with token + new password → invalidate token, update hash

---

## OAuth 2.0

### Flow: Authorization Code + PKCE

All three providers use the same flow:

```
Client                   Server                    Provider
  |                        |                          |
  |-- GET /auth/{provider} |                          |
  |                        |-- generate state + PKCE --|
  |                        |   (store in Redis 10min) |
  |<-- redirect to provider|                          |
  |                        |                          |
  |-- user authenticates --|------------------------->|
  |                        |<-- callback with code ----|
  |                        |-- verify state + PKCE ----|
  |                        |-- exchange code for token |
  |                        |-- fetch user profile -----|
  |                        |-- upsert user row --------|
  |<-- redirect with JWT --|                          |
```

### PKCE Parameters
- `code_verifier`: 64 random bytes, base64url encoded
- `code_challenge`: SHA256(code_verifier), base64url encoded
- `code_challenge_method`: S256
- `state`: 32 random bytes, base64url encoded

Both `state` and `code_verifier` stored in Redis keyed by `state`: TTL 10 minutes.

### State Validation
- On callback: verify `state` param matches Redis entry
- Mismatch → reject with 400, log suspected CSRF attempt
- Consumed on use (delete from Redis after verification)

### Provider Scopes

| Provider | Scopes Requested |
|---|---|
| Google | `openid email profile` |
| GitHub | `user:email read:user` |
| 42 school | `public` |

Minimal scopes only. Never request write permissions.

### 42 School Specifics
- OAuth app must be registered at `profile.intra.42.fr/oauth/applications`
- Callback URL must be whitelisted in the 42 app settings
- Token endpoint: `https://api.intra.42.fr/oauth/token`
- Profile endpoint: `https://api.intra.42.fr/v2/me`
- Use `login` field as username seed; email from `email` field

### Account Linking
- On OAuth login: look up `oauth_accounts` by `(provider, provider_user_id)`
- If found: log in the linked user
- If not found: check if email matches existing account → link it
- If email is new: create new user

### OAuth Failure Fallback
- If OAuth provider is unavailable (5xx/timeout): show "OAuth unavailable, please use email/password"
- Do not silently fail or hang

---

## JWT Tokens

### Access Token
- Algorithm: RS256 (asymmetric) — allows frontend to verify without exposing private key
- Expiry: 15 minutes
- Claims: `sub` (user_id), `email`, `username`, `iat`, `exp`

### Refresh Token
- Algorithm: HS256 (symmetric, server-only)
- Expiry: 7 days
- Stored: `httpOnly, Secure, SameSite=Strict` cookie
- One refresh token per user session; stored in Redis for revocation

### Refresh Flow
1. POST `/auth/refresh` (cookie sent automatically)
2. Server validates refresh token against Redis
3. Issue new access token + rotate refresh token
4. Old refresh token invalidated in Redis

### Revocation
- Logout: DELETE refresh token from Redis
- Password change: DELETE all refresh tokens for that user
- OAuth disconnect: DELETE associated refresh tokens

### Key Rotation
- RS256 key pair: rotate every 90 days
- Old key kept active for 15-minute overlap period (active token grace window)
- Key IDs (`kid`) in JWT header; server checks current and previous key

---

## HTTPS Requirement

- All auth endpoints: HTTPS only (enforced by Nginx)
- `Strict-Transport-Security` header: `max-age=31536000; includeSubDomains`
- Tokens never transmitted over HTTP

---

## Rate Limiting

| Endpoint | Limit |
|---|---|
| POST /auth/login | 5 req / 15 min / IP |
| POST /auth/register | 10 req / hour / IP |
| GET /auth/oauth/{provider} | 20 req / hour / IP |
| POST /auth/reset-request | 3 req / hour / email |
| POST /auth/refresh | 60 req / hour / user |

Implemented via Redis counters (see SCALING.md).

---

## Security Headers

Set on all responses:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'
Referrer-Policy: strict-origin-when-cross-origin
```

---

*Last updated: 2026-03-24*
