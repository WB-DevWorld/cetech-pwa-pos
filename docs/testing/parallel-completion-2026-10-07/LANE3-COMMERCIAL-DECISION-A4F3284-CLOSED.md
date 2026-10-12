# Lane 3 — one bounded commercial decision (a4f3284)

Task: `A4-RECOVERY-AND-QUOTE-ATTRIBUTION-02`  
Source sheet: `LANE4-BC-COMMERCIAL-DECISION-A4F3284.md` (validated, not re-executed)  
Status: **DECISION ONLY — UNAUTHORIZED TO RUN · AUTHORIZES NO EFFECT BY ITSELF**  
UTC: `2026-10-10T03:00Z` · `@wbdevworld` / WS3  
Staff-documentation impact: **NONE**  
A+D: **CONSUMED** — order **50317** / txn `33326bbc…` read/reprint only  
Journal unresolved recovery: remains **NOT EXERCISED** (do not manufacture)

## Validated current fixtures (read-only; from prior a4 fill + this task freeze)

| Item | Current |
| --- | --- |
| Preview / BUILD_ID | `dpl_FAaW712…` / `a4f3284…` / `q2u9baevb` |
| Session class | Staging Manager · `loc_a1` · Register A · shift already open |
| Cash fixture | Woo **49111** · POS `d7c385f0…` · qty **1** · `_stock=3` · `_price=29` · backorders **no** · currency **GHS** |
| Electronic | BFF: cash available; mobile/card/terminal **unconfigured** → TEST track **blocked until configured** |
| Contention candidate | Woo **49663** · POS `cc0924d4…` · `_stock=1` · `_price=12500` · backorders **no** — **outside** GHS 29 class |
| Quote timing class (noncommercial) | Woo **14985** already measured; not a sale track |

## ONE decision covering only unrun tracks

Senior chooses **exactly one** of the following packets for Preview `a4f3284` / `dpl_FAaW712…`, or **DEFERS** (hardware/tester acceptance continues; verdict stays NOT READY FOR PRODUCTION):

### Option A — Cash GO (preferred next commercial proof)

| Bound | Cap |
| --- | --- |
| Max new completed orders | **1** |
| Max prepare attempts | **1** successful prepare identity (retries only under timeout→resolve-reality rules; no second charge) |
| Max cash charges / claims | **1** verified cash tender claim |
| Max stock decrement | **−1** on **49111** only |
| Max GHS | **29.00** (re-quote immediately before Pay; abort if quote &gt; 29.00) |
| Max concurrent actors | **1** |
| Paystack/electronic | **0** |
| Journal | Exercise recovery only if an authorized timeout/response-loss occurs naturally — do not seed unresolved ops |
| Rollback / stop | On dual tender family, orphan claim, unexpected extra order, or second stock delta → **STOP**, Attention preserve, no cleanup that destroys evidence |
| Forbidden | A+D replay; stock/price edits; shift open/close unless required by separate policy note |

### Option B — Electronic TEST GO (only if capability becomes proven first)

| Bound | Cap |
| --- | --- |
| Precondition | BFF/provider shows sandbox/TEST configured on this Preview |
| Max completed paid winners | **1** |
| Max GHS | **29.00** on **49111×1** |
| Max new payment references | **1** fresh (never reuse R7/prior) |
| Settlement proof | claim + provider truth + order link (UI callback alone insufficient) |
| Stock | **−1** only if completed winner |
| Otherwise | same stop/Attention rules as Option A |

### Option C — Last-unit contention GO (explicit amount waiver required)

| Bound | Cap |
| --- | --- |
| Fixture | **49663** only **or** separately authorized ≤29 stock=1 setup (not invented by silent price/stock edit) |
| Max GHS if 49663 | **12,500.00** — requires **explicit senior waiver**; does **not** inherit GHS 29 |
| Max created order records | **2** |
| Max completed winners | **1** |
| Max stock decrement | **−1** |
| Actors | separate attempt identities |
| Loser | evidence-preserving recovery; no destructive cleanup |

### Option D — DEFER

No new commercial effect. Keep commercial/recovery gates open. Tester continues device/PWA/scanner/paper.

## This document does not

- Authorize Pay/prepare/tender/finalize
- Reopen A+D
- Close restore or #132
- Change staff procedures
