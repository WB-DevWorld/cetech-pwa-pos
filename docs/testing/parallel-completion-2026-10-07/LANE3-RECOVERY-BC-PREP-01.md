# Lane 3 — recovery inventory, FPM honesty, B/C decision (prep only)

Status: **PREP CONTINUATION COMPLETE** · restore **NOT EXECUTED** · B/C **NOT EXECUTED**  
Acting: `@wbdevworld` / WS3 · Lane 3 only · cutoff `2026-10-09T01:07Z`  
Staff-documentation impact: **NONE**  
Production effects: **NONE** · A+D cap remains consumed · RD-01 not re-applied · no deploy / alias / bridge reinstall / PHP kill

Sources: prior `RD-02-AD-EVIDENCE-CLOSURE.md`, `RD-01-STAGING-EXECUTION-RECEIPT.md`, `RUNTIME-DECISIONS-MANIFEST.md`, `LIVE-ENVIRONMENT-FACTS.md`, plus this session BatchMode SSH `cetechtrainingappserver` read-only listing (`sudo -n -u cetechtraining`) and WP-CLI / SQL stock reads.

## Result matrix

| Item | Result | Notes |
| --- | --- | --- |
| Backup identity inventory | **PASSED** | Private read-only listing + SHA-256 for bridge tarballs; empty `databases/`; task-scoped SQL dumps sized; POS dump absent; migration/privilege history from RD-01 |
| Disposable restore | **NOT RUN** | Blocker: no named non-shared local disposable target (clone hostname / isolated Supabase project id unnamed) |
| Native FPM loaded-generation | **UNVERIFIED** / probe **NOT RUN** | Historical cutover gap retained; `fpm_status_read.py --signed-off` is idle drain only — not generation reflection |
| B electronic TEST prep | **PASSED** (decision only) | Fixture IDs filled; execution forbidden under consumed A+D |
| C last-unit prep | **PASSED** (decision only) | Candidate stock=1 product **49663** discovered; POS-map / reservation still must be revalidated before any run |

---

## 1. Read-only backup / restore identity inventory

### 1.1 SSH access note

| Check | Result |
| --- | --- |
| Host | `cetechtrainingappserver` BatchMode **works** |
| Direct `ubuntu` read of `/home/cetechtraining/backups/` | Permission denied |
| Read-only via `sudo -n -u cetechtraining` | **OK** this session |
| Secrets | None dumped; no DB content excerpted |

### 1.2 Bridge plugin tarballs (rollback identity)

| Path under `/home/cetechtraining/backups/` | Bytes | mtime (host) | SHA-256 |
| --- | ---: | --- | --- |
| `cetech-pos-bridge-0.6.0-stg05-pre-ab5c7e1-20261008T164117Z.tgz` | 81447 | 2026-10-08T16:41:17Z | `c20239f1245a8697321a4f6ae89bd859ec935e695bfe706ae9c8793db01bfc8f` |
| `cetech-pos-bridge-0.6.0-stg05-before-d0480d33-20260924T074530Z.tgz` | 75528 | 2026-09-24T07:45:30Z | `9ff624173f709a7914198d038858df32e2aaf50fc762fc2fc2b6f8ea2855df1b` |
| `cetech-pos-bridge-0.2.6-br02-20260913T185756Z.tgz` | 19231 | 2026-09-13T18:57:56Z | `cf939a1241a4df717a987b67bd408bf0e163ec1da4c556ad5cacb9a097ab6f30` |
| `cetech-pos-bridge-0.2.5-br02-20260913T180200Z.tgz` | 18350 | 2026-09-13T17:56:40Z | `ae05b26b42e191553100a3bed669c6e95e518cd01c16d711a93079ad73f39c62` |
| `cetech-pos-bridge-0.2.4-br02-20260913T175500Z.tgz` | 17089 | 2026-09-13T17:53:25Z | `6014628289caac86947db3fab5a408cdd4e60c0d962b1894841bdc55257e2f03` |
| `cetech-pos-bridge-0.2.3-br02-20260913T173749Z.tgz` | 15994 | 2026-09-13T17:37:49Z | `07e586f38c0eb9ec4c94eecc6002170508f417a01723d246f7ba41e4f9ee7e69` |
| `cetech-pos-bridge-0.2.2-br02-20260913T170126Z.tgz` | 15835 | 2026-09-13T17:01:26Z | `c2d03bcb75c4b52f85a85145789e48b24cd559d71fff265dc381a021ac318ccd` |
| `cetech-pos-bridge-0.2.1-br02-20260913T165040Z.tgz` | 15158 | 2026-09-13T16:50:40Z | `b0e8a68b228dafb52e14e604a4c461bb839548dd628e579e56ca234934861f65` |
| `cetech-pos-bridge-0.1.0-br01-20260913T162937Z.tgz` | 6212 | 2026-09-13T16:29:54Z | `9364add63e79f5ad7eaa8a348b4028ac49836ed6bf0794cc40cfc2f978e79c62` |
| `cetech-pos-bridge-pre-stg01-1f119ce-20260919T161200Z.tgz` | 75400 | 2026-09-19T16:12:00Z | `e0d06dd9a32834238e9a3efa2e1b85fc1ff550a09c91113524dcb22c85d221b7` |
| `cetech-pos-bridge-pre-ux04-20260919T144734Z.tgz` | 73565 | 2026-09-19T14:47:34Z | `6883c5040753f36d3ce51db2c617e3c5f90acd70f49eebed38170b5ae52a9333` |
| `cetech-pos-bridge-pre-ux02-20260919T062905Z.tgz` | 73383 | 2026-09-19T06:29:05Z | `53febb3025b3459343383cfcae514c4806b9ecce3af265cfe50a977ce180a770` |

