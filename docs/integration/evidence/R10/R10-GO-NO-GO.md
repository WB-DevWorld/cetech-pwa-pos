# R10 go / no-go qualification sheet

Status: **PREPARED — current decision is NO-GO until the listed runtime gates are satisfied**

This sheet is the release-decision summary for QA-01 / REL-01. It does not override the detailed evidence, CP-04, the accepted STG-01 baseline, accepted REC-01 snapshot evidence, R9, business/fiscal decisions or human production approval. Current decision remains **NO-GO**. This document is preparation, not qualification completion.

## Decision rule

A release/pilot is GO only when every enabled capability is:

- PASS at its required evidence level; or
- explicitly excluded/disabled with no misleading reachable workflow.

Any unresolved financial, stock, authorization, durable-state or rollback safety blocker is NO-GO.

## Current prerequisite snapshot

| Gate | Current preparation status | GO requirement |
| --- | --- | --- |
| Protected main baseline | REC-01 merged as `7c5d6ca0cd93d7aeb5a7a1c97153ca187548c3fb` (inherits accepted STG-01 `c320be8c...` and accepted CD-01 `c1f659ea...`) | Final release candidate must identify exact accepted SHA and include later accepted prerequisites |
| STG-01 production-intent staging runtime | ACCEPTED — issue #70 closed; PR #77 merged | Reuse the accepted runtime evidence for unchanged paths; repeat any path materially changed by the final candidate. `pricingParityVerified=false` remains a separate unresolved gate. |
| CD-01 exact-SHA Preview infrastructure | ACCEPTED — PR #81 merged as `c1f659ea118a885180fe6a543797efa908abf210` | Trusted exact-SHA Preview path exists; dispatch remains a later authorized action and is not production promotion |
| REC-01 immutable receipt snapshots | ACCEPTED — PR #80 source `6995e1c...`; resulting main `7c5d6ca0...` | Reuse only the exercised evidence: verified running BUILD_ID; cash sale order `49606` / receipt `POS-49606`; product presentation `Fix-Am Admix 300 Polymer Emulsion Based Mortar`; re-fetch/reprint with no second commercial effect; historic `49585` unchanged. Do not treat this as proof of browser thermal print, customer-name snapshots, Sell picker search, or Returns handoff. |
| R9 PWA/recovery/operational close | PENDING_R9 | Accepted installed-client/update/reconnect/multi-tab/Z-report evidence |
| Production-MVP follow-ups #82–#85 | OPEN — unresolved release blockers unless later owner authority explicitly waives them | #82 Return Items handoff; #83 Sell customer picker authority/search; #84 sale-time customer presentation snapshot; #85 browser thermal receipt printing |
| Staging reliability #86–#87 | OPEN P1 — visible, not automatically production blockers | #86 intermittent staff sign-in diagnostics; #87 catalog freshness degradation. Escalate only if later qualification evidence shows a release-safety defect. |
| Historic receipt presentation #88 | OPEN P2 documented historical limitation | Pre-REC-01 UUID-like line on `49585` must remain immutable. Not corruption and not a rewrite job. Do not confuse with REC-01 snapshot correctness or with #85 print layout. |
| QA-01 automated qualification | IN PROGRESS on R10 prep branch | Exact final candidate suite green; no unresolved invariant blocker |
| Payment safety | Historical R7 TEST evidence + automated coverage | Final-candidate regressions green; live mode remains disabled unless separately authorized |
| Returns/refunds/restock | R8 code/evidence exists; #82 blocks production-MVP returns UX | Final regressions green; real effects disabled unless controlled acceptance/authorization exists; #82 remains a production-MVP blocker if returns are enabled |
| CP-04 production/write safety | OPEN for affected production capabilities | Production environment facts, permissions, containment and affected write gates resolved |
| Backup/restore | PREPARED only | Recorded recoverable backups plus required isolated restore evidence |
| Application/bridge rollback | PREPARED only | Recorded rehearsal against intended pilot topology |
| Physical devices | PENDING_AUTHORIZATION / models may remain unknown; browser print path is blocked by #85 | Required scanner/printer/device workflow evidence for hardware enabled at pilot |
| VitePOS reconciliation | PENDING_AUTHORIZATION | Offline/pending queue zero, shifts/cash/order cutoff/inventory reconciled |
| Fiscal/statutory process | unresolved unless separately signed off | Business/fiscal owner signoff for enabled production receipt/invoice process |
| Human production approval | NOT GRANTED by R10 prep | Explicit release authority GO after evidence review |

## P0 transaction integrity

NO-GO if any is unresolved:

- same semantic sale can create more than one Woo order;
- payment can start before successful authoritative prepare;
- payment/refund can execute without required authorization/CSRF;
- pending/unknown payment can initialize a replacement charge;
- verified payment can regress to weaker state;
- completed sale can be reported while external reality is ambiguous;
- retry/recovery can repeat stock/payment/refund effects;
- authoritative price/stock changes can be ignored at checkout.

## Security

NO-GO if:

- privileged Woo/WP/Supabase/payment secret is browser-exposed;
- anonymous/expired/revoked staff can mutate;
- client-supplied staff/tenant/capability data can elevate authority;
- CSRF/origin protection is bypassed for state changes;
- cross-organization/location/register data/effects are reachable without authority;
- infrastructure/auth uncertainty is treated as trusted access.

