# STAGING-ROLLOUT-A4F3284-01 — execution receipt

Status: **STAGING/TRAINING APPLIED · candidate Preview READY · authenticated noncommercial PASSED (software) · native FPM guard proof PASSED**  
Acting: `@wbdevworld` / WS3 (Cursor)  
Owner approval: `CETECH-POS-WS3-Controlled-Staging-Rollout-a4f3284` — APPROVED `2026-10-09T18:15:52Z`  
Closeout task: `FPM-AND-TESTER-HANDOFF-CLOSEOUT-A4-01`  
Staff-documentation impact: **UPDATED** (current-round entrypoint notices)  
Production effects: **NONE**  
Verdict: **NOT READY FOR PRODUCTION**

## Exact identities

| Field | Value |
| --- | --- |
| Exact SHA / BUILD_ID | `a4f3284c35785dbb0efe3843d38084f12911ac15` |
| Source tree | `58d0297dd6fc419bc583c1197fc3c7c95d635242` |
| Bridge tree | `de27630af10885d166401cba4043a02e3b2a4d2b` |
| CI | `37964935009` SUCCESS |
| Staging DB | `iegxncvpsyaitkpzywcr` ONLY |
| Training WP | `training.cetechbpa.com` ONLY |
| Preview id | `dpl_FAaW712WnVBZ9Wr7B8MXCurJEeXW` |
| Immutable URL | https://cetech-pos-staging-q2u9baevb-wbdevworlds-projects.vercel.app |
| Shared tester | **unchanged** — `dpl_nxWGrSLqaLBGNNN683QjdixNBjF6` / BUILD_ID `816e0bb…` (`git-integration-9578df…`) |
| Prior 452 Preview | retained — `dpl_F3uXp…` / `srx2grakx` / `452c446…` (superseded for new testing) |
| f0 Preview | retained — `dpl_4Vk3XQ…` / `gqg6tjedt` / `f0feb44…` |

## Source → hosted migration mapping

Atomic single-transaction apply via Management API `/database/query` (five SQL files + five history inserts). Accidental probe history row `20261009214202` / `probe_should_fail` deleted before apply (select-only; no schema change).

| Order | Source version / file | Hosted version | Hosted name |
| ---: | --- | --- | --- |
| 1 | `20261009130000` `pos_sale_tender_claims.sql` | `20261009214234` | `pos_sale_tender_claims` |
| 2 | `20261009130100` `pos_sale_tender_claim_atomic_cash.sql` | `20261009214235` | `pos_sale_tender_claim_atomic_cash` |
| 3 | `20261009140000` `db_sec_02_03_cash_authz.sql` | `20261009214236` | `db_sec_02_03_cash_authz` |
| 4 | `20261009150000` `pos_sale_tender_write_boundary.sql` | `20261009214237` | `pos_sale_tender_write_boundary` |
| 5 | `20261009160000` `pos_sale_tender_evidence_enrollment.sql` | `20261009214238` | `pos_sale_tender_evidence_enrollment` |

RD-01 preserved: hosted `20261008151307` ↔ source `20261006025100` (not re-applied). History count after apply: **30**. Probe row: **gone**.

## Enrollment / consistency (post-apply)

| Check | Result |
| --- | --- |
| `pos_sale_tender_claims` | present |
| Claims | **24** cash / **0** electronic |
| Cash-sale movement tx / pay-cash tx | 24 / 24 |
| Dual-family tx | **0** |
| Claim vs cash mismatches | **0** |
| Claim vs electronic mismatches | **0** |
| Orphan claims | **0** |
| Helpers | `pos_claim_or_require_tender_family`, `pos_infer_sale_tender_evidence`, `pos_record_verified_cash_sale`, `pos_actor_access_is_active`, `pos_cash_tender_family_guard`, `pos_checkout_payment_tender_family_guard`, `pos_shift_before_insert` |
| Write-boundary triggers | `pos_cash_tender_family_guard`, `pos_checkout_payment_tender_family_guard` |
| Authenticated TRUNCATE on claims / cash_movements | **false** |
| service_role INSERT claims | **true** |

## Training bridge

| Check | Result |
| --- | --- |
| Prior live runtime | `89e4461c…` |
| Prior live main | `63094753…` (unchanged) |
| Reviewed runtime target | `fa478ea44425679abfc9abbfd85618eab4fb7671e5b9364bfc795825860c5ceb` |
| Backup tarball | `/home/cetechtraining/backups/cetech-pos-bridge-pre-a4f3284-20261009T214555Z.tgz` |
| Backup SHA-256 | `74519defd6f5de6e041361faa89f9095bfa209ad6318d53944dee7127e9199cc` |
| Exchange | FPM idle drain → `rename_exchange.py --signed-off` PLUGIN ↔ staged (live copy + runtime overlay) |
| Live runtime after | `fa478ea4…` **VERIFIED** |
| Live main after | `63094753…` **VERIFIED** |
| Identity string count | 2 |
| Same-request guard count | 6 |
| Timers after | wp-cron + mailpoet **active**; `.maintenance` **absent** |
| Native FPM current execution proof | **PASSED** — see § Native FPM guard proof (closeout A4-01). Not retroactive cutover proof. |

