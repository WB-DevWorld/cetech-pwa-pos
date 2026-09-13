# PR review process

Architecture review: scope/ownership; canonical data owner; provider-neutral contracts; ADR changes; future replacement; shared-file serialization. Record PASS/WARNING/FAIL separately from implementation review.

Implementation review: behavior, input validation, server authorization/secrets, error/unknown-state handling, idempotency/concurrency, reconciliation, migration/RLS/rollback, PWA data retention, test and runtime evidence, unintended files/dependencies and documentation. Check exact diff against issue allowlist; verify fresh schema generation and immutable reference hashes.

Reject completion without acceptance evidence. Findings include severity, location, implication and proposed remedy. Audit-only request does not silently authorize fixes. Senior authored PR needs another human; no self-approved release. Human production signoff remains separate from passing PR CI.

## Milestone and freshness review

Review all included task scopes, source commits and the tested combination. Read the final two-pass evidence in HANDOFF-TEMPLATE; a second-pass cutoff is not perpetual currency. Inspect arrivals after the cutoff before merge. Assess architecture separately from correctness, and require another human for senior-authored work. Do not treat AI prose as verification. Split unreviewable scope; ten is a budget. See [policy](../plans/LONG-RUNNING-WORK.md).

## Ownership review (ADR-014)

Verify each contribution's declared owner, implementing human/workstream, source branch/SHA, imported SHA, tested combined SHA and any explicit reassignment. Git committer alone is not proof. Findings identify the owning task/human: frontend to Ben, bridge to Emmanuel, core/server/local to WS3. Require contributor fix/test/source SHA and combined re-test after import. Do not let the integrator take over by default. Record final-head independent review coverage per contribution; a neutral PR author does not make self-review independent. R4/#41 remains the existing-branch exception; R5+ uses neutral batch/rN-* PRs.
