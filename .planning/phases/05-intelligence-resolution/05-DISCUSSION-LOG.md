# Phase 5: Intelligence & Resolution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-03-30
**Phase:** 05-intelligence-resolution
**Mode:** discuss
**Areas analyzed:** Tier 1 auto-resolution, Resolution UX, LLM UI, Socket events

## Gray Areas Presented

### Tier 1 Auto-Resolution Scope
| Option | What it means |
|--------|---------------|
| Stub it | Fall through to Tier 2 at deadline; no external API calls |
| Real poller (minimal) ✓ | One real data source integration as proof-of-concept |

**User chose:** Real poller (minimal)

### Tier 1 API Source
| Option | Notes |
|--------|-------|
| Open-Meteo (weather) ✓ | Free, no key, deterministic JSON |
| NewsAPI | Requires free API key |
| Generic URL + JSONPath | Flexible but adds JSONPath eval scope |

**User chose:** Open-Meteo (weather)

### Resolution + Dispute UI Location
| Option | Notes |
|--------|-------|
| Inline on market page ✓ | Resolution + Dispute sections below bet detail |
| Dedicated pages | Separate /resolve and /dispute routes |

**User chose:** Inline on market page

### LLM Feature Placement
| Option | Notes |
|--------|-------|
| Inline buttons ✓ | Summarize in comments; hint in resolution form; opt-out in settings |
| Minimal backend only | No UI yet |

**User chose:** Inline buttons

### Socket Events (Phase 4 Deferred)
| Option | Notes |
|--------|-------|
| Wire them ✓ | bet:resolved, dispute:opened/voted/closed |
| Skip | Poll on page load |

**User chose:** Wire them

## Corrections Made

None — all recommendations accepted except Tier 1 (user chose real poller over stub).

## Notes

- Tier 1 real poller is scoped to Open-Meteo only (weather bets). Keeps scope manageable while satisfying "real integration" intent.
- Phase 4 CONTEXT D-13 explicitly deferred `bet:resolved` and `dispute:*` to this phase — confirmed here.
