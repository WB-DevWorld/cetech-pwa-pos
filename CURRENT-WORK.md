# Current work ledger

Updated 2026-09-17. Canonical repo `WB-DevWorld/cetech-pwa-pos`. Historical scheduler detail remains in Git/PR/evidence history. This file controls the current STG-01 recovery assignment on the integration branch and is intended to replace the stale pre-merge R8 ledger when reviewed/imported.

## Current authority

- accepted `main`: `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` — squash-merged `[R8] Safe returns and payment/register states (#69)`.
- latest successful shared staging for that exact SHA: `https://cetech-pos-staging-q5kb2f8t7-wbdevworlds-projects.vercel.app/`.
- Staging CD run `35216966693`: SUCCESS for exact main SHA; deployment pipeline/root protected smoke is working.
- Browser staging evidence on 2026-09-17 shows application-runtime acceptance is **NOT satisfied**: placeholder routes remain, Sell uses synthetic R4 catalog data, mounted UI hard-codes staff/shift authority, and protected quote/checkout mutations fail CSRF because no real staff session is established.
- CORE-06 / #25 and R6 / #54 are reopened because their own acceptance required real isolated-staging runtime evidence; mock/root-smoke evidence cannot satisfy them.
- STG-01 / #70 is the active P0 recovery gate.
- Issue #4 remains OPEN; `pricingParityVerified=false`. Production promotion, live Paystack, real refund/restock and VitePOS deactivation are not authorized.
- R9 PR #63 remains draft / must not merge while STG-01 is open.

```text
human: @wbdevworld
workstream: WS3 integration authority + task-specific STG-05 bridge implementer
mode: REMEDIATE / INTEGRATE
task: STG-01 — recover production-usable staging runtime
integration branch: batch/stg-01-staging-runtime-acceptance
```

## Active STG-01 assignments

### WS3 / @wbdevworld

1. **STG-02 / #71 — staff session, CSRF and authoritative register state**
   - branch: `ws3/stg-02-session-runtime-composition`
   - remove hard-coded `Staff member` / `shiftOpen=true` authority;
   - establish real transitional staff session through the existing identity abstraction and `/api/pos/v1/session`;
   - preserve exact-origin CSRF and server authorization;
   - drive cashier/register/shift UI from authoritative server state.

2. **STG-04 / #73 — training Woo catalog projection**
   - branch: `ws3/stg-04-training-catalog-projection`
   - staging must stop treating `CASHIER_SEED_CATALOG` as operational truth;
   - local/test/demo may retain synthetic fixtures;
   - staging consumes a provider-derived, rebuildable IndexedDB projection;
   - Woo remains commerce truth; quote pricing remains bridge/Woo/B2BKing/WoodMart owned.

3. **STG-06 / #75 — functional staging acceptance gate**
   - branch: `ws3/stg-06-functional-staging-gate`
   - root HTTP smoke remains necessary but is not application acceptance;
   - acceptance must prove real session/CSRF, authoritative register state, real training projection, quote path and authorized synthetic cash-sale trace before #25/#54/#70 can close.

4. **STG-07 / #76 — CD summary audit fix**
   - branch: `ws3/stg-07-cd-summary-audit-fix`
   - fix Bash backtick command substitution in deployment summary without changing deployment semantics.

### WS2 boundary — task-specific implementation reassignment to @wbdevworld

**STG-05 / #74 — training Woo bridge producer/runtime**

- branch: `ws2/stg-05-training-bridge-runtime`
- original WS2 owner remains Emmanuel / `@Emmanuel-coder-prog`, but the senior authority explicitly reassigns implementation of this task to `@wbdevworld` for this remediation cycle because Emmanuel currently lacks SSH/repository implementation access.
- This does **not** transfer general WS2 ownership to WS3.
- Changes must remain inside STG-05's WS2-owned paths: `wordpress/cetech-pos-bridge/**`, `tests/bridge/**`, `tests/fixtures/commerce/**`, WS2 evidence/handoff.
- Do not mix WS2 bridge edits into STG-02/STG-04 branches.
- Emmanuel may still independently review the resulting GitHub PR; SSH is not required for review.

