# Lane 3 continuation — backup identity, FPM current probe, B/C request

Captured: 2026-10-09T01:08Z (approx) via `cetechtrainingappserver` read-only/`sudo -n`  
Status: inventory **PASSED** · restore **NOT RUN** · FPM current idle **PASSED (limited)** · historical cutover **UNVERIFIED** · B/C **PREP ONLY**  
Staff-documentation impact: **NONE** · Production effects: **NONE**

## Backup identity (sanitized)

| Asset | Result |
| --- | --- |
| `/home/cetechtraining/backups/` listing | **PASSED** (sudo) — bridge tarballs + task-scoped dirs; no full WP dump present in listing |
| Rollback tarball | `cetech-pos-bridge-0.6.0-stg05-pre-ab5c7e1-20261008T164117Z.tgz` SHA-256 **`c20239f1245a8697321a4f6ae89bd859ec935e695bfe706ae9c8793db01bfc8f`** (re-verified) |
| `backups/databases/` | **empty** (only `.gitignore`) — **no** Woo/POS DB dump stored |
| Full training WP/Woo files+DB package | **NOT FOUND** in this inventory — **blocker** for complete restore proof |
| POS staging schema/data export | **NOT CAPTURED** this session |
| Hosted migration | RD-01 applied · hosted `20261008151307` · source `20261006025100` (prior receipt) |
| Cross-system snapshot atomicity | Woo listing time ≠ POS dump time — **cannot** claim atomic consistency |
| Sale cross-check (prior) | 50317 / txn `33326bbc…` / 49111 stock last reported **3** |

## Disposable restore

| Check | Result |
| --- | --- |
| Named non-shared local target | **NOT AVAILABLE** → restore **NOT RUN** |
| Shared/production restore | **FORBIDDEN** |

Blocker: no complete Woo+POS dump set and no named disposable local target. Checklist remains in `LANE3-RECOVERY-BC-PREP-01.md`.

## Native FPM (current generation only)

| Probe | Result |
| --- | --- |
| `sudo -n python3 …/fpm_status_read.py --signed-off` | **`{"accepted": true, "reason": "idle"}`** |
| What this proves | Training FPM status endpoint accepted signed-off read and reported **idle** at probe time |
| What this does **not** prove | Cached opcode identity, SAPI/PID binding to the earlier bridge cutover, reflected method signatures for `assert_prepared_order_operation_identity` |
| Historical cutover loaded-generation | Remains **UNVERIFIED** — later idle read cannot establish pre-open cutover |

## Ready B/C execution request (DO NOT RUN until new senior auth)

### Frozen identities

| Item | Value |
| --- | --- |
| PR / branch | `#144` / `ws3/combined-candidate-2026-10-08` |
| Product composition SHA | `542d3ef2f862394a762de43eacf00c724b17aaec` |
| Evidence/PR tip (re-verify) | `67f89b1a7e02afeade4c9ab60c7167eeef586266` |
| Bridge | live `63094753…` / manifest `89e4461c…` |
| f0 Preview | `dpl_4Vk3XQ…` / `f0feb44…` (not B/C host unless separately chosen) |
| A+D | **CONSUMED** — do not repeat cash sale 50317 |

### B — electronic TEST (one sale ≤ GHS29)

| Field | Exact |
| --- | --- |
| Product | Revalidate **49111** immediately before run (managed stock, published, POS-mapped); last stock **3** |
| Qty / amount | 1 / ≤ **2900** minor GHS |
| Path | prepare → Paystack **TEST** customer action → **server verify** ref/amount/currency/test domain → finalize → receipt → one stock Δ |
| Caps | One new TEST reference only; no live keys |
| Stop | Amount/domain drift; verify-only without finalize; second attempt after success |
| Cleanup | No refund/restock unless separately authorized |

### C — last-unit concurrency

| Field | Exact |
| --- | --- |
| Fixture | **Not 49111 @ 3** — need published mapped managed-stock product with **`_stock=1`**, `_backorders=no`, no live reservations |
| Fixture discovery this session | **NOT RUN** — no safe stock=1 id confirmed without stock edit |
| Attempts | Two distinct qty-1 prepares; allow up to **two** order records (create-before-reserve) + existing incomplete-order cleanup |
| Pass | ≤1 paid/completed winner with receipt and stock decrement |
| Forbidden | Manual stock edit, restock, refund, evidence deletion |

**Authorization requested:** explicit senior GO for B and/or C with the above caps after stock=1 fixture ID is filled (C) and 49111 revalidated (B). This document is not that GO.
