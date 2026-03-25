# Phase 2: Core Betting - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the Q&A.

**Date:** 2026-03-25
**Phase:** 02-core-betting
**Mode:** discuss
**Areas analyzed:** UI Design Level, Markets Feed & List, Market Creation Form, Balance Computation

## Assumptions Entering Discussion

From Phase 1 context (01-CONTEXT.md):
- D-12: "Styling: functional with Tailwind utilities. Not polished — visual design in Phase 2+"
- Full DB schema already in place (all bet, transaction, comment models migrated)
- Ledger-based economy (no balance columns on User)
- Economy formulas fully specified in plan/ECONOMY.md

## Q&A Log

### Area Selection

**Q:** Which areas do you want to discuss for Phase 2: Core Betting?
**A:** All four — UI design level, Markets feed & list, Market creation form, Balance computation

---

### UI Design Level

**Q:** How polished should Phase 2 UI be?
- Apply the PLANNING.md design system (indigo/emerald/rose palette, Inter/JetBrains Mono)
- Functional Tailwind, design in Phase 6

**A:** Functional Tailwind, design in Phase 6

**Decision captured:** D-01 — basic Tailwind utilities only, no custom design tokens. Visual design deferred to Phase 6.

---

### Markets Feed & List

**Q:** How should the markets list be sorted by default?
- Deadline soonest first
- Most active (by bet count)
- Newest first

**A:** Deadline soonest first, but most active / newest first should be one click (free text clarification)

**Decision captured:** D-02 — default sort = deadline ascending; one-click toggle between Deadline / Active / Newest via sort buttons.

**Q:** What filter tabs should the markets list have?
- All / Open / Resolved
- Open only
- All / Open / Mine / Resolved

**A:** All / Open / Resolved

**Decision captured:** D-03 — three filter tabs: All, Open, Resolved.

**Q:** Pagination approach?
- Simple page pagination
- Load more button
- Infinite scroll

**A:** Simple page pagination

**Decision captured:** D-04 — Previous/Next page buttons.

---

### Market Creation Form

**Q:** Should the creation form expose the resolution_source field?
- Hide it — keep form simple (title, description, resolution_criteria, deadline)
- Show as optional advanced field

**A:** Hide it — keep form simple

**Decision captured:** D-05 — resolution_source hidden in Phase 2.

**Q:** Who can create a market?
- Any authenticated user
- Costs bp to create

**A:** Costs bp to create

**Follow-up Q:** How much bp to create a market?
- 1 bp
- 5 bp
- 0 bp (you decide)

**A:** 1 bp

**Decision captured:** D-06 — market creation costs 1 bp, deducted atomically. D-07 — any authenticated user (with ≥1 bp).

---

### Balance Computation

**Q:** How should bp/kp/tp balances be computed?
- SUM on every request — pure ledger
- Redis cache, invalidate on write

**A:** SUM on every request — pure ledger

**Decision captured:** D-08 — no caching, no balance columns. Index on (user_id) recommended.

**Q:** Should User model store a denormalized kp snapshot?
- No — compute kp from kp_events
- Yes — add kp_balance column on User

**A:** No — compute kp from kp_events

**Decision captured:** D-09 — Celery daily task: SUM kp_events → credit bp → insert reset event.

---

## Corrections / Scope Clarifications

- **Market creation cost:** ECONOMY.md is silent on whether creating a market costs bp. User confirmed 1 bp. This is captured as D-06 in CONTEXT.md. ECONOMY.md should be considered incomplete on this point — the planner should not add a different cost.

## No Scope Creep Items

No out-of-scope features were raised during discussion.
