# WS3 bounded execution tasks

Baseline scope is committed here. GitHub issues own live assignment/status/evidence; synchronize approved scope changes back by PR.

# CP-01 — Bootstrap repository control plane

## Objective
Bootstrap repository control plane.

## Context
Own the shared application spine, data integrity, authorization, contracts, single-editor configuration and release integration. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS3 — Core / data / integration

## Owner
Senior / @wbdevworld; GitHub assignee only after identity verification.

## Branch
`ws3/cp-01-bootstrap-repository-control-plane`

## Allowed Files
root control files; docs/**; .cursor/**; .github/**; scripts/**; reference/**

## Forbidden Files
WS1 feature/UI files and WS2 plugin implementation except an explicitly recorded integration delegation; source artifact bytes. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
Authority hierarchy; owner WS3; version 1.0.0.

## Dependencies
none. Milestone M0. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Recover sources; inspect GitHub; commit authority/ownership/reference and workstream specs.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Foundation check and reference hashes pass; commit/tree exists in canonical repo.

## Required Tests
`python3 scripts/verify_control_plane.py`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Unsupported GitHub governance must remain explicitly pending.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# CP-02 — Reconcile architecture and decision freeze

## Objective
Reconcile architecture and decision freeze.

## Context
Own the shared application spine, data integrity, authorization, contracts, single-editor configuration and release integration. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS3 — Core / data / integration

## Owner
Senior / @wbdevworld; GitHub assignee only after identity verification.

## Branch
`ws3/cp-02-reconcile-architecture-and-decision-freeze`

## Allowed Files
docs/architecture/**; docs/decisions/**; SOURCE-OF-TRUTH.md

## Forbidden Files
WS1 feature/UI files and WS2 plugin implementation except an explicitly recorded integration delegation; source artifact bytes. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
ADRs 001–010; owner WS3; version 1.0.0.

## Dependencies
CP-01. Milestone M0. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Resolve current/transitional/target/superseded; record no P0 InventoryPort and central editor.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Fresh agent answers owner/provider/migration questions from repo; no conflicting baseline.

## Required Tests
`python3 scripts/verify_control_plane.py`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Do not relabel unknown runtime facts as approved.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# CP-03 — Freeze domain and wire contracts

## Objective
Freeze domain and wire contracts.

## Context
Own the shared application spine, data integrity, authorization, contracts, single-editor configuration and release integration. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS3 — Core / data / integration

## Owner
Senior / @wbdevworld; GitHub assignee only after identity verification.

## Branch
`ws3/cp-03-freeze-domain-and-wire-contracts`

## Allowed Files
docs/contracts/**; scripts/generate_contract_types.py; tests/contracts/**

## Forbidden Files
WS1 feature/UI files and WS2 plugin implementation except an explicitly recorded integration delegation; source artifact bytes. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
All v1 contracts; owner WS3; version 1.0.0.

## Dependencies
CP-02. Milestone M0. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Define money/IDs/customer/quote; separate payment/sale/print; generate TS and shared OpenAPI references.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Schema references and examples pass; no client payment evidence accepted; all consumers use v1.

## Required Tests
`python3 scripts/verify_control_plane.py`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Schema validation does not prove runtime or pricing correctness.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# CP-04 — Audit live environment and isolate staging

## Objective
Maintain the satisfied training development baseline and complete operation-specific write-safety/cutover evidence. See ADR-011 and docs/runbooks/CP-04-REMAINING-WORK.md.

## Context
Own the shared application spine, data integrity, authorization, contracts, single-editor configuration and release integration. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS3 — Core / data / integration

## Owner
Senior / @wbdevworld; GitHub assignee only after identity verification.

## Branch
`ws3/cp-04-audit-live-environment-and-isolate-staging`

## Allowed Files
LIVE-ENVIRONMENT-FACTS.md; docs/runbooks/**; docs/integration/evidence/**

## Forbidden Files
WS1 feature/UI files and WS2 plugin implementation except an explicitly recorded integration delegation; source artifact bytes. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
Environment and authorization policy; owner WS3; version 1.0.0.

## Dependencies
CP-01. M0 development baseline SATISFIED; remaining write-safety/cutover evidence OPEN / DEFERRED. Local CORE-01/BR-01 implementation does not require production access. Keep issue #4 OPEN.

## Implementation Steps
Development baseline SATISFIED via authenticated training evidence (ADR-011). Execute the operation-specific remaining-work checklist: outbound containment, data/write boundaries, synthetic fixtures, bridge service access and payment sandbox; retain production deltas for release.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Track DEVELOPMENT BASELINE separately from WRITE-SAFETY/CUTOVER. Each relevant fact has observer/time/environment/evidence. No blanket local-development block; affected remote effects require containment proof. Issue #4 stays open for residuals.

## Required Tests
`python3 scripts/verify_control_plane.py`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Known unsafe training side effects still block affected remote tests. Missing production access/fingerprints do not block local CORE-01 or BR-01.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# CP-05 — Pin toolchain and create Next.js/CI scaffold

## Objective
Pin toolchain and create Next.js/CI scaffold.

## Context
Own the shared application spine, data integrity, authorization, contracts, single-editor configuration and release integration. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS3 — Core / data / integration

## Owner
Senior / @wbdevworld; GitHub assignee only after identity verification.

## Branch
`ws3/cp-05-pin-toolchain-and-create-next.js-ci-scaffold`

## Allowed Files
apps/pos-web/package.json; apps/pos-web/src/app/**; apps/pos-web/tsconfig.json; apps/pos-web/next.config.*; apps/pos-web/eslint.config.*; apps/pos-web/*test*; apps/pos-web/public/**; package.json; pnpm-lock.yaml; .github/workflows/**; docs/standards/TOOLCHAIN.md

## Forbidden Files
WS1 feature/UI files and WS2 plugin implementation except an explicitly recorded integration delegation; source artifact bytes. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
v1 reexports; environment schema; owner WS3; version 1.0.0.

## Dependencies
CP-03. Milestone M0. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Verify supported versions/security; pin Node/pnpm/Next/TS; one app package, lockfile; wire lint/typecheck/test/build/e2e scripts; add real CI jobs.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Clean install --frozen-lockfile; lint/typecheck/test/build pass; no nonexistent checks; blank app routes do not redesign UX.

## Required Tests
`python3 scripts/verify_control_plane.py; pnpm install --frozen-lockfile; pnpm --dir apps/pos-web lint; pnpm --dir apps/pos-web typecheck; pnpm --dir apps/pos-web test; pnpm --dir apps/pos-web build`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Only WS3 edits dependencies; do not rely on remembered TS versions.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# CORE-01 — Create POS operational schema and RLS

## Objective
Create POS operational schema and RLS.

## Context
Own the shared application spine, data integrity, authorization, contracts, single-editor configuration and release integration. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS3 — Core / data / integration

## Owner
Senior / @wbdevworld; GitHub assignee only after identity verification.

## Branch
`ws3/core-01-create-pos-operational-schema-and-rls`

## Allowed Files
supabase/**; docs/architecture/DATA-OWNERSHIP.md; tests/integration/rls/**

## Forbidden Files
WS1 feature/UI files and WS2 plugin implementation except an explicitly recorded integration delegation; source artifact bytes. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
Register, Shift, CashMovement, PendingOperation; owner WS3; version 1.0.0.

## Dependencies
CP-04 means its SATISFIED development baseline for local implementation (ADR-011). Issue #4 remains OPEN for operation-specific remote-write/cutover evidence. Production-site access is not a local implementation prerequisite; runtime acceptance still needs applicable evidence.

CP-04, CP-05. Milestone M1. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
One migration owner; schema for devices/registers/shifts/movements/workflow/outbox/projections; grants/RLS; unique constraints and append-only rules.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Fresh local reset and supabase test db pass; anon/cross-tenant/wrong-location/forged actor denied; no duplicate commerce master.

## Required Tests
`python3 scripts/verify_control_plane.py; supabase db reset --local; supabase test db`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Service role bypass requires independent server authorization tests.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# CORE-02 — Implement staff auth abstraction and permission boundary

## Objective
Implement staff auth abstraction and permission boundary.

## Context
Own the shared application spine, data integrity, authorization, contracts, single-editor configuration and release integration. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS3 — Core / data / integration

## Owner
Senior / @wbdevworld; GitHub assignee only after identity verification.

## Branch
`ws3/core-02-implement-staff-auth-abstraction-and-permissi`

## Allowed Files
apps/pos-web/src/core/**; apps/pos-web/src/server/**; apps/pos-web/src/config/**; tests/integration/auth/**

## Forbidden Files
WS1 feature/UI files and WS2 plugin implementation except an explicitly recorded integration delegation; source artifact bytes. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
IdentityPort, Session; owner WS3; version 1.0.0.

## Dependencies
CP-05, CORE-01. Milestone M1. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Map Supabase Auth to server session; authorize staff/location/register; secure cookies/CSRF; timeout/revocation handling.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Anonymous/expired/wrong role/wrong location requests denied; client capabilities never grant access; signout preserves journal safely.

## Required Tests
`python3 scripts/verify_control_plane.py; pnpm --dir apps/pos-web lint; pnpm --dir apps/pos-web typecheck; pnpm --dir apps/pos-web test`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Buyer customer context must not become staff identity.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# CORE-03 — Wire BFF health and bridge connectivity

## Objective
Wire BFF health and bridge connectivity.

## Context
Own the shared application spine, data integrity, authorization, contracts, single-editor configuration and release integration. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS3 — Core / data / integration

## Owner
Senior / @wbdevworld; GitHub assignee only after identity verification.

## Branch
`ws3/core-03-wire-bff-health-and-bridge-connectivity`

## Allowed Files
apps/pos-web/src/server/**; apps/pos-web/src/app/api/**; apps/pos-web/src/config/**; tests/integration/health/**

## Forbidden Files
WS1 feature/UI files and WS2 plugin implementation except an explicitly recorded integration delegation; source artifact bytes. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
StoreHealth, BridgeHealth, ApiFailure; owner WS3; version 1.0.0.

## Dependencies
CORE-02, BR-01. Milestone M1. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Add normalized BFF routes and adapters; validate env; authenticated Supabase/bridge health; timeout/correlation handling.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Browser→BFF→Supabase and bridge→Woo detection verified; no privileged secret in browser/network bundle.

## Required Tests
`python3 scripts/verify_control_plane.py; pnpm --dir apps/pos-web lint; pnpm --dir apps/pos-web typecheck; pnpm --dir apps/pos-web test`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Detection is not pricing parity.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# CORE-04 — Implement catalog projection and durable local journal

## Objective
Implement catalog projection and durable local journal.

## Context
Own the shared application spine, data integrity, authorization, contracts, single-editor configuration and release integration. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS3 — Core / data / integration

## Owner
Senior / @wbdevworld; GitHub assignee only after identity verification.

## Branch
`ws3/core-04-implement-catalog-projection-and-durable-loca`

## Allowed Files
apps/pos-web/src/core/**; apps/pos-web/src/server/**; apps/pos-web/src/local/**; supabase/**; tests/integration/sync/**

## Forbidden Files
WS1 feature/UI files and WS2 plugin implementation except an explicitly recorded integration delegation; source artifact bytes. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
CatalogPort, CartDraftStore, OperationJournal; owner WS3; version 1.0.0.

## Dependencies
CORE-01, CORE-03. Milestone M1. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Sync versioned source projections/tombstones; barcode index; Dexie draft/journal append-before-send; retry/resolve; no prod PII fixtures.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
5,000-item fixture benchmark; missing/duplicate barcode explicit; reconnect/update retains unacked intent; projection rebuild preserves drafts.

## Required Tests
`python3 scripts/verify_control_plane.py; pnpm --dir apps/pos-web lint; pnpm --dir apps/pos-web typecheck; pnpm --dir apps/pos-web test`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Multi-stock and barcode source require live verification.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# CORE-05 — Build cash and FinalizeSale orchestration

## Objective
Build cash and FinalizeSale orchestration.

## Context
Own the shared application spine, data integrity, authorization, contracts, single-editor configuration and release integration. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS3 — Core / data / integration

## Owner
Senior / @wbdevworld; GitHub assignee only after identity verification.

## Branch
`ws3/core-05-build-cash-and-finalizesale-orchestration`

## Allowed Files
apps/pos-web/src/core/**; apps/pos-web/src/server/**; apps/pos-web/src/app/api/**; supabase/**; tests/integration/sales/**

## Forbidden Files
WS1 feature/UI files and WS2 plugin implementation except an explicitly recorded integration delegation; source artifact bytes. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
PaymentPort, SalesPort, CheckoutUseCases, ReceiptPort; owner WS3; version 1.0.0.

## Dependencies
CORE-03, CORE-01, CP-03. Milestone M1. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Open shift/cash ledger use cases; claim idempotency; cash proof; verify evidence; invoke commercial finalizer; outbox/receipt repair.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Same cash command yields one net ledger effect; amount/currency/customer/scope mismatches rejected; Woo success/POS outage repairs without second sale.

## Required Tests
`python3 scripts/verify_control_plane.py; pnpm --dir apps/pos-web lint; pnpm --dir apps/pos-web typecheck; pnpm --dir apps/pos-web test`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Bridge adapter mock may be used until BR-07; real slice waits on BR-07.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# CORE-06 — Integrate real cash sale and contract/E2E harness

## Objective
Integrate real cash sale and contract/E2E harness.

## Context
Own the shared application spine, data integrity, authorization, contracts, single-editor configuration and release integration. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS3 — Core / data / integration

## Owner
Senior / @wbdevworld; GitHub assignee only after identity verification.

## Branch
`ws3/core-06-integrate-real-cash-sale-and-contract-e2e-har`

## Allowed Files
tests/integration/**; tests/contracts/**; tests/e2e/**; .github/workflows/**; apps/pos-web/src/app/**; docs/integration/evidence/**

## Forbidden Files
WS1 feature/UI files and WS2 plugin implementation except an explicitly recorded integration delegation; source artifact bytes. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
v1 entire vertical slice; owner WS3; version 1.0.0.

## Dependencies
FE-05, BR-07, CORE-05. Milestone M1. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Add maintained schema validation/producer-consumer tests; run staff/register/scan/customer/quote/prepare/cash/receipt against isolated staging.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
One Woo order, one tender, one stock effect, one receipt and recorded POS workflow; exact CI/runtime evidence.

## Required Tests
`python3 scripts/verify_control_plane.py; pnpm --dir apps/pos-web lint; pnpm --dir apps/pos-web typecheck; pnpm --dir apps/pos-web test; pnpm --dir apps/pos-web test:e2e`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Cannot call mock-only success a live integration pass.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# PAY-01 — Implement verified electronic payment and reconciliation

## Objective
Implement verified electronic payment and reconciliation.

## Context
Own the shared application spine, data integrity, authorization, contracts, single-editor configuration and release integration. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS3 — Core / data / integration

## Owner
Senior / @wbdevworld; GitHub assignee only after identity verification.

## Branch
`ws3/pay-01-implement-verified-electronic-payment-and-rec`

## Allowed Files
apps/pos-web/src/server/**; apps/pos-web/src/core/**; apps/pos-web/src/app/api/**; supabase/**; tests/integration/payments/**

## Forbidden Files
WS1 feature/UI files and WS2 plugin implementation except an explicitly recorded integration delegation; source artifact bytes. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
PaymentPort, VerifiedPaymentEvidence; owner WS3; version 1.0.0.

## Dependencies
CORE-06, CP-04. Milestone M2. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Pin approved provider sandbox; prepare before initialize; validate signed webhook/server status, reference/amount/currency; dedupe events; late/unknown recovery.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Duplicate/out-of-order callback no double charge; pending never reinitiates; browser success cannot finalize; late success handled explicitly.

## Required Tests
`python3 scripts/verify_control_plane.py; pnpm --dir apps/pos-web lint; pnpm --dir apps/pos-web typecheck; pnpm --dir apps/pos-web test`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Account/live credentials/policy remain human-provided; no secrets in prompts.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# RT-01 — Freeze refund wire refinement and implement safe returns

## Objective
Freeze refund wire refinement and implement safe returns.

## Context
Own the shared application spine, data integrity, authorization, contracts, single-editor configuration and release integration. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS3 — Core / data / integration

## Owner
Senior / @wbdevworld; GitHub assignee only after identity verification.

## Branch
`ws3/rt-01-freeze-refund-wire-refinement-and-implement-s`

## Allowed Files
docs/contracts/**; docs/decisions/**; apps/pos-web/src/core/**; apps/pos-web/src/server/**; supabase/**; tests/integration/returns/**

## Forbidden Files
WS1 feature/UI files and WS2 plugin implementation except an explicitly recorded integration delegation; source artifact bytes. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
ReturnPort, PaymentPort.refund; owner WS3; version 1.0.0.

## Dependencies
PAY-01, BR-07. Milestone M2. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
First freeze missing bridge commercial-refund/restock commands with WS2 review; then historic economics/approval/refund workflow; request separate WS2 subtask in owned paths.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Partial/repeated return quantity capped; one refund and independent one stock effect; damaged/quarantine does not restock; unknown refund resolves.

## Required Tests
`python3 scripts/verify_control_plane.py; pnpm --dir apps/pos-web lint; pnpm --dir apps/pos-web typecheck; pnpm --dir apps/pos-web test`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
WS3 does not silently edit plugin; dependent WS2 task recorded before bridge implementation.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# CORE-07 — Implement safe PWA lifecycle and operational close

## Objective
Implement safe PWA lifecycle and operational close.

## Context
Own the shared application spine, data integrity, authorization, contracts, single-editor configuration and release integration. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS3 — Core / data / integration

## Owner
Senior / @wbdevworld; GitHub assignee only after identity verification.

## Branch
`ws3/core-07-implement-safe-pwa-lifecycle-and-operational-`

## Allowed Files
apps/pos-web/src/local/**; apps/pos-web/src/core/**; apps/pos-web/src/server/**; apps/pos-web/public/**; supabase/**; tests/integration/recovery/**

## Forbidden Files
WS1 feature/UI files and WS2 plugin implementation except an explicitly recorded integration delegation; source artifact bytes. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
OperationJournal, ReleasePolicy, RegisterPort; owner WS3; version 1.0.0.

## Dependencies
CORE-06. Milestone M2. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Controlled service worker update, retention, schema migration/multi-tab leader; non-destructive repair; atomic blind close and immutable Z.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Installed old version + unacked operation survives update/reconnect; no activation mid-tender; close retry yields one Z; cash variance retained.

## Required Tests
`python3 scripts/verify_control_plane.py; pnpm --dir apps/pos-web lint; pnpm --dir apps/pos-web typecheck; pnpm --dir apps/pos-web test; pnpm --dir apps/pos-web test:e2e`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Never clear critical stores or call a UI demo toggle lifecycle proof.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# QA-01 — Run failure security and invariant qualification

## Objective
Run failure security and invariant qualification.

## Context
Own the shared application spine, data integrity, authorization, contracts, single-editor configuration and release integration. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS3 — Core / data / integration

## Owner
Senior / @wbdevworld; GitHub assignee only after identity verification.

## Branch
`ws3/qa-01-run-failure-security-and-invariant-qualificat`

## Allowed Files
tests/integration/**; tests/e2e/**; docs/integration/evidence/**

## Forbidden Files
WS1 feature/UI files and WS2 plugin implementation except an explicitly recorded integration delegation; source artifact bytes. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
All enabled production contracts; owner WS3; version 1.0.0.

## Dependencies
FE-06, FE-07, CORE-07, RT-01. Milestone M2. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Inject outages after each external effect; reconcile; test auth/RLS negative paths, concurrent operations and updated installed PWA.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
No duplicate order/tender/refund/restock; no lost journal; consistent shift/receipt; all release blockers resolved or affected capability explicitly excluded.

## Required Tests
`python3 scripts/verify_control_plane.py; pnpm --dir apps/pos-web lint; pnpm --dir apps/pos-web typecheck; pnpm --dir apps/pos-web test; pnpm --dir apps/pos-web test:e2e`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
Deadline never waives financial or data safety gates.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.


# REL-01 — Rehearse cutover and execute approved pilot

## Objective
Rehearse cutover and execute approved pilot.

## Context
Own the shared application spine, data integrity, authorization, contracts, single-editor configuration and release integration. Baseline: v1.0.0; prototype is reference only.

## Workstream
WS3 — Core / data / integration

## Owner
Senior / @wbdevworld; GitHub assignee only after identity verification.

## Branch
`ws3/rel-01-rehearse-cutover-and-execute-approved-pilot`

## Allowed Files
docs/runbooks/**; docs/integration/evidence/**; LIVE-ENVIRONMENT-FACTS.md; CURRENT-WORK.md

## Forbidden Files
WS1 feature/UI files and WS2 plugin implementation except an explicitly recorded integration delegation; source artifact bytes. Paths are app-relative when beginning src/ or public/. A task-specific allowed path overrides the workstream default only for this assignment; unrelated files remain forbidden.

## Contracts
Release/cutover gates; owner WS3; version 1.0.0.

## Dependencies
QA-01. Milestone M3. Only read/mock preparation may precede an unmet runtime gate.

## Implementation Steps
Verify backups/restore, live statutory process, devices, VitePOS queue and inventory; rehearse rollback; obtain human signoff; controlled one-register pilot.

## Expected Changes
Implement only the objective in allowed paths; update this workstream's STATUS/HANDOFF with evidence. Record contract/ADR/migration changes explicitly.

## Acceptance Criteria
Recorded signoff; no two active POS writers for pilot register; proven rollback preserving new sales; healthy shifts before permanent VitePOS removal.

## Required Tests
`python3 scripts/verify_control_plane.py; review QA-01 evidence plus live rehearsal/restore/signoff (no implied production command)`
Scaffold-dependent commands become required only after CP-05/BR-01 creates them. If a required command/runtime does not exist after its prerequisite, mark BLOCKED and repair the prerequisite, never invent PASS. CP-04/REL-01 require actual redacted environment/rehearsal evidence in addition to file checks.

## Risks
No production writes/deactivation authorized by task completion alone; human promotion required.

## Definition of Done
Acceptance evidence attached; exact commands/exit results and runtime checks recorded; no unexpected files; assigned reviewer approves; contracts/migrations documented; no unresolved safety blocker. Done = evidence.

## Handoff
Task, branch, commits, files, contracts, migrations, ADRs, tests, runtime evidence, assumptions, limitations, unresolved risks, reviewer and recommended next task per docs/ai/HANDOFF-TEMPLATE.md. Requested reviewer: senior/integration authority, or verified second human for senior-authored work.
