# STAGING-ROLLOUT-A4F3284-01 — execution receipt

Status: **STAGING/TRAINING APPLIED · candidate Preview READY · authenticated noncommercial PENDING operator sign-in**  
Acting: `@wbdevworld` / WS3 (Cursor)  
Owner approval: `CETECH-POS-WS3-Controlled-Staging-Rollout-a4f3284` — APPROVED `2026-10-09T18:15:52Z`  
Staff-documentation impact: **NONE**  
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
| Native FPM loaded-generation / opcode proof | **UNVERIFIED** (idle status only; no allowlisted prepare-delete opcode probe) |

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

| Check | Result |
| --- | --- |
| Existing staff session on new immutable host | **NOT AVAILABLE** — cross-origin session does not transfer; browser showed Sign-in (autofill attempt failed; no password entered/logged) |
| Session/register/shift hydration, catalog/draft reads, order **50317** receipt/reload/reprint / no-scope | **PENDING** operator private sign-in on candidate URL |
| Pay / new commercial fixture | **not** attempted |

## Unresolved gates (honest)

- Native training FPM loaded-generation proof for prepare-delete remains **UNVERIFIED**
- Authenticated noncommercial + physical print/PWA/scanner remain tester/operator evidence
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
