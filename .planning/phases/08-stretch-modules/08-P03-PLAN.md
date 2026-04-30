---
phase: 08-stretch-modules
plan: P03
type: execute
wave: 3
depends_on: ["P01", "P02"]
files_modified:
  - backend/app/api/routes/public.py
  - backend/app/main.py
  - backend/app/services/public_rate_limit.py
  - backend/tests/test_public_api.py
autonomous: true
requirements:
  - STRETCH-01

must_haves:
  truths:
    - "A dedicated public router is mounted at /api/public with tag public"
    - "The public API exposes at least 5 read-only GET endpoints"
    - "Public endpoints require no access_token cookie and never call auth_service.get_current_user"
    - "Public endpoints reuse existing service functions and response schemas instead of duplicating market/profile/comment business logic"
    - "Public endpoints are rate-limited per client IP and return 429 with Retry-After when exceeded"
    - "OpenAPI includes all /api/public paths under the public tag"
    - "No POST, PATCH, PUT, or DELETE routes are added under /api/public"
  artifacts:
    - path: "backend/app/api/routes/public.py"
      provides: "Read-only public API router"
      contains: "router = APIRouter(tags=[\"public\"], dependencies=[Depends(enforce_public_rate_limit)])"
    - path: "backend/app/services/public_rate_limit.py"
      provides: "Redis-backed public API per-IP rate limiter"
      contains: "rate:public:"
    - path: "backend/app/main.py"
      provides: "Public router registration"
      contains: "app.include_router(public_router, prefix=\"/api/public\")"
    - path: "backend/tests/test_public_api.py"
      provides: "Regression coverage for unauthenticated access, rate limiting, OpenAPI documentation, and no write routes"
      contains: "test_public_api_openapi_documents_public_paths"
  key_links:
    - from: "backend/app/api/routes/public.py"
      to: "backend/app/services/market_service.py"
      via: "list_markets(db, ..., user_id=None) and get_market(db, market_id, current_user_id=None)"
      pattern: "market_service.list_markets"
    - from: "backend/app/api/routes/public.py"
      to: "backend/app/services/comment_service.py"
      via: "list_comments(db, bet_id=market_id, current_user_id=None)"
      pattern: "comment_service.list_comments"
    - from: "backend/app/api/routes/public.py"
      to: "backend/app/services/profile_service.py"
      via: "get_public_profile(db, username, current_user_id=None) and get_hall_of_fame(db, limit=limit)"
      pattern: "profile_service.get_public_profile"
---

<objective>
Implement the Phase 8 Public API stretch module as a read-only, documented API surface under `/api/public`.

Purpose: satisfy STRETCH-01 with a low-risk public API that external consumers can inspect through Swagger/OpenAPI and call without authentication, while avoiding writes, account data, private settings, chat, notifications, friends, LLM usage, and API-key scope creep.

Output: a dedicated public router with 7 GET endpoints, Redis-backed per-IP rate limiting, OpenAPI documentation coverage, and backend tests.
</objective>

<execution_context>
@/mnt/c/Users/dajcs/code/transcendence/.codex/get-shit-done/workflows/execute-plan.md
@/mnt/c/Users/dajcs/code/transcendence/.codex/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/08-stretch-modules/08-CONTEXT.md
@.planning/phases/08-stretch-modules/08-PATTERNS.md

<interfaces>
Existing public-ish route/service behavior to reuse:

- `backend/app/api/routes/markets.py`
  - `GET /api/markets` already supports anonymous access via `_get_current_user_optional`.
  - `GET /api/markets/{market_id}` already supports anonymous access.
  - `GET /api/markets/{market_id}/positions` is public.
  - `GET /api/markets/{market_id}/payouts` is public.
- `backend/app/api/routes/comments.py`
  - `GET /api/markets/{bet_id}/comments` already supports anonymous access.
- `backend/app/api/routes/users.py`
  - `GET /api/users/hall-of-fame` is public.
  - `GET /api/users/{username}` supports anonymous access.

