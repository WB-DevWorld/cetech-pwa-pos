# WS3 current handoff — STG-02 route session persistence

Kind: TASK_COMPLETION. Date: 2026-09-18.

Task / batch / workstream: STG-02 route persistence / STG-06 live navigation blocker / WS3.
Owner / integration editor: `@wbdevworld` / WS3.
Requested human reviewer: independent senior review; no self-approve.
Mode: REMEDIATE.
Branch: `ws3/stg-02-route-session-persistence`
Starting exact head: `4e47a1f793bb8b75f6cf4fa03ee8f66675b4a897`
Start `origin/main`: `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`
Start batch ref: `origin/batch/stg-01-staging-runtime-acceptance` = `4e47a1f793bb8b75f6cf4fa03ee8f66675b4a897`
Evidence: `docs/integration/evidence/STG-02-ROUTE-SESSION-PERSISTENCE.md`

Allowed: `apps/pos-web/src/app/**`, `apps/pos-web/e2e/**`, `tests/frontend/**`, CURRENT-WORK, WS3 STATUS/HANDOFF, this evidence. Forbidden: `main`, R9, WS1 Sell redesign, WS2 plugin, auth/CSRF/RLS weakening.

Contracts changed: none. Database migrations: none. Architecture decisions: none.

Do not merge. Do not modify `main`. Do not import/start R9. Next exact action: integrate this contributor SHA into `batch/stg-01-staging-runtime-acceptance` after independent review, then re-run STG-06 against the new Preview.

---

# WS3 previous handoff — STG-01 integration composition

Kind: PROGRESS_CHECKPOINT. Date: 2026-09-17.


Task / batch / workstream: STG-01 / #70 / WS3.
Owner / integration editor: `@wbdevworld` / WS3.
Requested human reviewer: independent senior review; no self-approve.
Mode: INTEGRATE.
Branch: `batch/stg-01-staging-runtime-acceptance`
Starting exact head: `acd4a2f009c58f734186cf9e44f278da93499a4b`
Start `origin/main`: `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`
STG-02 source/imported: `8a6aba2ce82ebe265a154f89999c2caab7a08beb` / `9bfb535ca86f7bd27108b3a82c6876e4b5f19c81`
STG-05 source/imported: `4d549167f7d6dcecf0eff24f35e1f24a3429d3d8` / `7cab23415d622cef7369ddc03e007e6576cc4ce7`
STG-04 source/imported: `01e4438d3553c633e7b0234de44743ff4cea2368` / `981722e7c8ff6ea7163532f03218f59ea2b9e20d`
Ben source/imported: `169f8155fe4cb34b6fe27db3bb6b445a13ade712` / `8073ef59dbf481160387000886b0b7da4a25d237`
STG-07 SHA: `4a978b9a67291c34c34f6cb75fddf31d14a7cbdd`
Composition SHA: `6df4e1edc503aa2ab0fe37f2f26a9177e6726177`

This file is the integration snapshot. It does not erase STG-02 or STG-04 contributor evidence files.

## Combined semantics

- Staff: restore/establish BFF session; CSRF cookie + `x-csrf-token`; cashier/register/shift from server; fail closed when unsigned/expired.
- Catalog: staging `provider_required` never seeds `CASHIER_SEED_CATALOG`; BFF `/api/pos/v1/catalog/sync`; local search/scan; stale/unavailable without clearing carts/journal. Localhost/test remain `synthetic_permitted`.
- Workspaces: WS3 mounts Ben Orders/Customers/Settings/Health/Attention. Orders is truthful empty (no frozen list port). Health uses `/api/pos/v1/health`. Attention actions only for catalog-projection retry; no last-resort IndexedDB wipe.
- Bridge: imported STG-05 producer; training deploy still pending.

Contracts changed: none. Database migrations: none. Architecture decisions: none.

Local combined tests: control-plane PASS; pos-web lint/typecheck/735 unit/build/11 e2e PASS; host PHP bridge 1614 passed; parity 138 passed / 19 skipped; Docker PHP `-l` PASS; `git diff --check` clean. Windows `npx supabase db reset --yes --local` BLOCKED (cmd.exe heredoc). GNU Make `command -v` not used; Docker PHP lint + host PHP runners substituted.

`BLOCKED_TRAINING_PLUGIN_NOT_DEPLOYED_STG05`. Do not claim live catalog/quote/cash or final STG-01 PASS.

Do not merge to main. Do not close #70/#25/#54. Do not merge R9 #63. Independent human review required.
Next exact action: STG-06 / #75 functional staging against the immutable Vercel deployment of this combined SHA after CI is green.

## Previous contributor handoff — STG-02 session/CSRF/register composition

Kind: TASK_COMPLETION. Date: 2026-09-17.
Branch: `ws3/stg-02-session-runtime-composition`
Source SHA: `8a6aba2ce82ebe265a154f89999c2caab7a08beb`
Evidence: `docs/integration/evidence/STG-02-SESSION-RUNTIME.md`

## Previous contributor handoff — STG-04 training catalog projection

Kind: TASK_COMPLETION. Date: 2026-09-17.
Branch: `ws3/stg-04-training-catalog-projection`
Source SHA: `01e4438d3553c633e7b0234de44743ff4cea2368`
Evidence: `docs/integration/evidence/STG-04-TRAINING-CATALOG.md`
STG-04 `CURRENT-WORK.md` was not imported.
