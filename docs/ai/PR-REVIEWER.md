# PR review process

Architecture review: scope/ownership; canonical data owner; provider-neutral contracts; ADR changes; future replacement; shared-file serialization. Record PASS/WARNING/FAIL separately from implementation review.

Implementation review: behavior, input validation, server authorization/secrets, error/unknown-state handling, idempotency/concurrency, reconciliation, migration/RLS/rollback, PWA data retention, test and runtime evidence, unintended files/dependencies and documentation. Check exact diff against issue allowlist; verify fresh schema generation and immutable reference hashes.

Reject completion without acceptance evidence. Findings include severity, location, implication and proposed remedy. Audit-only request does not silently authorize fixes. Senior authored PR needs another human; no self-approved release. Human production signoff remains separate from passing PR CI.

## Milestone and freshness review

Review all included task scopes, source commits and the tested combination. Read the final two-pass evidence in HANDOFF-TEMPLATE; a second-pass cutoff is not perpetual currency. Inspect arrivals after the cutoff before merge. Assess architecture separately from correctness, and require another human for senior-authored work. Do not treat AI prose as verification. Split unreviewable scope; ten is a budget. See [policy](../plans/LONG-RUNNING-WORK.md).
