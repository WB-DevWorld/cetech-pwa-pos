# WS1 bounded execution tasks

## Ordered continuation queue (ADR-012)

Activation and exact current scope: CURRENT-WORK.md at repository root. The table is the approved progression; a later milestone is not activated merely by being listed. Execute only tasks whose declared human/workstream owner matches Ben / @Ben-001-sys / WS1 (or a prior explicit senior reassignment in CURRENT-WORK), with authorized paths/leases. Test/inspect/commit/checkpoint, then continue only within that same owner's queue. At a cross-owner edge stop implementation and publish a tested provisional-SHA handoff; the integrator does not take the task. Review fixes return to the owning human. See ADR-014. Detailed task contracts below remain unchanged. Dependencies may allow PREP_ONLY mocks or declared PROVISIONAL_TEST composition; these never prove runtime acceptance. Final task/batch delivery uses [two-pass freshness](../../plans/LONG-RUNNING-WORK.md), then STOP after Pass 2.

| Order | Task | Milestone | Prerequisites / current boundary |
| --- | --- | --- | --- |
| 1 | FE-03 | R4 | FE-02, CORE-04; FE-02 merged, #41 preparation exists; CORE-04 runtime not accepted |
| 2 | FE-04 | R4 | FE-03, BR-05 |
| 3 | FE-05 | R6 | FE-04, CORE-05, BR-06 |
| 4 | FE-06 | R8 | FE-05, PAY-01, RT-01 |
| 5 | FE-07 | R9 | FE-05, CORE-07 |

Fallback inside R4: reference-preserving FE-03/FE-04 presentation and failure-state tests against frozen mocks, only evidenced gaps; do not redo complete preparation. PAY/RT UI contributions remain FE-06 scope; no payment verification. Never edit shared schema, core/routes/service worker without a named lease.


Baseline scope is committed here. GitHub issues own live assignment/status/evidence; synchronize approved scope changes back by PR.

# FE-01 — Intake approved prototype and map scenarios

## Objective
Intake approved prototype and map scenarios.

## Context
Convert the approved cashier experience into reusable Next.js features without redesign or provider leakage. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS1 — Frontend / POS experience

## Owner
Developer 1; GitHub assignee only after identity verification.

## Branch
`ws1/fe-01-intake-approved-prototype-and-map-scenarios`

