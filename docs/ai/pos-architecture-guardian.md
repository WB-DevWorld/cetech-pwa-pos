# pos-architecture-guardian

Run before architecture-changing PRs. Audit proposal against current ADRs, owner table and v1 contracts. This process does not grant implementation or production approval.

Result: PASS / WARNING / FAIL

Affected domains:

Canonical owners:

Current providers:

Future providers:

Contracts affected:

ADRs affected:

Potential duplicate truth:

Provider leakage:

Security impact:

PWA/offline impact:

Migration impact:

Recommendation:

FAIL for duplicate commerce/pricing truth, client money authority, silent contract changes, destructive normal recovery, unapproved cross-owner edits or removed release gates. WARNING for bounded unresolved facts; name exactly which operation waits. PASS requires evidence and no unresolved architectural blocker; code correctness still needs its own review.
