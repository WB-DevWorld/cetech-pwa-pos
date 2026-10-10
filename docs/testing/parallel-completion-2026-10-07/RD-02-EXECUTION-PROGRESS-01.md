# RD-02 execution progress — scoped Preview exception + A+D

Status: **A+D CLOSED (cap consumed) + bridge COMPLETE; native FPM cutover UNVERIFIED; Preview exception in progress**  
Canonical closure: `RD-02-AD-EVIDENCE-CLOSURE.md`  

Owner approval: conversation grant for scoped Preview exception + training bridge install + A+D (one cash sale ≤ GHS29 with response-loss). B/C, alias, production, remote restore **excluded**.  
Acting implementer: `@wbdevworld` / WS3  
Staff-documentation impact: **NONE**  
Production effects: **NONE**  
Verdict: **NOT READY FOR PRODUCTION**

## Approval record

```text
decision: scoped Preview exception + RD-02 A+D
authorizer: owner (explicit chat approval 2026-10-08)
scope: one correctly identified unpromoted Preview; reviewed training bridge install; one cash sale ≤ GHS29 with response-loss recovery
excluded: B, C, shared alias, production, remote restore
```

## 1) Preview identity / session

### Same-origin session (frozen Preview `dpl_8pUT…`)

| Field | Value |
| --- | --- |
| URL | https://cetech-pos-staging-d299u3ex7-wbdevworlds-projects.vercel.app/ |
| `GET /api/pos/v1/session` (credentials include, Origin = Preview) | **403** |
| code / message | `FORBIDDEN` / `session origin is not allowed` |
| correlationId | `b400394c-ed99-49cb-b12d-eb2a7fe5dcbd` |
| Cookie-less HTTP (no Origin) | **401** `AUTH_REQUIRED` / `staff session is required` (`acf99e1a-…`) |

Proven cause class: inherited `APP_ORIGIN` wins over `VERCEL_URL` in `staffAllowedOrigins()` / `resolveAppOrigin()`, so Preview hostname is excluded. UI “Access denied…” is this FORBIDDEN, not a password failure.

Observed release identity on this Preview remains `BUILD_ID=local-dev` (SW + release-policy).

### Replacement Preview — capability limit (stopped before create)

| Gate | Result |
| --- | --- |
| Trusted workflow `Exact SHA Preview` | Requires PR head == `candidate_sha`. #144 head is `8f6612d…` ≠ freeze `f0feb44…` |
| Independent exact-head GitHub APPROVED review | **None** on #144 (`reviews: []`). Owner chat approval is not that gate; must not fabricate a PR review; must not edit `exact_sha_preview.py` |
| Payload pattern | `create_payload` sets `BUILD_ID` only — does **not** clear/override inherited `APP_ORIGIN` for candidate-only origin admission |
| Local agent Vercel credentials | `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` **absent**; vercel CLI absent |
| App tree equivalence | `apps/pos-web` tree identical on `f0feb44` / `8f6612d` / `ab5c7e1` (`92108eb7…`) — does not remove the origin or trusted-gate blockers |

**Stop:** no speculative Preview created. Shared tester unchanged (`dpl_nxWG…` / `816e0bb…`). Old Preview evidence retained.

**Operator path to unblock (outside this agent):** one immutable Preview from `f0feb44` (or equivalent app tip) with request `BUILD_ID=<sha>` **and** candidate-only origin binding so Preview origin is admitted (do not wildcard; do not change shared tester `APP_ORIGIN`). Then verify uncached release-policy + `/sw.js?build=<sha>`.

## 2) Authorized session scope (shared tester — not qualification Preview)

| Field | Value |
| --- | --- |
| Origin | `https://cetech-pos-staging-git-integration-9578df-wbdevworlds-projects.vercel.app` (`BUILD_ID` `816e0bb…`) |
| organizationId | `org_a` |
| actorId | `manager_a` |
| assignedLocationIds | `loc_a1`, `loc_a2` |
| assignedRegisterIds | `reg_a`, `reg_a2`, `reg_b` |
| `/session` registerId / deviceId / shiftId | **null** (binding via UI/local register state) |
| UI after operator opened shift | Register A · **Shift open** · Sell · Pay enabled |

