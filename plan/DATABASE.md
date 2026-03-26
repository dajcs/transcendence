# Database Design

## Stack

- **PostgreSQL 16** — primary store
- **Redis 7** — session cache, pub-sub for real-time events, rate limiting counters
- **Alembic** — schema migrations (via SQLAlchemy 2)

---

## Core Tables

### users
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
email       TEXT UNIQUE NOT NULL
username    TEXT UNIQUE NOT NULL
password_hash TEXT               -- NULL for OAuth-only accounts
avatar_url  TEXT
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
last_login  TIMESTAMPTZ
is_active   BOOLEAN NOT NULL DEFAULT TRUE
```

### oauth_accounts
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
provider    TEXT NOT NULL  -- 'google' | 'github' | '42'
provider_user_id TEXT NOT NULL
access_token_enc TEXT       -- encrypted at application layer
refresh_token_enc TEXT
expires_at  TIMESTAMPTZ
UNIQUE (provider, provider_user_id)
```

### bets
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
proposer_id     UUID NOT NULL REFERENCES users(id)
title           TEXT NOT NULL
description     TEXT NOT NULL
resolution_criteria TEXT NOT NULL
resolution_source TEXT       -- optional API URL
deadline        TIMESTAMPTZ NOT NULL
market_type     TEXT NOT NULL DEFAULT 'binary'  -- 'binary'|'multiple_choice'|'numeric'
choices         JSONB          -- list of choice strings; only for multiple_choice markets
numeric_min     FLOAT          -- only for numeric markets
numeric_max     FLOAT          -- only for numeric markets
status          TEXT NOT NULL  -- 'open'|'pending'|'auto_resolved'|'proposer_resolved'|'disputed'|'closed'
winning_side    TEXT           -- 'yes'|'no'|choice text|numeric value|NULL until closed
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
closed_at       TIMESTAMPTZ
```

### bet_positions
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
bet_id      UUID NOT NULL REFERENCES bets(id)
user_id     UUID NOT NULL REFERENCES users(id)
side        TEXT NOT NULL  -- 'yes'|'no' for binary; choice text for multiple_choice; numeric string for numeric
bp_staked   NUMERIC(10,2) NOT NULL
placed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
withdrawn_at TIMESTAMPTZ
refund_bp   NUMERIC(10,2)
UNIQUE (bet_id, user_id)    -- one active position per user per bet
```

### position_history
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
bet_id      UUID NOT NULL REFERENCES bets(id)
user_id     UUID NOT NULL REFERENCES users(id)
side        TEXT NOT NULL
changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```
Used to calculate `t_win / t_bet` accurately.

### bp_transactions
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id     UUID NOT NULL REFERENCES users(id)
amount      NUMERIC(10,2) NOT NULL  -- positive = credit, negative = debit
reason      TEXT NOT NULL  -- 'signup'|'daily_login'|'daily_allocation'|'market_create'|'bet_place'|'own_bet_vote'|'bet_won'|'withdrawal_refund'|'dispute_opened'|'dispute_won'|'dispute_lost'|'proposer_penalty'
bet_id      UUID REFERENCES bets(id)  -- nullable
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```
**Never update; always insert.** Current balance = `SUM(amount) WHERE user_id = ?`

### tp_transactions
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id     UUID NOT NULL REFERENCES users(id)
amount      NUMERIC(10,4) NOT NULL
bet_id      UUID NOT NULL REFERENCES bets(id)
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```

### kp_events
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id     UUID NOT NULL REFERENCES users(id)
amount      INTEGER NOT NULL  -- +1 per upvote
source_type TEXT NOT NULL  -- 'comment_upvote'|'market_upvote'|'daily_reset'
source_id   UUID NOT NULL
day_date    DATE NOT NULL   -- which day this kp counts toward
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```
Daily kp = `SUM(amount) WHERE user_id = ? AND day_date = ?`

