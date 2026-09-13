# WS2 bounded execution tasks

## Ordered continuation queue (ADR-012)

Activation and exact current scope: CURRENT-WORK.md at repository root. The table is the approved progression; a later milestone is not activated merely by being listed. Execute only tasks whose declared human/workstream owner matches Emmanuel / @Emmanuel-coder-prog / WS2 (or a prior explicit senior reassignment in CURRENT-WORK), with authorized paths/leases. Test/inspect/commit/checkpoint, then continue only within that same owner's queue. At a cross-owner edge stop implementation and publish a tested provisional-SHA handoff; the integrator does not take the task. Review fixes return to the owning human. See ADR-014. Detailed task contracts below remain unchanged. Dependencies may allow PREP_ONLY mocks or declared PROVISIONAL_TEST composition; these never prove runtime acceptance. Final task/batch delivery uses [two-pass freshness](../../plans/LONG-RUNNING-WORK.md), then STOP after Pass 2.

| Order | Task | Milestone | Prerequisites / current boundary |
| --- | --- | --- | --- |
| 1 | BR-01 | R2 | CP-03, CP-04; ADR-011 local baseline satisfied; live installation/identity remain gated |
| 2 | BR-02 | R3 | BR-01 |
| 3 | BR-03 | R3 | BR-02 |
| 4 | BR-04 | R3 | BR-02 |
| 5 | BR-05 | R3 | BR-03, BR-04 |
| 6 | BR-06 | R5 | BR-05, CORE-01 |
| 7 | BR-07 | R6 | BR-06, CORE-05 |

R3 BR-03/BR-04 both follow BR-02 and may be prepared independently. Fallback: authorized synthetic bridge fixtures and local permission/quote harness; no live parity claim. After RT-01 freezes refund wire, accept only the explicitly delegated WS2 refund contribution with exact paths/tests; no invented contract or Supabase ownership.


Baseline scope is committed here. GitHub issues own live assignment/status/evidence; synchronize approved scope changes back by PR.

# BR-01 — Build bridge health and permission skeleton

## Objective
Build bridge health and permission skeleton.

## Context
Implement the authoritative isolated Woo runtime boundary and prove WoodMart/B2BKing parity before transactional checkout. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS2 — Commerce / WooCommerce bridge

## Owner
Developer 2; GitHub assignee only after identity verification.

## Branch
`ws2/br-01-build-bridge-health-and-permission-skeleton`

