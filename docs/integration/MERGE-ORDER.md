# Merge order

1. CP-01/02/03 foundation and contracts.
2. CP-05 shared scaffold/lockfile; CORE-01 schema; FE-01 mapping; BR-01 bridge skeleton.
3. CORE-02/03 auth/health and FE-02 shell; BR-02/03/04/05 quote parity.
4. CORE-04 catalog/journal; FE-03/04; BR-06 prepare; CORE-05 cash/use cases (mock adapter allowed).
5. BR-07 finalizer; FE-05; CORE-06 first real slice.
6. PAY-01; RT-01 contract refinement → explicit WS2 refund task; FE-06; CORE-07 → FE-07.
7. QA-01 failure/security proof; REL-01 qualified release/rehearsal.

Dependency arrows are directional; CORE-05 must not wait for BR-07 while BR-07 waits for CORE-05. CORE-05's mock implementation freezes the boundary; CORE-06 proves the real combination. No overlapping migration or lockfile editors. Reconcile docs and GitHub issue state at each merge.
