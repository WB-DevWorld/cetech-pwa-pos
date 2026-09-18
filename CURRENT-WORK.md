# Current work ledger

Updated 2026-09-18. Canonical repo `WB-DevWorld/cetech-pwa-pos`. Historical scheduler detail remains in Git/PR/evidence history. This file controls current assignment and implementation authority.

## Current authority

- `main`: `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` — squash-merged `[R8] Safe returns and payment/register states (#69)`. Protected. Observed 2026-09-18 via `git fetch origin`.
- Previous accepted R7 remains in history: `1feb78db36f33e0254c0170396f30112d71577ea`. CD-01 chain `#65`–`#68`. R6 remains `bd79c2901ce33c3177141d4244cc196be0a719d2`.
- ADR-012, ADR-014, accepted ADR-015, and ADR-016 (receipt product-name/SKU snapshot) are active; ownership-preserving milestone execution remains required.
- Issue #4 remains **OPEN**. `pricingParityVerified=false`. Production promotion is not authorized.
- Live Paystack / live electronic payment is not authorized. Live refund/restock is not authorized. VitePOS remains active.
- R9 is **not** imported by this assignment. Compact POS two-line product-name wrapping is WS1 follow-on, not this WS3 foundation.

```text
human: @wbdevworld
workstream: WS3
mode: IMPLEMENT
task: REC-01 — receipt product-name / SKU snapshot and operational settings
```

Senior-authorized WS3 foundation. Branch `ws3/receipt-product-name-sku` from `origin/main` `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`. Do not merge main from this ledger. Do not deploy production. WS1 compact-UI / receipt-paper rendering is a later Ben task after this head is published.

## R6 closure (historical)

R6 PR #55 was squash-merged to `main` as `bd79c2901ce33c3177141d4244cc196be0a719d2`. Post-merge CI run `34966689340`: `control-plane` SUCCESS; `control-plane-windows` SUCCESS. Woo order `49439` is historical R6 training evidence. No second training commercial sale is authorized.

## R7 — merged to protected main

PAY-01 / #26 and integration issue #57 closed by squash merge of PR #58 as `1feb78db36f33e0254c0170396f30112d71577ea`.

Historical provisional R7 head used only as the R8 delta base (not current authority): `9ab7e5b7cf2b5d4f253f9d41468726c31cbfc091`.

Preserved R7 evidence (no secrets):

- `docs/integration/evidence/R7-PAY-01-SANDBOX.md` — Paystack TEST sandbox PASS on `https://training.cetechbpa.com`; Woo **49449**.
- `docs/integration/evidence/R7-PAY-01-CONCURRENCY.md` — monotonic payment/sale transitions.
- `docs/integration/evidence/R7-PAY-01-MILESTONE-FRESHNESS.md`.

R7 fail-closed rules remain in force on `main` and must not regress: browser callback is not payment truth; server verification binds reference / POS transaction / order / amount / currency; Paystack execution only when `PAYMENT_PROVIDER=paystack`, `PAYSTACK_MODE=test`, `sk_test_` present; refuse `sk_live_` and `NEXT_PUBLIC_PAYSTACK_SECRET`; verified payments and `finalizing`/`completed` sales are monotonic.

## R8 — merged to protected main

PR #69 squash-merged as `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`. R8-02 runtime remediation is historical. Do not reopen `batch/r8-safe-returns-reconciliation` for new work.

## Active assignment — REC-01 receipt product-name / SKU

- Contributor branch: `ws3/receipt-product-name-sku`.
- Base: `origin/main` `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`.
- Allowed: WS3 contracts, `apps/pos-web/src/core/**`, `apps/pos-web/src/server/**`, `apps/pos-web/src/app/api/**`, `supabase/**`, `docs/**`, `tests/contracts/**`, `tests/integration/**` as needed for this feature.
- Forbidden: WS1 compact-UI / `ProductSearch.tsx` / `sell.css` / cart presentation; WS2 plugin; production deploy; merge to main from this ledger.
- Contract: ADR-016 additive `ReceiptLine.displayName`/`sku` and `ReceiptSettings`. Quote pricing unchanged.
- Migration: additive `20260918140000_pos_receipt_settings.sql` only. Applied on local Docker `supabase_db_cetech-pwa-pos`. Remote staging UNVERIFIED. Production not touched.

## R8 provenance (historical)

Accepted contract:

- ADR-015 / return-refund contract exact head `58d385300bfba784435448029e88f07742048cde`.
- Required cross-owner contract reviews: Ben / WS1 APPROVED; Emmanuel / WS2 APPROVED.

Accepted owner implementations (historical provenance):

- WS3 RT-01 runtime source `4650a0fa18c909743e9fbab4be0b6067bd1eff18`.
- BR-08 / #60 WS2 source `dcf9098a331f878647e067fc78b3c05778f8f668` — CLOSED / COMPLETED.
- FE-06 / #11 WS1 source `0ddde7c727337c4005e9878071817bbf826d41a2`; remediation includes `d3ddf0a7592845c710fe768b3645b9a9109693cb` — CLOSED / COMPLETED.

## R8 safety boundaries retained

- No real Woo refund or real stock disposition is authorized by this assignment.
- No live Paystack/provider refund or live electronic payment is authorized.
- No production mutation, promotion, or VitePOS deactivation is authorized.
- Historic sale economics remain authoritative for returns/refunds.

## Next milestone boundary

R9 (`batch/r9-pwa-recovery-operational-close`) remains downstream. Compact POS two-line product-name wrapping is a separate WS1 task after REC-01 is published. Do not merge this branch from this ledger. Production promotion is not authorized.
