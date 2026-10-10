# AUTH-01 — disablement / session issuance race repair

Status: **SOURCE REPAIRED (local tests)** · migration **NOT REQUIRED** · production effects **NONE**  
Base: `452c446fd0e3821fc3bfdb5de85a01d19a331809` · branch `ws3/combined-candidate-2026-10-08`  
Owner: `@wbdevworld` / WS3  
Staff-documentation impact: **NONE** (disablement UX copy unchanged; server closes the race)

Review evidence: `%LOCALAPPDATA%\CETECH-POS-R10\review-evidence-2026-10-09\` (`security-auth-repro.mjs`, `CETECH-POS-Security-and-Transaction-Review-2026-10-09.md`).

## Invariant now held

A staff actor that is durably **disabled** must not receive a usable BFF session or command authorization, including when disablement commits between the pre-insert access read and session INSERT, and including a durable disabled actor whose session revoke row was missed.

## Before (review / base SHA)

Exact-source portable repro at base `452c446…` (synthetic PostgREST + identity; no live request):

| Case | Result |
| --- | --- |
| Disable before access read | `FORBIDDEN`; no session |
| Disable after completed INSERT | `AUTH_REQUIRED` (session revoked) |
| **Disable between access read and INSERT** | **Session created; command guard ACCEPTED; payment.cash ACCEPTED; `revoked_at=null`** |
| Wrong org / location / register | `FORBIDDEN` |
| Missing CSRF / bad origin / anonymous | Denied |

```text
# From review-evidence folder (imports exact unmodified candidate source)
node --experimental-strip-types security-auth-repro.mjs
# Exit 0 — race case commandGuard=ACCEPTED (defect demonstrated, not repaired)
```

## After (this repair)

| Case | Result |
| --- | --- |
| Disable before access read | `FORBIDDEN`; no session |
| Disable after completed INSERT | `AUTH_REQUIRED` (revoked row) |
| Access ACTIVE → disable/revoke → INSERT | Issuance `FORBIDDEN`; inserted row revoked; guard denied |
| Disable between INSERT and post-insert recheck | Issuance `FORBIDDEN`; row revoked |
| Missed revoke (status disabled, session still present) | Guard `FORBIDDEN` + revoke-on-disabled |
| Access-control unavailable | `INTEGRATION_UNAVAILABLE` (never treated as active) |
| Scope / CSRF / origin / anonymous | Still denied |
| Forced password change | Still blocks before command grant |

### Repair surface (leased paths only)

1. **Post-insert recheck + revoke-on-disabled** — `apps/pos-web/src/server/auth/staff-session.ts`  
   After `store.create`, re-evaluate durable access; on disabled/unavailable revoke the new session and deny issuance.
2. **Validated-session path** — `apps/pos-web/src/server/sales/guard-staff-command.ts`  
   Rechecks durable access (explicit `accessControl` or `tryComposeStaffAccessControl()`); fail-closed; revoke-on-disabled for missed revoke rows.
3. **Shared evaluator** — `staff-access-control.ts` `evaluateStaffAccess` (unavailable ≠ active).
4. **Composition helper** — `compose-staff-access-control.ts` `tryComposeStaffAccessControl` (composition failure → null → deny).
5. **Optional authorize gate** — `authorize.ts` accepts `accessControl` and denies disabled actors when provided.

**Migration:** **no** (BFF boundary sufficient; no session-insert DDL).

**Not touched:** `confirm-cash.ts`, `finalize-sale.ts`, `supabase-checkout-store.ts`, `payments/*`, Woo/bridge, RD-01, cash/payment/receipt tables.

## Proof commands

```text
cd apps/pos-web

# AUTH-01 orchestration + negative controls (both commit orders)
pnpm exec vitest run src/server/auth/staff-session.disablement-race.test.ts src/server/auth/staff-access-control.test.ts
```

Observed: **14/14 passed** (10 race/orchestration + 4 access-gate including post-insert revoke).

```text
# Broader auth package regression
pnpm exec vitest run src/server/auth/
```

Observed: **45 passed** across auth test files (includes authorize, handle-staff-session, policy, disablement race).

```text
# Guard-path surfaces that must keep working (no-shift receipt / close presentation)
pnpm exec vitest run src/server/sales/handle-register-close-presentation.test.ts src/server/sales/handle-resolve-sale-r9.test.ts
```

Observed: passed (guard default compose remains active for local memory when durable access control is not configured).

## Files changed

| Path | Change |
| --- | --- |
| `apps/pos-web/src/server/auth/staff-session.ts` | Post-insert access recheck + revoke-on-disabled |
| `apps/pos-web/src/server/auth/staff-access-control.ts` | `evaluateStaffAccess` |
| `apps/pos-web/src/server/auth/compose-staff-access-control.ts` | `tryComposeStaffAccessControl` |
| `apps/pos-web/src/server/sales/guard-staff-command.ts` | Validated-session access recheck |
| `apps/pos-web/src/server/auth/authorize.ts` | Optional `accessControl` gate |
| `apps/pos-web/src/server/auth/staff-session.disablement-race.test.ts` | Deterministic orchestration + negatives |
| `apps/pos-web/src/server/auth/staff-access-control.test.ts` | Post-insert revoke unit |
| `docs/testing/parallel-completion-2026-10-07/scope-auth-01-disablement.json` | Scope lease |
| `docs/testing/parallel-completion-2026-10-07/AUTH-01-DISABLEMENT-REPAIR.md` | This evidence |

`supabase-session-store.ts`: **unchanged** (no create-path serialization required once post-insert + guard recheck compose).

## Remaining (out of AUTH-01)

- Two-connection live PostgreSQL concurrency is optional hardening; BFF orchestration covers both commit orders with synthetic durable store.
- DB-SEC-03 (direct RLS ignoring disablement) is a separate disposable-DB candidate — not closed by this BFF fix.
- AUTH-02 customer-read policy remains a separate explicit decision.
- Hosted Preview redeploy / production promotion are separate release actions.