The new Public API must not simply remove auth from existing mutable routes. It must create a clearly documented `/api/public` namespace and delegate to existing services.

Required endpoint surface:

| Method | Path | Response model | Delegation |
|---|---|---|---|
| GET | `/api/public/markets` | `MarketListResponse` | `market_service.list_markets(..., user_id=None)` |
| GET | `/api/public/markets/{market_id}` | `MarketResponse` | `market_service.get_market(..., current_user_id=None)` |
| GET | `/api/public/markets/{market_id}/comments` | `list[CommentResponse]` | `comment_service.list_comments(..., current_user_id=None)` |
| GET | `/api/public/markets/{market_id}/positions` | `ParticipantListResponse` | same query logic as existing `markets.py` positions route, or a shared helper extracted from it |
| GET | `/api/public/markets/{market_id}/payouts` | `PayoutListResponse` | same query logic as existing `markets.py` payouts route, or a shared helper extracted from it |
| GET | `/api/public/users/{username}` | `PublicProfileResponse` | `profile_service.get_public_profile(..., current_user_id=None)` |
| GET | `/api/public/leaderboards` | `HallOfFameResponse` | `profile_service.get_hall_of_fame(db, limit=limit)` |

Rate-limit target:
- 60 requests per 60 seconds per client IP.
- Redis key prefix: `rate:public:{ip}`.
- On limit exceeded: HTTP 429, detail `Public API rate limit exceeded`, header `Retry-After: 60`.
- If Redis is unavailable, log and allow the request rather than breaking the public API.
</interfaces>
</context>

<tasks>

<task type="tdd" tdd="true">
  <name>Task 1: Add public API regression tests first</name>
  <files>backend/tests/test_public_api.py</files>
  <read_first>
    - backend/tests/conftest.py - understand AsyncClient, app dependency overrides, and fakeredis setup
    - backend/tests/test_markets.py - copy market creation/auth fixture style
    - backend/tests/test_market_positions.py - copy participant/payout test setup style
    - backend/tests/test_users.py - copy profile and hall-of-fame assertion style
    - backend/app/main.py - confirm OpenAPI path source and router registration pattern
  </read_first>
  <action>
    Create `backend/tests/test_public_api.py` with async pytest coverage for the public API contract before implementation.

    Include these tests:

    1. `test_public_api_lists_and_reads_markets_without_auth`
       - Arrange by registering/logging in a creator and creating one market through existing `/api/markets`.
       - Logout or use a fresh unauthenticated client request.
       - Assert `GET /api/public/markets?page=1&limit=20` returns 200, contains `items` and `total`, and includes the created market id.
       - Assert `GET /api/public/markets/{market_id}` returns 200 and `user_has_liked` is `false`.

    2. `test_public_api_exposes_comments_positions_and_payouts_without_auth`
       - Arrange one market, one participant position, and one comment using existing authenticated endpoints or direct DB setup consistent with current tests.
       - Assert:
         - `GET /api/public/markets/{market_id}/comments` returns 200 and a list.
         - `GET /api/public/markets/{market_id}/positions?offset=0&limit=10` returns 200 and has `participants`, `aggregate`, `total`.
         - `GET /api/public/markets/{market_id}/payouts?offset=0&limit=10` returns 200 and has `payouts`, `total` even for an open market.

    3. `test_public_api_exposes_public_profile_and_leaderboards_without_auth`
       - Arrange a registered user.
       - Assert `GET /api/public/users/{username}` returns 200 and includes `username`, `lp`, `bp`, `tp`, `total_bets`, `win_rate`.
       - Assert the response does not include `email`, `llm_api_key`, `llm_mode`, or `llm_provider`.
       - Assert `GET /api/public/leaderboards?limit=10` returns 200 and includes `entries`, `tp_entries`, `total`.

    4. `test_public_api_rejects_write_methods`
       - Assert `POST /api/public/markets`, `POST /api/public/markets/{market_id}/comments`, `PATCH /api/public/users/{username}`, and `DELETE /api/public/users/{username}` return 405 or 404, never 200/201.

    5. `test_public_api_openapi_documents_public_paths`
       - Assert `GET /openapi.json` returns 200.
       - Assert the `paths` object contains all 7 required paths exactly:
         `/api/public/markets`,
         `/api/public/markets/{market_id}`,
         `/api/public/markets/{market_id}/comments`,
         `/api/public/markets/{market_id}/positions`,
         `/api/public/markets/{market_id}/payouts`,
         `/api/public/users/{username}`,
         `/api/public/leaderboards`.
       - Assert each path has a `get` operation whose `tags` contains `"public"`.

    6. `test_public_api_rate_limit_returns_429`
       - Monkeypatch `app.services.public_rate_limit._redis` to a `fakeredis.aioredis.FakeRedis(decode_responses=True)` instance after implementation exists.
       - Monkeypatch `app.services.public_rate_limit.PUBLIC_RATE_LIMIT_MAX_REQUESTS` to `2`.
       - Call `GET /api/public/markets` three times from the same test client.
       - Assert the third response status is 429 and header `Retry-After` is `"60"`.

    Tests should fail before implementation because `/api/public/*` does not exist.
  </action>
  <verify>
    <automated>cd /mnt/c/Users/dajcs/code/transcendence/backend && UV_CACHE_DIR=/mnt/c/Users/dajcs/code/transcendence/.cache/uv uv run pytest tests/test_public_api.py -q</automated>
    Expected before implementation: failures for missing public routes/imports.
    Expected after implementation: all tests pass.
  </verify>
  <acceptance_criteria>
    - `backend/tests/test_public_api.py` exists.
    - File contains `test_public_api_openapi_documents_public_paths`.
    - File contains every required path string listed above.
    - File contains `test_public_api_rate_limit_returns_429`.
    - Running the targeted pytest command after Task 3 exits 0.
  </acceptance_criteria>
