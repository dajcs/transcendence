# Points Economy Specification

## Overview

Vox Populi uses four point currencies. No real money involved.

| Currency | Name | Role |
|---|---|---|
| **kp** | Karma Points | Community contribution score |
| **bp** | Betting Points | Betting currency |
| **tp** | Truth Points | Forecasting accuracy score |
| **sp** | Spice Points | Phase 2 — real-money skin-in-the-game signal |

---

## Karma Points (kp)

### Earning
- +1 kp per upvote received on any comment or proposed bet
- Resets **daily at 00:00 UTC**

### Edge Cases
- `kp = 0` after daily reset until first upvote
- Upvotes received before reset count toward that day's kp; no carryover
- Upvoting your own content: **not allowed** (backend enforces unique voter constraint)

### Purpose
- Determines daily bp allocation (see below)
- Measures contribution quality — does not directly buy anything

---

## Betting Points (bp)

### Earning
| Event | Amount |
|---|---|
| Sign-up bonus | +10 bp |
| Daily login | +1 bp |
| Daily allocation | +floor(log10(kp + 1)) bp |
| Winning a bet | +1 bp |
| Successful dispute of a bet | +2 bp |

## Daily bp Allocation Task

- Runs at 00:00 UTC daily

- For each user:
  - Calculate `karma_bp = floor(log10(kp + 1))`
  - Insert a bp transaction of `+karma_bp` into `bp_transactions`
  - Reset kp to 0 for the new day

```
karma_bp = floor(log10(kp + 1))
```

- Base: log10 (base 10)
- `+1` offset ensures log never goes negative or undefined (handles `kp = 0`)
- `floor()` truncates to integer — no fractional bp
- Calculated and credited at **00:00 UTC** using kp from the **previous day**
- Processed by a Celery scheduled task

**Examples:**

| kp | karma_bp |
|---|---|
| 0 | 0 |
| 1 | 0 |
| 9 | 1 |
| 10 | 1 |
| 99 | 2 |
| 100 | 2 |
| 1000 | 3 |
| 10000 | 4 |

- Prevents whales from dominating markets regardless of bp balance



### Spending
- **Placing a bet:** 1 bp per vote
- **Disputing a resolution:** 1 bp upfront; +1 bp penalty if dispute is lost

### Withdrawal
A bet can be withdrawn before resolution. Refund formula:
```
refund_bp = round(current_winning_probability_of_position, 2)
```
- If YES position currently has 80% probability, withdrawing returns 0.8 bp (rounded to 2 decimal places)
- Minimum refund: 0.0 bp (when rounded probability to 2 decimals is 0.00)
- Withdrawal is immediate; position removed from market calculations

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

### Display
- tp is displayed as a float rounded to 2 decimal places
- Leaderboard sorts by cumulative tp

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
- Celery handles:
  - Daily bp allocation (00:00 UTC)
  - Daily kp reset (00:00 UTC)
  - Bet resolution scheduling

---

*Last updated: 2026-03-24*