Plugin-only. Does **not** restore Woo DB, WP files tree, or POS staging.

### 1.3 `databases/` — empty

| Path | Status |
| --- | --- |
| `/home/cetechtraining/backups/databases/` | Present; contains only `.gitignore` (11 bytes) — **no dump stored** |
| Repo `backups/databases/` | Not present in this workspace checkout |

### 1.4 Task-scoped training WP/SQL / plugin folders (not a current complete set)

Identity only (path + size + mtime). No content/credentials extracted.

| Folder / artifact | Approx size | mtime | Role |
| --- | ---: | --- | --- |
| `delivery-engine-clean-slate-20260924T093056Z/wordpress-database.sql` | 101521096 | 2026-09-24T09:31:05Z | Fullest WP DB snapshot found; **stale vs Oct 8 sale** |
| `shipment-order-read1-preinstall-20260922T161304Z/training-db-*.sql` | ~99.7 MB | 2026-09-22 | Task-scoped |
| `address-ux3-…`, `address-ux2-…`, `pdp-precision2-…`, `city-scope-…`, `geo-country5-…`, `geo-live2-reconcile-…`, `geo-live2-…` SQL | ~87–97 MB each | 2026-09-21–22 | Task-scoped |
| `rc12-preupgrade-…/cetechtraining-pre-rc12-….sql.gz` | ~11.7 MB | 2026-09-20 | Task-scoped |
| Matching `cetech-woocommerce-delivery-engine-*.tgz` / zip in those folders | ~1.1–1.8 MB | same windows | Delivery-engine plugin trees — **not** POS bridge |
| Snippet / safety / force-po SQL crumbs | small | Aug–Sep | Not restore sets |

**Missing for a current training Woo+WP restore set:** post–2026-10-08 full files+DB dump covering order **50317** / product stock after A+D.

### 1.5 POS staging schema / data + migration / privilege history

| Asset | Identity / status |
| --- | --- |
| Staging project | `iegxncvpsyaitkpzywcr` (`ACTIVE_HEALTHY`, PostgreSQL 17) — from RD-01 / A+D evidence |
| Full POS schema/data export | **NOT CAPTURED** — no sanitized dump artifact in backups or repo |
| Hosted migration history | **25** rows after RD-01 |
| DB-SEC-01 mapping | source `20261006025100` / blob `6936b0e68a5bb3fbd4e08bd4b5f50b08d78bfef5` / PR `#143` `c512b106…` → hosted **`20261008151307`** (`db_sec_01_revoke_authenticated_truncate`) |
| Privilege result | Authenticated / anon / PUBLIC **TRUNCATE false** on 11 named tables; row counts unchanged; residual UPDATE/DELETE/default-privilege work out of RD-01 scope |
| Snapshots | before `2026-10-08T15:10:42Z` · after `2026-10-08T15:13:21Z` |
| Completed sale cross-check (prior + this stock re-read) | txn `33326bbc-1dd7-4582-8409-ea434942d8db` / `sale-50317` / Woo **50317** / receipt `rcpt-33326bbc` / product **49111** `_stock` **3** (this session) |

### 1.6 Consistency time limits (Woo vs POS — not atomic)

