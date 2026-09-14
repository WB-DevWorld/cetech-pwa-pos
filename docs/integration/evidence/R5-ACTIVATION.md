# R5 activation — idempotent prepare + cash

Date: 2026-09-14 UTC

## Authority and baseline

R5 is explicitly activated by the senior/user after PRE-R5 hardening acceptance.

- Canonical repository: `WB-DevWorld/cetech-pwa-pos`
- Baseline `main`: `da86434cc471703b8309cea77cda88b7845c299b`
- PRE-R5 PR #51: **APPROVED / MERGED / POST-MERGE VERIFIED**
- PR #51 exact reviewed head: `49abf8509934fb319a479be59ce9e4192cb21178`
- PR #51 merge: `da86434cc471703b8309cea77cda88b7845c299b`
- Post-merge CI: run `34830069895` — `control-plane` SUCCESS; `control-plane-windows` SUCCESS
- PRE-R5 issues #46, #47, #48 and #49: CLOSED / COMPLETED
- PRE-R5 integration lease: RELEASED
- ADR-012: ACTIVE
- ADR-014: ACTIVE; cross-owner implementation transitions require exact tested-SHA handoff
- Issue #4: OPEN
- `pricingParityVerified=false`
- Production promotion: NOT AUTHORIZED

## R5 integration surface

- Integration issue: #52 `[R5-00] Integrate idempotent prepare and cash milestone`
- Neutral branch: `batch/r5-idempotent-prepare-cash`
- Integration editor: `@wbdevworld` / WS3
- R5 feature tasks: BR-06 / #18, then CORE-05 / #24

## Ownership-preserving execution order

1. **BR-06 / issue #18 — Emmanuel / `@Emmanuel-coder-prog` / WS2.**
   - Implement only in WS2-owned task scope.
   - Publish exact tested source SHA(s) and WS2 STATUS/HANDOFF evidence.
   - Stop and hand off to WS3.
2. **WS3 integration.**
   - Independently review BR-06.
   - Import only declared tested commits into `batch/r5-idempotent-prepare-cash`.
   - Run combined verification.
   - Publish the exact tested `BR06_INTEGRATION_SHA`.
3. **CORE-05 / issue #24 — `@wbdevworld` / WS3.**
   - Only after `BR06_INTEGRATION_SHA` exists.
   - Create/use a separate WS3 contributor branch based on that exact SHA.
   - Implement only CORE-05 scope, then publish tested source SHA(s).
4. **WS3 integration.**
   - Import CORE-05 into the same neutral R5 branch.
   - Run final combined checks.
   - Perform exactly two final ADR-012 freshness observations and STOP.
   - Request independent human review of the exact final head.

No intermediate merge to `main` is required between BR-06 and CORE-05.

## Important non-authority

The WS3 integration lease does **not** authorize WS3 to implement BR-06. An unavailable owner is not takeover permission. Review fixes affecting BR-06 return to Emmanuel. Reassignment requires explicit senior authority recorded in `CURRENT-WORK.md` before implementation.

The R5 activation does not authorize BR-07, FE-05, R6+, split tender, full offline settlement, payment-provider execution, production deployment, or destructive live actions.

## Contract / architecture invariants

Frozen v1.0.0 contracts remain authoritative unless a separate explicit contract-change decision is recorded.

- Quote is not reservation.
- PrepareSale must revalidate and claim idempotency.
- Woo order metadata lookup alone is not atomic deduplication or stock locking.
- CORE-05 FinalizeSale must consume verified evidence and must not create a second commercial sale during repair/retry.
- Receipt data remains separate from print side effects.

## Initial state

- BR-06: **AUTHORIZED / NOT STARTED**
- BR-06 owner: `@Emmanuel-coder-prog` / WS2
- CORE-05: **BLOCKED ON BR06_INTEGRATION_SHA / NOT STARTED**
- CORE-05 owner: `@wbdevworld` / WS3
- R5 milestone: **ACTIVE**
