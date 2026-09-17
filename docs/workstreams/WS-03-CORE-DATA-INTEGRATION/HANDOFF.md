# WS3 current handoff — STG-02 session/CSRF/register composition

Kind: TASK_COMPLETION. Date: 2026-09-17.

Task / batch / workstream: STG-02 / #71 / STG-01 / WS3.
Owner / integration editor: `@wbdevworld` / WS3.
Requested human reviewers: independent human (not self-approve). Do not merge from this handoff.
Mode: IMPLEMENT.
Branch: `ws3/stg-02-session-runtime-composition`
Starting exact head: `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`
Start `origin/main`: `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`

Allowed paths: `apps/pos-web/src/app/**`, `apps/pos-web/src/core/identity/**`, `apps/pos-web/src/server/auth/**`, `apps/pos-web/src/config/**`, `tests/integration/auth/**`, `tests/e2e/**` / `apps/pos-web/e2e/**`, WS3 evidence/handoff.
Forbidden: WS1 feature/UI implementation (LoginScreen mounted, not edited), Woo bridge, catalog projection redesign (STG-04).

Contracts changed: none. Frozen Session/IdentityPort unchanged. BFF GET `/api/pos/v1/session` returns a composition DTO `{ session, assignedLocationIds, assignedRegisterIds }` around Session.
Database migrations: none.
Architecture decisions: none.

## Behavior

1. Browser restores staff session via GET `/api/pos/v1/session` (cookie). Missing/expired/revoked fail closed.
2. Sign-in uses the existing identity abstraction (transitional public Supabase Auth adapter) then POST `/api/pos/v1/session` with Bearer token. Server still sets HttpOnly session + readable CSRF cookies.
3. Mutations continue to send `cetech_pos_csrf` in `x-csrf-token`. CSRF is not optional. Origins are not wildcards.
4. Header cashier name, register name, and shift-open come from session + register + active-shift APIs. Hard-coded `Staff member` / `shiftOpen=true` are removed from `pos-app.tsx`.
5. Sign-out / lock uses DELETE session with CSRF and does not clear IndexedDB drafts/journal.
6. R8 Returns/Register composition remains mounted after a real session exists.

## Tests executed (local)

See `docs/integration/evidence/STG-02-SESSION-RUNTIME.md`. Control-plane PASS; lint PASS; typecheck PASS; unit 73/677 PASS; e2e 10 PASS; `git diff --check` PASS.

Remote effects performed: none (no staging deploy of this SHA, no Paystack, no Woo mutation, no production).

## Next exact action

Push this contributor SHA. STG-01 integration imports only after independent review. Continue authorized same-owner STG-05 only after a clean STG-02 handoff, on a separate WS2 branch. Do not implement Ben STG-03 / FE-07.

Pass 3: NOT PERMITTED.
Production promotion: NOT AUTHORIZED.
Merge of STG-01 / #70: NOT AUTHORIZED.
