# Codebase Concerns

**Analysis Date:** 2026-03-24

## Project Status

**Current State:** Pre-development. No production source code exists. Repository contains specification documents, planning guides, and project scaffolding only.

**Key Files Analyzed:**
- `README.md` - Project overview and features
- `CLAUDE.md` - Architecture guidelines and module targets
- `plan/TECH.md` - Technology stack selection
- `plan/PLANNING.md` - Detailed UX flows and requirements
- `.subject/transcendence_v21.0.md` - 42 school project specification

---

## Critical Pre-Development Concerns

### 1. Complex Business Logic Not Yet Specified

**Problem:** The core economic system (Karma, Truth, Betting Points, and Spice calculation) is partially defined but lacks complete specification.

**Specific Gaps:**
- Log-scale bet cap formula: `max_position = log(karma)` — base and edge cases undefined
  - What happens when karma < 1? (Log returns negative)
  - Minimum stake rounding not specified
- Truth Points calculation: `t_win / t_bet` formula described but edge cases missing
  - What if user changes position mid-bet?
  - How to prevent gaming the ratio through strategic timing?
- Daily Betting Points allocation: `+log(kp)` — reset frequency and calculation timing unclear
  - When exactly does "daily" reset happen? Midnight UTC?
  - How is karma carryover handled across resets?
- Community dispute voting weights are complex (0.5x, 1x, 2x based on position)
  - Potential for gaming: users could vote against their position to earn 2x weight
  - No specified safeguards against collusion or whale voting despite reputation system

**Files:**
- `README.md` (lines 42-74) — Points economy
- `plan/PLANNING.md` — Economic system design

**Impact:** Missing specification will cause:
- Backend calculation errors and inconsistencies
- Exploitable gaming vectors
- Disputes over "correct" resolution
- Major refactoring mid-development

**Fix Approach:**
1. Create detailed specification: `plan/ECONOMY.md` with:
   - All formulas with edge cases documented
   - Examples showing behavior at boundaries (karma=0, karma=1000+, negative balances)
   - Explicit rounding/truncation rules
2. Add security review for voting weight system against collusion
3. Implement formula validation in tests before writing business logic

---

### 2. Bet Resolution Logic Design is Underspecified

**Problem:** The three-tier resolution system (Auto → Proposer → Community) has ambiguous rules and no conflict resolution strategy defined.

**Specific Gaps:**
- "Automatic resolution pulled from public APIs" — no list of supported APIs or fallback strategy
- Proposer resolution: "if outcome is clear-cut" — who defines "clear"?
- Community vote dispute cost: disputing costs 1bp, losing costs additional 1bp, winning disputes reward 2bp
  - Risk: Users could farm rewards by disputing obviously correct outcomes if costs < expected 2bp payout
  - No cooldown or spam prevention on disputes
- Minimum dispute participation: "at least 1% of participants must vote"
  - What if bet has 0 participants? (1% of 0 = 0, so any vote wins?)
  - No maximum dispute window specified — when does voting close?

**Files:**
- `README.md` (lines 63-74) — Bet resolution mechanics
- `plan/PLANNING.md` (implied in market lifecycle)

**Impact:**
- Unresolvable disputes (e.g., "clear-cut" is subjective)
- Exploitable reward mechanics for dispute farming
- Edge cases will occur in production with no defined behavior

**Fix Approach:**
1. Create `plan/RESOLUTION.md` detailing:
   - Exact list of supported auto-resolution APIs with fallback rules
   - Criteria for "clear-cut" proposer resolution (e.g., published, verifiable, no controversy)
   - Dispute mechanics with examples of edge cases
   - Time windows and cooldown periods
2. Add sanity checks in dispute calculation (prevent rewards > costs when stakes are low)
3. Implementation should validate disputes at backend before accepting

---

### 3. OAuth 2.0 Implementation Risk

**Problem:** OAuth integration planned for Google, GitHub, and 42 but implementation details not specified.

**Specific Gaps:**
- No specification for state validation, PKCE, or nonce handling
- No defined scope requirements (what data is requested from each provider?)
- Provider fallback strategy missing: what if OAuth fails?
- 42 school OAuth may have custom requirements not documented
- Token refresh strategy not specified

