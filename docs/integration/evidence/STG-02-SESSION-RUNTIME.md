# STG-02 staff session / CSRF / register composition

Observer: WS3 senior / @wbdevworld
Task: STG-02 / #71
Branch: `ws3/stg-02-session-runtime-composition`
Start SHA: `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`
UTC: `2026-09-17`

This is contributor-branch evidence. It is not staging/production acceptance and does not close #70, #25, or #54.

## Defect repaired

Mounted POS no longer hard-codes `cashierDisplayName="Staff member"` or `shiftOpen=true`. The browser restores or establishes the existing BFF staff session (`GET`/`POST` `/api/pos/v1/session`), then loads assigned register + active shift. Header and checkout eligibility use that server state. Unauthenticated/expired/revoked sessions fail closed to the approved LoginScreen while IndexedDB drafts/journal are not cleared.

CSRF is unchanged: readable `cetech_pos_csrf` is sent in `x-csrf-token`; HttpOnly `cetech_pos_sid` remains JS-unreadable; exact-origin checks are not weakened.

## Checks

| Command | Result |
| --- | --- |
| `python scripts/verify_control_plane.py` | PASS |
| `pnpm --dir apps/pos-web lint` | PASS |
| `pnpm --dir apps/pos-web typecheck` | PASS |
| `pnpm --dir apps/pos-web test` | PASS 73 files / 677 tests |
| `pnpm --dir apps/pos-web test:e2e` | PASS 10 tests |
| `git diff --check` | PASS |

Focused additions: `tests/integration/auth/staff-session-http.test.ts` GET recover/expiry; `tests/integration/auth/staff-runtime-composition.test.ts`; `apps/pos-web/e2e/staff-session.spec.ts`.

## Remaining blockers for STG-01

- Dedicated staging staff credentials and a protected Preview with this SHA are required before live session cookies can be proven on Vercel. This branch does not fake a staging session.
- Catalog still uses `ensureCashierLocalSeed()` (STG-04).
- WS1 Orders/Customers/Health/Attention/Settings remain R4 placeholders until Ben STG-03 / FE-07.
- No live electronic payment, refund/restock, or production mutation.

## Safety

No secrets committed. No CSRF bypass. No wildcard origins. No service-role in browser env.
