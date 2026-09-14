# Current work ledger

Updated 2026-09-14. Canonical repo `WB-DevWorld/cetech-pwa-pos`. This file is the current cross-workstream scheduler. Historical scheduler detail from before PRE-R5 hardening is preserved verbatim at [CURRENT-WORK-HISTORY-2026-09-14-PRE-R5](docs/integration/evidence/CURRENT-WORK-HISTORY-2026-09-14-PRE-R5.md) and in reviewed PR history; historical records do not grant current implementation authority.

## Current authority and completed gates

- `main`: `29cea52acbee2729175df61d2ae1a6658c5c04b1` — PR #45 / WF-OWN-01 merge.
- PR #41 / R4: **APPROVED / MERGED / POST-MERGE VERIFIED**. R4 lease **RELEASED**.
- PR #45 / ADR-014: **APPROVED / MERGED / POST-MERGE VERIFIED**. Ben approved exact head `4a6bb2bdf1ba30aa3353ed4493b9516cefe8ee1b`; merge `29cea52acbee2729175df61d2ae1a6658c5c04b1`; post-merge main CI run `34792504659` succeeded. WF-OWN-01 governance lease **RELEASED**.
- [ADR-012](docs/decisions/ADR/012.md) remains active and is narrowed by [ADR-014](docs/decisions/ADR/014.md): automatic implementation continues only for the same human/workstream owner. Cross-owner work requires an exact tested-SHA handoff. An unavailable owner is not takeover permission.
- Explicit implementation reassignments: **NONE**.
- Issue #4 / CP-04 remains **OPEN**. `pricingParityVerified=false`. Production is untouched. Training safeguards remain in force.

## Active assignment — PRE-R5 hardening

Activation authority: explicit senior/user instruction to proceed after R4 and ADR-014 adoption, recorded 2026-09-14. This assignment clears the two review-raised PRE-R5 hardening gates only. It does **not** activate R5 feature work.

- Integration issue: **#49 HARDEN-00** — neutral combined hardening review surface.
- Neutral integration branch: `batch/pre-r5-hardening`.
- Integration editor: WS3 / `@wbdevworld`.
- Integration baseline: `main` `29cea52acbee2729175df61d2ae1a6658c5c04b1`.
- R5 status: **BLOCKED / NOT STARTED**.
- R5 may be activated only after #46, #47 and #48 are accepted in the combined hardening batch, final two-pass freshness is complete, independent human review is recorded, this hardening lease is released, and a separate explicit R5 activation/lease is recorded.

### Owner-scoped hardening tasks

| Task | Human / workstream | Contributor branch | Status | Scope / gate cleared |
| --- | --- | --- | --- | --- |
| #46 HARDEN-01 | `@wbdevworld` / WS3 | `ws3/pre-r5-catalog-query-index` | AUTHORIZED / NOT STARTED | Local catalog query/index performance; real >=5,000-item local-adapter evidence |
| #47 HARDEN-02 | `@wbdevworld` / WS3 | `ws3/pre-r5-quote-schema-bff` | AUTHORIZED / NOT STARTED | BFF/server `QuoteRequest` + `Quote` runtime JSON Schema enforcement |
| #48 HARDEN-03 | `@Emmanuel-coder-prog` / WS2 | `ws2/pre-r5-quote-schema-bridge` | AUTHORIZED / OWNER HANDOFF | Woo bridge `QuoteRequest` + `Quote` runtime JSON Schema enforcement |
| #49 HARDEN-00 | `@wbdevworld` / WS3 integration | `batch/pre-r5-hardening` | ACTIVE INTEGRATION LEASE | Exact-SHA imports, combined verification, freshness, independent review |

Task issue bodies are authoritative for allowed/forbidden paths and acceptance criteria. A combined milestone path list does not transfer implementation ownership.

### PRE-R5 integration lease

**Editor:** WS3 / `@wbdevworld`.

**Allowed integration-editor work:**
- `CURRENT-WORK.md`;
- `docs/integration/evidence/**` for this hardening batch;
- bounded WS3 status/handoff updates;
- exact declared contributor commit imports into `batch/pre-r5-hardening`;
- combined tests, PR metadata, reviewer requests, provenance/evidence;
- conflict resolution only within WS3-owned integration surfaces.

**Not authorized by the integration lease:**
- implementing #48 / WS2 bridge code;
- editing WS1 feature/UI implementation;
- BR-06, CORE-05, sale preparation/finalization, payment, stock/order effects or any other R5 feature work;
- changing frozen v1 contract versions/shapes without separate contract-change authority;
- asserting `pricingParityVerified=true`;
- closing issue #4 or claiming CP-04 globally complete;
- production promotion or destructive live actions.