</task>

<task type="execute" tdd="false">
  <name>Task 2: Add Redis-backed public API rate limiter</name>
  <files>backend/app/services/public_rate_limit.py</files>
  <read_first>
    - backend/app/services/auth_service.py - reuse lazy Redis singleton pattern and HTTP 429 style
    - backend/app/config.py - confirm `settings.redis_url`
    - backend/tests/conftest.py - confirm tests can monkeypatch module singletons
  </read_first>
  <action>
    Create `backend/app/services/public_rate_limit.py` with this concrete API:

    ```python
    """Public API rate limiting."""
    import logging

    from fastapi import HTTPException, Request

    logger = logging.getLogger(__name__)

    PUBLIC_RATE_LIMIT_MAX_REQUESTS = 60
    PUBLIC_RATE_LIMIT_WINDOW_SECONDS = 60
    _redis = None

    def _get_redis():
        global _redis
        if _redis is None:
            import redis.asyncio as aioredis
            from app.config import settings
            _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
        return _redis

    async def enforce_public_rate_limit(request: Request) -> None:
        client_host = request.client.host if request.client else "unknown"
        key = f"rate:public:{client_host}"
        try:
            redis = _get_redis()
            current = await redis.incr(key)
            if current == 1:
                await redis.expire(key, PUBLIC_RATE_LIMIT_WINDOW_SECONDS)
            if current > PUBLIC_RATE_LIMIT_MAX_REQUESTS:
                raise HTTPException(
                    status_code=429,
                    detail="Public API rate limit exceeded",
                    headers={"Retry-After": str(PUBLIC_RATE_LIMIT_WINDOW_SECONDS)},
                )
        except HTTPException:
            raise
        except Exception:
            logger.warning("Public API rate limiter unavailable", exc_info=True)
    ```

    Do not add a new dependency package. Use the existing `redis[asyncio]` dependency already present in `backend/pyproject.toml`.
  </action>
  <verify>
    <automated>grep -c 'rate:public:' /mnt/c/Users/dajcs/code/transcendence/backend/app/services/public_rate_limit.py</automated>
    Expected: 1
    <automated>grep -c 'Retry-After' /mnt/c/Users/dajcs/code/transcendence/backend/app/services/public_rate_limit.py</automated>
    Expected: 1
    <automated>grep -c 'PUBLIC_RATE_LIMIT_MAX_REQUESTS = 60' /mnt/c/Users/dajcs/code/transcendence/backend/app/services/public_rate_limit.py</automated>
    Expected: 1
  </verify>
  <acceptance_criteria>
    - `public_rate_limit.py` defines `enforce_public_rate_limit(request: Request)`.
    - Rate-limit key prefix is exactly `rate:public:`.
    - Limit defaults are exactly 60 requests and 60 seconds.
    - Redis outage path logs and allows the request.
  </acceptance_criteria>