## Returns/refunds

If returns are enabled at pilot, NO-GO if:

- current catalog price can replace historic sale economics;
- returned quantity/refund can exceed remaining historic amount;
- approval-required operation can reach any external effect before approval;
- provider refund ambiguity can cause a second refund;
- commercial refund and physical stock disposition are not independently recoverable;
- damaged/quarantine/not-physically-returned item can silently become sellable.

If real electronic refunds/restock are not sufficiently qualified, keep them explicitly disabled/excluded and retain a safe operational fallback.

## PWA / local durability

NO-GO if:

- refresh/update/reconnect can destroy active cart/draft/unacknowledged operation;
- waiting update activates mid-tender/critical operation;
- two tabs can race lifecycle ownership unsafely;
- unsupported app version can continue silently where policy requires a block;
- normal recovery requires destructive clear-all IndexedDB/cache behavior.

## Register / operational close

NO-GO if:

- duplicate close can create multiple Z reports;
- non-zero variance can close without approved durable authority;
- counted/expected/variance data can be lost;
- a close appears successful when persistence/evidence is ambiguous.

## Staging acceptance

STG-01 already proved the baseline below on PR #77 / main `c320be8c5ad41c190200381cd52f853dd95212dc`. REC-01 later proved the additional receipt-snapshot facts below on PR #80 source `6995e1c...` / resulting main `7c5d6ca0...`. Before production decision, any later release candidate must re-prove the items materially affected by subsequent changes:

1. real staff session;
2. CSRF lifecycle;
3. authoritative register/shift state;
4. Woo-derived product projection;
5. search/barcode path;
6. retail/customer context as enabled;
7. authoritative Woo/WoodMart/B2BKing quote path;
8. prepare/payment/finalize exactly once;
9. exactly one Woo order;
10. intended stock effect;
11. receipt/history/reprint;
12. mounted current Returns/Register/System Status surfaces;
13. refresh/reconnect durability;
14. no fake production authority labels/states.

REC-01 additional accepted evidence (do not generalize beyond this):

- exact immutable Preview of accepted source `6995e1c...`;
- running BUILD_ID verified;
- controlled staging cash sale completed as Woo order `49606` / receipt `POS-49606`;
- human-readable product presentation `Fix-Am Admix 300 Polymer Emulsion Based Mortar`;
- re-fetch/reprint of that same completed sale with no second commercial effect observed;
- historic receipt `49585` remains unchanged.

Do not treat browser `window.print()` layout (#85) as a REC-01 snapshot defect. Do not treat historic UUID-like line presentation on `49585` (#88) as corruption requiring rewrite.

## Unresolved production-MVP follow-ups (not implemented in R10 Prep)

Unless later owner authority explicitly waives them, these OPEN issues are release blockers for a production-MVP GO:

| Issue | Title | Why it blocks production-MVP |
| --- | --- | --- |
| #82 | Return Items handoff leaves selected return flow below the discovery grid | Cashiers cannot complete the Orders → Returns selected-sale path |
| #83 | Sell customer picker searches IndexedDB instead of remote BFF | Sell cannot bind a remote customer that is not already local |
| #84 | Orders customer column persists customerId instead of sale-time display name | Order history lacks an immutable human customer presentation snapshot |
| #85 | Browser reprint prints the full POS shell instead of an 80mm receipt | Browser thermal print is not a receipt-only surface |

P1 staging reliability, not automatic production blockers:

- #86 intermittent staff sign-in diagnostics
- #87 catalog freshness degradation after a failed refresh

P2 documented historical limitation:

- #88 historic receipts without product snapshots must remain immutable

These issues are **not** implemented by R10 Prep.

## Backup / rollback

NO-GO if the pilot cannot answer:

- what exact build is running?
- how is the previous build restored?
- how are WordPress/Woo and Supabase restored?
- what plugin artifact is restored?
- how are pending payments/orders/refunds reconciled before traffic rollback?
- what is the last new-POS Woo order before returning traffic to VitePOS?
- who has out-of-band recovery authority/contact?

## VitePOS pilot gate

Do not deactivate VitePOS for pilot until:

- pending/offline queue is zero;
- active VitePOS sales are finished;
- drawer/session is closed and cash recorded;
- final VitePOS Woo order/timestamp recorded;
- inventory reconciled;
- backups complete;
- rollback owner available;
- first-sale evidence procedure ready.

Deactivate for controlled pilot only; do not uninstall/delete as part of initial cutover.

## Final decision record

Populate only at REL-01 decision time:

- Release candidate SHA:
- Deployment/build ID:
- QA-01 evidence index:
- STG-01 acceptance reference:
- REC-01 acceptance reference:
- R9 acceptance reference:
- CP-04 production gate reference:
- Backup/restore evidence:
- Rollback evidence:
- Device evidence:
- VitePOS reconciliation evidence:
- Fiscal/business signoff:
- Human approver:
- Decision: GO / NO-GO
- Enabled capabilities:
- Explicitly excluded capabilities:
- Known residual risks:
- Pilot start/end criteria:

An empty field is not implied PASS.
