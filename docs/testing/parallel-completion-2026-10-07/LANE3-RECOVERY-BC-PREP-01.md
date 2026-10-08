# Lane 3 — recovery inventory, FPM honesty, B/C decision (prep only)

Status: **PREP / INVENTORY** · restore **NOT EXECUTED** · B/C **NOT EXECUTED**  
Staff-documentation impact: **NONE**  
Production effects: **NONE** · A+D cap remains consumed · RD-01 not re-applied

## Read-only backup / restore identity inventory

Sources: `RD-02-AD-EVIDENCE-CLOSURE.md`, training host notes, repo `backups/` layout.

| Asset | Identity / status |
| --- | --- |
| Bridge rollback tarball | `/home/cetechtraining/backups/cetech-pos-bridge-0.6.0-stg05-pre-ab5c7e1-20261008T164117Z.tgz` SHA-256 `c20239f1…` |
| Installed bridge runtime | live `63094753…` / manifest `89e4461c…` / tree `fc8f2d05…` |
| Other bridge tarballs | Multiple historical under `/home/cetechtraining/backups/` — identity only |
| Training WP/Woo full files+DB dump | **NOT INVENTORIED as a complete current set** this session |
| Task-scoped SQL dumps | geo/city/shipment/pdp/rc12/checkout folders — **not** complete Woo+POS restore |
| Repo `backups/databases/` | Present, **empty** (`.gitignore` only) |
| POS staging schema/data export | **NOT CAPTURED** this session (sanitized manifest only when taken) |
| Hosted migration mapping | DB-SEC-01 applied · hosted `20261008151307` · source `20261006025100` |
| Completed sale cross-check (prior) | txn `33326bbc…` / sale-50317 / Woo 50317 / stock 49111 observed **3** after sale |
| Snapshot atomicity | Independent dumps **cannot** claim atomic Woo↔POS consistency |
| Isolated disposable restore | **NOT RUN** — no named non-shared local target exercised; outbound network/payment/cron disable checklist prepared below |
| Shared / paid / remote restore | **FORBIDDEN** (RD-03) |

### Disposable restore checklist (when a named local target exists)

1. Name target (non-shared); never shared training/production.
2. Disable outbound network, payment calls, webhook delivery, cron/background before app start.
3. Restore Woo files+DB and POS schema/data from recorded checksums; preserve originals.
4. Verify order **50317**, product **49111**, txn/receipt/shift, schema, RLS/grants, hosted migration mapping, old/new app read.
5. Publish sanitized manifests + checksums only — never raw dumps/credentials.

## Native FPM / loaded-generation

| Claim | Status |
| --- | --- |
| Disk hashes + plugin identity string at install | VERIFIED (prior A+D evidence) |
| Native PHP-FPM loaded-generation / opcode identity bound to cutover | **UNVERIFIED** |
| Retroactive proof from later probe | **Invalid** — cannot manufacture historical cutover proof |
| Safe current-pool reflection for `assert_prepared_order_operation_identity` | **No fixed operator probe** present; narrow probe needs explicit operator scope |
| Reinstall / kill PHP / pause timers / repeat A+D for FPM theatre | **Forbidden** |

Remaining release step if native FPM evidence is required: operator-authorized narrow fixed training-pool probe recording SAPI/PID, reflected method signatures, and allowlisted opcode identity **at probe time only** (labeled current, not historical cutover).

## Combined B/C commercial decision (DO NOT EXECUTE under consumed A+D)

Frozen context for any future owner authorization:

| Field | Value |
| --- | --- |
| Source / PR | `#144` / branch `ws3/combined-candidate-2026-10-08` |
| Product tip | `ab5c7e1…` |
| Preview (f0) | `dpl_4Vk3XQ…` / BUILD_ID `f0feb44…` — receipt path only until corrected Preview |
| Bridge | `89e4461c…` / live `63094753…` |
| A+D | **CONSUMED** — txn `33326bbc…` / sale-50317 — do not repeat cash sale |
| Cap | No second cash sale under this batch |

### B — electronic TEST checkout (proposed)

| Item | Exact fixture |
| --- | --- |
| Product | Revalidate **49111** (SKU / name / managed stock / published / POS-mapped) immediately before run |
| Qty / amount | 1 · **≤ GHS 29.00** (2900 minor) class |
| Tender | Paystack **TEST** only — one new payment reference; sandbox customer action |
| Must prove | initialize → customer action → **server verify** reference/amount/currency/test domain → finalize → receipt → one stock Δ |
| Not enough | initialize/verify alone |
| Stop | Any live key, amount drift, non-TEST domain, second attempt after success |
| Cleanup | No refund/restock unless separately authorized |

### C — last-unit concurrency (proposed)

| Item | Exact fixture |
| --- | --- |
| Product | **Not 49111 @ stock 3** — find published POS-mapped managed-stock product with **`_stock=1`**, `_backorders=no`, no live reservations |
| Record before run | product id, SKU, price, reservation TTL, stock=1 proof |
| Attempts | Two distinct qty-1 prepares (may create up to two order records; creation precedes reservation) |
| Pass | At most one completes / receives payment/receipt / decrements stock; incomplete-order cleanup permitted |
| Forbidden in this decision | Manual restock, refund, evidence deletion |
| Stop | If no stock=1 fixture exists without unauthorized stock edit |

### Owner gate

Present this B/C sheet for a **new** explicit senior authorization before any commercial execution. This document is **decision prep only**.
