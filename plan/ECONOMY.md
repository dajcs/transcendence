# Points Economy Specification

## Overview

Vox Populi uses four point currencies. No real money involved.

| Currency | Name | Role |
|---|---|---|
| **lp** | Like Points | Community contribution score |
| **bp** | Betting Points | Betting currency |
| **tp** | Truth Points | Forecasting accuracy score |
| **sp** | Spice Points | Phase 2 — real-money skin-in-the-game signal |

---

## Like Points (lp)

### Earning
- +1 lp per upvote received on a comment (`source_type = comment_upvote`)
- +1 lp per upvote received on a market (`source_type = market_upvote`)
- Converted to BP and reset to zero on user login

### Type
- **lp** is an **integer** (stored as a sum of integer LpEvent amounts).

### Edge Cases
- `lp = 0` after conversion reset until first upvote
- Upvotes received before conversion count toward accumulated lp; no carryover after reset
- Unlike operations remove the upvote but never let the recipient's lp aggregate go below 0
- Upvoting your own content: **not allowed** (backend enforces unique voter constraint)
- LP balance changes emit `points:balance_changed` to the recipient's `user:{id}` Socket.IO room so open sessions update without a page reload

### Purpose
- Determines bp allocation on next login (see LP → BP Conversion below)
- Measures contribution quality — does not directly buy anything

---

## Betting Points (bp)

### Types
- **bp** is a **float** (stored as `Numeric(10, 2)`). All calculations preserve fractional values.

### Earning
| Event | Amount |
|---|---|
| Sign-up bonus | +10.0 bp |
| Daily login | +1.0 bp |
| LP conversion on login | +min(log2(lp + 1), 10.0) bp (float, capped at 10.0) |
| Winning a bet | min(bet_amount × 10, proportional_share) BP; surplus to special fund |
| Successful dispute of a bet | +2.0 bp |

## LP → BP Conversion (at login)

Triggered on every user login (password or OAuth). Idempotent — if LP is 0, nothing happens.

- Calculate `karma_bp = min(log2(lp + 1), 10.0)` — **full float, capped at 10 BP**
- Insert a bp transaction of `+karma_bp` into `bp_transactions`
- Reset lp to 0 (insert negative LpEvent)
- Notify user: "X LP converted to Y.y BP"

```
karma_bp = min(log2(lp + 1), 10.0)
```

- Base: log2 (base 2) — faster growth at low lp counts
- `+1` offset ensures result is never negative or undefined at `lp = 0`
- Full float preserved — fractional bp credited
- Capped at 10.0 BP to prevent runaway accumulation

**Examples:**

| lp | karma_bp |
|---|---|
| 0 | 0.0 |
| 1 | 1.0 |
| 3 | 2.0 |
| 7 | 3.0 |
| 15 | 4.0 |
| 31 | 5.0 |
| 63 | 6.0 |
| 123 | 6.9425... |
| 1023 | 10.0 |
| 2000 | 10.0 (capped) |

- Prevents whales from dominating markets regardless of bp balance



### Spending
- **Placing a bet:** flat cap of 10 BP per position (or available balance, whichever is lower)
- **Disputing a resolution:** 1 bp upfront; +1 bp penalty if dispute is lost

### Withdrawal
A bet can be withdrawn before resolution. Refund formula depends on market type:

**Binary / Multiple-choice:**
```
refund_bp = round(side_pool / total_pool, 2)
```
- YES position at 80% probability → 0.80 bp refund
- Minimum refund: 0.0 bp

**Numeric:**
```
refund_bp = round(max(0, 1 - |estimate - mean_estimate| / (range_max - range_min)), 2)
```
- Consensus proximity: closer to the crowd mean → more bp back
- Single participant (or estimate == mean): full 1.0 bp refund
- Extreme outlier at range boundary: ~0.0 bp refund

Withdrawal is immediate; position removed from pool/mean calculations before refund is computed.

### Negative Balance
- bp balance **cannot go below 0**
- Bets are validated against current balance before acceptance
- Race condition guard: balance check + deduction in a single DB transaction with row-level lock

---

## Truth Points (tp)

### Earning
On a winning bet:
```
tp_earned = t_win / t_bet
```

Where:
- `t_win` = time spent in the winning position (seconds)
- `t_bet` = total duration of the bet from open to resolution (seconds)

