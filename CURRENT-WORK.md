# Current work ledger

Updated 2026-09-14. Canonical repo `WB-DevWorld/cetech-pwa-pos`. Historical scheduler detail remains preserved under `docs/integration/evidence/**` and reviewed PR history. This file controls the current assignment and implementation authority.

## Current authority

- `main`: `da86434cc471703b8309cea77cda88b7845c299b` — PRE-R5 PR #51 merge; protected.
- PR #51 / PRE-R5 hardening: **APPROVED / MERGED / POST-MERGE VERIFIED**.
- PRE-R5 issues #46, #47, #48 and #49: **CLOSED / COMPLETED**.
- PRE-R5 integration lease: **RELEASED**.
- ADR-012 remains active. ADR-014 remains active and preserves human/workstream ownership across milestone handoffs.
- Explicit implementation reassignments: **NONE**.
- Issue #4 remains **OPEN**. `pricingParityVerified=false`. Production promotion is not authorized.

## Active assignment — R5 idempotent prepare + cash

- Integration issue: **#52 R5-00**.
- Draft milestone PR: **#53** — `[R5] Idempotent prepare and cash orchestration`.
- Neutral integration branch: `batch/r5-idempotent-prepare-cash`.
- Integration editor: `@wbdevworld` / WS3.
- Activation baseline: `main` `da86434cc471703b8309cea77cda88b7845c299b`.
- Milestone state: **R5 ACTIVE**.

### Ordered human ownership queue

| Step | Task | Human / workstream | Contributor branch | Current status |
| --- | --- | --- | --- | --- |
| 1 | BR-06 / #18 — HPOS-safe idempotent prepare + resolve | `@Emmanuel-coder-prog` / WS2 | `ws2/br-06-implement-hpos-safe-idempotent-prepare-and-re` | **ACCEPTED / IMPORTED / COMBINED VERIFIED** |
| 2 | BR-06 integration handoff | `@wbdevworld` / WS3 integration | `batch/r5-idempotent-prepare-cash` | **COMPLETE — BR06_INTEGRATION_SHA PUBLISHED** |
| 3 | CORE-05 / #24 — cash + FinalizeSale orchestration | `@wbdevworld` / WS3 | `ws3/core-05-build-cash-and-finalizesale-orchestration` | **AUTHORIZED / READY TO IMPLEMENT** |
| 4 | Final R5 integration/review | `@wbdevworld` / WS3 integration | `batch/r5-idempotent-prepare-cash` | **BLOCKED ON CORE-05** |

No intermediate merge to `main` is required between BR-06 and CORE-05.

## BR-06 accepted source and import provenance

Declared owner / actual implementer: `@Emmanuel-coder-prog` / WS2.

Accepted source branch head: `a0fa00d452c3a672d97c5a3cb253a5ca6f11cf8f`.

Declared source chain, preserved exactly in merge ancestry:

1. `ec5dc534b3c3f5ab2373e1e1783c48ce55cae4cb`
2. `230daad09af684dba92a481abce3ec8aad83cdc3`
3. `4417ed867adb6962025d62184385d394083d1737`
4. `d4b0d2fd7a94dcd18a3a2b89529befdbaa4fba74`
5. `7f3ca2df3fd0548fed7734c7b87d46ef9d68a168`
6. `63b6d068a1400c9bea14c03c8728c59b08103deb`
7. `a48cca6f670eec805222442437613da4b428d76e`
8. `312dcc3cebd644d5b6ea206210be437e3f001869`
9. `fc89e5f03e822224bb8c9c4f2c4e2f663eccce9b`
10. `a0fa00d452c3a672d97c5a3cb253a5ca6f11cf8f`

Exact BR-06 integration merge commit: `30af336925fd29dc43e7315d81919ae2a7bd5bfc`.

The merge preserved the exact contributor commits as second-parent ancestry while retaining WS3-owned integration-control files.

Source verification at acceptance:
- bridge Make test: **1020 passed / 0 failed**;
- parity: **138 passed / 0 failed / 19 permission-required-skipped**;
- exact source-head CI `34851683401`: SUCCESS both required jobs;
- source live/staging HPOS and real DB concurrency evidence remain **PENDING** and are not claimed.

Combined R5 repository verification:
- exact tested combined head: `15baab1b47a35902b8a3ddde989df55cc4b25436`;
- GitHub Actions run `34855313462`: `control-plane` SUCCESS and `control-plane-windows` SUCCESS, including foundation/contracts, tooling, pgTAP, lint, typecheck, app unit tests, production build and E2E smoke;
- compare against accepted WS2 source shows only the four WS3 integration-control files differ; bridge/test/runtime blobs are identical to source-tested `a0fa00d…`.

**Published `BR06_INTEGRATION_SHA`: `15baab1b47a35902b8a3ddde989df55cc4b25436`.**

## CORE-05 handoff

CORE-05 / issue #24 is now the current executable WS3 feature task.

- Owner / actual implementer: `@wbdevworld` / WS3.
- Contributor branch: `ws3/core-05-build-cash-and-finalizesale-orchestration`.
- Required base: exact tested `BR06_INTEGRATION_SHA` `15baab1b47a35902b8a3ddde989df55cc4b25436`.
- The branch was created directly from that SHA.
- Allowed/forbidden paths, contracts, acceptance criteria and required tests remain controlled by issue #24.
- BR-07 / WS2 and R6+ are not authorized by this handoff.

After CORE-05 publishes tested source SHA(s), WS3 integration imports them into PR #53, runs full combined verification, performs exactly two final ADR-012 freshness observations and stops for independent human review.

PR #53 remains draft. Do not request final R5 review, merge R5, or start R6 before CORE-05 is implemented/imported and the complete R5 gate is satisfied.
