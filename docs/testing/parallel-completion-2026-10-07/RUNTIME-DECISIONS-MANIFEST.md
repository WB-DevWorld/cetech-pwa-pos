# Runtime decisions manifest — parallel completion 2026-10-07

Status: **PREFLIGHT / DECISION RECORD ONLY**  
Staff-documentation impact: **NONE**  
Production effects: **NONE**  
Hosted DDL / live commerce / device rehearsals: **not authorized by this file**

This document records three **independent** human decisions. Approving Section 1 does **not** authorize Section 2 or 3. Approving Section 2 does **not** authorize Section 1 or 3. Approving Section 3 does **not** authorize Section 1 or 2. Each section needs its own named human authorizer, UTC timestamp, and scope note before any side effects for that section may begin.

Application candidate (context only): `#140` `0e383d84f11573ca89d6533c8cb7c35d79d7b261`  
Security candidate (Section 1 only): `#143` `c512b106bce1a0efcfd9c2caeddd54ad9e43dccd`  
Race-fix ownership (context only): **WS3** (concurrent elsewhere; this manifest does not implement it)

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
| 1 | Identify staging Supabase project (ref / project id / dashboard URL) | **UNVERIFIED** — project identity not recorded in this worktree session |
| 2 | Confirm authorized DB access path (`SUPABASE_DB_URL` or linked CLI) without pasting secrets into git/agent prompts | **UNVERIFIED** — no authorized staging DB URL / access token in release-140 session (`LANE-A-RESULT.md`) |
| 3 | Migration history: confirm `20261006025100_db_sec_01_revoke_authenticated_truncate` is **not** already applied, or record prior apply SHA/operator | Fill at preflight |
| 4 | Before: `has_table_privilege` for `authenticated` (and spot-check `anon`/`PUBLIC`) TRUNCATE on all 11 tables | Expect TRUNCATE true where hosted ALL grant remains; record raw rows |
| 5 | Before: legitimate access — authenticated `SELECT` (and app-required `INSERT` paths) still true on a sample of the 11 tables | Must remain true after |
| 6 | Before: row counts on the 11 tables (or agreed subset) with UTC timestamp | Account for concurrent legitimate row changes; do not treat small deltas alone as failure |
| 7 | After (only if apply authorized): same privilege + access + count queries | TRUNCATE false for PUBLIC/anon/authenticated on all 11; SELECT/INSERT unchanged; counts explainable |
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
staging_project: ________________   # UNVERIFIED until filled
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

Race context: global Woo order-count hazard was reproduced at fixture evidence `7f384b4`; race fix proceeds **WS3-owned** elsewhere. Live tracks either wait for that fix on the installed bridge or accept fail-closed risk explicitly in the authorization note.

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

Fill at execution; do not reuse harness UUIDs. Leave blank until the authorized operator records values.

| Slot | Value at execution |
| --- | --- |
| Environment host (training/staging URL) | `UNVERIFIED — ________________` |
| Organization id | `________________` |
| Location id | `________________` |
| Register id | `________________` |
| Device id | `________________` |
| Cashier actor id / session id | `________________` |
| Open shift id | `________________` |
| Product id / SKU / qty | `________________` / `________________` / `1` |
| Quote id + fingerprint | `________________` |
| `transactionId` | `________________` |
| prepare `Idempotency-Key` | `________________` |
| cash `Idempotency-Key` (Track A) | `________________` |
| electronic reference (Track B) | `________________` |
| finalize `Idempotency-Key` | `________________` |
| Correlation ids (quote / prepare / pay / finalize) | `________________` |
| Application SHA under test | `________________` (default pin `0e383d84…` unless superseded) |
| Bridge / plugin version | `UNVERIFIED — ________________` |

### 2.6 Section approval block

```text
decision: RD-02-LIVE-TX-QUAL
authorizer: ________________
utc: ________________
tracks_authorized: [ ] A-cash  [ ] B-electronic-sandbox  [ ] C-concurrent-stock  [ ] D-response-loss-reload
host: ________________
product_id: ________________
race_fix_status_on_host: fixed SHA _____ / accepted fail-closed risk (circle)
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
| 1 | Launch from **installed** PWA (not desktop browser profile); record `BUILD_ID` / release-policy | ☐ |
| 2 | Authenticate; confirm cashier / register / shift are server-derived | ☐ |
| 3 | Record device: tablet/PC, OS, scanner model/interface, printer model/driver, paper 58/80 mm; Settings paper width matches stock | ☐ |
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
| Candidate pin / tester alias | `CANDIDATE-DEPLOYMENT-MANIFEST.md`; tester `816e0bb…` must stay unless a **new** release decision | Alias unchanged by parallel lanes |
| Isolated restore rehearsal | Required by Q-OPS-05 / R10 runbook section B | **UNVERIFIED / unexecuted** |

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
| Order-count race fix | **WS3-owned**, concurrent elsewhere — not implemented by this manifest |
| Section independence | Approval of any one RD-0N never implies the others |

### UNVERIFIED fields index

| Field | Section | Why |
| --- | --- | --- |
| Staging Supabase project identity | 1 | Not recorded in this worktree |
| Staging DB URL / linked access | 1 | Unset in release-140 / Lane A session |
| Staging before/after privileges & counts | 1 | Hosted apply unauthorized; preflight not run |
| Live fixture host / register / session / product / keys | 2 | Placeholders; live plan not executed |
| Bridge/plugin version on live host | 2 | Not pinned in this document |
| Installed PWA / physical printer / scanner | 3 | Desktop ≠ installed; hardware UNVERIFIED |
| Backup restore rehearsal | 3 | Runbook PREPARED only |
| Electronic sandbox IDs for this candidate | 2 | Must be newly recorded; do not reuse R7 as PASS |

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/testing/parallel-completion-2026-10-07/RUNTIME-DECISIONS-MANIFEST.md` |
| Prepared for | Integration editor aide / parallel completion |
| Related | `CHECKPOINT-60m.md`, `LANE-A-RESULT.md`, `LANE-B-LIVE-RUNTIME-PLAN.md`, `LANE-C-RESULT.md`, `LANE-D-RESULT.md`, `CANDIDATE-DEPLOYMENT-MANIFEST.md` |
