# R2 consumption of CP-04 W1/W4 training evidence

Observer: WS3 senior / @wbdevworld
UTC: `2026-09-13T13:12:55Z`
R2 head at consumption: `3a1b6b579781130afc9bd9792405b182c7bfe5ca`

CP-04 evidence was **not** duplicated and **not** merged onto `batch/r2-auth-bridge-bff`. Provenance is the CP-04 branch.

| Item | Exact value |
| --- | --- |
| Evidence branch | `origin/ws3/cp-04-r2-runtime-gates` |
| W4 evidence commit | `67ea42ce03142fb9f0ca18446b8146b0815ea621` |
| CP-04 final freshness head | `edf24afaf7d57d6109a761820f5cfb8bc548973f` |
| Host | `https://training.cetechbpa.com` |
| Environment | `WP_ENVIRONMENT_TYPE=staging` |
| BR-01 source installed | `280a73dbcd53ac0e03883775b4fabdec7465a4a8` |
| Plugin | `cetech-pos-bridge` `0.1.0-br01` |
| Service user | `cetech-pos-bridge-svc` subscriber ID 22 |
| Capability | `cetech_pos_bridge_access` only |
| Application Password | label `cetech-pos-bff-r2-health`; secret **not** repository data |
| Anonymous health | 401 `AUTH_REQUIRED` |
| Authenticated no-cap | 403 `FORBIDDEN` |
| Authenticated with-cap | 200 `ok=true` `healthy` |
| Detection | Woo/WoodMart/B2BKing true; `pricingParityVerified=false` |
| Unexpected orders/stock/payments/mail/webhooks | 0 |
| Mail containment | PASS / preserved |
| Production | not touched |
| Issue #4 | remains OPEN |

Classifications after this consumption (WordPress side only):

- CP04-W1: **PASS on training**
- CP04-W4: **PASS on training WordPress side**
- BR-01: **INTEGRATED_AND_TESTED / LIVE WORDPRESS HEALTH VERIFIED**
- CORE-03: **WORDPRESS_REMOTE_SIDE_VERIFIED / BFF_RUNTIME_ACCEPTANCE_PENDING**
- Overall CP-04: **not complete**
- Overall R2: **not complete**

Ben COMMENTED on `3a1b6b5…` (not APPROVED). Blocker 3 (live bridge→Woo on WordPress) is satisfied. Blockers 1–2 plus BFF→bridge runtime proof remain. Do not request re-review until a new exact head contains those proofs.

Historical blocked/preflight records on the CP-04 branch are preserved there.
