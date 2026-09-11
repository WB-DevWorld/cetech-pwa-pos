# Integration plan

1. WS3 freezes authority/contracts/scaffold. WS1 reference mapping and WS2 live read-only audit may proceed while central files are serialized.
2. CORE-01/02 and BR-01 merge independent foundations; CORE-03 wires health. WS1 shell mounts through WS3 app composition.
3. BR-02–05 prove real pricing and freeze golden corpus. FE-04 uses matching errors/state; no guessed fallback.
4. CORE-04 local catalog/journal plus BR-06 prepare; CORE-05 cash/finalizer skeleton consumes mocks until BR-07 real adapter.
5. CORE-06 integrates staff→register→scan→customer→quote→prepare→cash→stock→receipt. Reconcile every failure boundary.
6. PAY-01 → RT-01 contract refinement and scoped WS2 implementation → shift close/PWA → QA-01 → rehearsal.

Each integration PR names producer/consumer versions, database migration order, flags and rollback. Rebase/update small branches after shared changes; never resolve schema conflicts by selecting whichever AI output compiled. Senior reviews staging evidence after each merge; main stays releasable for its actual implemented scope.