</task>

<task type="execute" tdd="false">
  <name>Task 3: Add and mount the read-only public router</name>
  <files>
    backend/app/api/routes/public.py
    backend/app/main.py
  </files>
  <read_first>
    - backend/app/api/routes/markets.py - copy query validation and participant/payout SQL exactly or extract shared helpers first
    - backend/app/api/routes/comments.py - copy comment route response_model and service call pattern
    - backend/app/api/routes/users.py - copy public profile and hall-of-fame route patterns
    - backend/app/services/market_service.py - use `list_markets` and `get_market` with anonymous user context
    - backend/app/services/comment_service.py - use `list_comments` with `current_user_id=None`
    - backend/app/services/profile_service.py - use profile and leaderboard services with anonymous user context
    - backend/app/main.py - router import/include ordering
  </read_first>
  <action>
    Create `backend/app/api/routes/public.py` with a dedicated router:

    ```python
    """Read-only public API routes."""
    import uuid

    from fastapi import APIRouter, Depends, HTTPException, Query
    from sqlalchemy import func, select
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.api.deps import get_db
    from app.db.models.market import Market, MarketPosition
    from app.db.models.transaction import BpTransaction, TpTransaction
    from app.db.models.user import User
    from app.schemas.comment import CommentResponse
    from app.schemas.market import (
        AggregateStats,
        MarketListResponse,
        MarketResponse,
        ParticipantEntry,
        ParticipantListResponse,
        PayoutEntry,
        PayoutListResponse,
    )
    from app.schemas.profile import HallOfFameResponse, PublicProfileResponse
    from app.services import comment_service, market_service, profile_service
    from app.services.public_rate_limit import enforce_public_rate_limit

    router = APIRouter(tags=["public"], dependencies=[Depends(enforce_public_rate_limit)])
    ```

    Add exactly these route handlers:

    1. `@router.get("/markets", response_model=MarketListResponse)`
       - Query params:
         - `sort: str = Query(default="deadline", pattern="^(deadline|active|newest)$")`
         - `sort_dir: str = Query(default="", pattern="^(asc|desc|)$")`
         - `status: str = Query(default="all", pattern="^(all|open|closed|disputed|resolved)$")`
         - `proposer_id: uuid.UUID | None = Query(default=None)`
         - `q: str = Query(default="")`
         - `include_desc: bool = Query(default=False)`
         - `page: int = Query(default=1, ge=1)`
         - `limit: int = Query(default=20, ge=1, le=100)`
       - Call `market_service.list_markets(db, sort=sort, sort_dir=sort_dir, status=status, proposer_id=proposer_id, q=q, include_desc=include_desc, page=page, limit=limit, user_id=None, my_bets=False, my_markets=False, liked=False)`.

    2. `@router.get("/markets/{market_id}", response_model=MarketResponse)`
       - Call `market_service.get_market(db, market_id, current_user_id=None)`.

    3. `@router.get("/markets/{market_id}/comments", response_model=list[CommentResponse])`
       - Call `comment_service.list_comments(db, bet_id=market_id, current_user_id=None)`.

    4. `@router.get("/markets/{market_id}/positions", response_model=ParticipantListResponse)`
       - Use the same public behavior as existing `markets.py`.
       - It is acceptable to extract shared helper functions from `markets.py` if that keeps code duplication low, but do not change response shape.
       - Must preserve active positions only: `MarketPosition.withdrawn_at.is_(None)`.
       - Must preserve query params `offset: int = Query(default=0, ge=0)` and `limit: int = Query(default=20, ge=1, le=100)`.

    5. `@router.get("/markets/{market_id}/payouts", response_model=PayoutListResponse)`
       - Use the same public behavior as existing `markets.py`.
       - Must count distinct `BpTransaction.user_id` where `reason == "bet_win"`.
       - Must merge TP winnings from `TpTransaction` by `user_id`.
       - Must preserve query params `offset: int = Query(default=0, ge=0)` and `limit: int = Query(default=20, ge=1, le=100)`.

    6. `@router.get("/users/{username}", response_model=PublicProfileResponse)`
       - Call `profile_service.get_public_profile(db, username, current_user_id=None)`.
       - This must not call `_get_current_user`, `_get_optional_user`, or inspect cookies.

    7. `@router.get("/leaderboards", response_model=HallOfFameResponse)`
       - Query param `limit: int = Query(default=20, ge=1, le=100)`.
       - Call `profile_service.get_hall_of_fame(db, limit=limit)`.

    In `backend/app/main.py`:
    - Add `from app.api.routes.public import router as public_router`.
    - Add `app.include_router(public_router, prefix="/api/public")` near the other API router registrations.
    - Do not add any POST, PATCH, PUT, or DELETE public route.
  </action>
  <verify>
    <automated>grep -c 'router = APIRouter(tags=\["public"\], dependencies=\[Depends(enforce_public_rate_limit)\])' /mnt/c/Users/dajcs/code/transcendence/backend/app/api/routes/public.py</automated>
    Expected: 1
    <automated>grep -c '@router.get' /mnt/c/Users/dajcs/code/transcendence/backend/app/api/routes/public.py</automated>
    Expected: 7
    <automated>grep -E '@router\.(post|patch|put|delete)' /mnt/c/Users/dajcs/code/transcendence/backend/app/api/routes/public.py</automated>
    Expected: no output
    <automated>grep -c 'app.include_router(public_router, prefix="/api/public")' /mnt/c/Users/dajcs/code/transcendence/backend/app/main.py</automated>
    Expected: 1
  </verify>
  <acceptance_criteria>
    - `/api/public/markets` returns paginated `MarketListResponse`.
    - `/api/public/markets/{market_id}` returns `MarketResponse`.
    - `/api/public/markets/{market_id}/comments` returns `list[CommentResponse]`.
    - `/api/public/markets/{market_id}/positions` returns `ParticipantListResponse`.
    - `/api/public/markets/{market_id}/payouts` returns `PayoutListResponse`.
    - `/api/public/users/{username}` returns `PublicProfileResponse` without private fields.
    - `/api/public/leaderboards` returns `HallOfFameResponse`.
    - `public.py` contains no write-route decorators.
  </acceptance_criteria>
