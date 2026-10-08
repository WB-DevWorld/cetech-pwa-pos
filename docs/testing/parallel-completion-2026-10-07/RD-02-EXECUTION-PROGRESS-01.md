# RD-02 execution progress — scoped Preview exception + A+D

Status: **IN PROGRESS / PARTIALLY BLOCKED**  
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

Captured on tester origin after operator sign-in (no tokens/cookies recorded):

| Field | Value |
| --- | --- |
| Origin | `https://cetech-pos-staging-git-integration-9578df-wbdevworlds-projects.vercel.app` (`BUILD_ID` `816e0bb…`) |
| organizationId | `org_a` |
| actorId | `manager_a` |
| assignedLocationIds | `loc_a1`, `loc_a2` |
| assignedRegisterIds | `reg_a`, `reg_a2`, `reg_b` |
| registerId / deviceId / shiftId | **null** |
| UI | Sell visible; **no open shift** (Pay disabled when cart present) |

### A+D commercial precondition

Task requires an **existing open shift** (and device/register binding). Opening a shift is **out of scope**.  
**A+D STOPPED** on missing open shift / register / device. Independent work continues.

## 3) Training bridge prep (install not completed)

| Check | Result |
| --- | --- |
| Host | `training.cetechbpa.com` — `WP_ENVIRONMENT_TYPE=staging`; blogname TRAINING |
| Installed | `cetech-pos-bridge` **0.6.0-stg05** active |
| Installed main SHA-256 | `9fee0c40fd957eb0ec16bbe064fa2bb1122daec56d4d862bf0b34fc7bdc1f78b` |
| Installed runtime SHA-256 | `39159cb39eec8e687257dc9c604edab637df26787a522c4ceff4280cd891167b` |
| Identity proof on disk | `assert_prepared_order_operation_identity` count **0** |
| Product 49111 | `_stock=4`, `_price=29`, manage_stock yes, backorders no, publish |
| Fresh rollback backup | `/home/cetechtraining/backups/cetech-pos-bridge-0.6.0-stg05-pre-ab5c7e1-20261008T164117Z.tgz` |
| Backup SHA-256 | `c20239f1245a8697321a4f6ae89bd859ec935e695bfe706ae9c8793db01bfc8f` |
| Candidate ZIP on host | `/home/cetechtraining/tmp/cetech-pos-bridge-ab5c7e1-fc8f2d05.zip` |
| ZIP SHA-256 (local+host) | `e875ec3af476e230f2571624a3d0111dc29c1856d1793481deecfc1b6dbfa503` (104200 bytes) |
| ZIP members vs 41-file manifest | **exact match**; main `63094753…`; runtime `89e4461c…`; identity proof present in unpack |
| Timers | `cetech-training-wp-cron.timer` + `mailpoet` **active**; no `.maintenance` |
| Generation tooling | `rename_exchange.py` refuses: “Runtime approval is not recorded.” `training_diagnostic.sh` path is bound to QUOTE-EARLY timing package / frozen baseline — **not** this product tip install |

**Install STOPPED** before exchange: will not force busy PHP, will not rebuild diagnostic tooling, will not use unsigned timing-release path against a different frozen baseline. Need operator-signed whole-generation exchange for **this** artifact (or an existing approved product-install admission path that proves loaded FPM generation).

## 4) Parallel lanes

| Lane | State |
| --- | --- |
| Installed-PWA / physical printer | **UNVERIFIED** — no dedicated hardware in session |
| Full WP/Woo/DB + POS backup set | Bridge tarball only proved; full restore set still to identify |
| Isolated disposable restore | **UNEXECUTED** |
| RD-03 | Not requested |

## Remaining blockers (exact)

1. Candidate Preview with `BUILD_ID=<sha>` **and** origin admission for that Preview hostname (trusted Exact SHA Preview cannot currently satisfy both under #144 head / no GitHub independent APPROVED / no APP_ORIGIN override in payload; agent has no Vercel token).
2. Existing open shift + register + device on the qualification session (do not create under this scope).
3. Whole-generation install admission for product tip `ab5c7e1` / tree `fc8f2d05` (fresh backup + verified ZIP ready on training).

## Non-actions honored

- No re-apply of RD-01; no bulk db push
- No B/C tracks; no alias move; no production; no VitePOS deactivation
- No second prepare key; no commercial A+D attempt without open shift
- No speculative Preview creates
- #115 / #132 remain OPEN; profiler parked; Emmanuel review distinct