| Fact | Implication |
| --- | --- |
| Woo DB dumps newest full file ≈ **2026-09-24T09:31Z** | Predates A+D sale **2026-10-08T16:56Z**; restoring that dump **cannot** reproduce order 50317 / stock Δ |
| Bridge rollback tarball **2026-10-08T16:41Z** | Plugin only; independent of Woo DB and POS rows |
| POS authoritative rows live on staging after RD-01 + A+D | No paired Woo dump at the same cutoff |
| Independent dumps | **Cannot** claim atomic Woo↔POS consistency; any dual restore must record separate cutoffs and accept divergence or take a **new paired** capture under future authorization |

---

## 2. Disposable restore — NOT RUN

| Field | Value |
| --- | --- |
| Result | **NOT RUN** |
| Exact blocker | No **named** non-shared local disposable target. Proposed class only: non-shared training clone host **or** provider-supported isolated Supabase project (**not** `iegxncvpsyaitkpzywcr`). Exact clone hostname / isolated Supabase project id remain **UNVERIFIED** until an authorizer names them (`RUNTIME-DECISIONS-MANIFEST.md` §3.2; RD-03 for shared/paid/remote). |
| Forbidden | Restore onto shared training host, shared tester, staging cashiers, or production |

### Checklist (when a named local disposable target exists)

1. Name target hostname / isolated project id in writing; never shared training/production.
2. Disable outbound network, payment calls, webhook delivery, cron/background before app start.
3. Restore Woo files+DB and POS schema/data from recorded checksums/paths; preserve originals.
4. Verify order **50317** (only if dump cutoff includes it), product **49111** / C fixture, txn/receipt/shift, schema, RLS/grants, hosted migration mapping `20261008151307`, old/new app read.
5. Publish sanitized manifests + checksums only — never raw dumps/credentials.
6. Record elapsed steps; if provider restore cannot be rehearsed safely → **BLOCKED**, not PASS.

Runbook: `docs/runbooks/R10-BACKUP-RESTORE-ROLLBACK.md` (still **PREPARED — unexecuted**).

---

## 3. Native FPM / loaded-generation

| Claim | Status |
| --- | --- |
| Disk hashes + `assert_prepared_order_operation_identity` string count at install | **VERIFIED** (prior A+D) — main `63094753…` / runtime `89e4461c…` / count **2** |
| Native PHP-FPM loaded-generation / opcode identity **bound to cutover** | **UNVERIFIED** |
| Retroactive proof from a later probe | **Invalid** — cannot manufacture historical cutover proof |
| `fpm_status_read.py --signed-off` | Exists at `/home/cetechtraining/cetech-timing-release/fpm_status_read.py`; operator pattern used for **idle drain** before `rename_exchange.py --signed-off` only |
| What an idle `--signed-off` read proves | Current pool busy/idle / queue for drain — **not** SAPI/PID / reflected method signatures / opcode identity for `assert_prepared_order_operation_identity` |
| What a current-generation reflection probe would prove | Snapshot **at probe time only** (labeled current); still **not** historical cutover |
| Narrow CURRENT probe this session | **NOT RUN** — no fixed operator probe for that method; inventing one exceeds Lane 3 prep; idle drain re-read would not close the generation gap |
| Reinstall / kill PHP / pause timers / repeat A+D for FPM theatre | **Forbidden** |

Remaining release step if native FPM evidence is required: **new** operator-authorized narrow fixed training-pool probe recording SAPI/PID, reflected method signatures, and allowlisted opcode identity **at probe time only**.

---

## 4. Source / deployment / bridge identities (filled)

| Field | Exact value |
| --- | --- |
| Source / PR base | `#144` head `7d5778fe904792360947d88122050e529587aa51` · branch `ws3/combined-candidate-2026-10-08` |
| Lane 1 product SHA | `542d3ef2f862394a762de43eacf00c724b17aaec` |
| Product tip | `ab5c7e1f3849ff65100a84058e92f8b281a14be2` |
| Freeze tip | `f0feb44e9b3b241f0f712d3e306a9b768e0a070a` |
| Preview (f0 composition) | `dpl_4Vk3XQsjoqweKD6jH1qiE1echsMy` / immutable host `…-gqg6tjedt-…` / BUILD_ID `f0feb44…` |
| Bridge tree | `fc8f2d05e7fe36001c3e9265cad0b4754417fedd` |
| Live bridge main SHA-256 | `63094753eb380b57c1e7e6db1a172ead3a295112e538d6722ffb4325f7ff58ab` |
| Live bridge runtime SHA-256 | `89e4461c3ff7e7ef2dc6ff525751f799f4b92604d655880e9840256128deb76c` |
| A+D | **CONSUMED** — txn `33326bbc-1dd7-4582-8409-ea434942d8db` / `sale-50317` / Woo 50317 / `rcpt-33326bbc` — **do not repeat cash sale** |
| Cap | No second cash sale under this batch |

