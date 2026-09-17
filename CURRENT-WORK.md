# Current work ledger

Updated 2026-09-16. Canonical repo `WB-DevWorld/cetech-pwa-pos`. Historical scheduler detail remains in Git/PR/evidence history. This file controls current assignment and implementation authority.

## Current authority

- `main`: `1feb78db36f33e0254c0170396f30112d71577ea` — squash-merged `[R7] Verified electronic payment and reconciliation (#58)`. Protected. Post-merge CI run `35136321143` SUCCESS.
- CD-01 chain remains in history: `#65` `a9db7ad…`, `#66` `97f6436…`, `#67` `6548906…`, `#68` `b85c5da…`. R6 remains `bd79c2901ce33c3177141d4244cc196be0a719d2`.
- ADR-012, ADR-014 and accepted ADR-015 are active; ownership-preserving milestone execution remains required.
- Issue #4 remains **OPEN**. `pricingParityVerified=false`. Production promotion is not authorized.
- Live Paystack / live electronic payment is not authorized. Live refund/restock is not authorized. VitePOS remains active.
- R9 is **not** imported. CORE-07, FE-07, Store Health, new PWA lifecycle, and operational-close/Z-report work stay downstream.

```text
human: @wbdevworld
workstream: WS3
mode: INTEGRATE / REMEDIATE
task: R8-02 — Emmanuel exact-head WS1/WS3 runtime remediation
```

Ben `APPROVED` exact head `79dab6096466e00fd8289300038f07619868f539`. Emmanuel `CHANGES_REQUESTED` the same head. This assignment remediates Emmanuel's two runtime blockers (fabricated receipt `orderLineId`; invented shift-variance `approvalId`). Do not dismiss either review. Do not merge PR #69.

## R6 closure (historical)

R6 PR #55 was squash-merged to `main` as `bd79c2901ce33c3177141d4244cc196be0a719d2`. Post-merge CI run `34966689340`: `control-plane` SUCCESS; `control-plane-windows` SUCCESS. Woo order `49439` is historical R6 training evidence. No second training commercial sale is authorized.

## R7 — merged to protected main

PAY-01 / #26 and integration issue #57 closed by squash merge of PR #58 as `1feb78db36f33e0254c0170396f30112d71577ea`.

Historical provisional R7 head used only as the R8 delta base (not current authority): `9ab7e5b7cf2b5d4f253f9d41468726c31cbfc091`.

Preserved R7 evidence (no secrets):

- `docs/integration/evidence/R7-PAY-01-SANDBOX.md` — Paystack TEST sandbox PASS on `https://training.cetechbpa.com`; Woo **49449**.
- `docs/integration/evidence/R7-PAY-01-CONCURRENCY.md` — monotonic payment/sale transitions.
- `docs/integration/evidence/R7-PAY-01-MILESTONE-FRESHNESS.md`.

R7 fail-closed rules remain in force on `main` and must not regress on the R8 candidate: browser callback is not payment truth; server verification binds reference / POS transaction / order / amount / currency; Paystack execution only when `PAYMENT_PROVIDER=paystack`, `PAYSTACK_MODE=test`, `sk_test_` present; refuse `sk_live_` and `NEXT_PUBLIC_PAYSTACK_SECRET`; verified payments and `finalizing`/`completed` sales are monotonic.

## Active assignment — R8-02 runtime remediation

- Milestone PR: **#69** — `[R8] Safe returns and payment/register states`. Do not self-approve. Do not merge from this ledger.
- Recovery/integration branch: `batch/r8-safe-returns-reconciliation`.
- Starting exact head: `79dab6096466e00fd8289300038f07619868f539` (Ben APPROVED; Emmanuel CHANGES_REQUESTED).
- First R8-02 replacement: `0fe28d353002ef8836eb2739ed9174517da7846b`. This close-out tightens lookup authorization (cross-org `NOT_FOUND`, unauthorized location, non-completed/unknown sale) without redesigning R8.
- Prior R8-01 remediation (economicsVersion, persisted allocations, BFF composition, non-negative allocation migration) remains in history and must not be rewritten.
- This assignment remediates Emmanuel's two WS1/WS3 runtime blockers: authorized historic return-sale lookup using durable `orderLines[].orderLineId`, and fail-closed shift variance that ignores invented `approvalId`.
- Remediation evidence: `docs/integration/evidence/R8-REVIEW-REMEDIATION.md`.

Accepted contract:

- ADR-015 / return-refund contract exact head `58d385300bfba784435448029e88f07742048cde`.
- Required cross-owner contract reviews: Ben / WS1 APPROVED; Emmanuel / WS2 APPROVED.

Accepted owner implementations (historical provenance):

- WS3 RT-01 runtime source `4650a0fa18c909743e9fbab4be0b6067bd1eff18`.
- BR-08 / #60 WS2 source `dcf9098a331f878647e067fc78b3c05778f8f668` — CLOSED / COMPLETED.
- FE-06 / #11 WS1 source `0ddde7c727337c4005e9878071817bbf826d41a2`; remediation includes `d3ddf0a7592845c710fe768b3645b9a9109693cb` — CLOSED / COMPLETED.

Combined downstream receiver (pre-final-R7 rebase/reconcile):

- branch: `batch/rt01-safe-returns-ws3-integrated`
- BR-08 import: `79d9270a418ec958ffd716b7a20a8d1c213b5e8d`
- FE-06 import: `bc521c598b834930d2fd6b56c8225b2b08a3ec2a`
- exact integrated receiver: `d54a916946a6dcf0dfbc636d93528ac58a77ca1b`
- accepted downstream head: `5fa875eb43c0b2f62b59b80a3dfa3812c2d1e190`
- PR #62 combined CI `35017127991`: Linux + Windows SUCCESS.
- post-integration receiver CI `35017460256`: Linux + Windows SUCCESS.

Reconciliation evidence: `docs/integration/evidence/R8-FINAL-R7-RECONCILIATION.md`.

Recommended independent review coverage (do not self-approve): Ben reviews WS2/WS3 integration portions, not his own FE-06 as independent coverage; Emmanuel reviews WS1/WS3 integration portions, not his own BR-08 as independent coverage.

## R8 safety boundaries retained

- No real Woo refund or real stock disposition is authorized by this milestone.
- No live Paystack/provider refund or live electronic payment is authorized.
- No production mutation, promotion, or VitePOS deactivation is authorized.
- Historic sale economics remain authoritative for returns/refunds.
- Tender refund, Woo commercial refund accounting and physical stock disposition remain independent effects with independent durable identities/idempotency and resolve paths.
- Damaged, quarantine and not-physically-returned goods must not auto-restock sellable stock.
- Unknown provider refund results use the existing refund/effect identity (`resolve`), not a second money effect.
- `opened_resellable` / `defective` remain fail-closed without an approved tenant restock policy.
- Concrete Paystack refund create remains fail-closed where the provider cannot satisfy the accepted durable idempotency/recovery contract.

## Next milestone boundary

R9 (`batch/r9-pwa-recovery-operational-close`) remains downstream and is not part of this reconciliation. Do not merge PR #69 from this ledger. Controlled training refund/restock rehearsal remains a remaining gate if independently authorized later; it is not executed here.
