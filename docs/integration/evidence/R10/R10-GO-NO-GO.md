# R10 go / no-go qualification sheet

Status: **PREPARED — current decision is NO-GO until the listed runtime gates are satisfied**

This sheet is the release-decision summary for QA-01 / REL-01. It does not override the detailed evidence, CP-04, the accepted STG-01 baseline, R9, business/fiscal decisions or human production approval.

## Decision rule

A release/pilot is GO only when every enabled capability is:

- PASS at its required evidence level; or
- explicitly excluded/disabled with no misleading reachable workflow.

Any unresolved financial, stock, authorization, durable-state or rollback safety blocker is NO-GO.

## Current prerequisite snapshot

| Gate | Current preparation status | GO requirement |
| --- | --- | --- |
| Protected main baseline | STG-01 merged as `c320be8c5ad41c190200381cd52f853dd95212dc` | Final release candidate must identify exact accepted SHA and include later accepted prerequisites |
| STG-01 production-intent staging runtime | ACCEPTED — issue #70 closed; PR #77 merged | Reuse the accepted runtime evidence for unchanged paths; repeat any path materially changed by the final candidate. `pricingParityVerified=false` remains a separate unresolved gate. |
| R9 PWA/recovery/operational close | PENDING_R9 | Accepted installed-client/update/reconnect/multi-tab/Z-report evidence |
| QA-01 automated qualification | IN PROGRESS on R10 prep branch | Exact final candidate suite green; no unresolved invariant blocker |
| Payment safety | Historical R7 TEST evidence + automated coverage | Final-candidate regressions green; live mode remains disabled unless separately authorized |
| Returns/refunds/restock | R8 code/evidence exists | Final regressions green; real effects disabled unless controlled acceptance/authorization exists |
| CP-04 production/write safety | OPEN for affected production capabilities | Production environment facts, permissions, containment and affected write gates resolved |
| Backup/restore | PREPARED only | Recorded recoverable backups plus required isolated restore evidence |
| Application/bridge rollback | PREPARED only | Recorded rehearsal against intended pilot topology |
| Physical devices | PENDING_AUTHORIZATION / models may remain unknown | Required scanner/printer/device workflow evidence for hardware enabled at pilot |
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

STG-01 already proved the baseline below on PR #77 / main `c320be8c5ad41c190200381cd52f853dd95212dc`. Before production decision, any later release candidate must re-prove the items materially affected by subsequent changes:

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