**Purpose of the formula:** Rewards early correct positions; penalizes last-minute tp farming.

### Edge Cases
- `t_bet = 0` (instantaneous resolution): can't happen, backend asserts minimum bet duration of 3600 seconds
- `t_win > t_bet` impossible by definition; backend asserts this invariant
- User changes position mid-bet: Can't happen. User can only withdraw bets and place new ones. `t_win` accumulates only for time spent on the final winning side
  - Example: bet is open for t_bet = 3600s, user puts YES at t1 = 3000s remaining time, withdraws bet and puts a new NO bet at t2 = 2400s remaining time, NO wins → `t_win = t2 = 2400`, `tp = 2400/3600 = 0.67`
  - Position change history logged per user per bet for accurate calculation

### Type
- **tp** is a **float** (stored as `Numeric(10, 4)`). Displayed with 1 decimal in the nav header.
- Hall of Fame TP tab sorts by cumulative tp

---

## Special Fund (bp_fund_entries)

Surplus BP from capped payouts is recorded in the `bp_fund_entries` table.

| Column | Type | Description |
|--------|------|-------------|
| market_id | UUID | FK to bets.id |
| user_id | UUID | Winner whose payout was capped |
| amount | Numeric | Surplus BP amount |
| reason | Text | "cap_surplus" (binary/multichoice) or "numeric_cap_surplus" |
| created_at | DateTime | Event timestamp |

Surplus use-case (lottery/distribution) is deferred to a later phase.

The Hall of Fame BP tab surfaces users with the most cap-surplus BP from this ledger.

---

## Numeric Market Payout

Numeric markets use span-based error bands derived from the configured numeric range:

1. Parse each active prediction as a float and compute its absolute error as a percentage of the market span
2. Select the first non-empty winner band:
   - Band 1: error `<= 2%`
   - Band 2: error `> 2% and <= 4%`
   - Band 3: error `> 4% and <= 8%`
   - Band 4: error `> 8% and <= 16%`
3. Split the full BP pool proportionally across winners in that band
4. Cap each winner at `10x` their own stake
5. Surplus beyond that cap goes to the special fund (`reason = "numeric_cap_surplus"`)

---

## Spice Points (sp)

**Phase 2 only — not implemented in v1.**

- Earned from pairwise real-money bets
- Signals skin-in-the-game
- Not used in any formula in Phase 1

---

## Anti-Gaming Rules

### Vote Weight Manipulation
Community dispute votes are weighted to penalize self-serving voting:
- 0.5x — voting for your own winning position
- 1x — neutral voter (did not participate in bet)
- 2x — voting against your own position

**Collusion risk:** A user could bet YES and then vote NO to get 2x weight.
**Mitigation:** The bp cost of disputing (1 bp + 1 bp penalty on loss) makes this profitable only in large markets with high dispute rewards. Monitor for patterns; add rate limiting on disputes if farming is detected.

### Dispute Farming
- Disputing costs 1 bp upfront
- Losing a dispute costs 1 additional bp (net: -2 bp)
- Winning rewards 2 bp to each voter in the successful disputing coalition
- Net expected value of randomly disputing correct resolutions: negative (costs 2, wins 0)
- No cooldown initially; add 24h cooldown per user per market if farming is observed

### Last-Minute tp Farming
- Addressed by `t_win / t_bet` formula — late entry yields low tp even if correct
- Minimum bet duration enforced: bets must be open at least **3600 seconds** before resolution

---

## Implementation Notes

- All bp transactions go through an **immutable ledger table** (`bp_transactions`)
  - Never update a balance directly; always insert a transaction row
  - Current balance = `SUM(amount) WHERE user_id = ?`
- tp is similarly tracked in `tp_transactions`
- All balance-modifying operations wrapped in DB transactions with `SELECT FOR UPDATE` on user row
- **bp and tp are floats** — no floor/truncation in payout or allocation calculations
- **lp is an integer** — displayed without decimals
- Balance display updates use Socket.IO `points:balance_changed` events for LP/BP/TP payloads, while ledgers remain the source of truth
- Celery handles:
  - Bet resolution scheduling
  - Dispute deadline checks
- LP → BP conversion and LP reset happen at **user login** (password or OAuth), not via scheduled task

---

*Last updated: 2026-04-21*
