# Lane 4 — commercial decision sheet (a4f3284) — READ-ONLY

Status: **DECISION SHEET ONLY — NOT EXECUTED · AUTHORIZES NO NEW COMMERCIAL EFFECT**  
Task: `A4-REMAINING-QUALIFICATION-01` · `@wbdevworld` / WS3  
UTC fill: `2026-10-10T02:16Z`  
Staff-documentation impact: **NONE**

## Historical pin (do not use for new GO)

`LANE5-BC-COMMERCIAL-DECISION-452c446.md` and Preview `452c446` / `dpl_F3uXp…` / `srx2grakx` are **HISTORICAL** environment/fixture pins for the prior window. A+D cash sale remains **CLOSED** (`33326bbc…` / `sale-50317` / Woo **50317**). **Do not replay A+D.**

## Current runtime under test (software)

| Field | Value |
| --- | --- |
| Preview | `dpl_FAaW712WnVBZ9Wr7B8MXCurJEeXW` |
| URL | https://cetech-pos-staging-q2u9baevb-wbdevworlds-projects.vercel.app |
| SHA / BUILD_ID | `a4f3284c35785dbb0efe3843d38084f12911ac15` |
| Staging DB | `iegxncvpsyaitkpzywcr` (tender claims **24** cash / **0** electronic at fill) |
| Training WP | `training.cetechbpa.com` · bridge runtime `fa478ea4…` (accepted prior) |

## Read-only readiness snapshot (no shift/stock/payment init)

| Check | Observation |
| --- | --- |
| Staff session | Staging Manager · org_a · locations `loc_a1`,`loc_a2` · registers `reg_a`,`reg_a2`,`reg_b` |
| Shift | **Already open** on Register A — this sheet does **not** open/close a shift |
| Device | Capability probe via Register UI only; physical device = tester |
| Payments capabilities (BFF) | `cash=available`; `mobileMoney`/`card`/`externalTerminal`=**unconfigured** |
| Paystack / electronic TEST | **NOT PROVEN sandbox-ready** on this Preview until a configured TEST provider capability is shown |
| Pending Attention | present API reachable; no deletion performed |

### Fixture revalidation (Woo meta via WP-CLI read-only `2026-10-10T02:16:31Z`)

| Woo id | POS item_id | `_stock` | `_price` | `_backorders` |
| --- | --- | ---: | ---: | --- |
| **14985** | `63482776-2418-5db8-b794-ca5e6e516e67` | 27 | 30 | (not required for quote class) |
| **49111** | `d7c385f0-44e4-541e-b85a-267586d98857` | **3** | **29** | no |
| **49663** | `cc0924d4-d3f5-53bc-b7db-eb6529526715` | **1** | **12500** | no |

Quote class check (Lane 3): 14985×1 B2B customer `4` @ `loc_a1` → GHS **3000** minor ×3 samples.

---

## Proposed track 1 — NEW cash checkout/recovery (post-tender schema)

| Item | Bound |
| --- | --- |
| Purpose | One **new** cash qualification on tender-claim / write-boundary / evidence enrollment schema — **never** replay of A+D |
| Product | Woo **49111** / POS `d7c385f0…` · qty **1** |
| Amount cap | ≤ **GHS 29.00** (re-quote at run; current `_price=29`) |
| Stock class | `_stock=3` — **not** last-unit |
| Effects if completed | +1 order · −1 stock · +1 cash claim · one immutable receipt · journal recovery identity fresh |
| Idempotency | Fresh cartId / correlation / prepare attempt ids; timeout → resolve reality, no second charge |
| Response-loss | Manager Attention + recovery read; no duplicate finalize |
| Stop conditions | Any second stock decrement, dual tender family, orphan claim, or unexpected order create |
| Pre-run | Confirm open shift policy, device, quote purchasable, no conflicting reservation |
| Execution | **UNAUTHORIZED** until a separate exact **Cash GO** names this Preview SHA and cap |

## Proposed track 2 — payment-provider TEST

| Item | Bound |
| --- | --- |
| Product | Woo **49111** ×1 · ≤ GHS **29.00** |
| Tender | Provider **TEST/sandbox only** · **new** payment reference (never reuse R7 / prior refs) |
| Current blocker | BFF capabilities show electronic channels **unconfigured** — prove sandbox mode + TEST keys on this Preview **before** any GO |
| Settlement | UI callback alone is **not** settlement verification; require claim + provider truth + order link |
| Attempts | Max **1** paid/completed winner; cleanup incomplete creates |
| Execution | **UNAUTHORIZED** until TEST capability is proven **and** a separate **B GO** is recorded |

## Proposed track 3 — genuine stock=1 / backorders-off contention

| Item | Bound |
| --- | --- |
| Mapped candidate | Woo **49663** / POS `cc0924d4…` · `_stock=1` · backorders **no** · **GHS 12,500** |
| Cap conflict | **Outside** historical GHS 29 class — **do not** silently run as ≤29 experiment; **do not** edit stock/price to invent a cheaper last-unit |
| Cheaper stock=1 mapped fixture | **not found** this window (49111 @3 insufficient for two qty-1 last-unit) |
| If later authorized | Separate actors/attempt ids; ≤2 created order records; incomplete cleanup; **at most one** completed winner; one stock decrement; loser recovery evidence preserved |
| Distinguish | prepare-only reservation contention ≠ completed-winner qualification |
| Concrete setup needing authorization (not performed) | Either (a) authorize 49663 at GHS 12500 with explicit senior amount waiver, or (b) authorize a bounded reduce of an already-mapped ≤29 product to `_stock=1` on training only, or (c) STOP Track 3 |
| Execution | **UNAUTHORIZED** |

## Combined ask for senior (if commercial tracks required before cutover)

Authorize **exactly one** next commercial packet on Preview `a4f3284` / `dpl_FAaW712…`, or defer:

1. **Cash GO** — one new ≤GHS29 cash sale on **49111×1** (recovery/idempotency included); **or**
2. **B GO** — only after electronic TEST capability is configured/proven; **or**
3. **Defer B/C/cash** and keep **NOT READY FOR PRODUCTION** on commercial/recovery gates while tester hardware acceptance proceeds.

Do **not** authorize GHS 12,500 casually, A+D replay, shared/paid restore, or stock/price edits without an explicit bounded write scope.
