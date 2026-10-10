# Lane 5 — combined B/C commercial decision (452c446 window)

> **HISTORICAL** environment/fixture pin for Preview `452c446` / `dpl_F3uXp…`.  
> Current a4 decision sheet: `LANE4-BC-COMMERCIAL-DECISION-A4F3284.md`.

Status: **DECISION SHEET ONLY — NOT EXECUTED · HISTORICAL**  
Preview approval for `452c446` does **not** extend commercial caps.  
A+D cash sale **CLOSED** (`33326bbc…` / `sale-50317`). No second cash sale.  
Staff-documentation impact: **NONE**

## Runtime under test (software)

| Field | Value |
| --- | --- |
| Preview | `dpl_F3uXpLZA7xrkTb5av4TNzDc3ZGry` |
| URL | https://cetech-pos-staging-srx2grakx-wbdevworlds-projects.vercel.app |
| SHA / BUILD_ID | `452c446fd0e3821fc3bfdb5de85a01d19a331809` |

## B — Paystack TEST electronic (≤ GHS 29)

| Item | Bound |
| --- | --- |
| Product | Woo **49111** / POS `d7c385f0-44e4-541e-b85a-267586d98857` |
| Qty | **1** |
| Amount cap | ≤ **GHS 29.00** (fixture historically GHS 29 class for A+D; re-quote at run) |
| Stock class | `_stock=3` at Woo restore cutoff — **not** last-unit |
| Tender | Paystack **TEST** only; **new** payment reference (never reuse R7) |
| Attempts / orders | Max **1** paid/completed winner; cleanup incomplete orders if create precedes pay |
| Effects | One payment claim + one stock decrement if completed |
| Pre-run revalidation | staff / register / shift / device; Paystack TEST keys; availability/reservations |
| Execution | **UNAUTHORIZED** until a separate exact B GO is recorded for this Preview |

## C — last-unit / contention

| Item | Bound |
| --- | --- |
| Mapped candidate | Woo **49663** / POS `cc0924d4-d3f5-53bc-b7db-eb6529526715` |
| Stock | **1**, backorders **off** |
| Amount | **GHS 12,500** — **outside** GHS 29 cap; **do not** run as casual ≤29 experiment |
| Preferred cheaper stock=1 mapped fixture | **not found** in this window — do not edit price/stock to invent one |
| Allowed shape if later authorized | up to two created order records, incomplete cleanup, **at most one** paid winner, one stock decrement |
| Distinguish | prepare-only reservation contention ≠ completed-winner qualification |
| Execution | **UNAUTHORIZED** — no C GO in this packet |

## Combined ask for senior (if commercial tracks required before cutover)

Authorize **exactly one** of:

1. **B GO**: one Paystack TEST sale on **49111×1 ≤GHS29** on Preview `452c446` / `dpl_F3uXp…`, max 1 completed winner; or  
2. **Defer B/C** and keep **NOT READY FOR PRODUCTION** on electronic/last-unit gates while software tester acceptance proceeds.

Do **not** authorize GHS 12,500 live charge, cash A+D repeat, or stock/price edits.
