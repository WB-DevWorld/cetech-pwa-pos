# Runtime decisions manifest — parallel completion 2026-10-07

Status: **PREFLIGHT / DECISION RECORD ONLY**  
Staff-documentation impact: **NONE**  
Production effects: **NONE**  
Hosted DDL / live commerce / device rehearsals: **not authorized by this file**

This document records three **independent** human decisions. Approving Section 1 does **not** authorize Section 2 or 3. Approving Section 2 does **not** authorize Section 1 or 3. Approving Section 3 does **not** authorize Section 1 or 2. Each section needs its own named human authorizer, UTC timestamp, and scope note before any side effects for that section may begin.

Combined final candidate (PR [#144](https://github.com/WB-DevWorld/cetech-pwa-pos/pull/144)): tip `7d75c3944d41a5990aa64004c9e96954779c9730` on `ws3/combined-candidate-2026-10-08`  
Application baseline (included): `#140` `0e383d84f11573ca89d6533c8cb7c35d79d7b261`  
Security candidate (Section 1 only): `#143` `c512b106bce1a0efcfd9c2caeddd54ad9e43dccd`  
Race-fix **product** identity: `daac7e035d992c2798a317a0cf371f2925a9fe35` (`assert_prepared_order_operation_identity`) — **WS3-owned, in this combined candidate** (not concurrent elsewhere). Lane 1 may push further bridge repairs atop `7d75c39`; preserve that reviewed tip until repairs land.  
Documentation-only tips (no race/product change): `58af8dc…`, `a0d93de…`, `7d75c39…` (lease/manifest import). Distinguish these from product SHA `daac7e0`.  
Race-fix live status: **not** installed on training bridge yet. This manifest does not authorize live apply or plugin install.

Lane-2 read-only fill window: `2026-10-08T14:12Z`–`2026-10-08T14:22Z` UTC (SSH training + public tester BFF probes) plus documentation reconcile in this Lane-2 pass. No hosted DDL, no tester-alias move, no commercial effects. Verdict: **NOT READY FOR PRODUCTION**.

---

## Section 1 — Staging privilege repair

**Decision ID:** `RD-01-STAGING-TRUNCATE-REVOKE`  
**Approval of this section:** staging preflight + (when separately authorized) hosted apply of the pinned shipping migration only.  
**Does not authorize:** live cash/stock/payment (Section 2), installed-PWA/printer/backup rehearsals (Section 3), production, residual UPDATE/DELETE/default-privilege work, or any GRANT TRUNCATE.

### 1.1 Shipping migration path (exact)

```text
supabase/migrations/20261006025100_db_sec_01_revoke_authenticated_truncate.sql
```

### 1.2 Pin

| Field | Value |
| --- | --- |
| PR | `#143` |
| Commit SHA | `c512b106bce1a0efcfd9c2caeddd54ad9e43dccd` |
| Blob size | **1332 bytes** |
| Blob object | `6936b0e68a5bb3fbd4e08bd4b5f50b08d78bfef5` |
| `GRANT TRUNCATE` in shipping file | **None** (comments may mention TRUNCATE; no executable GRANT) |

Local Lane A proof (not a hosted apply): `LANE-A-RESULT.md` — disposable seed/replay + omit-invoke negative control + pgTAP 20 files / 419 tests PASS on that SHA.

### 1.3 Intended effects (shipping migration only)

| Effect | Scope |
| --- | --- |
| `REVOKE TRUNCATE` | From `PUBLIC`, `anon`, `authenticated` on **11** tables: `pos_cash_movements`, `pos_devices`, `pos_integration_watermarks`, `pos_locations`, `pos_organizations`, `pos_outbox_events`, `pos_pending_operations`, `pos_registers`, `pos_shifts`, `pos_staff_location_assignments`, `pos_staff_register_assignments` |
| `REVOKE ALL ON FUNCTION` | `public.db_sec_01_revoke_authenticated_truncate()` from `PUBLIC`, `anon`, `authenticated` |
| Final invocation | `SELECT public.db_sec_01_revoke_authenticated_truncate();` (required; definition alone is insufficient) |
| Unchanged | `SELECT` / `INSERT` (and existing `UPDATE`/`DELETE` where already granted), RLS policies, `service_role` privileges |
| Out of this section | Residual `UPDATE`/`DELETE` hardening; future-table default privileges; any speculative indexes/policies |

### 1.4 Preflight checklist (must complete before any hosted DDL)

Hosted DDL remains **UNAPPROVED** until a separate CURRENT-WORK / operator note names the authorizer, staging project, and write window. This subsection is **preflight only**.

| # | Check | Record / gate |
| --- | --- | --- |
| 1 | Identify staging Supabase project (ref / project id / dashboard URL) | **BLOCKED** — no project ref/id/dashboard URL in repo evidence; no linked `supabase` project / `SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_URL` in this session (`LANE-A-RESULT.md` same gap). Not an owner-approval gap. |
| 2 | Confirm authorized DB access path (`SUPABASE_DB_URL` or linked CLI) without pasting secrets into git/agent prompts | **BLOCKED** — same as #1; `npx supabase` present (2.120.0) but unauthenticated / unlinked |
| 3 | Migration history: confirm `20261006025100_db_sec_01_revoke_authenticated_truncate` is **not** already applied, or record prior apply SHA/operator | **UNVERIFIED** — needs hosted SQL/`supabase_migrations` read (blocked by #1/#2). Historical note only: DB-SEC-01 observed live history version `20261003083357` before this shipping version; no hosted apply of `20261006025100` recorded |
| 4 | Before: effective TRUNCATE for `authenticated` / `anon` / `PUBLIC` on all 11 tables | **UNVERIFIED** — prior observation `2026-10-06T02:43:00Z` / `02:44:21Z` (DB-SEC-01): `authenticated` TRUNCATE true on 11; `anon` none. **PUBLIC** must be re-read via `relacl` / catalog ACL (not `has_table_privilege` login assumption). Fresh re-read blocked by #1/#2 |
| 5 | Before: legitimate access — authenticated `SELECT` (and app-required `INSERT` paths) still true on a sample of the 11 tables | **UNVERIFIED** — blocked by #1/#2; intended post-condition remains SELECT/INSERT preserved |
| 6 | Before: row counts on the 11 tables (or agreed subset) with UTC timestamp | **UNVERIFIED** — blocked by #1/#2 |
| 7 | After (only if apply authorized): same privilege + access + count queries | N/A — hosted apply **not authorized** / not performed |
| 8 | Lock / stop conditions | STOP if production project selected; STOP if migration history conflicted; STOP if SELECT/INSERT regresses; STOP if unexpected DDL beyond this file; STOP if operator cannot identify staging project |

### 1.5 Rollback

- Application / migration rollback must **NOT** re-grant `TRUNCATE` to `authenticated` (or PUBLIC/anon).
- Correction path is **forward only**: re-apply / re-invoke the shipping helper (or a later forward repair that also does not GRANT TRUNCATE).
- Code rollback does not reverse a successful privilege revoke and must not invent a GRANT to “undo” it.

### 1.6 Residual questions (separate decisions — not implied by RD-01)

- Whether hosted `UPDATE`/`DELETE` on these tables should be further revoked or narrowed.
- Whether default privileges for future tables need a separate migration once the granting role is known.
- Production apply of the same file (never implied by staging preflight or staging apply).

### 1.7 Section approval block

```text
decision: RD-01-STAGING-TRUNCATE-REVOKE
authorizer: ________________
utc: ________________
staging_project: ________________   # BLOCKED until hosted identity/access available
scope: preflight only | preflight + hosted apply (circle one)
hosted_ddl_authorized: NO (default) / YES (requires explicit note)
notes:
```

---

## Section 2 — Live transaction qualification

**Decision ID:** `RD-02-LIVE-TX-QUAL`  
**Approval of this section:** authorized training/staging live transaction rehearsals listed below only.  
**Does not authorize:** staging TRUNCATE DDL (Section 1), installed-PWA/printer/backup (Section 3), production, live Paystack (non-TEST), refund/restock, or VitePOS deactivation.

Adapted from `LANE-B-LIVE-RUNTIME-PLAN.md` (plan only; **not executed**). Expand into four **separate** exercise tracks so one PASS cannot be read as another.

### 2.0 Authority rule (all tracks)

1. Explicit operator write authorization for training order/stock/tender effects (historical grants do not count).
2. Training containment / identity CURRENT_PASS; secrets off git / not pasted into prompts.
3. Host is training/staging only — never production.
4. **Necessary quote ≠ cash authorization ≠ stock authorization ≠ payment authorization.** An authoritative quote proves price/context only. Prepare, cash tender, stock effect, and electronic initialize/charge each require their own authorized step and evidence. Do not treat quote success as permission to tender or mutate stock.

Race context: global Woo order-count hazard was reproduced at fixture evidence `7f384b4`. Combined candidate **implements** identity-based prepare proof (`daac7e0`, `assert_prepared_order_operation_identity`). **Installed training bridge still uses the global order-count gate** (see §2.5). Live tracks must either install/activate the combined bridge artifact first or accept fail-closed risk explicitly in the authorization note.

### 2.1 Track A — Cash (training)

Follow Lane B plan steps 1–10 for cash only (`LANE-B-LIVE-RUNTIME-PLAN.md`).

| Gate | Requirement |
| --- | --- |
| Before | HPOS/order fingerprint, product `_stock`, hold minutes, plugin version, no production host |
| Quote | BFF authoritative quote; POS must not invent unit price |
| Prepare | One prepare → one unpaid Woo order + reserved/proven commitment |
| Replay / conflict | Same key+body → same sale; same key+altered body → `IDEMPOTENCY_CONFLICT`; order delta still one |
| Cash | One cash ledger/tender; duplicate same key → same `paymentId` |
| Finalize | One commercial completion + one intended stock effect; duplicate finalize → no second effect |
| After | Order delta +1 POS order; stock delta = intended only; one receipt id |

**Non-actions:** no Paystack/MoMo/card; no return/refund/restock; no journal/attention deletion.

### 2.2 Track B — Electronic sandbox (TEST only)

Separate authorization from cash. Reuse historical R7 Paystack TEST discipline (`docs/integration/evidence/R7-PAY-01-SANDBOX.md`) as method guidance only — do **not** claim that historical order as this candidate’s PASS.

| Gate | Requirement |
| --- | --- |
| Mode | Paystack **TEST** / approved sandbox only; live electronic **NOT AUTHORIZED** |
| Binding | Provider verification binds reference, transaction/order, exact amount and currency |
| Duplicate | Same reference / webhook replay must not double-tender or double-finalize |
| Pending | Unknown/pending must resolve reality; no blind new initialize |
| Quote rule | Quote success still does not authorize initialize/charge |

Fill new fixture IDs at execution; do not reuse harness or R7 production-looking IDs as “already done.”

### 2.3 Track C — Concurrent stock

| Gate | Requirement |
| --- | --- |
| Product | Stock-managed simple product; known `_stock` before-state (`manage_stock` must be yes) |
| Contention | Last-unit / concurrent prepare vs online or second POS attempt per authorized script |
| Pass | Exactly one winner commitment; loser fail-closed; no oversell |
| Fail | Second reservation/order that oversells, or unexplained stock move |

Do not substitute Lane B unit fixtures for this live track.

### 2.4 Track D — Response-loss / reload

| Gate | Requirement |
| --- | --- |
| Lost prepare HTTP | Drop/ignore once; `SalesPort.resolve` / GET sale returns original prepared sale; no second order |
| Journal | Original `transactionId` / idempotency keys retained; do not delete attention/journal rows |
| Remount | Reopen Sell / Needs attention same register scope; unresolved attempt restores identity |
| Rule | No blind Pay retry with a **new** prepare key while an attempt is unresolved |

### 2.5 Fixture / register / session / correlation placeholders

Read-only training host facts filled below. Mint new UUIDs / keys only at authorized execution. Do not reuse harness or historical R6/R7 command IDs as this candidate’s PASS.

| Slot | Value at execution |
| --- | --- |
| Environment host (training/staging URL) | `https://training.cetechbpa.com` (`WP_ENVIRONMENT_TYPE=staging`; blogname contains TRAINING) — **VERIFIED** SSH `2026-10-08T14:14Z` |
| Organization id | **UNVERIFIED** — requires authenticated BFF/Supabase session (health returns `AUTH_REQUIRED` without staff session) |
| Location id | **UNVERIFIED** — same |
| Register id | **UNVERIFIED** — same |
| Device id | **UNVERIFIED** — same |
| Cashier actor id / session id | **UNVERIFIED** — same |
| Open shift id | **UNVERIFIED** — same |
| Product id / SKU / qty (safe stock fixture) | Woo `49111` / SKU `49111` / proposed qty `1` — `_manage_stock=yes`, `_stock=4`, `_price=29`, `_backorders=no`, `publish` — **VERIFIED** WP-CLI `2026-10-08T14:14Z` |
| Hold-stock minutes / global manage stock | `60` / `yes` — **VERIFIED** |
| HPOS `shop_order` count fingerprint | `97` — **VERIFIED** WP-CLI SQL `2026-10-08T14:20Z` (concurrent legitimate orders may change) |
| Quote id + fingerprint | `________________` (mint at execution) |
| `transactionId` | `________________` |
| prepare `Idempotency-Key` | `________________` |
| cash `Idempotency-Key` (Track A) | `________________` |
| electronic reference (Track B) | `________________` |
| finalize `Idempotency-Key` | `________________` |
| Correlation ids (quote / prepare / pay / finalize) | `________________` |
| Application SHA under test (shared tester BFF) | Observed `BUILD_ID` / release-policy all builds = `816e0bb6963aff760609a3c7e4817e603c4ffdf0` at tester origin `https://cetech-pos-staging-git-integration-9578df-wbdevworlds-projects.vercel.app` — **VERIFIED** `2026-10-08T14:15Z`. Historical deployment id pin (docs): `dpl_nxWGrSLqaLBGNNN683QjdixNBjF6`. Combined candidate `#144` tip is **not** what the tester alias currently serves. |
| Bridge / plugin version (installed training) | **Active** `cetech-pos-bridge` **`0.6.0-stg05`** — **VERIFIED** WP-CLI. Main file SHA-256 `9fee0c40fd957eb0ec16bbe064fa2bb1122daec56d4d862bf0b34fc7bdc1f78b`; `class-woo-runtime.php` SHA-256 `39159cb39eec8e687257dc9c604edab637df26787a522c4ceff4280cd891167b`. Installed runtime still contains global order-count fail string; **lacks** `assert_prepared_order_operation_identity` (grep counts 1 / 0). |

### 2.5a Proposed commercial caps (plan only — not authorized / not executed)

These are concrete proposed ceilings for an operator authorization note. They do **not** grant write authority.

| Track | Proposed cap | Rationale |
| --- | --- | --- |
| A — Cash | **One** cash sale; product `49111` qty **1**; expected total **GHS 29.00** (minor 2900) at current training price; order delta **+1**; stock delta **−1** only if finalize stock effect is the authorized intent | Matches R6/R7 price class; `_stock=4` leaves headroom for one unit without last-unit contention |
| B — Electronic TEST | **One** Paystack **TEST** initialize/verify; same product/qty/total class as Track A (**GHS 29.00** / 2900); **no** live keys; new reference only | R7 method guidance; do not reuse R7 reference `pos_2f0b5a038deb47c68aa36a7b9551b098` |
| C — Concurrent stock | **One** last-unit (or qty=1 vs concurrent second prepare) on stock-managed `49111` after operator records a fresh `_stock` fingerprint; stop on any unexplained second reservation/order | Do not start from Lane B unit fixtures alone |
| D — Response-loss | **One** prepare with intentional dropped HTTP once; resolve/remount only; **no** second prepare key; pairs with Track A identity rules | No extra commercial completion beyond the single authorized sale |

### 2.6 Section approval block

```text
decision: RD-02-LIVE-TX-QUAL
authorizer: ________________
utc: ________________
tracks_authorized: [ ] A-cash  [ ] B-electronic-sandbox  [ ] C-concurrent-stock  [ ] D-response-loss-reload
host: https://training.cetechbpa.com
product_id: 49111 (proposed)
race_fix_status_on_host: NOT installed (0.6.0-stg05 still global order-count) / install combined daac7e0+ first / accepted fail-closed risk (circle)
notes:
```

---

## Section 3 — Device, printing and rollback

**Decision ID:** `RD-03-DEVICE-PRINT-ROLLBACK`  
**Approval of this section:** installed-client / printer / disposable backup-restore rehearsal scope only.  
**Does not authorize:** staging TRUNCATE DDL (Section 1), live cash/electronic/stock tracks (Section 2), production promotion, or tester-alias moves.

**Hard rule:** Desktop Chromium / Playwright evidence is **not** installed PWA PASS (`LANE-D-RESULT.md`, `browser-desktop-evidence.json`). Do not claim desktop browser = installed PWA.

### 3.1 Installed PWA + cashier device / printer checklist (executable)

Record model/OS/build before starting. Candidate context: `0e383d84f11573ca89d6533c8cb7c35d79d7b261` (`CANDIDATE-DEPLOYMENT-MANIFEST.md`). Procedure spine: `docs/runbooks/R10-DEVICE-AND-PWA-REHEARSAL.md` + Lane C hardware steps in `LANE-C-RESULT.md`.

| # | Step | Result |
| --- | --- | --- |
| 1 | Launch from **installed** PWA (not desktop browser profile); record `BUILD_ID` / release-policy | ☐ — current shared tester origin still serves `816e0bb…` (see §2.5); Exact SHA Preview of `0e383d84…` not claimed here |
| 2 | Authenticate; confirm cashier / register / shift are server-derived | ☐ |
| 3 | Record device: tablet/PC, OS, scanner model/interface, printer model/driver, paper 58/80 mm; Settings paper width matches stock | ☐ — training appserver has **no** CUPS/`lpstat` (expected: printer is cashier-local) |
| 4 | Create cart/draft; refresh/close/reopen; drafts/journal survive (no clear-all storage) | ☐ |
| 5 | Reconnect / update: observe waiting worker; activation blocked during tender/critical; activate only at safe point; local data survives (`R10-DEVICE-AND-PWA-REHEARSAL.md` B–C) | ☐ |
| 6 | Multi-window/tab lease: only authorized surface owns lifecycle activation | ☐ |
| 7 | Receipt: one authorized training sale or prior safe receipt print; on print failure, sale stays complete — **no** second Pay/prepare | ☐ |
| 8 | Reprint from Orders: same business content; **no** second payment/order/stock effect | ☐ |
| 9 | Attach evidence via `docs/integration/evidence/R10/R10-EVIDENCE-TEMPLATE.md` | ☐ |

Lane D local status to cite (not substitute): desktop 7/7 + 122 focused tests PASS_WITH_GATES; installed-PWA / cashier-hardware **UNVERIFIED**.

### 3.2 Backup / restore — available evidence vs disposable demo scope

| Topic | Available evidence (cite only) | Status |
| --- | --- | --- |
| Runbook | `docs/runbooks/R10-BACKUP-RESTORE-ROLLBACK.md` | **PREPARED — unexecuted** |
| App rollback vs commerce | Same + `docs/runbooks/RELEASE-AND-ROLLBACK.md`; Lane D notes code rollback ≠ Woo/payment/stock reversal | Documented |
| Candidate pin / tester alias | `CANDIDATE-DEPLOYMENT-MANIFEST.md`; tester `816e0bb…` must stay unless a **new** release decision | Alias unchanged; live probe confirms still `816e0bb…` |
| Training bridge backup identity (read-only) | `/home/cetechtraining/backups/` includes `cetech-pos-bridge-0.6.0-stg05-before-d0480d33-20260924T074530Z.tgz` plus older `0.2.x-br02` tarballs — **VERIFIED** listing `2026-10-08T14:12Z` | Identity only; restore **not** rehearsed |
| Isolated restore rehearsal | Required by Q-OPS-05 / R10 runbook section B | **UNVERIFIED / unexecuted** |
| Vercel CLI for fresh dpl re-inspect | Local Vercel auth token **expired** `2026-10-07T16:43:29Z` → API 403; refresh 400. Blocker is credential expiry, not owner approval. | **BLOCKED** for live `dpl_*` re-query; docs pin `dpl_nxWGrSLqaLBGNNN683QjdixNBjF6` still cited |

**Disposable restore demo scope** (prepare only; execute only under RD-03 approval):

1. Choose an **isolated** restore target (never production; never shared tester destructive restore).
2. Restore disposable WP DB/files snapshot **or** provider-supported isolated Supabase target — not over live staging cashiers.
3. Verify representative records: one known Woo order, one product/stock row, one POS transaction/shift/receipt reference (redact secrets).
4. Run read-only health/consistency checks; record elapsed steps and missing dependencies.
5. Separately rehearse **application** rollback to prior known-good build without deleting newer business rows.
6. Record BLOCKED if provider restore cannot be rehearsed safely; do not invent PASS.

### 3.3 Section approval block

```text
decision: RD-03-DEVICE-PRINT-ROLLBACK
authorizer: ________________
utc: ________________
scopes_authorized: [ ] installed-PWA  [ ] printer/reprint  [ ] disposable-restore-demo  [ ] app-rollback-rehearsal
device_id / BUILD_ID: ________________
notes:
```

---

## Cross-cutting (not a fourth approval)

| Item | State |
| --- | --- |
| Staff-doc impact | **NONE** |
| Production promotion | **NONE** / not authorized |
| Lane E profiler | **Parked** — no new profiler lease |
| Order-count race fix | **WS3-owned**, **implemented on combined candidate** (`daac7e0` in PR #144 tip ancestry). **Not** installed on training (`0.6.0-stg05` still global order-count). Not authorized for live apply by this manifest |
| Shared tester BFF | Origin `https://cetech-pos-staging-git-integration-9578df-wbdevworlds-projects.vercel.app`; `BUILD_ID=816e0bb6963aff760609a3c7e4817e603c4ffdf0`; docs deployment pin `dpl_nxWGrSLqaLBGNNN683QjdixNBjF6` |
| Section independence | Approval of any one RD-0N never implies the others |

### UNVERIFIED / BLOCKED fields index

| Field | Section | Why |
| --- | --- | --- |
| Staging Supabase project identity | 1 | **BLOCKED** — no linked CLI / access token / project ref in session |
| Staging DB URL / migration history / fresh ACL+counts | 1 | **BLOCKED** — same access gap (PUBLIC via `relacl` still required when access returns) |
| Org / location / register / device / shift / cashier session | 2 | **UNVERIFIED** — BFF health requires staff session (`AUTH_REQUIRED`) |
| Installed PWA / physical printer / scanner | 3 | Desktop ≠ installed; appserver has no CUPS; hardware UNVERIFIED |
| Backup restore rehearsal | 3 | Runbook PREPARED; backups identity listed only |
| Fresh Vercel `dpl_*` API re-inspect | 2/3 | **BLOCKED** — local Vercel token expired 2026-10-07 |
| Electronic sandbox IDs for this candidate | 2 | Must be newly recorded; do not reuse R7 as PASS |
| Hosted TRUNCATE apply | 1 | Not authorized |

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/testing/parallel-completion-2026-10-07/RUNTIME-DECISIONS-MANIFEST.md` |
| Prepared for | Integration editor aide / parallel completion / PR #144 |
| Lane-2 fill | WS3 Lane 2 read-only facts `2026-10-08` on combined tip (moves with later commits) |
| Related | `CHECKPOINT-60m.md`, `LANE-A-RESULT.md`, `LANE-B-RESULT.md`, `LANE-B-LIVE-RUNTIME-PLAN.md`, `LANE-C-RESULT.md`, `LANE-D-RESULT.md`, `CANDIDATE-DEPLOYMENT-MANIFEST.md`, `browser-desktop-evidence.json`, `COMBINED-CANDIDATE.md` |
