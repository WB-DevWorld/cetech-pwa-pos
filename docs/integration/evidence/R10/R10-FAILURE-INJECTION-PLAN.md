# R10 failure-injection plan

Status: **PREPARED — execute only against an authorized exact candidate**

Purpose: define QA-01 failure points before final qualification so the team does not improvise retries around money, orders, stock, refunds or local durable state.

## General rule

For every scenario:

1. record the exact candidate SHA/environment;
2. create durable local/server operation identity before the external effect where the implemented workflow requires it;
3. inject the failure at one named boundary;
4. recover by resolving existing reality first;
5. prove no duplicate external effect occurred;
6. record the durable IDs and final state using `R10-EVIDENCE-TEMPLATE.md`.

A timeout or lost response is not evidence that the external effect failed.

## Sale / order preparation

### FI-SALE-01 — request fails before Woo prepare effect

Injection point: POS/BFF request is rejected or transport fails before the bridge creates an order.

Expected:

- no Woo order;
- no stock effect;
- no payment starts;
- cart/draft remains recoverable;
- retry may use the original semantic operation identity if the server confirms not_found.

Release blocker if payment begins without successful prepare.

### FI-SALE-02 — Woo prepare succeeds, response is lost

Injection point: after the bridge has created/prepared the Woo order but before the POS receives the response.

Expected:

- exactly one Woo order;
- resolve by transaction/idempotency identity returns the existing prepared sale;
- retry does not create another order;
- stock/reservation effect is not repeated.

Existing R6 automated evidence covers the algorithm. STG-01 now provides the accepted production-intent happy-path runtime baseline on PR #77 / main `c320be8c5ad41c190200381cd52f853dd95212dc`; R10 still must execute the lost-response injection on the final candidate.

### FI-SALE-03 — quote/stock changes immediately before prepare

Injection point: mutate authoritative training fixture between confirmed cart quote and prepare.

Expected:

- typed quote/stock review state;
- no payment starts;
- cashier must review the changed sale;
- old quote cannot force stale economics.

Uses the accepted STG-01 authoritative quote/catalog path as its baseline. The affected pricing case cannot be qualified while `pricingParityVerified=false`; R10 must execute this mutation/review scenario on the final candidate once the relevant parity gate is green.

## Cash/finalization

### FI-CASH-01 — cash recorded, final commercial confirmation response lost

Injection point: after cash payment evidence is durable, around commercial finalize/response.

Expected:

- no second cash movement;
- resolve existing sale/payment before repeating finalization;
- finalization may be retried only as the same idempotent commercial operation;
- one Woo completion/stock effect;
- one receipt.

### FI-CASH-02 — commercial finalizer unavailable

Expected:

- sale remains truthful (not falsely completed);
- verified cash evidence is retained;
- cashier/support sees recoverable attention/finalization state;
- retry cannot collect cash again.

## Electronic payment

### FI-PAY-01 — provider initialize response lost

Injection point: provider intent/reference created, HTTP response lost.

Expected:

- original provider/payment identity remains durable;
- no second initialize;
- reconciliation/resolve returns the original intent.

Existing PAY-01 tests already prove this algorithm.

### FI-PAY-02 — provider success occurs, webhook delayed or lost

Expected:

- polling/server verification can reconcile the original reference;
- browser callback alone cannot mark paid;
- no replacement payment starts;
- verified evidence binds exact transaction/order/amount/currency.

### FI-PAY-03 — duplicate/out-of-order webhook

Sequence examples:

- pending → success → duplicate success;
- failed → later verified success;
- success → stale failed/pending event.

Expected:

- monotonic verified truth;
- one tender/commercial completion;
- stale weaker state cannot overwrite verified/finalizing/completed.

### FI-PAY-04 — provider verification timeout

Expected:

- payment remains pending/reconciling/requires_attention as appropriate;
- no second charge;
- later resolve uses the same reference.

### FI-PAY-05 — final Woo completion response lost after verified electronic payment

Expected:

- do not charge again;
- retain verified provider evidence;
- resolve commercial order state;
- retry only idempotent finalization.

## Refund / return

### FI-RT-01 — provider refund response lost

Injection point: after provider may have accepted the refund but before POS has definitive outcome.

Expected:

- same refundId/provider identity is retained;
- resolve existing provider refund;
- no second refund create;
- commercial refund and stock effects remain independently truthful.

### FI-RT-02 — Woo commercial refund response lost

Expected:

- commercialRefundId persists;
- resolve the same commercial effect;
- no second commercial refund;
- payment refund and stock disposition identities are not collapsed into this effect.

### FI-RT-03 — stock-disposition response lost

Expected:

- stockDispositionId persists;
- resolve same effect;
- no second restock/deduction;
- damaged/quarantine/not-physically-returned never become sellable merely because recovery is ambiguous.

### FI-RT-04 — approval/authorization/CSRF absent

Expected:

- zero provider refund creates;
- zero commercial refund applies;
- zero stock-disposition applies.

Executable R10 no-effect guard tests cover this at integration level.

### FI-RT-05 — two concurrent final-quantity returns

Expected:

- accepted returned quantity never exceeds original quantity;
- only one contender may consume the final available quantity;
- refund economics remain tied to historical sale allocation.

Existing R8 tests cover the integration algorithm.

## Supabase / durable POS store

### FI-DB-01 — durable store unavailable before new tender

Expected:

- no unsafe new tender/payment begins when required POS transaction/audit durability cannot be established;
- cart/draft may remain usable;
- UI must not claim sale complete.

### FI-DB-02 — durable store becomes unavailable after external payment/order effect

Expected:

- preserve operation identity locally where implemented;
- resolve Woo/provider reality;
- backfill POS durable state when safe;
- never duplicate order/payment merely to repair POS state.

## PWA / client lifecycle

These require R9 acceptance.

### FI-PWA-01 — refresh/restart with unacknowledged operation

Expected:

- durable operation/journal survives;
- resolve before retry;
- no duplicate external effect.

### FI-PWA-02 — reconnect while update is waiting

Expected:

- reconnect does not force reload;
- protected tender/critical work blocks activation;
- update activates only at safe point.

### FI-PWA-03 — two tabs during protected operation

Expected:

- lifecycle lease/leadership is respected;
- no competing migration/update activation;
- no duplicated business operation.

## Register close

### FI-REG-01 — duplicate close request

Expected:

- one close result;
- one immutable Z report;
- idempotent replay returns same result.

Requires R9 runtime acceptance.

### FI-REG-02 — non-zero variance

Expected:

- requires_attention;
- no fabricated approval ID can force closed;
- counted/expected/variance evidence remains retained.

R8 automated tests already prove fail-closed status behavior.

## Infrastructure / deployment

### FI-OPS-01 — application deployment rollback

Expected:

- rollback to known-good build does not delete legitimate business rows;
- durable pending operations remain resolvable;
- schema remains compatible across rollback window.

### FI-OPS-02 — bridge rollback

Expected:

- exact prior plugin artifact can be restored where authorized;
- health/capability checks recover;
- already-created Woo/payment/stock effects are reconciled, not erased.

### FI-OPS-03 — VitePOS traffic rollback

Expected:

- stop new new-POS traffic;
- reconcile every pending/unknown operation;
- preserve new-POS Woo history;
- verify old VitePOS offline queue remains empty;
- re-enable VitePOS without dual-writing uncontrolled traffic.

## Failure classification

A qualification event is a **release blocker** if it can cause any of:

- duplicate order;
- duplicate charge/payment;
- duplicate refund;
- duplicate stock mutation/restock;
- lost durable operation;
- false completed state;
- unauthorized external effect;
- stale price/stock used without required review;
- unresolvable payment/order/refund state;
- destructive PWA update/recovery;
- unrecoverable rollback path for the enabled capability.

Do not reduce a blocker to documentation-only acceptance. Either fix it, disable/exclude the affected capability, or stop release.