## Native FPM guard proof (closeout A4-01)

Current-generation proof only. Task-local probe removed after run. No directory exchange, PHP kill, global OPcache reset, or FPM master reload.

| Field | Value |
| --- | --- |
| UTC | `2026-10-09T22:27:09+00:00` |
| Task / product | `FPM-AND-TESTER-HANDOFF-CLOSEOUT-A4-01` / `a4f3284…` |
| Transport | accepted training FastCGI client shape → `127.0.0.1:20001`, 10s whole-request deadline |
| PHP_SAPI | `fpm-fcgi` |
| PID | `26369` |
| Reflected method | `Cetech_Pos_Bridge_Woo_Runtime::assert_no_unexpected_same_request_order_creates` @ `class-woo-runtime.php:1244` |
| Runtime disk SHA-256 | `fa478ea44425679abfc9abbfd85618eab4fb7671e5b9364bfc795825860c5ceb` |
| OPcache file entry for runtime | **null** (restricted output; not required when SAPI + outcomes pass) |
| Case: object, one intended create, deletes 0 | `true` |
| Case: object, deletes 1 | `INTEGRATION_UNAVAILABLE` / status **503** |
| Case: array, deletes 1 | `INTEGRATION_UNAVAILABLE` / status **503** |
| Timers / maintenance after proof | unchanged (active / absent) |
| Verdict | **PASS** (current native execution of the delete guard) |

## Preview identity (unauthenticated)

| Check | Result |
| --- | --- |
| Create payload | BUILD_ID + empty `APP_ORIGIN` / `NEXT_PUBLIC_APP_ORIGIN` (env + build.env); target omitted |
| readyState | **READY** |
| Git SHA | `a4f3284…` |
| `GET /api/pos/v1/release-policy` | latest/recommended/minimum = `a4f3284…` |
| `GET /sw.js?build=a4f3284…` | 200 |
| `manifest.webmanifest` | 200 standalone CETECH POS |
| Same-origin `GET /api/pos/v1/session` | **401 AUTH_REQUIRED** (not FORBIDDEN) |
| UI | Sign-in form visible (not Access denied) |
| Shared tester alias move | **not performed** |

## Authenticated noncommercial checks

Operator signed in privately on the candidate host (no password in chat/logs). Observed as Staging Manager (`manager_a`).

| Check | Result |
| --- | --- |
| `GET /api/pos/v1/session` (cookie) | **200** — org_a; locations loc_a1/loc_a2; registers reg_a/reg_a2/reg_b |
| Release-policy BUILD_ID | **a4f3284…** (authenticated + unauthenticated) |
| Sell catalog presentation (T-D3a) | Loaded product grid; search box present; **Pay disabled** (empty cart) |
| Draft persistence / journal survival (T-D3b) | **PENDING** — not claimed from no observed loss |
| Header scope | **No register** / **No open shift** / Online |
| Register hydration | Register options reg_a/reg_a2/reg_b; Open register disabled without device — **not** opened |
| Orders list | Includes **50317** |
| Order detail + receipt retrieval (T-D4a) | Walk-in · Cash Verified · **GHS 29.00** · txn `33326bbc…` · `rcpt-33326bbc` via API **200** |
| No-scope Reprint control (T-D4b) | **Reprint** available with no register/shift; clicked once |
| Receipt reload (T-D4c) | **PENDING** — not observed |
| Native print dialog / paper (T-D4d / §C) | **PENDING** — dialog unconfirmed in embedded automation; paper tester-owned |
| Pay / new commercial fixture / open shift | **not** attempted |

## Unresolved gates (honest)

- Draft persistence / journal survival, receipt reload, native print dialog, physical paper, installed PWA, scanner remain tester / pending evidence
- Historical FPM cutover-at-exchange opcode proof remains **not** claimed (current native guard proof is separate)
- Independent human GitHub APPROVED / main merge / shared alias move / production — **not** granted by this receipt
- A+D / new sale/charge/refund/stock — **forbidden** and not performed

## Rollback notes

- DB: five hosted versions recorded; do not blindly drop claims/guards; forward repair only if needed
- Bridge: restore tarball `…pre-a4f3284-20261009T214555Z.tgz` (`74519def…`) then FPM drain/exchange; prove loaded generation before commercial admission
- Preview: retain prior `452c446` / f0 / shared tester; ignore this Preview if identity wrong — no alias change required

## Related

- Packet: `CETECH-POS-WS3-Controlled-Staging-Rollout-a4f3284`
- Prior blocker (cleared): `STAGING-ROLLOUT-A4F3284-BLOCKER.md`
- Tester checklist: `TESTER-ACCEPTANCE-CHECKLIST-a4f3284.md`
