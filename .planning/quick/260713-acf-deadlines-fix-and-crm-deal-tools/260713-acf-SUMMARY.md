---
phase: quick
plan: 260713-acf
subsystem: tools
tags: [bugfix, deadlines, crm, deals, new-tools]
dependency_graph:
  requires: [clean-11-tool-server]
  provides: [working-task-deadlines, crm-deal-tools]
  affects: [src/tools/read, src/tools/write, tests/tools]
tech_stack:
  added: []
  patterns:
    - "splitWeeekDate helper routes one date string to dueDate (Y-m-d) vs dueDateTime (ISO UTC)"
    - "CRM deals are status-scoped: POST/GET /crm/statuses/{statusId}/deals"
key_files:
  added:
    - src/tools/write/_dates.ts
    - src/tools/read/list-funnels.ts
    - src/tools/read/list-funnel-statuses.ts
    - src/tools/read/list-deals.ts
    - src/tools/write/create-deal.ts
    - tests/tools/_dates.test.ts
    - tests/tools/list-funnels.test.ts
    - tests/tools/list-funnel-statuses.test.ts
    - tests/tools/list-deals.test.ts
    - tests/tools/create-deal.test.ts
  modified:
    - src/tools/write/create-task.ts
    - src/tools/write/update-task.ts
    - src/tools/read/list-tasks.ts
    - src/tools/read/index.ts
    - src/tools/write/index.ts
    - src/index.ts
    - package.json
    - README.md
    - CHANGELOG.md
    - tests/tools/create-task.test.ts
    - tests/tools/update-task.test.ts
    - tests/tools/list-tasks.test.ts
decisions:
  - "Task date field is dueDate (Y-m-d) / dueDateTime (Y-m-d\\TH:i:s\\Z UTC), NOT dateEnd — verified against live API: a POST with dateEnd is accepted (200) but the deadline is silently dropped (dueDate stays null). Reverses the incorrect 48577bf assumption that dateEnd was the real schema."
  - "One agent-facing param (due_date/start_date) accepting either a calendar date or an ISO timestamp; splitWeeekDate picks dueDate vs dueDateTime by presence of a time component. Naive datetimes are treated as UTC so behaviour is host-independent."
  - "list_tasks now surfaces startDate/dueDate/startDateTime/dueDateTime (with legacy dateStart/dateEnd as fallback) — previously it shaped only the always-null legacy fields, hiding every deadline."
  - "CRM deals are scoped to a funnel status. Create = POST /crm/statuses/{statusId}/deals (funnel inferred from status); list = GET /crm/statuses/{statusId}/deals (supports limit/offset, returns hasMoreDeals). /crm/deals 404s — verified empirically."
  - "No CRM delete/update-deal tools added — keeps the v1 'no delete for AI agents' posture; scope was read + create only."
metrics:
  duration: "~1 session"
  completed: "2026-07-13T17:08:01+03:00"
  commit: "8943498"
  pr: "https://github.com/MakarGlavanar/weeek-mcp/pull/2"
  tools_added: 5
  files_changed: 22
  tests_total: 119
---

# Quick Task 260713-acf: Task Deadlines Fix + CRM Deal Tools

**One-liner:** Fixed task deadlines silently never persisting (wrong `dateEnd` field → real `dueDate`/`dueDateTime`) and added a CRM deal workflow (funnels → statuses → list/create deals). 16 tools total (10 read + 6 write).

## Objective

Two user-driven needs:
1. **Deadlines broken.** `weeek_create_task` / `weeek_update_task` sent a `dateEnd` field the WEEEK API silently ignores, so due dates were never set. Ship the correct field mapping.
2. **CRM deals.** The server only touched the task manager. Add tools to create deals in the CRM.

## Tasks Completed

| Task | Name | Commit |
|------|------|--------|
| 1 | Live-API discovery: confirm real date fields + CRM endpoints | (investigation) |
| 2 | `_dates.ts` helper + fix create/update-task; surface dates in list-tasks | 8943498 |
| 3 | CRM read tools: list_funnels, list_funnel_statuses, list_deals | 8943498 |
| 4 | CRM write tool: create_deal | 8943498 |
| 5 | Tests (updated + new), README/CHANGELOG, version bump 0.2.0 | 8943498 |

## Outcome

- Server registers **16 tools**: 10 read + 6 write.
- Deadlines persist: `due_date` "2026-07-20" → `dueDate`; "2026-07-20T14:30:00Z" → `dueDateTime`.
- `weeek_list_tasks` now shows deadlines instead of always-null legacy fields.
- CRM: `weeek_list_funnels` → `weeek_list_funnel_statuses` → `weeek_create_deal` / `weeek_list_deals`.
- `tsc --noEmit` clean, ESLint clean, **119/119 tests pass**, `npm run build` OK.
- Verified end-to-end against the live workspace API (real funnels/statuses; task+deal created, read back, cleaned up).

## Deviations from Plan

### Process deviation
- **Work was done outside the GSD workflow** (direct edits + a single `git commit` + `CHANGELOG` + PR #2), not via `/gsd:quick`. This SUMMARY and the `STATE.md` decision entries were written afterwards to restore journal parity.

### Discoveries during verification
- **`DELETE /tm/tasks/{id}` is a soft delete.** Test tasks created during discovery returned HTTP 200 on delete but remain fetchable by id with `isDeleted: true`; they do NOT appear in default task lists / boards. So live-API test fixtures land in trash rather than being hard-removed — acceptable, but noted.
- **`dueDateTime` format is strict:** only `Y-m-d\TH:i:s\Z` (UTC `Z`). Offset (`+03:00`) and space-separated forms are rejected (400). `splitWeeekDate` normalizes any accepted input to this shape.

## Known Stubs

None.

## Follow-ups

- PR #2 (`anton_crm_fix` → `main`) awaiting review/merge by the repo owner.
- `dist/` is gitignored and rebuilt locally; the MCP client must reconnect to pick up new tools.
- Possible future scope: attach/create CRM contacts & organizations; update/move deal between statuses.

## Self-Check: PASSED

- `src/tools/write/_dates.ts` — exists, `splitWeeekDate` covered by `tests/tools/_dates.test.ts`
- `src/tools/read/index.ts` — registers 10 read tools; `src/tools/write/index.ts` — 6 write tools
- Commit 8943498 present in git log; PR #2 open
- `tsc --noEmit` clean; `vitest run` — 119/119 pass