Review fixes return to the human owner of the affected contribution. Any implementation reassignment must be explicitly authorized by the senior and recorded here before work begins.

### Contributor provenance / handoff table

| Contribution | Declared owner | Actual implementer | Source branch | Tested source SHA(s) | Imported SHA(s) | Tested combined SHA | Receiving owner / next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| #46 catalog performance | WS3 / `@wbdevworld` | UNVERIFIED | `ws3/pre-r5-catalog-query-index` | UNVERIFIED | UNVERIFIED | UNVERIFIED | WS3 integration |
| #47 BFF schema validation | WS3 / `@wbdevworld` | UNVERIFIED | `ws3/pre-r5-quote-schema-bff` | UNVERIFIED | UNVERIFIED | UNVERIFIED | WS3 integration |
| #48 bridge schema validation | WS2 / `@Emmanuel-coder-prog` | UNVERIFIED | `ws2/pre-r5-quote-schema-bridge` | UNVERIFIED | UNVERIFIED | UNVERIFIED | WS3 integration |

Unknown provenance is **UNVERIFIED** and blocks hardening acceptance.

### Hardening acceptance gate

The PRE-R5 gate is satisfied only when all of the following are evidenced on the combined tree:

1. Catalog search/scan no longer reloads every IndexedDB catalog row and reconstructs the full projection engine for each query; real local-adapter before/after evidence exists on a >=5,000-item synthetic catalog and R4 barcode/variation/tombstone/cursor correctness remains green.
2. The trusted Next.js BFF validates the canonical existing v1 `QuoteRequest` before bridge execution and validates the canonical existing v1 `Quote` before trusting/returning a bridge result.
3. The Woo bridge validates canonical existing v1 `QuoteRequest` ingress before pricing execution and validates canonical existing v1 `Quote` egress before a successful response leaves the plugin.
4. Generated TypeScript/PHP shapes do not substitute for runtime JSON Schema enforcement; no divergent handwritten second contract is introduced.
5. Existing R4 retail/B2B/WoodMart/B2BKing quote behavior remains semantically unchanged and parity regressions remain green.
6. Required component and combined checks pass; `git diff --check` is clean.
7. Contributor source SHA → imported SHA → combined SHA provenance is recorded.
8. Final ADR-012 freshness runs exactly Pass 1 and Pass 2, then stops. No autonomous Pass 3.
9. A different competent human independently reviews the final combined hardening head.

## Next milestone — R5 remains gated

Planned neutral R5 branch after hardening acceptance and a separate activation record: `batch/r5-idempotent-prepare-cash`.

Planned ownership after activation:

1. **BR-06 / issue #18 — Emmanuel / WS2.** Implement on the WS2 contributor branch, publish tested source SHA(s), then hand off.
2. **WS3 integration.** Import only Emmanuel's declared tested BR-06 commit(s), run combined verification, and publish `BR06_INTEGRATION_SHA`.
3. **CORE-05 / issue #24 — `@wbdevworld` / WS3.** Implement on a WS3 contributor branch against that exact provisional integration SHA.
4. Import/test CORE-05 into the same neutral R5 milestone branch, complete two-pass freshness, then independent human review.

No intermediate merge to `main` is required between BR-06 and CORE-05. WS3 must not implement BR-06 merely because it owns the R5 integration PR.

## Required review and safety rules

- Main remains protected; required checks remain `control-plane` and `control-plane-windows`.
- Senior-authored changes require another competent human reviewer. No self-approval.
- No production promotion, payment execution, real sale/order/stock mutation, or destructive environment action is authorized by this scheduler.
- Training Woo remains the development/integration reference under [ADR-011](docs/decisions/ADR/011.md); unavailable production facts remain cutover/release deltas unless a task specifically requires them.
- PWA/local-data recovery protections remain mandatory; do not clear critical IndexedDB stores to solve hardening problems.

## Historical scheduler

The full scheduler state immediately before this PRE-R5 activation is preserved verbatim at [CURRENT-WORK-HISTORY-2026-09-14-PRE-R5](docs/integration/evidence/CURRENT-WORK-HISTORY-2026-09-14-PRE-R5.md). R1–R4 milestone details, prior leases, metrics and freshness chronology remain authoritative as historical evidence there and in their reviewed PR/evidence records, but they do not grant current implementation scope.
