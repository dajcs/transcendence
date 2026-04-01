# Bet Resolution Specification

## Overview

Resolution works in three tiers, attempted in order:

1. **Automatic** — pulled from public APIs if the market is linked to a verifiable data source
2. **Proposer** — proposer resolves unilaterally if outcome is clear-cut
3. **Community vote** — triggered if proposer resolution is disputed

---

## Tier 1: Automatic Resolution

### Supported Sources
- Public APIs returning structured, verifiable data (e.g., sports scores, election results, financial data)
- Each bet optionally links to a `resolution_source` at creation time (URL + field path)

### Criteria for Automatic Resolution
- Source must return a definitive YES or NO answer (no ambiguity)
- Polled by Celery task at deadline + 5-minute grace period
- If API returns ambiguous or no data → fall through to Tier 2

### Fallback
- If automatic resolution fails for any reason → escalate to Proposer (Tier 2)
- Failure reasons logged for audit

---

## Tier 2: Proposer Resolution

### When Used
- No automatic resolution source, or automatic resolution failed
- Outcome must be **objectively verifiable** from public information:
  - Published fact (news article, official announcement)
  - Deterministic outcome (score, date, price)
  - No reasonable controversy expected

### Who Can Resolve
- Only the original bet proposer
- Available from deadline until **7 days after deadline** (then auto-escalates to Tier 3)

### Process
1. Proposer submits resolution with YES or NO + justification text (min 20 chars)
2. Resolution is applied immediately
3. 48-hour dispute window begins

### Proposer Penalty
If proposer resolution is successfully overturned via community vote:
- Proposer loses **50% of their staked bp** (including any winnings from their own bet position)
- Deducted immediately upon dispute resolution; cannot go below 0

---

## Tier 3: Community Vote (Dispute)

### Trigger Conditions
- Any participant disputes the Tier 2 resolution within the 48-hour window
- Tier 2 window expires without resolution

### Dispute Cost
- Opening a dispute: **1 bp** (upfront, non-refundable if dispute is invalid — see validity below)
- Losing a dispute: **+1 bp penalty** (net: -2 bp for a losing dispute)
- Winning a dispute: **+2 bp** shared among all voters in the winning coalition

### Dispute UI (market detail page)
- When market is `proposer_resolved` and no dispute exists: show **"Dispute Resolution"** button with note "Costs 1 BP · Opens 48h community vote". Backend enforces active-position requirement (403 if no position). Button is visible to all logged-in users; error shown inline on rejection.
- When dispute is active: show closing timestamp, YES/NO vote weights, Vote YES / Vote NO buttons.
- Section background: light violet.

### Vote Weights
| Voter type | Weight |
|---|---|
| Voted for their own **winning** position | 0.5x |
| Did not participate in the bet | 1x |
| Voted **against** their own position | 2x |

### Validity Requirement
- Dispute is valid only if **at least 1% of bet participants** vote
- Minimum: 1 voter (for bets with < 100 participants, any vote makes it valid)
- Maximum voting window: **3 days** from dispute opening
- If minimum participation not reached by deadline → dispute is **invalid**, original resolution stands, disputer's 1 bp is refunded

### Resolution Outcome
- **Weighted majority** determines final outcome (YES or NO)
- Ties (exactly 50/50 after weighting): original proposer resolution stands
- On successful dispute: original proposer resolution overturned, proposer penalty applied

### Spam Prevention
- Each user may open at most **1 disputes per 24 hours** globally
- Each user may open at most **1 dispute per bet**
- Disputes on already-disputed bets in the same round: not allowed (one dispute round per resolution)

---

## Edge Cases

### Zero Participants
- `1% of 0 = 0` — minimum is raised to **1 voter** to prevent empty-quorum exploits

### Proposer Bets on Own Market
- Allowed; proposer can hold a position
- Penalty still applies if resolution is overturned (including bp from their position)

### Simultaneous Disputes
- Only one active dispute round per bet at a time
- If dispute is opened while a previous round is still open: rejected with error

### LLM-Assisted Resolution
- When Tier 2 proposer is unsure, they may invoke the LLM assistant (see `LLM_INTEGRATION.md`)
- LLM provides a recommendation with justification; proposer decides
- LLM suggestion does not bind the outcome; human proposer is always responsible

---

## Market States

```
OPEN → PENDING_RESOLUTION → (AUTO_RESOLVED | PROPOSER_RESOLVED | DISPUTED) → CLOSED
                                                               |
                                              DISPUTE_VOTING → (DISPUTE_ACCEPTED | DISPUTE_REJECTED) → CLOSED
```

All state transitions logged with timestamp and actor.

---

## Payout Calculation

On CLOSED:
1. Determine winning side (YES or NO)
2. For each winner:
   - `+1 bp`
   - `+floor(tp_formula * 100) / 100 tp` (see ECONOMY.md)
3. For each loser: no additional penalty (bp was already spent when bet was placed)
4. Proposer penalty applied if overturned (see Tier 2)

All payouts are atomic DB transactions.

---

*Last updated: 2026-03-24*
