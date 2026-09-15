# CP-04 remaining implementation and evidence

Controlling decision: [ADR-011](../decisions/ADR/011.md). Owner: WS3 senior / @wbdevworld; WS2 supplies commerce evidence and the environment operator supplies access/configuration evidence. Tracker: [issue #4](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/4), kept OPEN.

Do not flatten history: W1/W4 were completed for training during R2 and accepted in merged PR #43. Original files remain on `origin/ws3/cp-04-r2-runtime-gates`. R6 still needs sale-write authorization plus a BR-07 plugin that is not yet on training.

| Gate | Current state | Meaning |
| --- | --- | --- |
| Development baseline | SATISFIED | Training is the reference. |
| Controlled remote write testing | OPEN for **order/stock/tender** writes. Isolation vs production still NOT PROVEN. W1/W4 training gates historically PASS; 2026-09-15 freshness CURRENT_PASS for containment and bridge identity/health | No test orders, stock changes, messages or real charges are authorized by this document. |
| Production cutover | OPEN / DEFERRED | Production differences must be resolved before their affected capability is enabled. |

## Already established

The [authenticated audit](../integration/evidence/CP-04-AUTHENTICATED-AUDIT.md) and [public audit](../integration/evidence/CP-04-LIVE-AUDIT.md) remain the 2026-09-12 baseline. R2 consumed W1/W4 in [R2-CP04-W4-CONSUMED.md](../integration/evidence/R2-CP04-W4-CONSUMED.md). R6 chronology/freshness: [R6-CP04-CHRONOLOGY.md](../integration/evidence/R6-CP04-CHRONOLOGY.md).

These are not pricing parity, stock-semantics, or production-readiness proofs.

## Bounded CP-04 items

| ID | Historical / current | Remaining for R6 |
| --- | --- | --- |
| CP04-W1 | **HISTORICAL PASS** 2026-09-13 (`af7e2a2…`). **CURRENT_PASS** 2026-09-15: MU intercept present; MailPoet inactive; notify domains `training.invalid`; webhooks 0; mailq empty | Re-check immediately before a sale. Do not treat as unfinished first-time work. Do not send a new synthetic email unless separately authorized |
| CP04-W2 | **PASS as resource/write-boundary map** (`1f1a04f…`). Order/stock/payment writes: **NO** | Explicit R6 sale-write grant still required |
| CP04-W3 | **PASS** as health-fixture plan (no commerce fixtures) | R6 cash-sale fixture is planned in [R6-STAGING-CASH-SALE-REHEARSAL.md](R6-STAGING-CASH-SALE-REHEARSAL.md); not executed |
| CP04-W4 | **HISTORICAL PASS** WordPress identity/health 2026-09-13 (`67ea42c…` / `edf24af…`). **CURRENT_PASS** 2026-09-15: user 22 least privilege; anonymous 401; authenticated 200 healthy; secret not rotated | Training plugin is still `0.2.7-br02` (health/quotes only). BR-07 `0.4.0-br07` routes are **DRIFTED**. Do not recreate the service user or Application Password |
| CP04-W5 | OPEN | Required before electronic payment execution (PAY-01 / R7). Inactive Paystack is not a sandbox proof |

## Downstream proof owned by implementation tasks

| Task owner | Required proof | CP-04 contribution |
| --- | --- | --- |
| WS2 BR-02–BR-05 | Woo/WoodMart/B2BKing quote parity | Permitted test environment; tax-off is not statutory signoff |
| WS2 BR-06/BR-07 + WS3 CORE-06 | Idempotent order/stock effects and real cash-sale recovery | Safe synthetic transaction environment plus **explicit sale-write authorization**; 60-minute hold-stock alone proves no reservation behavior |
| WS3 CORE-01/CORE-02 | Local schema reset/RLS | Development baseline already satisfied |
| WS3 PAY-01/RT-01/CORE-07/QA-01 | Payment/refund, close, PWA recovery | Applicable sandbox; no mock result closes a live gate |

## Production delta register — resolve at the affected release gate

All production values below remain **UNVERIFIED** unless updated with direct evidence.

| Delta | Training baseline | Owner | Required before / fallback |
| --- | --- | --- | --- |
| Operations host, data stores, credentials, deployment/Supabase project and recovery contacts | Training identity known; production Woo operations identity unverified | WS3 + operator | Production connection/deployment |
| Woo/plugin versions, HPOS, currency/precision and commercial/tax rules | Authenticated training values documented; live plugin `0.2.7-br02` vs R6 tree `0.4.0-br07` | WS2 + business owner | Enabling production quoting/checkout; install exact artifact only when authorized |
| Stock model, outlet/register mapping, backorders, fractional quantity and reserve/reduce/expiry semantics | Woo stock on; VitePOS stockable flag off; runtime sale effect unproven | WS2 + store operator | Live inventory/order writes after explicit grant |
| Email, SMS/WhatsApp, fulfillment, webhooks and dataset policy | W1 CURRENT_PASS on training (`training.invalid`, MailPoet inactive, webhooks 0); other plugins/chat/forms still not a full containment matrix | WS3 + operator | Applicable remote side effects; keep test sinks |
| Payment account, live processor, settlement and refund permissions | Paystack inactive; invoice/COD runtime | WS3 + payment owner | Real-money capability enablement |
| Fiscal process and production invoice owner | Woo tax calculation off | Business/fiscal owner + WS3 | Production selling/invoicing |
| Scanner, printer, drawer, terminal, staff roles and cash variance policy | Hardware/production policy unverified | Store operator + respective workstream | Relevant production workflow |
| Every VitePOS device queue, active shift, stock reconciliation and rollback | Config flags/counts only | Store operator + WS2 + WS3 | REL-01 pilot |

## Acceptance and next action

Keep issue #4 open. Next CP-04/R6 environment action is **not** a first-time W1 apply. It is: operator authorization for the R6 rehearsal (and BR-07 plugin install if routes remain absent), then execution per [R6-STAGING-CASH-SALE-REHEARSAL.md](R6-STAGING-CASH-SALE-REHEARSAL.md). Follow [CP-04-STAGING-AUDIT.md](CP-04-STAGING-AUDIT.md) for read-only collection.