## Allowed Files
wordpress/cetech-pos-bridge/**; tests/bridge/**; tests/fixtures/commerce/**

## Forbidden Files
apps/**; supabase/**; docs/contracts/**; .github/**; root config/lockfiles; reference/**. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
bridgeHealth / BridgeHealth; owner WS3; version 1.0.0.

## Dependencies
CP-03, CP-04. Milestone M0. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Create plugin bootstrap/build/check targets; capability guard; authenticated health and plugin detection.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
make check/test pass; unauthenticated/unauthorized calls rejected; health never claims parity from detection alone.

## Required Tests
`python3 scripts/verify_control_plane.py; make -C wordpress/cetech-pos-bridge check; make -C wordpress/cetech-pos-bridge test`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Actual PHP/plugin versions required before compatibility declaration.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# BR-02 — Implement isolated Woo runtime quote spike

## Objective
Implement isolated Woo runtime quote spike.

## Context
Implement the authoritative isolated Woo runtime boundary and prove WoodMart/B2BKing parity before transactional checkout. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS2 — Commerce / WooCommerce bridge

## Owner
Developer 2; GitHub assignee only after identity verification.

## Branch
`ws2/br-02-implement-isolated-woo-runtime-quote-spike`

## Allowed Files
wordpress/cetech-pos-bridge/**; tests/bridge/**; tests/fixtures/commerce/**

## Forbidden Files
apps/**; supabase/**; docs/contracts/**; .github/**; root config/lockfiles; reference/**. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
QuoteRequest, Quote, ApiFailure; owner WS3; version 1.0.0.

## Dependencies
BR-01. Milestone M1. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Create isolated whole-cart/customer context; snapshot quote; normalize response and restore globals in finally.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Guest and retail parity; two concurrent customer contexts isolated; quote creates no order/stock side effects.

## Required Tests
`python3 scripts/verify_control_plane.py; make -C wordpress/cetech-pos-bridge check; make -C wordpress/cetech-pos-bridge test; make -C wordpress/cetech-pos-bridge parity`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Pricing hooks may require actual cart/session context; no guessed calculations.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# BR-03 — Prove WoodMart tier pricing parity

## Objective
Prove WoodMart tier pricing parity.

## Context
Implement the authoritative isolated Woo runtime boundary and prove WoodMart/B2BKing parity before transactional checkout. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS2 — Commerce / WooCommerce bridge

## Owner
Developer 2; GitHub assignee only after identity verification.

## Branch
`ws2/br-03-prove-woodmart-tier-pricing-parity`

## Allowed Files
wordpress/cetech-pos-bridge/**; tests/bridge/**; tests/fixtures/commerce/**

## Forbidden Files
apps/**; supabase/**; docs/contracts/**; .github/**; root config/lockfiles; reference/**. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
Quote and pricing corpus; owner WS3; version 1.0.0.

## Dependencies
BR-02. Milestone M1. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Capture below/at/above configured thresholds for simple/variation products; compare checkout line/tax/totals.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Zero unexplained minor-unit differences, redacted golden corpus records plugin versions and timestamps.

## Required Tests
`python3 scripts/verify_control_plane.py; make -C wordpress/cetech-pos-bridge check; make -C wordpress/cetech-pos-bridge test; make -C wordpress/cetech-pos-bridge parity`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Do not hardcode threshold logic in bridge or UI.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# BR-04 — Prove B2BKing commercial parity

## Objective
Prove B2BKing commercial parity.

## Context
Implement the authoritative isolated Woo runtime boundary and prove WoodMart/B2BKing parity before transactional checkout. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS2 — Commerce / WooCommerce bridge

## Owner
Developer 2; GitHub assignee only after identity verification.

## Branch
`ws2/br-04-prove-b2bking-commercial-parity`

## Allowed Files
wordpress/cetech-pos-bridge/**; tests/bridge/**; tests/fixtures/commerce/**

## Forbidden Files
apps/**; supabase/**; docs/contracts/**; .github/**; root config/lockfiles; reference/**. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
CustomerContext, Quote; owner WS3; version 1.0.0.

## Dependencies
BR-02. Milestone M1. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Test group/tier/customer-specific terms and relevant tax exemptions/min/max/multiples in actual runtime.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
All configured scenarios exact; unauthorized customer switch denied; no context leakage.

## Required Tests
`python3 scripts/verify_control_plane.py; make -C wordpress/cetech-pos-bridge check; make -C wordpress/cetech-pos-bridge test; make -C wordpress/cetech-pos-bridge parity`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Unconfigured cases documented as not applicable with evidence, never synthetic parity.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# BR-05 — Resolve plugin overlap and pass pricing gate

## Objective
Resolve plugin overlap and pass pricing gate.

## Context
Implement the authoritative isolated Woo runtime boundary and prove WoodMart/B2BKing parity before transactional checkout. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS2 — Commerce / WooCommerce bridge

## Owner
Developer 2; GitHub assignee only after identity verification.

## Branch
`ws2/br-05-resolve-plugin-overlap-and-pass-pricing-gate`

## Allowed Files
wordpress/cetech-pos-bridge/**; tests/bridge/**; tests/fixtures/commerce/**

## Forbidden Files
apps/**; supabase/**; docs/contracts/**; .github/**; root config/lockfiles; reference/**. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
Quote/error v1; pricing parity matrix; owner WS3; version 1.0.0.

## Dependencies
BR-03, BR-04. Milestone M1. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Exercise WoodMart+B2BKing together, variations and tax; identify controlling runtime behavior; retain golden fixtures.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
All required matrix rows pass or applicability approved; senior records pricing gate result.

## Required Tests
`python3 scripts/verify_control_plane.py; make -C wordpress/cetech-pos-bridge check; make -C wordpress/cetech-pos-bridge test; make -C wordpress/cetech-pos-bridge parity`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Any unexplained mismatch blocks dependent checkout.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# BR-06 — Implement HPOS-safe idempotent prepare and resolve

## Objective
Implement HPOS-safe idempotent prepare and resolve.

## Context
Implement the authoritative isolated Woo runtime boundary and prove WoodMart/B2BKing parity before transactional checkout. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS2 — Commerce / WooCommerce bridge

## Owner
Developer 2; GitHub assignee only after identity verification.

## Branch
`ws2/br-06-implement-hpos-safe-idempotent-prepare-and-re`

## Allowed Files
wordpress/cetech-pos-bridge/**; tests/bridge/**; tests/fixtures/commerce/**

## Forbidden Files
apps/**; supabase/**; docs/contracts/**; .github/**; root config/lockfiles; reference/**. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
PrepareSaleRequest, PreparedSale, SaleResolution; owner WS3; version 1.0.0.

## Dependencies
BR-05, CORE-01. Milestone M1. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Use Woo CRUD; durable unique key/transaction claim; verify reserve/reduce; recovery mapping; cancellation guards.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Same intent concurrent/retry creates one order; crash after order create recovers; last-unit race with online checkout cannot oversell; target HPOS mode passes.

## Required Tests
`python3 scripts/verify_control_plane.py; make -C wordpress/cetech-pos-bridge check; make -C wordpress/cetech-pos-bridge test; make -C wordpress/cetech-pos-bridge parity`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Order metadata lookup alone is not atomic deduplication or stock locking.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# BR-07 — Implement verified commercial finalization and cancel

## Objective
Implement verified commercial finalization and cancel.

## Context
Implement the authoritative isolated Woo runtime boundary and prove WoodMart/B2BKing parity before transactional checkout. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS2 — Commerce / WooCommerce bridge

## Owner
Developer 2; GitHub assignee only after identity verification.

## Branch
`ws2/br-07-implement-verified-commercial-finalization-an`

## Allowed Files
wordpress/cetech-pos-bridge/**; tests/bridge/**; tests/fixtures/commerce/**

## Forbidden Files
apps/**; supabase/**; docs/contracts/**; .github/**; root config/lockfiles; reference/**. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
BridgeFinalizeRequest, SaleResolution; owner WS3; version 1.0.0.

## Dependencies
BR-06, CORE-05. Milestone M1. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Validate server evidence binding and exact order total; idempotent Woo completion; safe cancellation/expiry with no verified/pending money.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Duplicate finalization reduces stock once; uncertain money blocks release; late success goes to attention.

## Required Tests
`python3 scripts/verify_control_plane.py; make -C wordpress/cetech-pos-bridge check; make -C wordpress/cetech-pos-bridge test; make -C wordpress/cetech-pos-bridge parity`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Do not let payment adapter call Woo or invent compensation.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.
