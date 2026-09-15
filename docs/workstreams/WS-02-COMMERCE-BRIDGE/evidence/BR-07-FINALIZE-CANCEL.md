# BR-07 / issue #19 — verified commercial finalize and cancel

Kind: TASK_COMPLETION evidence (WS2). Not live Woo/HPOS write evidence. Not a real DB concurrency PASS.

## Uncertain-money cancel safety remediation (2026-09-14)

Prior published head: `e15fbe09af261ecf6647ac8c6e778b42c08d96f3`  
Implementation parent: `78c8403697ac2f925cdf189b5d2f705c5da6b3a5`  
Remediation SHA: `af9fab2f19e496481d3dd627a64419f880282cd6`

Gap: `GET_LOCK` serialized live finalize/cancel, but process/connection death released the lock while a durable finalize claim could remain `PENDING` or `IN_PROGRESS` with Woo still unpaid. Cancel ignored those states and could `wc_release_stock_for_order` + cancel the order while verified money was unresolved.

Fix: while holding the shared transaction mutation lock, cancel inspects the durable finalize claim **before** reservation release or Woo cancellation. `STATUS_PENDING` and `STATUS_IN_PROGRESS` return canonical `PAYMENT_PENDING` (409, nextAction=resolve). `OPERATION_IN_PROGRESS` remains lock-acquisition failure only.

Cancel-command persistence: this `PAYMENT_PENDING` is **not** stored as `TERMINAL_FAILURE`. The cancel claim stays nonterminal (`PENDING` from insert) so the same Idempotency-Key can reevaluate if the finalize command later reaches a definitive no-effect or completed state. The claim is not deleted. Financial dedupe indexes are unchanged. DB version remains **4**. No schema/index/wire/error-code changes.

| Case | Result |
| --- | --- |
| F1 crash → cancel | `PAYMENT_PENDING`; release=0; cancel=0; payment_complete=0; order=1; original finalize retry `completed` once |
| IN_PROGRESS crash → cancel | same safety; `after_finalize_in_progress` seam after IN_PROGRESS persist, before bind/`payment_complete` |
| CASE A finalize-wins | nested cancel `OPERATION_IN_PROGRESS`; later cancel `PAYMENT_PENDING`; payment_complete=1; stock=1; release=0; cancel=0 |
| CASE B cancel owns lock + nested verified finalize claim | nested finalize `OPERATION_IN_PROGRESS`; durable PENDING claim exists; outer cancel `PAYMENT_PENDING`; then original finalize retry `completed`; payment_complete=1; stock=1; release=0; cancel=0 |
| CASE C true cancel-before-finalize | cancel `cancelled`; release/cancel ≤1; late first finalize `requires_attention`; payment_complete=0; no second order |

GET after PENDING finalize remains observational `finalizing` with zero Woo writes.

Contracts changed = NO. DB version = 4 unchanged. ADRs = NO. Supabase = NO. Pricing formulas copied = NO. `pricingParityVerified=false`. Live HPOS rehearsal=PENDING. Real DB concurrency=PENDING. Issue #4 OPEN. CORE-06 NOT STARTED. FE-05 NOT TOUCHED.

Verification of this remediation: `make test` **1297 passed / 0 failed**; parity **138 / 0 / 19**; check PASS (42 files); control-plane PASS; derive `--check` PASS; `git diff --check` clean.

Freshness (new owner-remediation cycle, not Pass 3 of the previous BR-07 cycle): START 2026-09-14T22:59:22Z; PASS 1 2026-09-14T22:59:35Z; PASS 2 2026-09-14T23:00:02Z. main `bc606a6…`. batch `8dabbde…`. No newer WS3 authority. Classification: **FRESH_2**.

## Original BR-07 delivery (historical; superseded for cancel-safety by the section above)