**Files:**
- `CLAUDE.md` (line 28) — Auth methods
- `plan/TECH.md` (line 46) — OAuth 2.0 module

**Impact:**
- Security vulnerabilities (CSRF, token leakage, scope creep)
- Integration failures during testing at 42 school evaluation
- User signup flow breaks if OAuth provider is unavailable

**Fix Approach:**
1. Create `plan/AUTH.md` specifying:
   - PKCE flow for all OAuth providers
   - Required scopes per provider
   - Fallback to email/password if OAuth fails
   - Token refresh and expiration handling
   - 42 school specific requirements (contact 42 IT if unclear)
2. Implement state parameter validation in frontend and backend
3. Add integration tests for OAuth flows before writing code

---

### 4. Real-time WebSocket Architecture Not Specified

**Problem:** Socket.IO for real-time updates is planned but the event model and room structure are undefined.

**Specific Gaps:**
- Which events require real-time? (New bets? Vote changes? Dispute updates?)
- Room organization not specified: bet-level? user-level? both?
- Backpressure/message dropping strategy missing: what happens if socket floods?
- No broadcast topology defined: does every client get every message?
- Reconnection and message history handling not specified

**Files:**
- `CLAUDE.md` (lines 24, 26) — Socket.IO real-time
- `plan/TECH.md` (lines 10, 24) — Real-time features

**Impact:**
- Inefficient bandwidth usage (sending updates to all clients)
- Memory leaks from unclosed socket connections
- Message loss on disconnection (user sees stale data)
- Scaling will be extremely difficult without defined architecture

**Fix Approach:**
1. Create `plan/REALTIME.md` specifying:
   - Event types and broadcast scope (e.g., "bet:vote_change" → bet room only)
   - Room hierarchy and membership rules
   - Message history retention policy (if any)
   - Backpressure handling (e.g., rate limit messages per user)
   - Reconnection and state sync strategy
2. Design for scalability: assume each socket event goes to specific room, not broadcast
3. Load test WebSocket connections before going to production

---

### 5. Database Schema Missing Critical Constraints

**Problem:** Database design not started, but complex requirements suggest schema pitfalls ahead.

**Specific Gaps:**
- No foreign key constraint specification for multi-tier resolution (Bet → Proposer → Community Vote)
- Concurrent vote handling not addressed: what if two clients vote simultaneously?
- Bet closure and payout logic will have complex transactional requirements
- User point balance consistency: what prevents double-spending betting points?
- No locking strategy defined for shared resources (bets, resolution votes)

**Files:**
- `plan/TECH.md` (lines 21, 25) — PostgreSQL + Redis
- `plan/PLANNING.md` — Market lifecycle (implied transactions)

**Impact:**
- Race conditions in voting (double votes counted)
- Point balance inconsistencies (users could have negative balance)
- Deadlocks during concurrent bet settlement
- Data integrity issues in production

**Fix Approach:**
1. Create database schema (`backend/db/schema.sql` or use Alembic migrations):
   - Define tables for users, bets, votes, points ledgers
   - Add unique constraints on votes (user + bet = unique)
   - Use PostgreSQL transactions for bet settlement
   - Implement optimistic locking or row-level locks for concurrent updates
2. Create `plan/DATABASE.md` with:
   - Concurrency model (pessimistic locking vs optimistic)
   - Transaction isolation requirements
   - Ledger-based point tracking (immutable transaction log)
3. Load test concurrent bets before production

---

### 6. LLM Integration Security & Cost Risk

**Problem:** OpenRouter API integration for summarization and resolution assistance is planned but unspecified.

**Specific Gaps:**
- No cost control mechanism defined: how many summaries/day? Spending limit?
- Prompt injection vulnerability: LLM receives user-submitted bet descriptions
- Response validation missing: what if LLM returns nonsense?
- Fallback missing: what if API is down?
- Privacy concern: is user data sent to external LLM?

**Files:**
- `CLAUDE.md` (line 27) — LLM module target
- `README.md` (implied in resolution system)
- `plan/TECH.md` (line 46) — LLM interface module

