# Implementation Flow

## Team

### Part 1 — Core Platform (3 students)

| Role | Person | Focus |
|---|---|---|
| **Tech Lead + Backend** | Student A | FastAPI, database, auth, API, Docker |
| **Frontend Lead** | Student B | Next.js, components, pages, styling |
| **Full-stack** | Student C | Socket.IO, chat, notifications, LLM integration |

All three contribute to all areas — roles indicate primary ownership, not exclusivity.

### Part 2 — Spice (2 additional students join later)

| Role | Person | Focus |
|---|---|---|
| **Spice Backend** | Student D | Pairwise bet model, settlement logic, jurisdiction checks |
| **Spice Frontend** | Student E | Spice UI, pairwise bet flow, Spice leaderboard |

---

## Git Workflow

### Branch Strategy

```
main                        ← always deployable, protected
  └── dev                   ← integration branch, all features merge here first
       ├── feat/docker-setup
       ├── feat/backend-scaffold
       ├── feat/frontend-scaffold
       ├── feat/auth
       ├── feat/markets
       ├── feat/betting
       ├── feat/comments
       ├── feat/friends
       ├── feat/chat
       ├── feat/socketio
       ├── feat/llm
       ├── feat/i18n
       ├── feat/oauth
       ├── fix/some-bug
       └── ...
```

**Rules:**
- `main` — protected, only updated via PR from `dev` when a milestone is stable
- `dev` — integration branch, all feature branches merge here
- `feat/*` — one branch per feature/task
- `fix/*` — bug fix branches
- Never commit directly to `main` or `dev`

### Setting Up GitHub Branch Protection

1. Go to repo Settings > Branches > Add rule
2. Branch name pattern: `main`
3. Enable:
   - "Require a pull request before merging"
   - "Require approvals" (at least 1)
   - "Require status checks to pass" (once CI exists)
4. Repeat for `dev` with same settings

### Initial Setup (do once, per student)

```bash
# Clone the repo
git clone git@github.com/dajcs/transcendence.git
cd transcendence

# Set up your local environment
cp .env.example .env
# Edit .env — fill in secrets (each student uses the same values, share via DM)
make gen-keys  # Generate SSL cert + RSA key pair for JWT (run once)
make seed # Optional: seed the database with test data

# Switch to dev (the dev branch is created in Sprint 0)
git checkout dev
git pull origin dev

# Verify everything works
docker compose up --build
```

**First time only (Student A, Sprint 0):**
```bash
git checkout -b dev
git push -u origin dev
```

### Daily Workflow

#### Starting a new feature

```bash
# Always start from latest dev
git checkout dev
git pull origin dev


# Verify everything works
make dev

# Announce in team chat: "Starting feat/my-feature"

# Create your feature branch
git checkout -b feat/my-feature
```

#### Making commits

Write small, focused commits. Each commit should do ONE thing.

```bash
# Stage specific files (preferred over `git add .`)
git add backend/app/models/user.py backend/app/schemas/user.py

# Commit with a clear message
git commit -m "add user model and schema"
```

**Commit message format:**
```
<type>: <short description>

Types:
  feat:     new feature
  fix:      bug fix
  refactor: code restructuring (no behavior change)
  docs:     documentation
  style:    formatting, linting (no logic change)
  test:     adding or fixing tests
  chore:    build, config, dependencies
```

Examples:
```
feat: add market CRUD endpoints
fix: prevent duplicate bets on same market
refactor: extract betting logic to service layer
docs: add API endpoint documentation
chore: add redis to docker-compose
test: add auth registration tests
```

#### Pushing your branch

```bash
# Push your feature branch
git push origin feat/my-feature

# After pushing, go to GitHub to create a PR:
# 1. Click "Compare & pull request"
# 2. Base: dev / Compare: feat/my-feature
# 3. Title: same format as commit messages (e.g., "feat: add market CRUD endpoints")
# 4. Description: What changed, why, and how to test
# 5. Assign a reviewer (one of the other 2 team members)
# 6. Announce in team chat: "Created PR for feat/my-feature"

```

#### Creating a Pull Request (PR)

1. Go to GitHub > Pull Requests > New Pull Request
2. Base: `dev` / Compare: `feat/my-feature`
3. Title: Same format as commit messages (e.g., `feat: add market CRUD endpoints`)
4. Description: What changed, why, and how to test
5. Assign a reviewer (one of the other 2 team members)
6. Wait for review before merging

**PR description template** (copy-paste into every PR):
```
## What
Brief description of what this PR does.

## How to test
1. `docker compose up --build`
2. Go to https://localhost:8443/...
3. Do X, expect Y

## Checklist
- [ ] Works locally (docker compose up)
- [ ] No Chrome console errors
- [ ] Tests pass (if applicable)
```