- Task: BR-07 / issue #19
- R6 integration issue: #54
- R6 milestone PR: #55 (draft; WS2 does not alter PR code)
- Owner / actual implementer: @Emmanuel-coder-prog / WS2
- Source branch: `ws2/br-07-implement-verified-commercial-finalization-an`
- Starting R5 main SHA: `bc606a690f0c167b7057e3ae9143337404275882`
- Observed R6 neutral SHA at activation/work: `8dabbde2af91b3aa31f00ae159b5f8cd7a3280a9` (FE-05 import only; not a BR-07 ownership/contract drift)
- Implementation SHA: `78c8403697ac2f925cdf189b5d2f705c5da6b3a5`
- Plugin version: `0.4.0-br07`
- Frozen contracts: v1.0.0 **READ-ONLY** (no `docs/contracts/**` edits)
- ADRs: **NONE**
- Supabase: **NONE**
- Dependencies added: **NONE**
- CORE-06: **NOT STARTED**
- FE-05: **NOT TOUCHED**
- Neutral R6 branch: **NOT MODIFIED**
- Shared `CURRENT-WORK.md`: **NOT MODIFIED**
- `pricingParityVerified`: **false**
- Issue #4: **OPEN**
- Live HPOS finalize/cancel rehearsal: **PENDING** (no R6 write-rehearsal authority)
- Real DB concurrency: **PENDING** (deterministic in-memory interleaving only)

## Contracts

NO expected / NO observed. Canonical `docs/contracts/**` untouched.

Mechanical bridge schema derivation roots added (sorted, artifact only):

- `BridgeFinalizeRequest`
- `CancelSaleRequest`

`VerifiedPaymentEvidence` enters transitively from `BridgeFinalizeRequest`. Existing roots remain: `QuoteRequest`, `Quote`, `PrepareSaleRequest`, `PreparedSale`, `SaleResolution`.

Shipped artifact: `wordpress/cetech-pos-bridge/schema/quote-contract.v1.json`. Canonical authority remains `docs/contracts/pos-domain.schema.json`. Derive `--check` PASS.

## DB migration

YES.

- Prior `DB_VERSION`: **3**
- Final `DB_VERSION`: **4**
- New table: `wp_cetech_pos_command_claims` (`cetech_pos_command_claims` with `$wpdb->prefix`)
- Install: version-gated `maybe_upgrade` / idempotent `dbDelta`; both prepare + command CREATE TABLE SQL on activate
- No DDL per request
- No Woo table mutation
- No Supabase changes
- BR-06 `cetech_pos_prepare_claims` uniqueness **unchanged** (`uniq_idempotency`, `uniq_transaction`, `uniq_recovery_token`)

Indexes on command claims:

- `UNIQUE uniq_idempotency (site_scope, operation_type, idempotency_key)`
- `UNIQUE uniq_command (site_scope, transaction_id, operation_type)`
- `UNIQUE uniq_payment (site_scope, payment_id)` — NULL allowed (cancel)
- `UNIQUE uniq_evidence (site_scope, evidence_id)` — NULL allowed (cancel)

Persisted: site scope, operation, Idempotency-Key, transactionId, semantic request hash, paymentId/evidenceId when applicable, internal status, outcome JSON, canonical error fields, timestamps. No secrets. No provider payload dumps. Financial dedupe indexes are not expired casually.

Rollback limitation: DB v4 is additive. Reverting plugin code without dropping the new table leaves unused command-claim rows; there is no automated down-migration.

## Finalize claim design

Separate durable row in `cetech_pos_command_claims` with `operation_type=finalize`.

- Same key + same semantic hash → prior outcome
- Same key + different hash → `409 IDEMPOTENCY_CONFLICT`
- Same transaction + same operation under a different key: recover completed SaleResolution when the commercial effect is already bound; different payment/evidence against an already-bound sale → `requires_attention` / fail-closed
- Duplicate `paymentId` or `evidenceId` on another sale → `PAYMENT_NOT_VERIFIED` (no second commercial effect)
- Commercial effect does not start before the durable command claim exists
- In-progress mutation lock miss → `202 OPERATION_IN_PROGRESS`

## Cancel claim design

Same table, `operation_type=cancel`. Same idempotency uniqueness. Same transaction+operation uniqueness. paymentId/evidenceId remain NULL.

Frozen `CancelSaleRequest` is only `{transactionId, reason}`. Bridge does **not** receive PaymentState on the wire. Safe cancellation is implemented by fail-closed inspection of:

- BR-06 prepare mapping
- competing finalize command state
- Woo paid / payment-binding / cancelled / contradictory commercial snapshot

This is **not** a CONTRACT BLOCKER: the frozen wire is sufficient because the bridge never pretends it independently knows upstream payment-provider state, and it refuses cancel whenever local money uncertainty is visible.

## Transaction mutation lock

Shared by finalize and cancel. Identity: `GET_LOCK('cetech_pos_tx_' . md5(site_scope|transactionId), 0)`. Memory harness models the same name with an in-process flag. Not the BR-06 prepare creator lock. Failure to acquire → `OPERATION_IN_PROGRESS`.