**Impact:**
- Unbounded API costs (could drain budget quickly)
- Security breach if user data is leaked through LLM
- Service failures cascade to resolution workflow
- Reputational risk if LLM generates biased or harmful content

**Fix Approach:**
1. Create `plan/LLM_INTEGRATION.md` specifying:
   - Usage limits per user per day
   - Cost tracking and budget enforcement
   - Approved models (use small, cheap models where possible)
   - Prompt templates to prevent injection
   - Response validation rules
   - Fallback to manual resolution if LLM unavailable
2. Implement data masking: never send PII or full user discussions to LLM
3. Rate limit LLM requests per user
4. Add cost alerts before going live

---

### 7. Multi-language (i18n) Complexity Not Addressed

**Problem:** i18n for EN, FR, DE is a module target but implementation strategy is undefined.

**Specific Gaps:**
- No translation management workflow specified
- Dynamic content from LLM and user-generated text is hard to translate
- Bet descriptions and discussions are user-provided and untranslated
- No locale-specific formatting rules (date, time, numbers, currency)
- No RTL language support needed now but adds complexity

**Files:**
- `CLAUDE.md` (line 43) — i18n minor module
- `plan/TECH.md` (line 47) — i18n module target

**Impact:**
- Late-stage refactoring if i18n not baked in from the start
- Inconsistent translations across features
- User-generated content is untranslatable (users speak in their own language)
- Locale-specific bugs (date format errors in some locales)

**Fix Approach:**
1. Choose i18n library early: `next-intl` or `next-i18n-router` for Next.js
2. Separate translatable strings (UI labels) from user-generated content (bet descriptions)
3. Create `plan/I18N.md` specifying:
   - Supported locales and their abbreviations
   - Translation management workflow (spreadsheet? YAML files? translation service?)
   - Fallback locale (EN) if translation missing
   - Locale-specific number/date formatting
4. Implement namespace-based translation (e.g., `common.button_submit`)
5. Add linting to catch untranslated hardcoded strings

---

### 8. Privacy Policy & GDPR Compliance Gaps

**Problem:** 42 project requires Privacy Policy and Terms of Service, but data handling practices are undefined.

**Specific Gaps:**
- No data retention policy specified (how long do we keep deleted user data?)
- GDPR right-to-delete (Article 17) not addressed for disputes/discussions (immutable?)
- No consent mechanism for OAuth data collection
- Cookie policy not specified
- No data processing agreement with OpenRouter (LLM vendor)
- Analytics/monitoring not specified (who logs what?)

**Files:**
- `CLAUDE.md` (lines 15-16) — 42 requirements
- `plan/TECH.md` (line 52) — GDPR compliance stretch module

**Impact:**
- Project fails 42 evaluation if Privacy Policy is missing
- GDPR fines if data handling is non-compliant (€10-20M for serious violations)
- Legal liability if users are not informed of data collection
- Cannot meet "right-to-delete" if bets/disputes are immutable

**Fix Approach:**
1. Create `plan/PRIVACY.md` specifying:
   - Data categories collected (email, name, bets, discussion posts)
   - Retention periods (e.g., user data deleted 90 days after account close)
   - Legal basis for processing (consent, contract, legitimate interest)
   - Third-party data sharing (OpenRouter, OAuth providers)
   - User rights (access, deletion, portability)
2. Draft Privacy Policy and Terms of Service templates
3. Create pseudo-deletion strategy for immutable records (mask user info, keep bet structure)
4. Add data export endpoint for GDPR right-of-access

---

### 9. Module Point Risk: 42 Evaluation May Not Recognize Features

**Problem:** Project targets 14+ module points but some module definitions are vague or risky.

**Specific Concerns:**
- **LLM interface (2pts):** Is using OpenRouter's API enough? Or does "LLM interface" require custom implementation?
- **Real-time features (2pts):** Socket.IO is used, but are all required features actually real-time?
- **User interaction (2pts):** "Chat, profiles, friends" — are all three required? Which is the focus?
- **i18n (1pt):** Three languages required — but is UI-only or user-content too?
- **Public API (2pts stretch):** Not mentioned in core requirements; may require significant extra work

