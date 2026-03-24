# Privacy & GDPR Compliance

## Data Categories Collected

| Category | Examples | Legal Basis | Retention |
|---|---|---|---|
| Account data | Email, username, password hash | Contract | Until account deletion + 30 days |
| OAuth data | Provider user ID, encrypted tokens | Contract | Until OAuth disconnect + 30 days |
| Activity data | Bets placed, votes, comments | Legitimate interest | 3 years after last activity |
| Point ledger | bp/tp/kp transactions | Contract | 5 years (financial record-keeping) |
| Session data | JWT tokens, Redis sessions | Contract | Token TTL (15 min / 7 days) |
| Logs | IP address, user agent, request logs | Legitimate interest | 90 days |
| LLM inputs | Sanitized comment excerpts | Legitimate interest | Not stored (processed transiently) |

---

## Third-Party Data Sharing

| Recipient | Data Shared | Purpose | DPA Required |
|---|---|---|---|
| Google OAuth | Email, name, Google ID | Authentication | Google's terms cover this |
| GitHub OAuth | Email, GitHub username | Authentication | GitHub's terms cover this |
| 42 school OAuth | Email, 42 login | Authentication | 42 school terms |
| OpenRouter (LLM) | Anonymized comment excerpts | Summarization | Yes — review before launch |

**Never sent to third parties:** passwords, bp/tp balances, full discussion threads, IP addresses.

---

## User Rights (GDPR Articles 15–22)

### Right of Access (Art. 15)
- Endpoint: `GET /api/user/data-export`
- Returns: JSON export of all user data (account, bets, positions, comments, transactions)
- Delivered within 30 days of request; immediately available via API

### Right to Erasure / Deletion (Art. 17)
- Endpoint: `DELETE /api/user/account`
- Pseudonymization strategy for immutable records:
  - User row: replaced with `[deleted]` username, email cleared, password hash cleared
  - Bets proposed: kept (market integrity), proposer field set to anonymized ID
  - bet_positions: kept for payout accuracy, user_id replaced with anonymized ID
  - Comments: content replaced with `[deleted]`, user_id anonymized
  - bp_transactions / tp_transactions: user_id anonymized, amounts kept for audit
  - kp_events: deleted entirely (not needed after account close)
- OAuth tokens: deleted immediately
- Sessions: invalidated immediately
- Backups: anonymization applied during next backup rotation (max 30 days)

### Right to Rectification (Art. 16)
- Users can update: username, email, avatar, language preference
- Email change requires re-verification

### Right to Portability (Art. 20)
- Same as data export endpoint; JSON format

### Right to Object / Withdraw Consent (Art. 21)
- Opt out of LLM summarization: `PUT /api/user/settings` with `{ llm_opt_out: true }`
- If opted out: comments excluded from market summaries; resolution assistant unavailable

---

## Cookie Policy

| Cookie | Type | TTL | Purpose |
|---|---|---|---|
| `refresh_token` | HttpOnly, Secure, SameSite=Strict | 7 days | Auth session |
| `locale` | Non-HttpOnly | 1 year | Language preference |

No tracking cookies. No third-party cookies.

Cookie consent banner required on first visit for EU users (detect via `Accept-Language` header).

---

## Privacy Policy Page

Required by 42 project specification. Must be accessible at `/privacy`.

Sections to include:
1. What data we collect and why
2. How we use it
3. Third-party sharing (Google, GitHub, 42, OpenRouter)
4. Data retention periods
5. User rights and how to exercise them
6. Contact information (use project email or GitHub issues)
7. Cookie policy

Must be available in EN, FR, DE (i18n applies to legal pages too).

---

## Terms of Service Page

Required by 42 project specification. Accessible at `/terms`.

Sections:
1. Acceptable use (no bots, no real money)
2. Bet content rules (no illegal markets)
3. Account suspension/deletion policy
4. Disclaimer (no financial advice, no liability)
5. Governing law

---

## CSRF Protection

- All state-changing REST endpoints: require `X-CSRF-Token` header
- Token generated on login, stored in non-httpOnly cookie, included in request header
- SameSite=Strict on auth cookie provides additional protection

---

## Data Minimization

- No analytics tracking beyond server logs
- No behavioral profiling
- No advertising data
- Logs purged after 90 days (automated Celery task)

---

## Implementation Checklist

- [ ] Data export endpoint (`GET /api/user/data-export`)
- [ ] Account deletion endpoint with pseudonymization (`DELETE /api/user/account`)
- [ ] LLM opt-out setting
- [ ] Cookie consent banner (EU users)
- [ ] Privacy Policy page (EN, FR, DE)
- [ ] Terms of Service page (EN, FR, DE)
- [ ] OpenRouter DPA reviewed and accepted
- [ ] Automated log retention cleanup (Celery task, 90-day purge)
- [ ] Email change re-verification flow

---

*Last updated: 2026-03-24*