## Allowed Files
docs/workstreams/WS-01-FRONTEND-UX/**; tests/frontend/reference-map.md

## Forbidden Files
src/core/**; src/server/**; src/local/**; src/config/**; src/app/**; public/**; wordpress/**; supabase/**; root package/lockfiles; docs/contracts/**; .github/**; reference/**. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
PROTOTYPE-MAPPING.md; owner WS3; version 1.0.0.

## Dependencies
CP-03. Milestone M0. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Read immutable artifact; list component/token/view mapping; map every demo scenario to production test target.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
All reference screens and failure states mapped; no source bytes changed.

## Required Tests
`python3 scripts/verify_control_plane.py`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Prototype fixture success is not runtime proof.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# FE-02 — Convert tokens and responsive POS shell

## Objective
Convert tokens and responsive POS shell.

## Context
Convert the approved cashier experience into reusable Next.js features without redesign or provider leakage. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS1 — Frontend / POS experience

## Owner
Developer 1; GitHub assignee only after identity verification.

## Branch
`ws1/fe-02-convert-tokens-and-responsive-pos-shell`

## Allowed Files
apps/pos-web/src/features/**; apps/pos-web/src/ui/**; tests/frontend/**

## Forbidden Files
src/core/**; src/server/**; src/local/**; src/config/**; src/app/**; public/**; wordpress/**; supabase/**; root package/lockfiles; docs/contracts/**; .github/**; reference/**. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
IdentityPort, RegisterPort; owner WS3; version 1.0.0.

## Dependencies
FE-01, CP-05. Milestone M1. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Implement tokens/navigation/layout; Login/Register gate components; provide route mounting instructions to WS3.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Phone/tablet/desktop screenshots match reference; keyboard/focus/touch/reduced-motion checks pass.

## Required Tests
`python3 scripts/verify_control_plane.py; pnpm --dir apps/pos-web lint; pnpm --dir apps/pos-web typecheck; pnpm --dir apps/pos-web test; pnpm --dir apps/pos-web test:e2e`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Do not edit app routes or add component library defaults without approval.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# FE-03 — Build Sell cart barcode and customer workflow

## Objective
Build Sell cart barcode and customer workflow.

## Context
Convert the approved cashier experience into reusable Next.js features without redesign or provider leakage. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS1 — Frontend / POS experience

## Owner
Developer 1; GitHub assignee only after identity verification.

## Branch
`ws1/fe-03-build-sell-cart-barcode-and-customer-workflow`

## Allowed Files
apps/pos-web/src/features/**; apps/pos-web/src/ui/**; tests/frontend/**

## Forbidden Files
src/core/**; src/server/**; src/local/**; src/config/**; src/app/**; public/**; wordpress/**; supabase/**; root package/lockfiles; docs/contracts/**; .github/**; reference/**. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
CatalogPort, CustomerPort, CartDraftStore; owner WS3; version 1.0.0.

## Dependencies
FE-02, CORE-04. Milestone M1. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Wire catalog/variation/barcode views; preserve leading zeroes; persist cart revisions; customer switch/new-sale reset.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Repeated scans increment; exact variation bypasses chooser; stale catalog/offline drafts work; no privileged imports.

## Required Tests
`python3 scripts/verify_control_plane.py; pnpm --dir apps/pos-web lint; pnpm --dir apps/pos-web typecheck; pnpm --dir apps/pos-web test; pnpm --dir apps/pos-web test:e2e`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Source barcode mapping requires CP-04 before live use.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# FE-04 — Integrate quote states and checkout eligibility

## Objective
Integrate quote states and checkout eligibility.

## Context
Convert the approved cashier experience into reusable Next.js features without redesign or provider leakage. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS1 — Frontend / POS experience

## Owner
Developer 1; GitHub assignee only after identity verification.

## Branch
`ws1/fe-04-integrate-quote-states-and-checkout-eligibili`

## Allowed Files
apps/pos-web/src/features/**; apps/pos-web/src/ui/**; tests/frontend/**

## Forbidden Files
src/core/**; src/server/**; src/local/**; src/config/**; src/app/**; public/**; wordpress/**; supabase/**; root package/lockfiles; docs/contracts/**; .github/**; reference/**. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
PricingPort, QuoteState, CheckoutEligibility; owner WS3; version 1.0.0.

## Dependencies
FE-03, BR-05. Milestone M1. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Bind whole-cart quote; reject obsolete responses; explain disabled Pay; show accepted price/stock change review.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Delayed quote cannot overwrite current revision; expired/offline quote blocks payment; customer change requotes.

## Required Tests
`python3 scripts/verify_control_plane.py; pnpm --dir apps/pos-web lint; pnpm --dir apps/pos-web typecheck; pnpm --dir apps/pos-web test; pnpm --dir apps/pos-web test:e2e`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Mock quote states may start earlier; live checkout requires BR-05.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# FE-05 — Integrate cash checkout and receipt UX

## Objective
Integrate cash checkout and receipt UX.

## Context
Convert the approved cashier experience into reusable Next.js features without redesign or provider leakage. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS1 — Frontend / POS experience

## Owner
Developer 1; GitHub assignee only after identity verification.

## Branch
`ws1/fe-05-integrate-cash-checkout-and-receipt-ux`

## Allowed Files
apps/pos-web/src/features/**; apps/pos-web/src/ui/**; tests/frontend/**

## Forbidden Files
src/core/**; src/server/**; src/local/**; src/config/**; src/app/**; public/**; wordpress/**; supabase/**; root package/lockfiles; docs/contracts/**; .github/**; reference/**. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
CheckoutUseCases, PaymentPort, ReceiptPort, PrintPort; owner WS3; version 1.0.0.

## Dependencies
FE-04, CORE-05, BR-06. Milestone M1. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Show prepare/resolve/cash/finalizing/complete separately; integrate print/reprint; preserve draft on failure.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Double-click/timeout yields one order/tender; receipt only after consistent completion; failed print does not repeat sale.

## Required Tests
`python3 scripts/verify_control_plane.py; pnpm --dir apps/pos-web lint; pnpm --dir apps/pos-web typecheck; pnpm --dir apps/pos-web test; pnpm --dir apps/pos-web test:e2e`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
No browser cash/payment verification or fake receipt counters.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# FE-06 — Implement payment returns and register states

## Objective
Implement payment returns and register states.

## Context
Convert the approved cashier experience into reusable Next.js features without redesign or provider leakage. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS1 — Frontend / POS experience

## Owner
Developer 1; GitHub assignee only after identity verification.

## Branch
`ws1/fe-06-implement-payment-returns-and-register-states`

## Allowed Files
apps/pos-web/src/features/**; apps/pos-web/src/ui/**; tests/frontend/**

## Forbidden Files
src/core/**; src/server/**; src/local/**; src/config/**; src/app/**; public/**; wordpress/**; supabase/**; root package/lockfiles; docs/contracts/**; .github/**; reference/**. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
PaymentPort, ReturnPort, RegisterPort; owner WS3; version 1.0.0.

## Dependencies
FE-05, PAY-01, RT-01. Milestone M2. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Add electronic pending/reconciling; historical returns/condition UI; blind shift close and variance states.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Pending says do not charge again; damaged return not implicitly sellable; cashier cannot invent expected cash.

## Required Tests
`python3 scripts/verify_control_plane.py; pnpm --dir apps/pos-web lint; pnpm --dir apps/pos-web typecheck; pnpm --dir apps/pos-web test; pnpm --dir apps/pos-web test:e2e`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Final policies/provider states are server-owned.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# FE-07 — Finish Store Health and responsive PWA recovery UX

## Objective
Finish Store Health and responsive PWA recovery UX.

## Context
Convert the approved cashier experience into reusable Next.js features without redesign or provider leakage. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS1 — Frontend / POS experience

## Owner
Developer 1; GitHub assignee only after identity verification.

## Branch
`ws1/fe-07-finish-store-health-and-responsive-pwa-recove`

## Allowed Files
apps/pos-web/src/features/**; apps/pos-web/src/ui/**; tests/frontend/**

## Forbidden Files
src/core/**; src/server/**; src/local/**; src/config/**; src/app/**; public/**; wordpress/**; supabase/**; root package/lockfiles; docs/contracts/**; .github/**; reference/**. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
HealthPort, ReleasePolicy, local recovery view state; owner WS3; version 1.0.0.

## Dependencies
FE-05, CORE-07. Milestone M2. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Render health/attention/update-ready/passive-tab/offline/migration-blocked states; compare reference on real devices.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Installed Android/iPhone or documented supported-device evidence; update deferred during payment; no loss of drafts/journal.

## Required Tests
`python3 scripts/verify_control_plane.py; pnpm --dir apps/pos-web lint; pnpm --dir apps/pos-web typecheck; pnpm --dir apps/pos-web test; pnpm --dir apps/pos-web test:e2e`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
If a device is not available, mark that release evidence missing.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.