**Files:**
- `CLAUDE.md` (lines 33-43) — Module targets
- `plan/TECH.md` (lines 35-48) — Module breakdown

**Impact:**
- If evaluators don't recognize module implementations, project fails (< 14pts)
- Wasted effort on modules that don't count
- Last-minute scramble to add missing features

**Fix Approach:**
1. Contact 42 evaluation team to clarify module definitions
2. Create `plan/MODULES.md` with:
   - Exact implementation requirements per module
   - Evidence/test plan to prove each module works
   - Risk assessment (what if this doesn't count?)
3. Prioritize high-confidence modules first (frameworks, ORM, auth)
4. Defer stretch modules (API, PWA) until core is solid

---

### 10. Testing Strategy Completely Missing

**Problem:** No test framework chosen, no testing patterns defined, no coverage targets.

**Specific Gaps:**
- No test runner specified (pytest for backend, vitest/jest for frontend?)
- No fixture strategy for test data (factories? hardcoded?)
- No integration test plan (how to test Socket.IO?)
- No mocking strategy (what to mock, what not to?)
- No CI/CD pipeline defined (how are tests run before merge?)

**Files:**
- `CLAUDE.md` (lines 49-55) — Planned commands (not yet implemented)
- No test-specific documentation found

**Impact:**
- Untested code shipped to production
- Bugs discovered after deployment
- Refactoring becomes risky without test safety net
- Complex business logic (points, resolution) will have bugs

**Fix Approach:**
1. Choose test frameworks early:
   - Backend: pytest + pytest-asyncio (for async FastAPI)
   - Frontend: vitest + React Testing Library
2. Create `plan/TESTING.md` with:
   - Test structure (unit vs integration vs e2e)
   - Mocking strategy (mock APIs, databases, LLM)
   - Fixture patterns for test data
   - Coverage targets (minimum 70% for critical paths)
3. Set up GitHub Actions workflow for test runs on PR
4. Write critical path tests first (auth, betting, resolution)

---

### 11. Frontend State Management Complexity

**Problem:** Zustand is chosen for state management, but complex distributed state (bets, votes, live updates) will require careful design.

**Specific Gaps:**
- No store architecture defined (monolithic or multiple stores?)
- Socket.IO event sync with Zustand state not specified
- Optimistic updates not specified (e.g., user votes but server rejects)
- Race conditions: socket update arrives while user is typing
- No devtools/debugging strategy defined

**Files:**
- `plan/TECH.md` (line 11) — Zustand state management

**Impact:**
- Stale data in UI (user sees old bet odds)
- Inconsistent state between tabs/windows
- Memory leaks from unreleased Zustand listeners
- Difficult to debug state-related bugs

**Fix Approach:**
1. Create `plan/STATE_MANAGEMENT.md` specifying:
   - Zustand store structure (e.g., `betsStore`, `userStore`, `socketStore`)
   - Socket event handlers and state sync rules
   - Optimistic update strategy (rollback on error)
   - Time-to-live (TTL) for cached data
2. Use Redux DevTools middleware for debugging
3. Create action logging for state changes
4. Load test concurrent socket updates with state sync

---

### 12. Scaling Concerns: Socket.IO & Database Bottlenecks

**Problem:** Project targets "multi-user simultaneous support" but no scaling analysis exists.

**Specific Gaps:**
- How many concurrent users? (100? 1000? 10k?)
- PostgreSQL connection pool size not specified (will exhaust at scale)
- Redis usage not optimized (using as session store + pub-sub simultaneously)
- Socket.IO broadcast will fail at 1000+ concurrent connections on single server
- Database query optimization not planned (no indexing strategy)

**Files:**
- `CLAUDE.md` (line 16) — Multi-user requirement
- `plan/TECH.md` (lines 21-25) — Infrastructure choices

**Impact:**
- Application crashes under load (project fails evaluation)
- Database connection exhaustion
- Memory leaks in Node.js from unclosed socket connections
- Cannot scale beyond few hundred concurrent users

**Fix Approach:**
1. Create `plan/SCALING.md` specifying:
   - Target concurrent users (start with 100, scale to 1000+)
   - Database connection pool sizing rules
   - Redis cluster strategy (if needed)
   - Socket.IO room architecture for horizontal scaling
   - Load testing milestones
2. Implement database connection pooling (PgBouncer or built into ORM)
3. Monitor connection usage in development
4. Load test with at least 10x target users before production

---

## Tech Debt Patterns to Avoid

### Hardcoding Configuration
- **Risk:** API keys, URLs, port numbers hardcoded in code
- **Prevention:** All external config via `.env` (already planned in CLAUDE.md)

### Missing Environment Validation
- **Risk:** Missing `.env` variables cause cryptic errors at runtime
- **Prevention:** Validate all required env vars at startup, fail loudly

### No Request ID Logging
- **Risk:** Cannot trace requests across services in logs
- **Prevention:** Add request ID middleware to FastAPI, pass to frontend

### Circular Imports
- **Risk:** Python circular imports cause module loading errors
- **Prevention:** Use dependency injection, avoid importing from views in models

### Missing Error Boundaries
- **Risk:** Single component error crashes entire frontend
- **Prevention:** Use React Error Boundary on every page

---

## Security Concerns

### 1. SQL Injection
- **Status:** Using SQLAlchemy 2 (parameterized queries) mitigates this
- **Monitoring:** Code review for any raw SQL queries

### 2. CSRF Protection
- **Status:** No CSRF token handling specified in Socket.IO or forms
- **Action Needed:** Add CSRF tokens to all state-changing requests

### 3. JWT Attacks
- **Status:** JWT mentioned but no key rotation strategy
- **Action Needed:** Specify JWT signing key rotation schedule

### 4. Prompt Injection (LLM)
- **Status:** Critical risk if user input sent to LLM without sanitization
- **Action Needed:** Implement prompt validation, sandboxed execution if possible

### 5. Rate Limiting
- **Status:** Not mentioned in spec
- **Action Needed:** Implement rate limiting on:
  - Bet creation (prevent spam)
  - Dispute voting (prevent vote farming)
  - LLM calls (prevent cost explosion)
  - API endpoints (standard DDoS protection)

---

## Documentation Debt

### Missing Specifications
- [ ] Economic system (formulas, edge cases, examples)
- [ ] Resolution logic (APIs, dispute mechanics, edge cases)
- [ ] Database schema and concurrency model
- [ ] Real-time event architecture
- [ ] Authentication and OAuth flows
- [ ] LLM integration (cost, security, fallback)
- [ ] Testing strategy
- [ ] Deployment and monitoring
- [ ] Privacy and GDPR compliance

### Recommended New Documents
Create these before development starts:
1. `plan/ECONOMY.md` — Points system specification
2. `plan/RESOLUTION.md` — Bet resolution mechanics
3. `plan/DATABASE.md` — Schema and concurrency
4. `plan/REALTIME.md` — Socket.IO architecture
5. `plan/AUTH.md` — OAuth and JWT implementation
6. `plan/LLM_INTEGRATION.md` — LLM usage and safety
7. `plan/TESTING.md` — Test strategy and frameworks
8. `plan/PRIVACY.md` — Data handling and GDPR
9. `plan/SCALING.md` — Performance and capacity planning
10. `plan/DEPLOYMENT.md` — Docker, CI/CD, monitoring

---

## Recommendations for Next Phase

### 1. Validate 42 Module Definitions
Contact 42 evaluation team to confirm:
- What counts as "LLM interface"?
- What counts as "real-time features"?
- Are stretch modules (PWA, API) actually worth pursuing?

### 2. Spec Economic System First
Before writing backend code, create comprehensive economy spec:
- All formulas with examples and edge cases
- Validation rules to prevent gaming
- Security analysis of voting mechanics

### 3. Create Database Schema
Design schema with:
- Transaction isolation for concurrent bets
- Ledger-based point tracking (immutable)
- Indexes for performance queries

### 4. Set Up Testing Infrastructure
Configure:
- pytest + pytest-asyncio for backend
- vitest for frontend
- GitHub Actions for CI
- Coverage tracking

### 5. Load Test Early
Once core features exist:
- Load test with 10x target concurrent users
- Measure Socket.IO scalability
- Optimize database queries

---

*Concerns audit: 2026-03-24*