#### Reviewing a PR

```bash
# Fetch and check out the PR branch locally
git fetch origin
git checkout feat/their-feature

# Run the app, test it
docker compose up --build

# If it works, approve on GitHub
# If issues found, leave comments on specific lines
```

#### Merging a PR

After approval:
1. On GitHub, click "Squash and merge" (keeps dev history clean)
2. Delete the feature branch on GitHub after merge
3. Locally, clean up:

```bash
git checkout dev
git pull origin dev
git branch -d feat/my-feature  # delete local branch
```

### Handling Merge Conflicts

When your feature branch falls behind `dev`:

```bash
# On your feature branch
git checkout feat/my-feature

# Rebase onto latest dev (preferred over merge)
git fetch origin
git rebase origin/dev

# If conflicts appear:
# 1. Open conflicted files — look for <<<<<<< markers
# 2. Edit to resolve (keep the correct code)
# 3. Stage resolved files
git add <resolved-file>

# 4. Continue rebase
git rebase --continue

# 5. Force-push your branch (safe because it's YOUR feature branch)
git push --force-with-lease
```

**Golden rule:** Only force-push feature branches you own. Never force-push `dev` or `main`.

### Releasing to Main

When a milestone is complete and tested on `dev`:

```bash
# Create PR: dev → main on GitHub
# Title: "release: milestone X — description"
# All 3 team members review
# Merge (regular merge, not squash — preserve milestone history)
```

---

## Implementation Sprints

Each sprint is ~1 week. Tasks are assigned by primary owner but everyone reviews.

### Sprint 0 — Project Setup (all 3 together, day 1)

Do this together in one session to avoid conflicts on shared config files.

**Tasks (Student A leads, all participate):**

