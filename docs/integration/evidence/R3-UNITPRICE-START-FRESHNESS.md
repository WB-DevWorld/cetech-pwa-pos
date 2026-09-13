# R3 continuation start freshness — QuoteLine unitPrice remediation

This is a **new** ADR-012 continuation. It is not Pass 3 of the prior R3 session (`docs/integration/evidence/R3-FRESHNESS.md`).

START_FRESHNESS_SNAPSHOT UTC: `2026-09-13T16:06:08Z`

- origin/main: `ab9aa5ae3dcc79d51efb22c19bd1f17f38d57f77` (R2 PR #43 MERGED / VERIFIED; post-merge CI run 34765462210)
- Declared batch: `batch/r3-authoritative-pricing-parity`
- Editor candidate HEAD at start: `a8d29b1e9e724f852a6c945be6f9ebce323ce984`
- Draft PR #44: OPEN, `isDraft=true`, headOid `a8d29b1e…`. Review was not requested by this continuation. A pre-existing GitHub `reviewRequests` entry for `@Ben-001-sys` is recorded as observed metadata only; this assignment does not add, re-request, or treat that as gate review.
- Contracts: v1.0.0 unchanged. ADR-011 CURRENT. ADR-012 ACTIVE.
- Queue remains BR-02 → BR-03 / BR-04 → BR-05. This continuation remediates a discovered BR-02 QuoteLine `unitPrice` defect only.
- Live training plugin update: **not authorized**. Training deployment **not performed**.
- `pricingParityVerified`: false. Issue #4 OPEN. R4 not started.

Fetch: `git fetch origin --prune` succeeded before this snapshot.