### WS1 / @Ben-001-sys

1. **STG-03 / #72**
   - branch: `ws1/stg-03-approved-workspaces`
   - implement approved production-intent Orders, Customers and Settings feature/UI surfaces;
   - do not edit provider/server/core/local logic.

2. **FE-07 / #12** remains canonical for Store Health, Attention/recovery, update/offline/degraded/passive-tab/migration UI.

Ben publishes exact tested source SHAs + mount instructions. WS3 mounts accepted WS1 components during STG-01 integration; integration ownership does not transfer WS1 implementation ownership.

## Integration order

1. STG-02 real session/CSRF/register composition.
2. STG-05 bridge producer verification/minimal repair (may run in parallel with STG-02; keep separate branch/path ownership).
3. STG-04 training catalog projection consumes the verified STG-05 producer boundary.
4. Ben delivers STG-03 + FE-07 source SHAs.
5. Integration editor imports only declared tested owner/reassigned-owner commits into `batch/stg-01-staging-runtime-acceptance`, preserving source SHA → imported SHA → tested combined SHA provenance.
6. Mount accepted WS1 features in WS3-owned app composition; no accepted route may fall through to the generic R4 placeholder.
7. Apply STG-07 audit fix.
8. Implement/run STG-06 functional staging acceptance against the exact immutable Vercel deployment produced from the candidate.
9. Capture redacted exact-SHA staging evidence; independent human review; final ADR-012 freshness procedure.
10. Only after all STG-01 gates pass may #25, #54 and #70 close and R9 resume.

## Imported provenance (this integration head)

Do not treat STG-04 contributor `CURRENT-WORK.md` as the shared ledger.

| Contribution | Owner | Source branch | Source SHA | Imported SHA |
| --- | --- | --- | --- | --- |
| STG-01 control | WS3 / @wbdevworld | `batch/stg-01-staging-runtime-acceptance` | `acd4a2f009c58f734186cf9e44f278da93499a4b` | base |
| STG-02 / #71 | WS3 / @wbdevworld | `ws3/stg-02-session-runtime-composition` | `8a6aba2ce82ebe265a154f89999c2caab7a08beb` | `9bfb535ca86f7bd27108b3a82c6876e4b5f19c81` |
| STG-05 / #74 | WS2 boundary; implementer @wbdevworld | `ws2/stg-05-training-bridge-runtime` | `4d549167f7d6dcecf0eff24f35e1f24a3429d3d8` | `7cab23415d622cef7369ddc03e007e6576cc4ce7` |
| STG-04 / #73 | WS3 / @wbdevworld | `ws3/stg-04-training-catalog-projection` | `01e4438d3553c633e7b0234de44743ff4cea2368` | `981722e7c8ff6ea7163532f03218f59ea2b9e20d` |
| STG-03 / FE-07 | WS1 / @Ben-001-sys | `ws1/stg-03-approved-workspaces` | `169f8155fe4cb34b6fe27db3bb6b445a13ade712` | `8073ef59dbf481160387000886b0b7da4a25d237` |

Combined tested SHA and STG-07 SHA are recorded after composition/tests.

Semantic conflict: `apps/pos-web/src/app/pos-app.tsx` and `apps/pos-web/src/config/env.ts` plus WS3 STATUS/HANDOFF. Composition keeps STG-02 staff/CSRF/register authority and STG-04 catalog projection. `readPublicStaffAuthEnv` and `readAppEnv` both remain. Staging still never silently seeds `CASHIER_SEED_CATALOG`.

## Safety boundaries

- No production promotion.
- No live electronic payment execution.
- No real customer refund/restock.
- No VitePOS deactivation.
- Training/staging effects must remain inside CP-04 authorization.
- No secrets in prompts, commits, screenshots, logs or evidence.
- No wildcard origin/CSRF bypass.
- Do not clear IndexedDB/drafts/journal as a routine recovery or catalog-sync technique.