### A+D commercial precondition

Operator opened an existing shift on Register A (agent must not create). Precondition **satisfied** after operator notice `2026-10-08`.

## 3) Training bridge install (COMPLETED)

| Check | Result |
| --- | --- |
| Host | `training.cetechbpa.com` — staging TRAINING |
| Exchange | `rename_exchange.py --signed-off` PLUGIN ↔ `cetech-timing-release/staged` after FPM idle |
| Drain | `fpm_status_read.py --signed-off` alone (idle). Unsupported `--phase drain` aborted safely earlier; live unchanged until correct drain |
| Live main SHA-256 | `63094753eb380b57c1e7e6db1a172ead3a295112e538d6722ffb4325f7ff58ab` |
| Live runtime SHA-256 | `89e4461c3ff7e7ef2dc6ff525751f799f4b92604d655880e9840256128deb76c` |
| Identity proof on disk | `assert_prepared_order_operation_identity` count **2** |
| Plugin | active; Version header still `0.6.0-stg05` (label not proof) |
| Rollback backup (pre-exchange) | `/home/cetechtraining/backups/cetech-pos-bridge-0.6.0-stg05-pre-ab5c7e1-20261008T164117Z.tgz` (`c20239f1…`) |
| Post-exchange host | no `.maintenance`; wp-cron + mailpoet timers **active** |
| Exchange log | `/home/cetechtraining/tmp/rd02-bridge-exchange-20261008b.log` |

## 3b) Track A+D cash + response-loss (COMPLETED on shared tester)

| Field | Value |
| --- | --- |
| Origin | shared tester (not qualification Preview) |
| Scope | org_a / manager_a / Register A / Shift open |
| Product | Woo `49111` XL INGCO Nitrile Frosted Coated Gloves · qty 1 · quoted **GHS 29.00** |
| D — response-loss | Client allowed `POST /api/pos/v1/sales/prepare` to complete (**HTTP 200**) then discarded the body (`TypeError: Failed to fetch`). UI entered uncertain/resolving then **Choose payment** without a second prepare key |
| Prepare identity | `transactionId` `33326bbc-1dd7-4582-8409-ea434942d8db` · `saleId` `sale-50317` · `orderReference` `50317` · correlation prefix `67fb2222-ef93-4…` |
| A — cash | Exact GHS 29.00 → Confirm cash → finalize |
| UI completion | `data-checkout-stage=receipt_ready` · Order `#50317` · Receipt `POS-50317` · Cash · Total GHS 29.00 · Register A |
| Woo order | status **processing** · total **29.00** · currency GHS · line `49111` qty 1 |
| Stock | `_stock` **4 → 3** (Δ −1) |
| False start | One earlier client abort **before** send produced “sale attempt not found / Keep cart” and **no** order; discarded. Commercial identity remains order **50317** only |

## 4) Parallel lanes

| Lane | State |
| --- | --- |
| Installed-PWA / physical printer | **UNVERIFIED** — Print receipt UI available; no dedicated hardware exercised |
| Full WP/Woo/DB + POS backup set | Bridge tarball only proved; full restore set still to identify |
| Isolated disposable restore | **UNEXECUTED** |
| RD-03 | Not requested |

## Remaining blockers (exact)

1. Candidate Preview with `BUILD_ID=<sha>` **and** origin admission for that Preview hostname (trusted Exact SHA Preview cannot currently satisfy both under #144 head / no GitHub independent APPROVED / no APP_ORIGIN override in payload; agent has no Vercel token). Shared-tester A+D does **not** close the Preview exception.

## Non-actions honored

- No re-apply of RD-01; no bulk db push
- No B/C tracks; no alias move; no production; no VitePOS deactivation
- No second prepare key on the commercial sale identity
- No speculative Preview creates
- #115 / #132 remain OPEN; profiler parked; Emmanuel review distinct
