# Lane 3 — B/C prep with verified projection maps (decision only)

Status: **PREP UPDATED** · B/C **NOT EXECUTED** · A+D cap **CONSUMED**  
Acting: `@wbdevworld` / WS3 · 2026-10-09  
Staff-documentation impact: **NONE** · Production effects: **NONE**

## Server projection maps (root review + this batch)

Project `iegxncvpsyaitkpzywcr` / org_a. Simple Woo items, not tombstoned, projected `stock_status=in_stock`.

| Woo item | POS item id | Projection updated (server) | Local/Woo revalidation this session |
| --- | --- | --- | --- |
| **49111** | `d7c385f0-44e4-541e-b85a-267586d98857` | `2026-10-09T00:59:00.257Z` | Woo `_stock=**3**` @ capture `20261009T062133Z` and restore verify |
| **49663** | `cc0924d4-d3f5-53bc-b7db-eb6529526715` | `2026-10-08T22:30:27.196Z` | Woo `_stock=**1**` · `_price=**12500**` · `_backorders=no` · restore verify |

Cashier IndexedDB freshness remains a separate device check. Do **not** treat 49663 as another ≤GHS29 fixture.

## B — electronic TEST (still decision-only)

| Item | Value |
| --- | --- |
| Product | **49111** / POS `d7c385f0-…` |
| Stock class | `_stock=3` — unsuitable for last-unit C |
| Amount class | ≤ **GHS 29.00** |
| Tender | Paystack **TEST** only; new payment reference (never reuse R7) |
| Scope to revalidate before any run | current staff / register / shift / device + TEST keys |
| Execution | **UNAUTHORIZED** this batch |

## C — last-unit contention (still decision-only)

| Item | Value |
| --- | --- |
| Mapped candidate | **49663** / POS `cc0924d4-…` · stock **1** · backorders **off** |
| Amount caution | GHS **12,500** — unsuitable to casually extend the GHS29 cap; prefer prepare-only reservation contention or a cheaper stock=1 mapped product if found later |
| Live reservations | Revalidate immediately before any future run (`woocommerce_hold_stock_minutes=60` historically) |
| Allowed commercial shape (when authorized later) | up to two created order records (create precedes reservation), existing incomplete-order cleanup, **at most one** paid/completed winner, one stock decrement |
| Distinguish | prepare-only reservation contention ≠ full paid/completed winner |
| Execution | **UNAUTHORIZED** — no C run, no manual stock edit, no refund/restock from this handoff |

## Sheet readiness

B/C sheet remains **not execution-ready**: missing chosen exact runtime for a new TEST electronic sale, current open staff/register/shift/device scope, verified Paystack TEST configuration at run time, and reservation revalidation. Projection mapping uncertainty for 49111/49663 is **closed**.
