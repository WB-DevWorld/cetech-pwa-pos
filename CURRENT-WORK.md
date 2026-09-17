# Current work ledger

Updated 2026-09-17. Canonical repo `WB-DevWorld/cetech-pwa-pos`. Historical scheduler detail remains in Git/PR/evidence history. This file controls current assignment and implementation authority.

## Current authority

- `main`: `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` — squash-merged `[R8] Safe returns and payment/register states (#69)`. Protected. R8 post-merge CI run `35216668259` SUCCESS.
- Historical R7 on `main`: `1feb78db36f33e0254c0170396f30112d71577ea` — squash-merged `[R7] Verified electronic payment and reconciliation (#58)`. Post-merge CI `35136321143` SUCCESS.
- CD-01 chain remains in history: `#65` `a9db7ad…`, `#66` `97f6436…`, `#67` `6548906…`, `#68` `b85c5da…`. R6 remains `bd79c2901ce33c3177141d4244cc196be0a719d2`.
- ADR-012, ADR-014 and accepted ADR-015 are active; ownership-preserving milestone execution remains required.
- Issue #4 remains **OPEN**. `pricingParityVerified=false`. Production promotion is not authorized.
- Live Paystack / live electronic payment is not authorized. Live refund/restock is not authorized. VitePOS remains active.
- R10 / QA-01 is **not started**.

```text
human: @wbdevworld
workstream: WS3
mode: RECONCILE / INTEGRATE
task: R9-REC-01 — Reconcile reviewed CORE-07 + FE-07 onto final R8 main
```

R9 remains **DRAFT**. This ledger does not authorize marking PR #63 ready, merging it, closing CORE-07, or claiming installed-client/device evidence. Code reconciliation is not runtime-device acceptance.

## R6 / R7 / R8 (historical, accepted)

R6 PR #55 was squash-merged to `main` as `bd79c2901ce33c3177141d4244cc196be0a719d2`. Post-merge CI run `34966689340`: `control-plane` SUCCESS; `control-plane-windows` SUCCESS.

PAY-01 / #26 and integration issue #57 closed by squash merge of PR #58 as `1feb78db36f33e0254c0170396f30112d71577ea`. Preserved R7 evidence (no secrets): `docs/integration/evidence/R7-PAY-01-SANDBOX.md` (Woo **49449**); `docs/integration/evidence/R7-PAY-01-CONCURRENCY.md`.

R8 PR #69 squash-merged as `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`. Fail-closed historic return lookup and fail-closed shift variance remain in force on `main` and must not regress on the R9 candidate.

## Active assignment — R9-REC-01 R8-base reconciliation

- Milestone PR: **#63** — `[R9] PWA recovery, operational close and Store Health`. Keep **DRAFT**. Do not self-approve. Do not merge.
- Branch: `batch/r9-pwa-recovery-operational-close`.
- Historical R9 head (pre-reconciliation, R6-based): `13af56ca86d13657736b8c5156b73a8e79664130`. Independent review of that head is provenance only; this reconciliation changes the exact head.
- Historical merge base with current main: `bd79c2901ce33c3177141d4244cc196be0a719d2` (R6).
- Method: normal `--no-ff` merge of `origin/main` into the R9 branch. No rebase. No force push.
- Reconciliation evidence: `docs/integration/evidence/R9-R8-RECONCILIATION.md`.

Accepted R9 capabilities retained/adapted: PWA manifest/offline/icon/service worker, ReleasePolicy, lifecycle coordinator at the root POS boundary, durable tender activity, recovery diagnostics, Store Health FE-07, atomic operational close infrastructure behind the R8 BFF.

Operational close remains one production path:

```text
POST /api/pos/v1/shifts/close  → ApiResult<Shift>
GET  /api/pos/v1/shifts/{shiftId}/report?kind=...
RegisterPort.close(...): Promise<ApiResult<Shift>>
```

Zero variance closes and mints exactly one durable Z. Non-zero variance stays `requires_attention` with no Z and no `closedAt`. `approvalId` has zero close authority.

## Safety boundaries retained

- No real Woo refund or real stock disposition is authorized.
- No live Paystack/provider refund or live electronic payment is authorized.
- No production mutation, promotion, or VitePOS deactivation is authorized.
- Automated Playwright/service-worker mocks are not installed-client evidence.
- Final ADR-012 two-pass freshness is **not** claimed in this reconciliation pass (`NOT FINAL FRESHNESS`).

## Next milestone boundary

Stop at `R9_RECONCILED_CODE_READY_FOR_REVIEW`. Fresh independent review of the reconciled exact SHA is required. Installed-client/device runtime evidence remains pending. Do not start R10.