</task>

<task type="execute" tdd="false">
  <name>Task 4: Verify STRETCH-01 and documentation coverage</name>
  <files>
    backend/tests/test_public_api.py
    backend/app/api/routes/public.py
    backend/app/main.py
  </files>
  <read_first>
    - backend/tests/test_public_api.py - confirm all tests from Task 1 were implemented
    - backend/app/api/routes/public.py - confirm route count and tags
    - backend/app/main.py - confirm router registration
  </read_first>
  <action>
    Run the targeted Public API verification, then a focused backend regression set:

    1. Targeted Public API tests:
       `cd backend && UV_CACHE_DIR=/mnt/c/Users/dajcs/code/transcendence/.cache/uv uv run pytest tests/test_public_api.py -q`

    2. Route-adjacent regressions:
       `cd backend && UV_CACHE_DIR=/mnt/c/Users/dajcs/code/transcendence/.cache/uv uv run pytest tests/test_markets.py tests/test_comments.py tests/test_market_positions.py tests/test_users.py -q`

    3. OpenAPI manual smoke:
       Use the test client or `pytest` output from `test_public_api_openapi_documents_public_paths` to confirm `/openapi.json` includes all 7 `/api/public` paths with tag `public`.

    If failures occur, fix the route or test defects. Do not weaken the tests to pass.
  </action>
  <verify>
    <automated>cd /mnt/c/Users/dajcs/code/transcendence/backend && UV_CACHE_DIR=/mnt/c/Users/dajcs/code/transcendence/.cache/uv uv run pytest tests/test_public_api.py -q</automated>
    Expected: exits 0
    <automated>cd /mnt/c/Users/dajcs/code/transcendence/backend && UV_CACHE_DIR=/mnt/c/Users/dajcs/code/transcendence/.cache/uv uv run pytest tests/test_markets.py tests/test_comments.py tests/test_market_positions.py tests/test_users.py -q</automated>
    Expected: exits 0
  </verify>
  <acceptance_criteria>
    - Targeted Public API tests pass.
    - Existing market/comment/position/user route tests pass.
    - `/openapi.json` documents all `/api/public` paths.
    - STRETCH-01 is no longer deferred in Phase 8 execution status.
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
| Threat | Severity | Mitigation |
|---|---|---|
| Public API accidentally exposes authenticated/private data such as email, LLM settings, notifications, chat, friend status, or GDPR export data | HIGH | Use a dedicated `/api/public` router with explicit read-only handlers. Reuse `PublicProfileResponse`, `MarketResponse`, comment/participant/payout schemas only. Tests assert profile responses exclude private fields. |
| Public API permits mutations through copied authenticated routes | HIGH | Add only `@router.get` handlers in `public.py`. Tests assert representative POST/PATCH/DELETE calls under `/api/public` do not succeed. Grep verification rejects write decorators. |
| Public API becomes an unauthenticated scraping endpoint with no throttle | MEDIUM | Apply `Depends(enforce_public_rate_limit)` to the whole public router. Redis-backed per-IP limit defaults to 60/min and returns 429 with `Retry-After: 60`. |
| Duplicated participant/payout SQL drifts from existing market routes | MEDIUM | Prefer extracting shared helpers if implementation becomes non-trivial; otherwise copy exact logic and cover public routes with route-adjacent regression tests. |
| Public search leaks descriptions unexpectedly | LOW | Preserve existing explicit `include_desc` boolean. Default `q` searches title only. |
| Redis outage breaks all public reads | LOW | Rate limiter logs and allows on non-HTTPException errors, matching availability-first behavior for a public read surface. |
</threat_model>

<verification>
Run:

```bash
cd /mnt/c/Users/dajcs/code/transcendence/backend && UV_CACHE_DIR=/mnt/c/Users/dajcs/code/transcendence/.cache/uv uv run pytest tests/test_public_api.py -q
cd /mnt/c/Users/dajcs/code/transcendence/backend && UV_CACHE_DIR=/mnt/c/Users/dajcs/code/transcendence/.cache/uv uv run pytest tests/test_markets.py tests/test_comments.py tests/test_market_positions.py tests/test_users.py -q
```

Manual/API smoke:
- Open `/api/docs` and confirm a `public` tag exists.
- Confirm Swagger lists the 7 `/api/public` GET endpoints.
- Confirm unauthenticated requests to `/api/public/markets` and `/api/public/leaderboards` return 200.
</verification>

<success_criteria>
- STRETCH-01 has a documented `/api/public` API surface with at least 5 GET endpoints.
- The implemented endpoint count is exactly 7 GET endpoints.
- No public write endpoints exist.
- Public endpoints do not require cookies or auth.
- Public endpoints are rate-limited.
- OpenAPI documents every public endpoint under tag `public`.
- Targeted and route-adjacent backend tests pass.
</success_criteria>
