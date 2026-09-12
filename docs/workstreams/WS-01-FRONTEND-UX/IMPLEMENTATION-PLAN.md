# WS1 implementation plan

## Mission
Convert the approved cashier experience into reusable Next.js features without redesign or provider leakage.

## Production Outcome
A cashier can use phone/tablet/desktop to scan, quote, pay and print with truthful pending/offline/recovery states.

## Scope
Feature components, semantic tokens, responsive flows, port-driven view models and frontend regression evidence.

## Out of Scope
src/core/**; src/server/**; src/local/**; src/config/**; src/app/**; public/**; wordpress/**; supabase/**; root package/lockfiles; docs/contracts/**; .github/**; reference/**; full offline settlement, split tender, independent pricing/inventory engines and target-peer infrastructure in P0.

## Canonical Owners
Woo commercial truth; POS server register/workflow truth; device draft intent only.

## Inputs
CatalogPort, CustomerPort, PricingPort, CheckoutUseCases, PaymentPort UI-safe methods, RegisterPort, ReceiptPort, PrintPort, IdentityPort, HealthPort; QuoteState and CheckoutEligibility.

## Outputs
Feature components, semantic tokens, responsive flows, port-driven view models and frontend regression evidence.

## File Ownership
apps/pos-web/src/features/**; apps/pos-web/src/ui/**; tests/frontend/**. See BOUNDARIES.md for exact root-relative interpretation.

## Protected / Forbidden Files
src/core/**; src/server/**; src/local/**; src/config/**; src/app/**; public/**; wordpress/**; supabase/**; root package/lockfiles; docs/contracts/**; .github/**; reference/**. No competitive central edits. Record a scoped delegation before crossing ownership.

## Dependencies
CP-01/02/03 freeze authority and v1. CP-05 creates shared app/toolchain; CP-04 verifies live facts. BR-05 gates live transactional checkout. Task-specific dependencies below are mandatory; no hidden cross-workstream dependency.

## Milestones
1. Reference intake and scenario/test map.
2. Tokens and responsive shell on shared scaffold.
3. Catalog/cart/customer and revision-safe quotes.
4. Prepare/cash/receipt integration after parity.
5. Electronic/refund/register/recovery UX and real-device comparison.

## Task Sequence
FE-01 → FE-02 → FE-03 → FE-04 → FE-05 → FE-06 → FE-07. Full execution contracts are in TASKS.md. CP-03/FE-01/BR-01/CORE work can proceed in distinct files once their stated inputs exist.

## Integration Points
H0–4 authority/contracts/scaffold; H4–12 browser/BFF/providers plus pricing parity; H12–28 one cash-sale slice; H28–44 electronic/returns/shift/PWA; H44–60 failures/rehearsal/pilot. WS3 owns composition and merge order; integrate scoped commits frequently and review at the declared milestone PR under ADR-012. The ordered continuation queue in TASKS.md and active assignment in CURRENT-WORK control progression; exactly two final freshness passes precede delivery.

## Test Requirements
Foundation: `python3 scripts/verify_control_plane.py`. After scaffold: pnpm --dir apps/pos-web lint; pnpm --dir apps/pos-web typecheck; pnpm --dir apps/pos-web test; pnpm --dir apps/pos-web test:e2e. Match tests to risk and register actual commands in TOOLCHAIN.md. Staging and hardware evidence are distinct from unit/mock results; record device/configuration/commit/date and redacted artifacts.

## Failure Cases
Out-of-order quote; customer switch; duplicate barcode; missing variation; offline cart; expired session; pending tender; Woo finalized but POS pending; print cancelled; passive tab; blocked update.

## Security Requirements
Never import privileged SDKs; escape display data; mask customer PII; capability hints never authorize actions; no token persistence in localStorage.

## Performance Requirements
Proposed engineering budgets: local barcode lookup/add p95 ≤100 ms on representative device and 5,000-product fixture; input feedback ≤100 ms; record actual device/catalog size. Remote quote latency measured separately. These are proposed acceptance budgets for the sprint, not measured facts; lead may revise only with recorded reason and UX impact.

## Definition of Done
Owned task acceptance passes; no unapproved file or contract changes; schema/type/lint/unit checks pass where available; relevant runtime proof attached; assumptions and limitations explicit; reviewer accepts. Done = evidence.

## STOP / Escalation Conditions
Missing approved reference, need to alter core contracts, unexplained pricing mismatch, cross-owner edit or any UI state that would imply unverified payment/completion. Stop only the affected operation; continue authorized independent work. Do not use escalation to request permission already granted in the task.

## Handoff Requirements
Use HANDOFF.md and report exact task/branch/commit(s), files, contracts, migrations, ADRs, commands/results, runtime verification, assumptions/limitations, risks, reviewer and next task. Attach pricing/RLS/device/failure evidence as appropriate. Never say only 'implemented successfully'.

## Batch continuation

Use TASKS.md ordered queue and CURRENT-WORK activation/leases. Continue automatically through ready authorized tasks; block only affected work. Checkpoint every 30–60 minutes or coherent subtask. Use the canonical handoff and [bounded freshness policy](../../plans/LONG-RUNNING-WORK.md); after Pass 2 stop. Historical single-task prompts are superseded only within this approved batch scope.
