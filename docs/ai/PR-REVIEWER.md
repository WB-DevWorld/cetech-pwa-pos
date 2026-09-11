# PR review process

Architecture review: scope/ownership; canonical data owner; provider-neutral contracts; ADR changes; future replacement; shared-file serialization. Record PASS/WARNING/FAIL separately from implementation review.

Implementation review: behavior, input validation, server authorization/secrets, error/unknown-state handling, idempotency/concurrency, reconciliation, migration/RLS/rollback, PWA data retention, test and runtime evidence, unintended files/dependencies and documentation. Check exact diff against issue allowlist; verify fresh schema generation and immutable reference hashes.

Reject completion without acceptance evidence. Findings include severity, location, implication and proposed remedy. Audit-only request does not silently authorize fixes. Senior authored PR needs another human; no self-approved release. Human production signoff remains separate from passing PR CI.
