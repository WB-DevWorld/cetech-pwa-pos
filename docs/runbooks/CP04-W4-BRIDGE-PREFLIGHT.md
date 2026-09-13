# CP-04 W4 bridge preflight (R2)

Use with [CP-04 remaining work](CP-04-REMAINING-WORK.md) and [staging audit](CP-04-STAGING-AUDIT.md). This runbook does **not** authorize remote writes.

## Preconditions

- CP04-W1 mail/outbound containment **PASS** for this host (apply evidence `docs/integration/evidence/CP04-W1-CONTAINMENT-APPLY.md`). W4 still needs its own operator grant.
- CP04-W2 write boundary recorded.
- Explicit operator authorization for each of Actions A–G on `https://training.cetechbpa.com` — **granted 2026-09-13**; executed in `docs/integration/evidence/CP04-W4-BRIDGE-SERVICE-ACCESS.md`.
- Artifact SHA `280a73dbcd53ac0e03883775b4fabdec7465a4a8`.
- No `NEXT_PUBLIC_BRIDGE_*` secrets.

## Sequence

1. Recapture fingerprints: HPOS order count, webhook count, user count, plugin dir, health HEAD.
2. Action A–B: install/activate exact plugin; confirm `cetech-pos/v1` appears.
3. Action C–E: create `cetech-pos-bridge-svc` (or operator-approved name); Application Password; **deny** without capability (401/403).
4. Action F: grant only `cetech_pos_bridge_access`.
5. Action G: GET health with known UUID; echo check; `pricingParityVerified=false`; no secrets in body.
6. Compare fingerprints; record approved writes vs unexpected writes.
7. Retain or revoke the Application Password per operator instruction.

Stop if W1 is still UNSAFE or authorization is missing.
