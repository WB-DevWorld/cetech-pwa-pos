# WS2 implementation plan

## Mission
Implement the authoritative isolated Woo runtime boundary and prove WoodMart/B2BKing parity before transactional checkout.

## Production Outcome
A prepared POS transaction maps to at most one Woo order with correct customer pricing/tax/stock and recoverable finalization.

## Scope
Independently buildable WordPress plugin; normalized commerce responses; redacted golden pricing corpus and parity results; HPOS/idempotency tests.

## Out of Scope
apps/**; supabase/**; docs/contracts/**; .github/**; root config/lockfiles; reference/**; full offline settlement, split tender, independent pricing/inventory engines and target-peer infrastructure in P0.

## Canonical Owners
Woo catalog/customer/order/stock truth; Woo + WoodMart/B2BKing commercial rules; POS operational state is WS3 responsibility.

## Inputs
bridge-api.openapi.json, QuoteRequest/Quote, PrepareSaleRequest, BridgeFinalizeRequest, error-policy.json, actual staging plugin configuration.

## Outputs
Independently buildable WordPress plugin; normalized commerce responses; redacted golden pricing corpus and parity results; HPOS/idempotency tests.

## File Ownership
wordpress/cetech-pos-bridge/**; tests/bridge/**; tests/fixtures/commerce/**. See BOUNDARIES.md for exact root-relative interpretation.

## Protected / Forbidden Files
apps/**; supabase/**; docs/contracts/**; .github/**; root config/lockfiles; reference/**. No competitive central edits. Record a scoped delegation before crossing ownership.

## Dependencies
CP-01/02/03 freeze authority and v1. CP-05 creates shared app/toolchain; CP-04 verifies live facts. BR-05 gates live transactional checkout. Task-specific dependencies below are mandatory; no hidden cross-workstream dependency.

## Milestones
1. Live audit and bridge health/capability checks.
2. Isolated whole-cart quote harness.
3. WoodMart, B2BKing and overlap parity gate.
4. Idempotent prepare/resolve plus last-unit race tests.
5. Verified finalization/cancel and refund/restock integration.

## Task Sequence
BR-01 → BR-02 → BR-03 → BR-04 → BR-05 → BR-06 → BR-07. Full execution contracts are in TASKS.md. CP-03/FE-01/BR-01/CORE work can proceed in distinct files once their stated inputs exist.

## Integration Points
H0–4 authority/contracts/scaffold; H4–12 browser/BFF/providers plus pricing parity; H12–28 one cash-sale slice; H28–44 electronic/returns/shift/PWA; H44–60 failures/rehearsal/pilot. WS3 owns composition and merge order; integrate scoped commits frequently and review at the declared milestone PR under ADR-012. The ordered continuation queue in TASKS.md and active assignment in CURRENT-WORK control progression; exactly two final freshness passes precede delivery.

## Test Requirements
Foundation: `python3 scripts/verify_control_plane.py`. After scaffold: make -C wordpress/cetech-pos-bridge check; make -C wordpress/cetech-pos-bridge test; make -C wordpress/cetech-pos-bridge parity. Match tests to risk and register actual commands in TOOLCHAIN.md. Staging and hardware evidence are distinct from unit/mock results; record device/configuration/commit/date and redacted artifacts.

## Failure Cases
Plugin absent/incompatible; guest context leakage; two customers concurrently quoting; tax mismatch; crash after order creation; reused key/different body; concurrent last-unit sale; unknown tender on expiry; duplicate finalization/refund/restock.

## Security Requirements
Dedicated bridge capability and service identity over TLS; never price as the privileged integration user; validate scope/customer IDs; restore Woo globals; no public privileged CORS; redact logs.

## Performance Requirements
Proposed budget: whole-cart 20-line quote p95 ≤2 s on staging from store network, report p50/p95/timeouts; correctness gates regardless of latency. Fail boundedly when runtime unavailable. These are proposed acceptance budgets for the sprint, not measured facts; lead may revise only with recorded reason and UX impact.

## Definition of Done
Owned task acceptance passes; no unapproved file or contract changes; schema/type/lint/unit checks pass where available; relevant runtime proof attached; assumptions and limitations explicit; reviewer accepts. Done = evidence.

## STOP / Escalation Conditions
No isolated staging access, unknown multi-stock behavior, unexplained price/tax mismatch, unsafe order/stock race, request to duplicate pricing rules or missing shared contract. Stop only the affected operation; continue authorized independent work. Do not use escalation to request permission already granted in the task.

## Handoff Requirements
Use HANDOFF.md and report exact task/branch/commit(s), files, contracts, migrations, ADRs, commands/results, runtime verification, assumptions/limitations, risks, reviewer and next task. Attach pricing/RLS/device/failure evidence as appropriate. Never say only 'implemented successfully'.

## Batch continuation

Use TASKS.md ordered queue and CURRENT-WORK activation/leases. Continue automatically through ready authorized tasks; block only affected work. Checkpoint every 30–60 minutes or coherent subtask. Use the canonical handoff and [bounded freshness policy](../../plans/LONG-RUNNING-WORK.md); after Pass 2 stop. Historical single-task prompts are superseded only within this approved batch scope.

## Human ownership through a milestone (ADR-014)

The task's human/workstream owner survives batching. Auto-continuation covers only that owner's authorized ready tasks. At a cross-owner edge hand off exact source/import/tested combined SHAs; the receiver can branch from the declared provisional integration SHA without an intermediate main merge. The editor imports/tests contributions rather than implementing another owner's feature. Review fixes return to the task owner; unavailability requires waiting or explicit recorded senior reassignment. R5+ milestone PRs use neutral WS3-owned batch/rN-* branches. Read [the canonical rule](../../plans/LONG-RUNNING-WORK.md#ownership-preserving-milestone-execution); CURRENT-WORK controls activation and scope.