Race proof is **deterministic in-memory interleaving** (nested call while the lock is held). It is **not** a real DB concurrency PASS.

## Payment evidence binding

Server `VerifiedPaymentEvidence` only. Binding before Woo:

- `request.transactionId` == `payment.transactionId` == prepare claim transaction
- `payment.saleId` == PreparedSale.saleId == prepare mapping
- `payment.amount.minor` == PreparedSale.total.minor
- `payment.amount.currency` == PreparedSale.total.currency
- Woo order identity from PreparedSale.orderReference / prepare `woo_order_id`; CETECH-owned; no locate-by-user numeric ID; no second order
- Identity/amount/currency mismatch → `PAYMENT_NOT_VERIFIED` (no Woo effect)
- No Paystack / mobile-money / terminal / provider execution
- Non-cash tenders (`mobile_money` / `card` / `external_electronic`) validated at schema/semantic boundary only

## Woo economics and identity

Before `payment_complete`: load the actual Woo order. Prove CETECH ownership, prepared transaction/sale/quote identity, exact currency, exact grand total == PreparedSale.total, no contradictory payment binding. Do not depend on the short-lived Quote transient. Divergent Woo economics or identity → persist `SaleResolution.status=requires_attention`; **do not** call `payment_complete`; do not reprice.

## Official Woo commercial completion API

`WC_Order::payment_complete($paymentId)`.

Bridge-private Woo meta (supported CRUD): paymentId, evidenceId, tender, verificationSource, verifiedAt.

Commercial completion is proven by Woo paid/transaction/stock state, not a guessed `"completed"` status string. Physical products may remain `processing`.

- Payment completion count: **≤ 1**
- Stock reduction/commit count: **≤ 1** (BR-06 already reserved; finalize commits reserved stock once)
- Woo order count: **= 1**

## Cancel official Woo APIs

1. `wc_release_stock_for_order($order)` for the reserved-stock path
2. `WC_Order::update_status('cancelled', $reason)`

No direct reservation-table writes. No homemade stock arithmetic. Expired reservation + provably unpaid: mark cancelled without inventing a release. Unexpected unpaid `reduced` stock → `requires_attention` (frozen PreparedSale allows `"reduced"`; reversal is not invented).

## Cancel money-safety boundary

NEVER release/cancel commercially when Woo is paid, finalize completed, verified payment meta is bound on Woo, finalize outcome is ambiguous, or late success is present.

Canonical codes used (no invented codes):

- `PAYMENT_PENDING` — paid/completed/bound evidence blocks cancel
- `OPERATION_IN_PROGRESS` — shared mutation lock held
- `requires_attention` — contradictory / late-success freeze as SaleResolution
- `IDEMPOTENCY_CONFLICT` / `NOT_FOUND` / schema `INVALID_REQUEST` as applicable

Pending finalize **while cancel already holds the mutation lock** and Woo is unpaid is **not** treated as proven money (enables cancel-wins serialization). Woo payment meta bound but unpaid (F2) **does** block cancel with `PAYMENT_PENDING`.

## Crash seams

Finalize:

- **F1** `Command_Engine::$after_finalize_claim` — claim+lock before Woo. Retry same order/evidence; payment effect once.
- **F2** `Woo_Runtime::$after_payment_binding` — meta bound, unpaid. Retry inspects unpaid, `payment_complete` once.
- **F3** `Woo_Runtime::$after_payment_complete` notified after proven paid, before command outcome persist. Retry recovers completed; does not `payment_complete` again; does not reduce stock again.
- **F4** throw after possible Woo effect: inspect Woo first; same payment proven → recover completed; unproven → `requires_attention`. Never blindly retry.

Cancel:

- **C1** after durable cancel claim, before Woo release/status
- **C2** after reservation released, before cancelled persisted
- **C3** after order cancelled, before command outcome persisted

Retries never create another order. Already-released reservation is idempotent. Order cancelled at most once.

## GET resolve

`GET /sales/{transactionId}` remains **read-only**. Overlay inspects prepare claim + command claims + `inspect_commercial_snapshot()`. It does not call `payment_complete`, release reservation, cancel, repair command storage, write Woo metadata, or change stock.

- Finalize in progress + unpaid → `finalizing`
- Woo paid with same payment while finalize outcome missing → observational `completed` (no repair write)
- Safe cancelled Woo → `cancelled`
- Cancel-in-progress does **not** invent `cancelling` (no such SaleStatus) → truthful frozen state (typically `prepared`)
- Paid+cancelled contradictory / late success → `requires_attention`