### resolutions
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
bet_id          UUID UNIQUE NOT NULL REFERENCES bets(id)
tier            INTEGER NOT NULL  -- 1|2|3
resolved_by     UUID REFERENCES users(id)  -- NULL for auto
outcome         TEXT NOT NULL  -- 'yes'|'no'
justification   TEXT
resolved_at     TIMESTAMPTZ NOT NULL DEFAULT now()
overturned      BOOLEAN NOT NULL DEFAULT FALSE
```

### disputes
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
bet_id          UUID NOT NULL REFERENCES bets(id)
opened_by       UUID NOT NULL REFERENCES users(id)
opened_at       TIMESTAMPTZ NOT NULL DEFAULT now()
closes_at       TIMESTAMPTZ NOT NULL  -- opened_at + 7 days
status          TEXT NOT NULL  -- 'open'|'accepted'|'rejected'|'invalid'
final_outcome   TEXT  -- 'yes'|'no'|NULL
```

### dispute_votes
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
dispute_id  UUID NOT NULL REFERENCES disputes(id)
user_id     UUID NOT NULL REFERENCES users(id)
vote        TEXT NOT NULL  -- 'yes'|'no'
weight      NUMERIC(3,1) NOT NULL  -- 0.5|1.0|2.0
voted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE (dispute_id, user_id)
```

### comments
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
bet_id      UUID NOT NULL REFERENCES bets(id)
user_id     UUID NOT NULL REFERENCES users(id)
parent_id   UUID REFERENCES comments(id)
content     TEXT NOT NULL
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
edited_at   TIMESTAMPTZ
deleted_at  TIMESTAMPTZ  -- soft delete
```

### comment_upvotes
```sql
comment_id  UUID NOT NULL REFERENCES comments(id)
user_id     UUID NOT NULL REFERENCES users(id)
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
PRIMARY KEY (comment_id, user_id)
```

### bet_upvotes
```sql
bet_id      UUID NOT NULL REFERENCES bets(id)
user_id     UUID NOT NULL REFERENCES users(id)
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
PRIMARY KEY (bet_id, user_id)
```
One upvote per user per market. Awards +1 kp to the market proposer.

---

## Concurrency Model

### Balance Updates (bp, tp, kp)
- Use **ledger pattern** — never UPDATE a balance field; INSERT a transaction row
- Current balance computed via aggregate query (cached in Redis with TTL=30s)
- For bet placement: `SELECT FOR UPDATE` on user row inside transaction to serialize concurrent bets

### Voting / Disputes
- `UNIQUE (dispute_id, user_id)` constraint on `dispute_votes` prevents double-voting at DB level
- `UNIQUE (bet_id, user_id)` on `bet_positions` prevents duplicate positions
- Application layer checks these before insert; DB constraint is the final guard

### Bet Payout
- Payout is a single DB transaction:
  1. Lock bet row: `SELECT ... FOR UPDATE`
  2. Insert `bp_transactions` for all winners
  3. Update `bets.status = 'closed'` and `bets.winning_side`
  4. Commit
- Idempotency key on payout task prevents double-payout on Celery retry

### Transaction Isolation
- Default: `READ COMMITTED` (PostgreSQL default)
- Upgrade to `REPEATABLE READ` for payout transactions
- No `SERIALIZABLE` isolation needed — ledger pattern avoids most anomalies

---

## Indexes

```sql
-- Hot query paths
CREATE INDEX idx_bets_status ON bets(status);
CREATE INDEX idx_bets_deadline ON bets(deadline) WHERE status = 'open';
CREATE INDEX idx_bet_positions_bet ON bet_positions(bet_id);
CREATE INDEX idx_bp_transactions_user ON bp_transactions(user_id, created_at DESC);
CREATE INDEX idx_kp_events_user_day ON kp_events(user_id, day_date);
CREATE INDEX idx_comments_bet ON comments(bet_id, created_at) WHERE deleted_at IS NULL;
```

---

## Redis Usage

| Key Pattern | Type | TTL | Purpose |
|---|---|---|---|
| `session:{token}` | Hash | 24h | JWT session data |
| `bp_balance:{user_id}` | String | 30s | Cached bp balance |
| `rate:{action}:{user_id}` | String | varies | Rate limiting counters |
| `bet_odds:{bet_id}` | Hash | 10s | Cached YES/NO vote counts |
| `channel:bet:{bet_id}` | Pub-Sub | — | Real-time bet updates |
| `channel:user:{user_id}` | Pub-Sub | — | User notifications |

---

## Migrations

- All schema changes via Alembic: `uv run alembic revision --autogenerate -m "description"`
- Never edit migration files after they are committed
- Migration naming: `YYYYMMDD_short_description`
- Rollback: Alembic downgrade supported for all migrations

---

*Last updated: 2026-03-26*
