# Current work ledger

Updated 2026-09-15. Canonical repo `WB-DevWorld/cetech-pwa-pos`. Historical scheduler detail remains in Git/PR/evidence history. This file controls current assignment and implementation authority.

## Current authority

- `main`: `bd79c2901ce33c3177141d4244cc196be0a719d2` — R6 PR #55 merge; protected.
- ADR-012 and ADR-014 are active; ownership-preserving milestone execution remains required.
- Issue #4 remains **OPEN**. `pricingParityVerified=false`. Production promotion is not authorized.
- Live electronic payment is not authorized. R8 is not started. R7 is not merged.

## R6 closure

R6 PR #55 was squash-merged to `main` as `bd79c2901ce33c3177141d4244cc196be0a719d2`. Post-merge CI run `34966689340`: `control-plane` SUCCESS; `control-plane-windows` SUCCESS.

Closed as completed:

- CORE-06 / #25
- R6-00 / #54
- CORE-HARDEN-07 / #56

Issue #4 remains OPEN. Woo order `49439` is historical R6 training evidence. R6-REM-01 and R6-REM-02 leases expired when PR #55 merged. No second training commercial sale is authorized.

## Active assignment — R7 electronic payment and reconciliation

- Integration issue: **#57** — `[R7-00] Integrate verified electronic payment and reconciliation`.
- Implementation task: **PAY-01 / #26** — `[PAY-01] Implement verified electronic payment and reconciliation`.
- Neutral branch: `batch/r7-electronic-payment-reconciliation` (starts at exact post-R6 `main`).
- Owner / integration editor: `@wbdevworld` / WS3.
- Milestone PR: **not opened**. ChatGPT owns later GitHub review-control. Do not open, request reviewers, approve, or merge.
- FE-06 / returns / refunds / R8: **not authorized**.

```text
human: @wbdevworld
workstream: WS3
mode: INTEGRATE
task: PAY-01 / #26
```

PAY-01 source is imported onto the neutral branch.

| Role | SHA |
| --- | --- |
| R7_ACTIVATION_SHA | `0c34694882e69282b9e3df66104197394c55294e` |
| PAY01_SOURCE_SHA (implementation) | `f79544e7fd815917cbc2d7688d6a8e67f485f998` |
| PAY01_SOURCE_SHA (FRESH_2) | `3352b7267984fd9125fdaa46196f176e6bf54e4a` |
| PAY01_IMPORT_SHA (implementation) | `15542c555ab65b7151bc115d377d9478dca1f3cd` |
| PAY01_IMPORT_SHA (FRESH_2) | `b049ff5446184be7a69fccef82daf5f588c6a6e9` |

Allowed PAY-01 paths: `apps/pos-web/src/server/**`; `apps/pos-web/src/core/**`; `apps/pos-web/src/app/api/**`; `supabase/**`; `tests/integration/payments/**`. Bounded WS3 evidence/status/handoff and this ledger may be updated on the neutral branch for scheduler/activation/integration truth.

Forbidden: WS1 `apps/pos-web/src/features/**` and `src/ui/**`; WS2 plugin/tests as implementation work; frozen v1.0.0 contract widening unless a genuine unavoidable blocker is recorded; live Paystack/MoMo/card; production; refunds; a second training Woo sale; opening/merging the R7 PR.

### Provider boundary

Repository truth has no newer explicit provider decision. Initial concrete sandbox provider is **Paystack test mode**. Canonical POS payment state remains provider-neutral. Provider-specific concepts stay behind an adapter. Fail closed if configuration appears live (`R7_BLOCKED_LIVE_PROVIDER_CONFIGURATION`).

Authorized only if TEST credentials already exist through an approved local/staging secret mechanism. Do not retrieve, print, rotate, or commit secrets. Do not perform live electronic payments. Do not create another training Woo order.

### R7 safety limits

- Server verification binds amount, currency, and order.
- Duplicate / out-of-order callbacks are safe.
- Pending does not re-charge.
- Reconciliation recovers unknown outcomes without a second initialize.
- Browser success is not payment truth.
- Cash R6 invariants remain mandatory.
- Production promotion: NOT AUTHORIZED.
- Live electronic payment: NOT AUTHORIZED.
- R8: NOT STARTED.
- R7: NOT MERGED.

### Sandbox gate

```text
PAYMENT PROVIDER SANDBOX GATE: BLOCKED_SANDBOX_CREDENTIALS
```

No approved local TEST secret was present. Automated PAY-01 proof uses the fake provider. This is not milestone acceptance.
