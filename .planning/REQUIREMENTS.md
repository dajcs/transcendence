# Requirements: Vox Populi

**Defined:** 2026-03-24
**Core Value:** Users can bet on real-world outcomes, argue their position, and earn a verifiable reputation score — without real money.

## v1 Requirements

### Infrastructure

- [x] **INFRA-01**: Single `docker compose up --build` starts all services
- [x] **INFRA-02**: HTTPS on all endpoints via Nginx + self-signed cert
- [x] **INFRA-03**: PostgreSQL 16 + Redis 7 running in containers
- [x] **INFRA-04**: Secrets via `.env` (git-ignored); `.env.example` committed
- [x] **INFRA-05**: App validates required env vars at startup; fails loudly if missing

### Authentication

- [x] **AUTH-01**: User can register with email and password
- [x] **AUTH-02**: User can log in and receive JWT access + refresh tokens
- [x] **AUTH-03**: User can reset password via email link
- [x] **AUTH-04**: User session persists across browser refresh (refresh token rotation)
- [ ] **AUTH-05**: OAuth 2.0 login via Google, GitHub, and 42 school (PKCE flow)

### Betting

- [x] **BET-01**: User can create a market (title, description, criteria, deadline)
- [x] **BET-02**: User can place a YES or NO bet (costs 1 bp)
- [x] **BET-03**: User can withdraw a bet before resolution (refund = current win probability)
- [x] **BET-04**: Bet cap enforced per user per market: `floor(log2(kp+1)) + 1` bp
- [x] **BET-05**: bp balance cannot go below 0; checked atomically before deduction
- [x] **BET-06**: New user receives 10 bp signup bonus
- [x] **BET-07**: Daily bp allocation runs at 00:00 UTC: `+floor(log2(kp+1))`
- [x] **BET-08**: Daily login bonus: +1 bp

### Discussion

- [x] **DISC-01**: Each bet has a threaded comment section
- [x] **DISC-02**: Users can upvote comments (earns kp for author)
- [x] **DISC-03**: Comments support nested replies (up to 5 levels deep)

### Resolution

- [x] **RES-01**: Tier 1 automatic resolution via configured API source at deadline
- [x] **RES-02**: Tier 2 proposer resolution with justification (within 7 days of deadline)
- [x] **RES-03**: Tier 3 community vote dispute (48h window, 1% participation minimum)
- [x] **RES-04**: Dispute vote weights: 0.5x (voted same as own bet), 1x (no stake), 2x (voted against own bet)
- [x] **RES-05**: Proposer penalty: loses 50% staked bp if resolution overturned
- [x] **RES-06**: Winning bet pays proportional BP pool share + TP to each winner (D-11: `floor(user_stake / total_winning_stake * total_bp_pool)`)

### Social

- [ ] **SOC-01**: User can send/accept/decline/block friend requests
- [ ] **SOC-02**: User can send and receive direct messages (chat)
- [ ] **SOC-03**: User profile shows kp, tp, bet history, avatar
- [ ] **SOC-04**: User can see online status of friends
- [ ] **SOC-05**: User receives in-app notifications (bet resolved, disputed, friend request)

### Real-time

- [x] **RT-01**: Bet odds update live via Socket.IO when positions change
- [x] **RT-02**: New comments appear live in bet threads
- [x] **RT-03**: Notifications delivered in real-time

### Intelligence

- [x] **LLM-01**: Bet thread summarizer (LLM generates neutral summary)
- [x] **LLM-02**: Resolution assistant (LLM suggests YES/NO for proposer)
- [x] **LLM-03**: Per-user daily limits enforced (5 summaries, 3 resolution assists)
- [x] **LLM-04**: Monthly budget cap with graceful degradation when exceeded

### Compliance & Polish

- [ ] **COMP-01**: i18n: English, French, German (all UI strings)
- [ ] **COMP-02**: Privacy Policy page at `/privacy` (EN/FR/DE)
- [ ] **COMP-03**: Terms of Service page at `/terms` (EN/FR/DE)
- [ ] **COMP-04**: Zero console errors/warnings in latest stable Chrome
- [ ] **COMP-05**: GDPR: data export endpoint, account deletion with pseudonymization
- [ ] **COMP-06**: Dark mode support

### Quality

- [ ] **TEST-01**: Backend unit tests for economy formulas (100% coverage)
- [ ] **TEST-02**: Backend integration tests for API endpoints (80%+ coverage)
- [ ] **TEST-03**: Frontend component tests (70%+ coverage)
- [ ] **TEST-04**: E2E tests: auth, bet lifecycle, dispute flow

## v2 Requirements

### Economy Extension

- **SP-01**: Spice Points (sp) from pairwise real-money bets
- **SP-02**: sp leaderboard and portfolio

### Stretch Modules

- **STRETCH-01**: Public API (5+ endpoints, rate-limited, documented) — +2 pts
- **STRETCH-02**: Advanced search (filters, sorting, pagination) — +1 pt
- **STRETCH-03**: PWA with offline support — +1 pt

## Out of Scope

| Feature | Reason |
|---|---|
| Real money / crypto | Gambling regulations; core design is reputation-only |
| Mobile native app | Web-first; Chrome target |
| Email notifications | In-app only for v1; complexity not worth it |
| Video/image uploads in comments | Storage cost, not core to prediction market |
| Public API | Stretch only; implement after core 14pts secured |

## Traceability

| Requirement | Phase | Status |
|---|---|---|
| INFRA-01 to INFRA-05 | Phase 1 | Pending |
| AUTH-01 to AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 6 | Pending |
| BET-01 to BET-08 | Phase 2 | Complete |
| DISC-01 to DISC-03 | Phase 2 | Complete |
| RES-01 to RES-06 | Phase 5 | Pending |
| SOC-01 to SOC-05 | Phase 3 | Pending |
| RT-01 to RT-03 | Phase 4 | Pending |
| LLM-01 to LLM-04 | Phase 5 | Pending |
| COMP-01 to COMP-06 | Phase 6 | Pending |
| TEST-01 to TEST-04 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 43 total
- Mapped to phases: 43
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-24 after initialization*
