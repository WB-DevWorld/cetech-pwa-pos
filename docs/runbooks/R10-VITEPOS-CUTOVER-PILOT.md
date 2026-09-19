# R10 VitePOS reconciliation, cutover and pilot

Status: **PREPARED — NO CUTOVER AUTHORIZED**

This is the REL-01 operational procedure. Preparing this document does not authorize production promotion, VitePOS deactivation or a real customer pilot.

## Absolute prerequisites

Do not begin the cutover unless:

1. STG-01 functional staging acceptance is complete.
2. R9 installed-client/update/recovery acceptance is complete.
3. QA-01 qualification is accepted for every enabled capability.
4. CP-04 production/write-safety blockers for the affected capability are resolved.
5. Backup/restore and rollback evidence is accepted.
6. Business/fiscal/statutory receipt process is signed off where applicable.
7. Actual devices and staff workflow are rehearsed.
8. A human release authority explicitly approves the pilot.
9. Live payment/refund capabilities are enabled only if independently authorized.
10. There will not be two uncontrolled active POS writers for the pilot register.

## A. VitePOS reconciliation before changeover

Record without changing state first:

- VitePOS Lite/Pro versions and active/inactive state;
- outlets/warehouses/counters;
- cashier/role setup;
- stock mode and stockable flags;
- barcode field;
- payment methods;
- receipt/print configuration;
- offline mode and pending/sync queue;
- active sales/held sales;
- active cash drawer/session/shift;
- final EOD/report state;
- last Woo order ID/timestamp generated through VitePOS;
- inventory counts/reconciliation basis;
- any plugin-specific metadata needed for rollback/history.

If any offline/pending transaction is unresolved, **STOP**. Do not cut over.

## B. Final pre-cutover

1. announce the register changeover window;
2. finish active VitePOS sales;
3. drain/sync all VitePOS pending/offline orders;
4. close the VitePOS drawer/session;
5. count cash and preserve EOD report;
6. record final VitePOS Woo order ID + timestamp;
7. reconcile inventory and investigate unexplained deltas;
8. take final WordPress DB/files backup;
9. take final Supabase backup/dump;
10. record release SHA/build and bridge version;
11. verify cashier/device/register assignments;
12. verify recovery contacts and rollback owner;
13. verify the first-sale script and evidence template are ready.

## C. Changeover

Only after explicit human GO:

1. stop new VitePOS transactions;
2. **deactivate, do not uninstall/delete VitePOS**;
3. open the approved new POS;
4. sign in as the named cashier;
5. select/open the correct register/shift;
6. enter the approved opening cash;
7. keep the rollback owner available.

Do not delete VitePOS data/configuration during the pilot.

## D. First controlled sale

Use a low-risk normal product and approved payment method.

Capture one continuous trace:

`session → register/shift → product/search/scan → customer → authoritative quote → prepare → payment → finalize → Woo order → stock → receipt → POS history`

Immediately verify:

- exactly one POS sale;
- exactly one Woo order;
- correct customer/context;
- correct authoritative total;
- correct payment evidence;
- exactly one intended stock effect;
- storefront/online availability reflects the expected stock state;
- receipt renders and reprints without repeating the sale;
- POS transaction/history resolves completed;
- shift/cash totals reflect the sale;
- no unexpected message/webhook/fulfillment side effect.

Record exact IDs using the R10 evidence template.

If B2B is enabled for pilot, run a separate explicitly approved B2B verification after the normal first sale, not simultaneously.

## E. First-day monitoring

Continuously watch and record:

- pending/requires-attention operations;
- Woo/bridge errors;
- payment verification/reconciliation errors;
- quote/pricing mismatch;
- stock mismatch;
- webhook failures;
- cash variance;
- receipt/printing complaints;
- PWA/update/reconnect events;
- latency/performance;
- staff usability;
- support/diagnostic incidents.

Review every REQUIRES_ATTENTION transaction before attempting another external effect.

## F. Rollback triggers

Stop new-POS cashier traffic if any of these appear and cannot be immediately bounded:

- duplicate Woo order;
- duplicate/unknown payment effect;
- wrong B2B/retail price;
- materially incorrect tax;
- unexplained stock deduction/restock;
- payment with missing/unresolvable order;
- repeated checkout failure;
- critical receipt/statutory failure;
- critical auth/session/security defect;
- local durable state lost on refresh/update/reconnect.

## G. Traffic rollback to VitePOS

1. stop new new-POS transactions;
2. reconcile every pending/unknown new-POS operation first;
3. record last new-POS Woo order/timestamp;
4. verify VitePOS's old offline queue is still empty;
5. re-enable VitePOS;
6. reopen the appropriate VitePOS counter/session;
7. run one controlled verification transaction if authorized;
8. continue through VitePOS only after verification.

New-POS orders already committed to Woo remain legitimate history. If reversal is required, cancel/refund using normal flows. Do not delete orders, payment records, stock effects or audit rows.

## Pilot completion

Permanent VitePOS removal is not part of the first pilot. Consider permanent removal only after healthy shifts, reconciled orders/stock/payments, accepted first-day monitoring and explicit human approval.
