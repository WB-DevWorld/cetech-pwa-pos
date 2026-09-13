# R4 OperationJournal idempotency remediation

NEW ADR-012 continuation. Not Pass 3 of the assembled-R4 session. Start snapshot: `R4-JOURNAL-IDEMPOTENCY-START-FRESHNESS.md` UTC `2026-09-13T21:25:29Z`.

Pre-handoff implementation SHA: `11bdbd9c6bb5004e9dd70a203a53becdf191728e`
Prior assembled #41 head: `76218ffaeb41c27eb568a2a27c461bbb70a14db8`
Base: `origin/main` `516d6a49af74cc6677f67bdf843de6e819a05feb`

Contracts: OperationJournal v1.0.0 consumed; **none changed**.
Issue #4: OPEN. R5: not started. Production untouched. No quote/R3/payment/prepare edits.

## Defect

`appendBeforeSend` treated same `(operation, idempotencyKey)` + different `requestHash` as reuse when the existing row was `acknowledged`. Frozen v1 semantics: identical intents reuse keys; a different canonical payload must never reuse the key.

## Behavior now

| Existing row | Incoming | Result |
| --- | --- | --- |
| any status, same hash | same key | reuse / no-op; no new row |
| any status, different hash | same key | `IDEMPOTENCY_CONFLICT`; original payload and `requestHash` unchanged |

No automatic key rotation. Acknowledged rows are not deleted or overwritten.

## Files

- `apps/pos-web/src/local/operation-journal.ts`
- `tests/integration/sync/operation-journal.test.ts`
- this evidence / STATUS / HANDOFF / CURRENT-WORK

## Combined-tree commands (Node 24.21.0, pnpm 12.4.1)

```text
python scripts/verify_control_plane.py
python -m unittest discover -s tests/tooling -v
pnpm install --frozen-lockfile
pnpm --dir apps/pos-web lint
pnpm --dir apps/pos-web typecheck
pnpm --dir apps/pos-web test
pnpm --dir apps/pos-web build
pnpm --dir apps/pos-web test:e2e
pnpm --dir apps/pos-web exec playwright test --config ../../tests/frontend/visual/playwright.config.ts
git diff --check
```

| Command | Result |
| --- | --- |
| control-plane | PASS |
| tooling | **48 tests OK** |
| frozen install | PASS |
| lint | PASS |
| typecheck | PASS |
| Vitest | **42 files / 232 tests PASS** (do not reuse 229) |
| production build | PASS |
| App E2E | **1 passed** |
| Isolated visual Playwright | **12 passed** |
| `git diff --check` | clean |

Journal regressions in the 232: pending conflict, acknowledged conflict, acknowledged identical reuse, original payload/hash retained; existing append-before-send/reload/response_unknown/requires_attention/secret tests preserved.

Independent reviewer for this head: **@Emmanuel-coder-prog** (PR author @Ben-001-sys cannot satisfy independent approval). Assembling editor will not self-approve or merge.