---

## 5. Combined B/C commercial decision (DO NOT EXECUTE under consumed A+D)

### B — electronic TEST checkout (proposed)

| Item | Exact fixture |
| --- | --- |
| Product id | **49111** |
| SKU / title | `49111` / XL INGCO Nitrile Frosted Coated Gloves |
| Stock fingerprint (this session `2026-10-09T01:03Z`) | `_stock=**3**` · `_manage_stock=yes` · `_backorders=no` · `_price=29` · `publish` |
| Why not C | Stock **3** unsuitable for last-unit with two qty-1 prepares |
| Qty / amount | 1 · **≤ GHS 29.00** (2900 minor) class |
| Tender | Paystack **TEST** only — one **new** payment reference (do not reuse R7 `pos_2f0b5a038deb47c68aa36a7b9551b098`); sandbox customer action |
| Org / location / register / shift (from A+D context) | org_a / loc_a1 / reg_a / prior shift `e82217c6-3e20-4131-abbb-1b6668e2622b` — **re-open/revalidate session before run** |
| Must prove | initialize → customer action → **server verify** reference/amount/currency/test domain → finalize → receipt → one stock Δ |
| Not enough | initialize/verify alone |
| Stop | Any live key, amount drift, non-TEST domain, second attempt after success |
| Cleanup | No refund/restock unless separately authorized |
| Execution | **NOT RUN** this batch |

### C — last-unit concurrency (proposed)

| Item | Exact fixture |
| --- | --- |
| Unsuitable | **49111 @ `_stock=3`** (also was 4 pre-A+D) — cannot prove last-unit with two qty-1 |
| Candidate (read-only Woo discovery `2026-10-09T01:05Z`) | Product id **49663** · SKU **49663** · `_stock=**1**` · `_manage_stock=yes` · `_backorders=no` · `_price=12500` · `publish` · title TOTAL TP190006 9000W Gasoline Generator… |
| Hold / reservation TTL | `woocommerce_hold_stock_minutes=**60**` (WP option this session) |
| POS-mapped / catalog searchable | **UNVERIFIED** this session — must confirm in POS search before any C run |
| Live reservations | **NOT CHECKED** — revalidate immediately before run |
| Amount caution | GHS **12500** is far above B’s ≤29 class; if any path can charge, treat as high-risk — prefer prepare-only contention or a cheaper stock=1 mapped product if later found |
| How to obtain alternate fixtures | Read-only: WP-CLI/`wp db query` for publish + `_manage_stock=yes` + `_stock=1` + `_backorders=no`; then confirm POS catalog map; **or** explicit bounded reduce-to-1 write scope (separate authorization); **or** STOP Track C |
| Attempts | Two distinct qty-1 prepares (may create up to two order records; creation precedes reservation) |
| Pass | At most one completes / receives payment/receipt / decrements stock; incomplete-order cleanup permitted |
| Forbidden in this decision | Manual restock, refund, evidence deletion |
| Stop | If no POS-mapped stock=1 fixture without unauthorized stock edit |
| Execution | **NOT RUN** this batch |

### Owner gate

Present this B/C sheet for a **new** explicit senior authorization before any commercial execution. This document is **decision prep only**.

---

## 6. Blockers (Lane 3)

1. No named disposable restore target → restore remains **NOT RUN**.
2. No current paired Woo files+DB + POS dump at A+D cutoff → full restore set incomplete.
3. Native FPM cutover proof remains **UNVERIFIED**; idle `fpm_status_read` cannot close it.
4. C candidate **49663** needs POS-map + reservation clear before any authorized run; amount class is awkward.
5. B/C execution blocked until **new** senior authorization (A+D cap consumed).

## Related

- `RD-02-AD-EVIDENCE-CLOSURE.md`
- `RD-01-STAGING-EXECUTION-RECEIPT.md`
- `HANDOFF-PRINT-PWA-RECOVERY-COMPLETION.md`
- `docs/runbooks/R10-BACKUP-RESTORE-ROLLBACK.md`
- `LIVE-ENVIRONMENT-FACTS.md` (hold-stock 60; FPM 8.5.9 vs CLI 8.4.24 — environment context only)