- [ ] Create `dev` branch, set up GitHub branch protection
- [ ] Create `.gitignore` (node_modules, .next, __pycache__, .env, nginx/certs/*.pem, *.pyc)
- [ ] Create `.env.example` with all variables from PLANNING.md Section 6
- [ ] Create `docker-compose.yml` with all 6 services (nginx, frontend, backend, celery, db, redis)
- [ ] Create `nginx/nginx.conf` (HTTPS on :8443, proxy rules)
- [ ] Generate self-signed certs: `openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout nginx/certs/key.pem -out nginx/certs/cert.pem`
- [ ] Create backend scaffold: `pyproject.toml`, `app/main.py`, `app/config.py`, `app/database.py`
- [ ] Create frontend scaffold: `npx create-next-app@latest`, configure Tailwind 4
- [ ] Create both Dockerfiles
- [ ] Verify `docker compose up --build` starts all services without errors
- [ ] Commit to `dev`, push

**Definition of done:** `docker compose up --build` runs, `https://localhost:8443` shows the Next.js welcome page, `https://localhost:8443/api/health` returns `{"status": "ok"}`.

### Sprint 1 — Auth + Database + Layout

| Task | Branch | Owner | Depends on |
|---|---|---|---|
| User model + Alembic migration | `feat/user-model` | A | Sprint 0 |
| Auth endpoints (register/login/JWT) | `feat/auth-api` | A | user-model |
| Frontend layout (Header, Sidebar, Footer) | `feat/layout` | B | Sprint 0 |
| Login + Register pages | `feat/auth-pages` | B | layout |
| Auth store (Zustand) + API client (fetch wrapper) | `feat/auth-frontend` | C | layout |
| Connect frontend auth to backend | `feat/auth-integration` | C | auth-api, auth-pages |

**Merge order:** user-model → auth-api → layout → auth-pages → auth-frontend → auth-integration

**Definition of done:** User can register, log in, see their username in the header. JWT stored in httpOnly cookie. Protected routes redirect to login.

### Sprint 2 — Markets + Betting

| Task | Branch | Owner | Depends on |
|---|---|---|---|
| Market + Bet models + migrations | `feat/market-model` | A | Sprint 1 |
| Market CRUD endpoints | `feat/market-api` | A | market-model |
| Betting endpoints (place bet, bet cap) | `feat/betting-api` | A | market-model |
| Market list page + MarketCard component | `feat/market-list` | B | Sprint 1 |
| Market detail page + BetPanel + OddsBar | `feat/market-detail` | B | market-list |
| Comment model + endpoints | `feat/comments-api` | C | market-model |
| CommentThread component | `feat/comments-ui` | C | market-detail |
| Karma system (upvote/downvote) | `feat/karma` | C | comments-api |

**Merge order:** market-model → market-api + betting-api (parallel) → market-list → market-detail → comments-api → comments-ui + karma (parallel)

**Definition of done:** User can create a market, place a YES/NO bet (respecting karma-based cap), write comments, upvote/downvote comments. Karma updates on votes.

### Sprint 3 — Social Features

| Task | Branch | Owner | Depends on |
|---|---|---|---|
| Friend model + endpoints | `feat/friends-api` | A | Sprint 2 |
| Chat model + endpoints | `feat/chat-api` | A | friends-api |
| User profile page + avatar upload | `feat/profile` | B | Sprint 2 |
| Friends page (list, requests, status) | `feat/friends-ui` | B | friends-api, profile |
| Chat UI (sidebar, window, messages) | `feat/chat-ui` | C | chat-api |
| Notification model + endpoints | `feat/notifications-api` | A | Sprint 2 |
| Notification bell + dropdown | `feat/notifications-ui` | C | notifications-api |

**Definition of done:** Users can send friend requests, accept/reject/block. Direct chat works. Profile shows avatar, stats, bet history. Notification bell shows unread count.

### Sprint 4 — Real-time + Socket.IO

| Task | Branch | Owner | Depends on |
|---|---|---|---|
| Socket.IO server setup (python-socketio) | `feat/socketio-server` | C | Sprint 3 |
| Socket.IO client setup + socketStore | `feat/socketio-client` | C | socketio-server |
| Real-time market updates (bet placed → pool update) | `feat/rt-markets` | A | socketio-client |
| Real-time chat (messages, typing indicators) | `feat/rt-chat` | C | socketio-client |
| Real-time notifications | `feat/rt-notifications` | B | socketio-client |
| Online status tracking | `feat/online-status` | A | socketio-server |
| Market resolution system (auto/proposer/community) | `feat/resolution` | A | Sprint 3 |
| Resolution UI (dispute, vote, evidence) | `feat/resolution-ui` | B | resolution |

Note: After C sets up the Socket.IO foundation (server + client), all 3 students can work on real-time features in parallel since they touch different domains.

**Definition of done:** When User A places a bet, User B sees the odds update live. Chat messages appear instantly. Notifications pop up in real-time. Online status shows green dot for friends.

### Sprint 5 — LLM + i18n + OAuth

| Task | Branch | Owner | Depends on |
|---|---|---|---|
| OpenRouter client + LLM service | `feat/llm-backend` | A | Sprint 4 |
| LLM endpoints (summarize, resolve-assist, chat) | `feat/llm-api` | A | llm-backend |
| LLM UI (summary button, resolution assistant, chat panel) | `feat/llm-ui` | B | llm-api |
| i18n setup (next-intl) + EN translations | `feat/i18n-setup` | B | Sprint 4 |
| FR + DE translations | `feat/i18n-translations` | B | i18n-setup |
| OAuth 2.0 backend (Google, GitHub, 42) | `feat/oauth-backend` | C | Sprint 4 |
| OAuth frontend (login buttons, callback handling) | `feat/oauth-frontend` | C | oauth-backend |

**Definition of done:** LLM summarizes market discussions, suggests resolutions. App works in EN/FR/DE. Users can log in via Google/GitHub/42.

### Sprint 6 — Polish + Legal + Testing

| Task | Branch | Owner | Depends on |
|---|---|---|---|
| Privacy Policy page | `feat/privacy-policy` | B | Sprint 5 |
| Terms of Service page | `feat/terms-of-service` | B | Sprint 5 |
| Dark mode | `feat/dark-mode` | B | Sprint 5 |
| Backend test suite (pytest) | `feat/backend-tests` | A | Sprint 5 |
| Frontend test suite (Vitest) | `feat/frontend-tests` | C | Sprint 5 |
| E2E tests (Playwright) | `feat/e2e-tests` | C | backend-tests |
| Responsive polish + Chrome console cleanup | `feat/responsive` | B | Sprint 5 |
| Leaderboard page | `feat/leaderboard` | A | Sprint 5 |
| Settings page (language, profile, notifications) | `feat/settings` | C | i18n |

**Definition of done:** No console errors in Chrome. Privacy Policy and ToS pages have real content. Tests pass. App is responsive. Dark mode works.

### Sprint 7 — Integration Testing + Release

All 3 students together:

- [ ] Full end-to-end walkthrough: register → create market → bet → comment → resolve → payout
- [ ] Multi-user testing: 3 students use the app simultaneously
- [ ] Fix any remaining bugs
- [ ] Merge `dev` → `main` via PR
- [ ] Final Docker build from clean clone to verify reproducibility:
  ```bash
  git clone ... fresh-test
  cd fresh-test
  cp .env.example .env  # fill secrets
  docker compose up --build
  ```
- [ ] Prepare for evaluation: each student can explain every module they touched

---

## Phase 2 — Spice (Students D + E join)

### Onboarding Checklist for New Students

1. Clone repo, set up `.env`, run `docker compose up --build`
2. Read `README.md`, `plan/PLANNING.md` (especially Sections 1, 4, 7), `plan/TECH.md`
3. Read `CLAUDE.md` for code style and conventions
4. Read this file (IMPLEMENTATION.md) for git workflow
5. Explore the codebase: `backend/app/models/`, `backend/app/routers/`, `frontend/src/app/`
6. Create a tiny test PR (fix a typo, add a comment) to practice the workflow
7. Get added to GitHub repo with write access

### Spice Implementation Plan

| Task | Branch | Owner | Depends on |
|---|---|---|---|
| Spice model (pairwise bets between 2 users) | `feat/spice-model` | D | Onboarding |
| Spice settlement logic (both-agree resolution) | `feat/spice-settlement` | D | spice-model |
| Spice endpoints (propose, accept, settle, dispute) | `feat/spice-api` | D | spice-settlement |
| Spice UI (propose from market thread, accept/reject) | `feat/spice-ui` | E | spice-api |
| Spice leaderboard + profile integration | `feat/spice-leaderboard` | E | spice-ui |
| Jurisdiction check (legal compliance) | `feat/spice-jurisdiction` | D | spice-api |
| Spice influence on community vote weight | `feat/spice-vote-weight` | D | spice-settlement |
| Spice tests | `feat/spice-tests` | D + E | all spice features |

---

## Parallel Work Guide

To minimize conflicts, different students should work on different directories:

| Student | Primary directories | Rarely touches |
|---|---|---|
| A (Backend) | `backend/app/models/`, `backend/app/routers/`, `backend/app/services/`, `docker-compose.yml` | `frontend/src/components/` |
| B (Frontend) | `frontend/src/app/`, `frontend/src/components/`, `frontend/public/` | `backend/app/models/` |
| C (Full-stack) | `backend/app/socket/`, `backend/app/tasks/`, `frontend/src/stores/`, `frontend/src/hooks/`, `frontend/src/lib/` | `backend/app/models/` |

**Shared files (coordinate before editing):**
- `docker-compose.yml` — Student A owns, others request changes via PR
- `backend/app/main.py` — Adding routers/middleware (coordinate)
- `frontend/src/app/layout.tsx` — Root layout changes (coordinate)
- `.env.example` — Anyone can add variables, but announce in chat first

---

## Communication Checklist

### Daily (async, 5 min)

Post in team chat:
1. What I did yesterday
2. What I'm doing today
3. Am I blocked on anything?

### Before Starting a Feature

1. Check that no one else is working on overlapping files
2. Pull latest `dev`
3. Create feature branch
4. Announce in team chat: "Starting `feat/X`"

### Before Creating a PR

1. Run locally: `docker compose up --build` — no errors
2. Check Chrome console — no warnings/errors
3. Run tests if they exist: `uv run pytest` / `npm test`
4. Self-review your diff: `git diff dev..HEAD`
5. Create PR, assign reviewer

### Before Merging

1. At least 1 approval from a teammate
2. No merge conflicts
3. CI passes (once set up)
4. Tested locally by reviewer

---

## Common Pitfalls (and how to avoid them)

| Pitfall | What happens | How to avoid |
|---|---|---|
| Working on `dev` directly | Messy history, can't undo easily | Always create a feature branch |
| Huge PRs (500+ lines) | Hard to review, merge conflicts | Break work into small PRs (< 200 lines) |
| Not pulling before branching | Your branch starts from stale code | Always `git pull origin dev` first |
| `git add .` | Commits unintended files (.env, node_modules) | Use `git add <specific-files>` or check `git status` first |
| Forgetting to test before PR | Broken code merges into dev | Run `docker compose up --build` + check Chrome before every PR |
| Two people editing same file | Merge conflicts | Check the Parallel Work Guide, announce what you're working on |
| Not communicating | Duplicate work, wasted time | Daily standup message in team chat |
| Waiting to merge until everything is perfect | Branches diverge too far | Merge small, merge often |
| Force-pushing shared branches | Overwrites teammates' work | Only force-push YOUR feature branches |
| Not reading PR descriptions | Missing context during review | Write good PR descriptions, read them before reviewing |

---

## Quick Reference Card

```
# Start your day
git checkout dev && git pull origin dev

# Start a feature
git checkout -b feat/my-thing

# Work, commit often
git add <files> && git commit -m "feat: description"

# Push and create PR
git push -u origin feat/my-thing
# → GitHub → New PR → base: dev

# After PR is merged
git checkout dev && git pull origin dev
git branch -d feat/my-thing

# Update your feature branch if dev moved ahead
git fetch origin && git rebase origin/dev
# resolve conflicts if any, then:
git push --force-with-lease

# Nuclear option (abandon branch, start over)
git checkout dev && git pull origin dev
git branch -D feat/broken-thing
git checkout -b feat/retry-thing
```
