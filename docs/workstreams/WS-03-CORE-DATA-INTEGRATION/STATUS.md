# WS3 current status

Snapshot 2026-09-18. Protected `main` `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` is accepted/merged R8 PR #69. Active contributor work is REC-01 on `ws3/receipt-product-name-sku`. Do not merge this branch from this status file. Do not deploy production.

## REC-01 (active)

Mode: IMPLEMENT. Owner `@wbdevworld` / WS3. Branch `ws3/receipt-product-name-sku` from `origin/main` `778348c…`.

Additive `ReceiptLine.displayName`/`sku`, `ReceiptSettings`, sale-time catalog presentation snapshot, `pos_receipt_settings`, and additive `pos_pending_operations.intent_snapshot` bound before `SalesPort.prepare`. Compact POS wrapping remains WS1. Remote staging apply UNVERIFIED; production not touched.

## R8 (historical)

PR #69 squash-merged as `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`. R8-02 runtime remediation is historical. Do not reopen `batch/r8-safe-returns-reconciliation` for new work.

## R7 (historical)

PR #58 squash-merged as `1feb78db36f33e0254c0170396f30112d71577ea`. Paystack TEST sandbox evidence remains `docs/integration/evidence/R7-PAY-01-SANDBOX.md` (Woo **49449**). Live Paystack is still not authorized.

## Remaining disposition

Independent review of REC-01 after the published contributor head. Ben/WS1 consumes frozen `displayName ?? name` and optional `sku` later. Compact two-line POS UI is a separate frontend task. Production, live Paystack, live refund/restock, and VitePOS deactivation remain NOT AUTHORIZED.
