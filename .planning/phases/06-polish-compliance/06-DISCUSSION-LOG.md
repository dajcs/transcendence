# Phase 6: polish-compliance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-09
**Phase:** 06-polish-compliance
**Mode:** discuss
**Areas discussed:** Branch consolidation strategy

## Gray Areas Presented

| Area | Selected? |
|------|-----------|
| Branch consolidation strategy | Yes |
| i18n completeness | No — deferred to Claude's discretion |
| Chrome audit scope | No — deferred to Claude's discretion |
| OAuth smoke-testing | No — deferred to Claude's discretion |

## Discussion

### Branch Consolidation Strategy

**Question:** How to merge `imp/i18n` and `fix/polish` into `fix/ph6`?

| Option | Description |
|--------|-------------|
| Merge both branches in | `git merge` — preserves history with merge commits |
| Cherry-pick both commits | Linear history, no merge commits |
| Rebase fix/ph6 onto imp/i18n | Cleanest history, rewrites commits |

**User selection:** Option 1 — Merge both branches in (merge commits, preserves history)

## Corrections Made

None — one area discussed, user answered directly.

## Pre-analysis context

Phase 6 was substantially implemented before this discussion session:
- OAuth 2.0 (Google/GitHub/42): on fix/ph6 ✓
- Dark mode (next-themes + dark: variants): on fix/ph6 ✓
- Privacy/Terms pages: on fix/ph6 ✓
- GDPR (export + pseudonymized deletion): on fix/ph6 ✓
- i18n (useT() + EN/FR/DE dictionaries): on imp/i18n branch, NOT yet merged ⚠
- Additional dark mode variants: on fix/polish branch, NOT yet merged ⚠