All GET results validate `SaleResolution`. No `receiptId` from BR-07.

## Tested outcomes (deterministic fake)

| Case | Result |
| --- | --- |
| Valid `cash_ledger` evidence | `completed` SaleResolution `{transactionId,status,saleId,orderReference,paymentId}` |
| Unexpected finalize/cancel fields | fail-closed schema |
| transaction/saleId/amount/currency mismatch | `PAYMENT_NOT_VERIFIED`; no Woo effect |
| Woo saved total / identity mismatch | `requires_attention`; no `payment_complete` |
| Unknown transaction | `NOT_FOUND` |
| Same-key finalize replay | same completed resolution |
| Same-key finalize different request | `IDEMPOTENCY_CONFLICT` |
| Different key / same payment / completed sale | same commercial effect once |
| Different paymentId same sale | `requires_attention` |
| Reused paymentId / evidenceId on another sale | `PAYMENT_NOT_VERIFIED` |
| Concurrent same-finalize | one `payment_complete`; nested `OPERATION_IN_PROGRESS` |
| Concurrent same-cancel | one cancel + one release |
| F1 / F2 / F3 | recover same order; effect ≤ 1 |
| Ambiguous exception after possible Woo effect | resolve Woo first; recover if same payment |
| Already paid same payment | recover `completed` |
| Already paid different payment | `requires_attention` |
| Expired reservation + verified money | `requires_attention`; no blind completion |
| Cancelled + late verified payment | `requires_attention`; no second order; no reopen |
| Valid unpaid reserved cancel | `cancelled`; official release |
| Same-key cancel replay / different reason | same outcome / `IDEMPOTENCY_CONFLICT` |
| Paid / bound evidence cancel | `PAYMENT_PENDING` |
| Unexpected reduced unpaid | `requires_attention` |
| Finalize-wins race | completed once; later cancel `PAYMENT_PENDING` |
| Cancel-wins + late finalize | cancelled; late finalize `requires_attention` |
| GET after complete/cancel | observational; mutation counters unchanged |
| Woo order count | 1 |
| BR-06 regressions | green inside 1230 passed |

## Verification

Host: `python scripts/verify_control_plane.py` PASS.

Canonical GNU Make via ephemeral `php:8.5-cli` (PHP **8.5.10** NTS, GNU Make **4.4.1**):

- `make -C wordpress/cetech-pos-bridge check` PASS (42 files; 30 plugin/tool + 12 test sources)
- `make -C wordpress/cetech-pos-bridge test` **1230 passed / 0 failed**
- `make -C wordpress/cetech-pos-bridge parity` **138 passed / 0 failed / 19 skipped**
- `php wordpress/cetech-pos-bridge/tools/derive-quote-contract.php --check` PASS
- `git diff --check` clean
- Pricing formulas copied: **NO**
- `pricingParityVerified` remains **false**

In-memory fake is not a live Woo/HPOS database PASS.

## Freshness (ADR-012 two-pass; new BR-07 cycle, not Pass 3 of R5)

START: 2026-09-14T22:28:16Z. HEAD `78c8403697ac2f925cdf189b5d2f705c5da6b3a5`. `origin/main` `bc606a690f0c167b7057e3ae9143337404275882`. `origin/batch/r6-first-real-cash-sale` `8dabbde2af91b3aa31f00ae159b5f8cd7a3280a9`. `origin/ws2/br-07-implement-verified-commercial-finalization-an` `bc606a690f0c167b7057e3ae9143337404275882` (implementation not yet pushed). Issue #19 activation comment 5668031169 still ACTIVE for @Emmanuel-coder-prog / WS2. Frozen contracts unchanged. FE-05 already imported on the R6 batch; WS1-only; does not invalidate BR-07.

PASS 1: 2026-09-14T22:29:57Z. main `bc606a6…`. batch `8dabbde…`. contributor remote still `bc606a6…`. Issue #19 last comment still 2026-09-14T17:31:26Z. PR #55 still draft at `8dabbde…`. No new arrivals. No frozen-contract / ownership / R6-authority drift.

PASS 2: 2026-09-14T22:30:38Z. main `bc606a6…`. batch `8dabbde…`. Same issue/PR state. No new arrivals. Nothing reconciled.

Freshness classification: **FRESH_2**

Delivery: **READY_FOR_INTEGRATION** pending exact-head CI after push. Next owner: @wbdevworld / WS3 independent review/import. Pass 3: NOT PERMITTED.
