# R10 device and PWA rehearsal

Status: **PREPARED — DO NOT CLAIM PASS UNTIL EXECUTED**

This procedure supports QA-01 and R9/R10 evidence. It does not replace R9 acceptance. STG-01 is now the accepted runtime baseline; this procedure must still be executed for the R9 installed-client/update/reconnect/multi-tab gates.

## Required targets

Record at least:

- CETECH Windows desktop/POS device;
- one supported mobile/PWA path (Android or another explicitly supported installed-client path);
- actual keyboard-wedge scanner if available;
- actual receipt printer if available.

Record exact model, OS/browser, installed PWA state and build ID. An unavailable physical device is **BLOCKED**, not emulated PASS.

## Preconditions

1. Candidate SHA is frozen and deployable to an authorized non-production environment.
2. Candidate includes the accepted STG-01 application-runtime baseline (`c320be8c...`) or a later verified successor. Current accepted successor is REC-01 main `7c5d6ca0cd93d7aeb5a7a1c97153ca187548c3fb`.
3. No live payment/refund/restock is enabled merely for this rehearsal.
4. A known test cashier/register/shift and synthetic commerce fixture are available.
5. Evidence template is copied and populated before external effects.
6. Build A is installed and its build/schema/release-policy values are recorded.

## A. Baseline installed-client check

On Build A:

1. launch from installed PWA;
2. authenticate normally;
3. confirm cashier/register/shift are server-derived;
4. search by SKU/product name;
5. scan a barcode with the keyboard-wedge scanner if available;
6. create a cart/draft;
7. refresh/close/reopen and verify allowed local working state survives;
8. record System Status / attention state;
9. print/reprint a prior safe receipt if a printer is authorized.

Do not start an external payment solely to prove PWA lifecycle.

## B. Build A → Build B controlled update

1. Keep Build A installed and open.
2. Create a safe blocking state:
   - active cart plus the R9-designated durable/tender marker path using an authorized synthetic path; or
   - another approved unacknowledged durable operation that does not move real money.
3. Deploy Build B to the authorized staging candidate.
4. Observe update discovery / waiting-worker state.
5. Verify activation is blocked while the protected state exists.
6. Verify the UI does not silently reload or clear IndexedDB/drafts/journal.
7. Resolve/finish the protected operation safely.
8. Reach a documented safe point.
9. Activate Build B.
10. Verify:
    - app build changes to B;
    - required local data survives;
    - schema migration completes or fails closed;
    - cart/draft/journal state is not silently destroyed;
    - System Status reports truthful state.

Capture screenshots/log references for the blocked and allowed activation states.

## C. Reconnect and unresolved durable work

1. Establish a safe synthetic pending operation before the response/acknowledgement boundary.
2. Interrupt connectivity or the response at the planned point.
3. Reconnect/reopen.
4. Verify the client resolves existing server/provider reality before replay.
5. Verify no duplicate external effect is produced.
6. Record the same operation/transaction identity before and after recovery.

## D. Multi-tab / multi-window

1. Open the installed/web client in two tabs/windows for the same staff/device context.
2. Establish the lifecycle lease/leadership condition.
3. Verify only the authorized tab performs lifecycle activation/migration responsibility.
4. Establish the safe tender-in-progress marker.
5. Verify neither tab can activate an update while tender/critical work is protected.
6. Close/transfer the active tab and verify bounded lease recovery without duplicate business effect.

## E. Scanner

If hardware is available:

1. record scanner model/interface;
2. scan known SKU/barcode;
3. scan unknown code;
4. scan repeatedly;
5. verify local lookup remains fast and no duplicate unintended line is created;
6. verify focus recovery after cart/customer actions.

## F. Printer

If hardware is available:

1. record printer model/driver/paper width;
2. print accepted test receipt;
3. reprint the same receipt;
4. verify reprint cannot create another sale/payment/stock effect;
5. verify essential fields are readable;
6. record any browser print-dialog limitation separately from transaction correctness. Issue #85 (browser reprint prints the full POS shell instead of an 80mm receipt) is a P0 production-MVP print-layout defect; it is not a REC-01 receipt-snapshot defect and must not rewrite historic receipt `49585`.

## Exit

Attach one `R10-EVIDENCE-TEMPLATE.md` record per device/rehearsal group.

A green automated Playwright run does not substitute for installed-client evidence. A screenshot does not substitute for durable transaction/recovery proof.
