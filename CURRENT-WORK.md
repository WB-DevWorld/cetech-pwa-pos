# Current work ledger

Updated 2026-09-15. Canonical repo `WB-DevWorld/cetech-pwa-pos`. Historical scheduler detail remains in Git/PR/evidence history. This file controls current assignment and implementation authority for this branch.

## Current authority

- `main`: `bd79c2901ce33c3177141d4244cc196be0a719d2` — R6 PR #55 merged / post-merge verified.
- ADR-012 and ADR-014 remain active; ownership-preserving milestone execution is required.
- Issue #4 remains **OPEN**. `pricingParityVerified=false`. Production promotion is not authorized.
- R7 / PAY-01 remains **PROVISIONAL_TEST / sandbox-deferred** on `batch/r7-electronic-payment-reconciliation` at code-ready head `9ab7e5b7cf2b5d4f253f9d41468726c31cbfc091`; PR #58 remains draft and unmerged.
- RT-01 combined safe-returns work is integrated on `batch/rt01-safe-returns-ws3-integrated`; it is not the base of this CORE-07 branch and does not authorize live refund/restock/provider effects.

## Active assignment — CORE-07 safe PWA lifecycle and operational close

- Task: **CORE-07 / #28** — `Implement safe PWA lifecycle and operational close`.
- Workstream / owner: **WS3 / @wbdevworld**.
- Mode: **IMPLEMENT**.
- Contributor branch: `ws3/core-07-implement-safe-pwa-lifecycle-and-operational-`.
- Start/base SHA: `bd79c2901ce33c3177141d4244cc196be0a719d2` (current R6 `main`).
- Dependency: CORE-06 — **SATISFIED** by R6 merge.
- Milestone plan explicitly permits CORE-07 to proceed after CORE-06 concurrently with payment/returns work.

```text
human: @wbdevworld
workstream: WS3
mode: IMPLEMENT
task: CORE-07 / #28
```

### Authorized implementation scope

Use the issue-declared CORE-07 paths only:

- `apps/pos-web/src/local/**`
- `apps/pos-web/src/core/**`
- `apps/pos-web/src/server/**`
- `apps/pos-web/public/**`
- `supabase/**`
- `tests/integration/recovery/**`
- WS3-owned `STATUS.md` / `HANDOFF.md` for evidence and task handoff

This `CURRENT-WORK.md` edit is integration-control/scheduler truth and does not broaden the task's product-code ownership.

Forbidden without new recorded authority:

- WS1 `apps/pos-web/src/features/**` and `apps/pos-web/src/ui/**`
- WS2 WordPress/plugin implementation
- root dependency/lockfile changes
- frozen v1.0.0 contract widening unless a genuine defect triggers the coordinated contract-change process
- production deployment or promotion
- live electronic payment
- live refund/restock
- VitePOS cutover

## CORE-07 required behavior

1. Controlled service-worker/update lifecycle; no disruptive activation during active tender, unresolved critical operation, sync mutation, or unsafe local migration state.
2. Preserve critical IndexedDB/local business state across updates and reconnects; never use blanket cache/IndexedDB clearing as normal repair.
3. Versioned local schema migration and multi-tab coordination/leadership sufficient to prevent conflicting update/migration ownership.
4. Non-destructive recovery/repair path with truthful diagnostics.
5. Atomic blind register close: expected cash remains server-owned; cashier submits counted cash only.
6. Retain variance/evidence and make close retries idempotent.
7. Exactly one immutable Z report for the logical close operation, including retries/lost responses.
8. Existing R6 cash-sale, transaction-recovery, auth, RLS, and receipt invariants must remain green.

## Acceptance / evidence

Before handoff, record exact source SHA(s), changed paths, migrations/ADRs/contracts, test commands/results, limitations, and unresolved risks.

Required tests include at least:

- `python3 scripts/verify_control_plane.py`
- `pnpm --dir apps/pos-web lint`
- `pnpm --dir apps/pos-web typecheck`
- `pnpm --dir apps/pos-web test`
- `pnpm --dir apps/pos-web test:e2e`
- relevant Supabase reset/pgTAP when migrations or database close semantics are changed
- focused recovery/update/multi-tab/close retry tests
- `git diff --check`

Then publish the normal ADR-012 exactly-two freshness observations and stop. **No Pass 3.**

## Parallel/deferred boundaries

R7 Paystack sandbox acceptance remains a separate human/secret boundary. Do not weaken, bypass, or mark that gate complete from CORE-07.

RT-01 code may later be combined at the milestone integration layer, but this contributor branch starts from accepted `main` to keep CORE-07 independent of provisional R7/returns branches.

Production promotion remains **NOT AUTHORIZED**.
