# Current work ledger

Updated 2026-09-16. Canonical repo `WB-DevWorld/cetech-pwa-pos`. Historical scheduler detail remains in Git/PR/evidence history. This file controls current assignment and implementation authority.

## Current authority

- `main`: `97f64368880ea9838511eb3aacee97e2c2359f6d` — CD-01 PR #66 (Vercel CLI compatibility) on top of PR #65 staging deploy; protected. R6 remains `bd79c2901ce33c3177141d4244cc196be0a719d2` in history.
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
- Neutral branch: `batch/r7-electronic-payment-reconciliation`.
- Owner / integration editor: `@wbdevworld` / WS3.
- Milestone PR: **#58 draft**. Do not mark ready. Do not request reviewers, approve, or merge.
- FE-06 / returns / refunds / R8: **not authorized**.

```text
human: @wbdevworld
workstream: WS3
mode: INTEGRATE
task: PAY-01 / #26
```

PAY-01 source is imported onto the neutral branch. Control-plane review remediation (positive `sk_test_` requirement) is imported.

| Role | SHA |
| --- | --- |
| R7_ACTIVATION_SHA | `0c34694882e69282b9e3df66104197394c55294e` |
| PAY01_SOURCE_SHA (implementation) | `f79544e7fd815917cbc2d7688d6a8e67f485f998` |
| PAY01_SOURCE_SHA (FRESH_2) | `3352b7267984fd9125fdaa46196f176e6bf54e4a` |
| PAY01_IMPORT_SHA (implementation) | `15542c555ab65b7151bc115d377d9478dca1f3cd` |
| PAY01_IMPORT_SHA (FRESH_2) | `b049ff5446184be7a69fccef82daf5f588c6a6e9` |
| Prior combined head | `dd6c91c27035e0387938d819f880b71b515b338e` |
| REMEDIATION_SOURCE_SHA | `ac3340cf63eec771b194dd2c0d2eb54b2bf1b457` |
| REMEDIATION_IMPORT_SHA | `cc5666fd3b31fa45f7da0a9045002ad3c5c72741` |
| CONCURRENCY_REMEDIATION_SHA | `3ba954b0ad3ff112a93e4af0c87c4a0a0dc2fa12` |
| CD01_MAIN_SHA (PR #65) | `a9db7adcab8881d905df73b9536ed47a658cf1c9` |
| CD01_CLI_SHA (PR #66) | `97f64368880ea9838511eb3aacee97e2c2359f6d` |
| R7_CD01_MERGE_SHA | `3ee0e816170cd322c7666d84edc82de6f86057af` |
| R7_CD01_CLI_MERGE_SHA | `98aca59cdaa0d7dab99564877a9a6e2471d0522a` |

Allowed PAY-01 paths: `apps/pos-web/src/server/**`; `apps/pos-web/src/core/**`; `apps/pos-web/src/app/api/**`; `supabase/**`; `tests/integration/payments/**`. Bounded WS3 evidence/status/handoff and this ledger may be updated on the neutral branch for scheduler/activation/integration truth.

Forbidden: WS1 `apps/pos-web/src/features/**` and `src/ui/**`; WS2 plugin/tests as implementation work; frozen v1.0.0 contract widening unless a genuine unavoidable blocker is recorded; live Paystack/MoMo/card; production; refunds; opening/merging the R7 PR. A Paystack TEST sandbox on `training.cetechbpa.com` is authorized only when the TEST secret is already present in the POS process through the approved secret mechanism. Do not copy secrets from staging into git, prompts, or evidence.

### Provider boundary

Repository truth has no newer explicit provider decision. Initial concrete sandbox provider is **Paystack test mode**. Canonical POS payment state remains provider-neutral. Provider-specific concepts stay behind an adapter. Fail closed if configuration appears live (`R7_BLOCKED_LIVE_PROVIDER_CONFIGURATION`).

Authorized only if TEST credentials already exist through an approved local/staging secret mechanism. Do not retrieve, print, rotate, or commit secrets. Do not perform live electronic payments. Do not copy a staging secret into this workstation in order to run the POS adapter.

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
PAYMENT PROVIDER SANDBOX GATE: PASS
```

Paystack TEST credentials were supplied externally through the approved gitignored Next `.env.local` (sibling `apps/pos-web` checkout). The secret was never committed or documented. TEST sandbox execution used `https://training.cetechbpa.com`. Woo order **49449**, POS transaction `8a9959df-4f82-4a25-9792-b058886ed69a`, sanitized Paystack TEST reference `pos_2f0b5a038deb47c68aa36a7b9551b098`, GHS 29.00, durable payment `verified`, sale `completed`. Evidence: `docs/integration/evidence/R7-PAY-01-SANDBOX.md` (preserved; no second TEST charge). Milestone freshness: `docs/integration/evidence/R7-PAY-01-MILESTONE-FRESHNESS.md` (**RECONCILED_2**, cutoff `97f6436…`). Combined R7 head contains current `origin/main`. PR **#58** remains draft pending independent review; do not merge from this ledger.
