# CP04-W4 bridge service access — PREFLIGHT / NOT EXECUTED

Observer: WS3 senior / @wbdevworld  
UTC: `2026-09-13T00:06:00Z`  
Host: `https://training.cetechbpa.com`  
R2 dependency head: `3a1b6b579781130afc9bd9792405b182c7bfe5ca`  
BR-01 source SHA: `280a73dbcd53ac0e03883775b4fabdec7465a4a8`  
Imported R2 checkpoint: `0ac2e38befb54c9ada404e6854a80285bebb69b9`

Remote mutation authorization: **NOT GRANTED** for W4 Actions A–G.
W1 mail containment: **PASS** (`docs/integration/evidence/CP04-W1-CONTAINMENT-APPLY.md`). Repository policy: do not proceed to remote W4 without a separate operator grant.

## Exact artifact / security model

| Item | Value |
| --- | --- |
| Plugin slug/path | `wordpress/cetech-pos-bridge` at BR-01 SHA `280a73d…` |
| REST route | `GET /wp-json/cetech-pos/v1/health` (`cetech-pos/v1` + `/health`) |
| Capability | `cetech_pos_bridge_access` (administrator status is **not** the intended authz) |
| Current host | plugin dir **absent**; namespace **absent**; HEAD health **404** |
| BFF config | server-only `BRIDGE_BASE_URL`, `BRIDGE_USERNAME`, `BRIDGE_APPLICATION_PASSWORD` |
| Forbidden public env | `NEXT_PUBLIC_BRIDGE_USERNAME`, `NEXT_PUBLIC_BRIDGE_APPLICATION_PASSWORD` |

Application Password must use an approved secret channel only. Never commit or paste it.

## Mutation plan (Actions A–G) — STOPPED before Action A

| Action | Description | Executed |
| --- | --- | --- |
| A | Install exact bridge artifact on confirmed training WordPress | **no** |
| B | Activate exact plugin | **no** |
| C | Create dedicated least-privilege synthetic service user | **no** |
| D | Provision Application Password | **no** |
| E | Negative authorization before capability | **no** |
| F | Grant only `cetech_pos_bridge_access` | **no** |
| G | Authenticated + negative health evidence | **no** |

If the operator later authorizes W1 containment **and** these writes, execute E before F: user+password without capability must 403; anonymous 401; then grant capability; then success envelope with echoed correlation; `pricingParityVerified` must remain **false**.

## Results (not run)

| Check | Result |
| --- | --- |
| Plugin installed | no |
| Plugin activated | no |
| Dedicated service user created | no |
| Application Password provisioned | no |
| Secret committed/logged | **NO** |
| Anonymous health | not run (route 404) |
| Authenticated no-cap health | not run |
| Authenticated with-cap health | not run |
| Correlation echoed | n/a |
| Woo / WoodMart / B2BKing detected | n/a (no health body) |
| Pricing parity verified | **MUST REMAIN FALSE** |
| Unexpected orders | **0** (no W4 writes; pre-count 51 unchanged by this assignment) |
| Unexpected stock changes | **0** / not written |
| Unexpected external mail | **0** from this assignment; environment remains capable of sending |
| Unexpected webhooks | **0**; count remains 0 |
| Credential retained for R2 live BFF | **no** (never provisioned) |
| Rollback state | no W4 mutations to roll back |

## Classification

CP04-W4 = **PERMISSION_REQUIRED** / **BLOCKED**  
Blockers: no explicit operator authorization for Actions A–G. W1 mail is no longer the blocker.

R2 bridge remote gate: **BLOCKED**  
Issue #4: remains **OPEN**  
Production touched: **NO**  
R3: **NOT STARTED**
