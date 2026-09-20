# WS3 current handoff — R9 / PR #63 Ben review-fix: SHA minimum-version deadlock

Kind: PROGRESS_CHECKPOINT. Date: 2026-09-20.

Task / batch / workstream: R9 review-fix / WS3.
Owner / integration editor: `@wbdevworld` / WS3.
Requested human reviewer: `@Ben-001-sys` re-review of the replacement exact head. Emmanuel / `@Emmanuel-coder-prog`: UNAVAILABLE / NOT REQUESTED.
Mode: IMPLEMENT (review-fix).
Branch: `batch/r9-pwa-recovery-operational-close` / PR #63 (DRAFT).
Previous reviewed head: `51c2c9bf0148d04113090565585fad3a4c7c2371` (CHANGES_REQUESTED).
Final task head SHA: record from `git rev-parse HEAD` after this evidence commit; do not embed it here.

Allowed: existing R9 PWA/update safety comparison semantics and tests; CURRENT-WORK/STATUS/HANDOFF; PR #63 description.
Forbidden: #82–#88; R9 redesign; installed-device evidence; frozen-contract churn; production; Emmanuel request; self-merge.

Contracts changed: none. Database migrations: none. Architecture decisions: none.

## Blocker and remediation

Ben HIGH: default SHA `BUILD_ID` deployments set `latestBuild = recommendedBuild = minimumSupportedBuild = B_SHA`. `compareBuildIds()` treated opaque inequality as older, so `UNSUPPORTED_APP_VERSION` deadlocked `activateWaitingUpdate()`.

Remediation: keep advertised-build discovery (`shouldDiscoverAdvertisedWorker` / `compareBuildIds`) so A SHA can discover B SHA. Minimum enforcement uses `isBelowMinimumSupportedBuild`, which requires genuinely orderable numeric/dotted versions. 40-character Git SHAs are opaque identities, not version numbers. Frozen `ReleasePolicy` shape unchanged.

## Local qualification (before this evidence commit)

- focused release-policy / PWA lifecycle / mounted / R9 suites: PASS
- `python scripts/verify_control_plane.py`: PASS
- tooling: 72 PASS
- lint / typecheck: PASS
- Vitest: 130 files / 985 tests PASS
- production build: PASS
- Playwright E2E: 15 passed
- `git diff --check`: PASS
- `supabase.exe` reset + pgTAP: 10 files / 224 PASS

Installed-device A→B evidence: NOT STARTED.
#82–#88: NOT STARTED.
Production authorized: NO.
Next exact action: push, require fresh Linux/Windows CI, keep DRAFT, request Ben re-review. Do not start device evidence until Ben confirms the source fix.

Pass 3: NOT PERMITTED for this assignment.

---

# WS3 previous handoff — R9 / PR #63 reconcile onto accepted main + R10 closeout

Kind: PROGRESS_CHECKPOINT. Date: 2026-09-20.

Task / batch / workstream: R9 PWA recovery, operational close, update safety / WS3.
Owner / integration editor: `@wbdevworld` / WS3.
Requested human reviewer: `@Ben-001-sys` for later exact-head source review after freeze. Emmanuel / `@Emmanuel-coder-prog`: UNAVAILABLE / NOT REQUESTED.
Mode: RECONCILE / RUNTIME QUALIFICATION.
Branch: `batch/r9-pwa-recovery-operational-close` / PR #63 (DRAFT).
Previous R9 head: `5592c29ca5a74ca59d7684ccf1a376ae10b37a13`
Protected main: `c49045dd02c46574af5d341cc65c177116fa7306`
R10 closeout consumed: `cf78330f2c5f1b9b8d231aad5b7bdc9a24e2d731`
Reconciliation merge: `f2a3930fa2e219d34612a84031c3bb4fbfa9b3a7` (parents `5592c29...` + `cf78330...`; non-force two-parent merge)
New merge-base: `c49045dd02c46574af5d341cc65c177116fa7306`
Ahead / behind vs origin/main after merge: 60 / 0, then one authority commit.
Final task head SHA: record from `git rev-parse HEAD` after this evidence commit; do not embed it here.

Allowed: existing R9 runtime; semantic reconciliation with accepted main; R9 migrations/tests; PWA/update/recovery/device evidence; operational-close/Z; WS3 CURRENT-WORK/STATUS/HANDOFF/evidence; PR #63 description.
Forbidden: #82–#88 implementation; REC-01 redesign; R10 implementation expansion; Woo pricing authority; live electronic payment; real refund/restock; production promotion; VitePOS cutover; self-merge; requesting Emmanuel.

Contracts changed: none in this pass (combined CheckoutStore keeps REC-01 prepare-intent plus R9 close/Z). Database migrations: inherited R9 search-path hardening `20260919173000_pos_operational_close_search_path.sql` plus accepted REC-01 receipt/prepare-intent migrations. Architecture decisions: none.

## Reconciliation

- Did not merge `ws3/r10-prep-close` to protected main.
- Consumed closeout `cf78330...` as the current-truth parent so ancestry contains current main, closeout, and existing R9 history.
- Four REC-01 overlap files keep both durable `PrepareIntentSnapshot` / first-write-wins intent immutability AND R9 `saveShiftReport` / `getShiftReport` / `pos_shift_reports` / Z.
- Zero original runtime overlap with R10 Prep #79 and exact-SHA Preview #81 (those trees are inherited).
- Accepted System status cashier wording is preserved; obsolete `features/health/**` was not resurrected. Health fallback copy now says System status.

## Local qualification (this checkout, before the evidence commit)

- `python scripts/verify_control_plane.py`: PASS
- `python -m unittest discover -s tests/tooling -v`: 72 PASS
- focused R9 PWA/tender/recovery/close + overlap: 13 files / 65 tests PASS
- `pnpm --dir apps/pos-web lint`: PASS
- `pnpm --dir apps/pos-web typecheck`: PASS
- `pnpm --dir apps/pos-web test`: 130 files / 980 tests PASS (untracked #82 file remains in `doc/` and was not committed)
- `pnpm --dir apps/pos-web build`: PASS
- `pnpm --dir apps/pos-web test:e2e`: 15 passed
- `git diff --check`: PASS after restoring Vitest/E2E fixture mutations
- Windows `npx supabase@2.117.0 db reset --yes --local`: BLOCKED (cmd.exe heredoc)
- Direct `supabase.exe db reset --yes --local` then `supabase.exe test db`: PASS — 10 files / 224 tests, including `operational_close.sql` and `prepare_intent_snapshot.sql`. Migrations applied through `20260919173000_pos_operational_close_search_path.sql`. Linux CI remains the canonical npx reset+pgTAP authority.

## Remaining genuine R9 evidence (not claimed PASS)

- Installed-client A→B: PENDING
- Reconnect with durable work: PENDING
- Real multi-tab tender safety: PENDING
- Operational-close/Z runtime on authorized staging register: PENDING / BLOCKED until separately authorized
- Device evidence was not started; candidate is not frozen until exact-head Linux/Windows CI is green on the pushed SHA.

Production authorized: NO
#82–#88 implementation: NOT STARTED
PR #63: remains DRAFT
Next exact action: push this head, require fresh Linux `control-plane` and Windows `control-plane-windows` SUCCESS, replace the stale PR #63 body, keep DRAFT, do not request Emmanuel, do not start device evidence until frozen.

Freshness protocol:
START_FRESHNESS_SNAPSHOT UTC: 2026-09-20T13:22:00Z
Start main SHA: `c49045dd02c46574af5d341cc65c177116fa7306`
Start batch ref/SHA: `origin/batch/r9-pwa-recovery-operational-close` = `5592c29ca5a74ca59d7684ccf1a376ae10b37a13`
Applicable contracts / ADRs / ownership / queue revision: CURRENT-WORK R9 lease; ADR-012/014; OWNERSHIP unchanged.

Pass 1 fetch UTC / success evidence: recorded at assignment start against the verified SHAs above
Pass 1 main SHA: `c49045dd02c46574af5d341cc65c177116fa7306`
Pass 1 batch SHA: `5592c29ca5a74ca59d7684ccf1a376ae10b37a13`
Relevant upstream: unmerged R10 closeout `cf78330...` consumed as parent; accepted REC-01/R10/CD-01 inherited
Classification: COMPATIBLE inherit via two-parent merge; STALE_REQUIRES_FIX for CURRENT-WORK authority and four overlap files
Actions taken: merge `f2a3930...`; combined store contract; surgical CURRENT-WORK/STATUS; System status fallback copy
Tests rerun: listed above

Pass 2 fetch UTC / success evidence: recorded in the PR body after the independent post-commit fetch
Pass 2 main SHA: record after post-commit fetch
Final freshness status: pending Pass 2 observation
Delivery status: READY_FOR_INTEGRATION only after Pass 2 confirms main unchanged and exact-head CI is green; R9 milestone remains blocked on genuine device evidence
Pass 3: NOT PERMITTED for this assignment.
Review/merge/release status: keep DRAFT; no self-merge; production NO; Ben source review only after freeze; no Emmanuel request.

---

# WS3 previous handoff — R10 Prep PR #79 merged / preparation complete

Kind: TASK_COMPLETION. Date: 2026-09-20.

Task / batch / workstream: R10 Prep finish / WS3.
Owner / integration editor: `@wbdevworld` / WS3.
Requested human reviewer: `@Ben-001-sys` approved exact head `bb35b879...`. Emmanuel / `@Emmanuel-coder-prog`: UNAVAILABLE / NOT REQUESTED.
Mode: CLOSEOUT.
PR #79 merged: YES (squash)
Source SHA: `bb35b8790e1370bc1b0aed6f39fc73c92549019a`
New canonical main: `c49045dd02c46574af5d341cc65c177116fa7306`
Merge timestamp: 2026-09-20T13:11:06Z
Main CI: `35512758174` SUCCESS — Linux `control-plane` and Windows `control-plane-windows`
Staging CD: `35512916881` SUCCESS — `https://cetech-pos-staging-fgzk1bb00-wbdevworlds-projects.vercel.app`
R10 Prep result: MERGED / PREPARATION COMPLETE
QA-01 #29: OPEN
REL-01 #30: OPEN
Production authorized: NO
Next active task: PR #63 R9 reconciliation
This closeout does not edit PR #63.

Contracts changed: none. Database migrations: none. Architecture decisions: none.
Pass 3: NOT PERMITTED for this assignment.

---

# WS3 previous handoff — R10 Prep reconcile onto accepted REC-01 main

Kind: TASK_COMPLETION / SESSION_HANDOFF. Date: 2026-09-20.

Task / batch / workstream: R10 Prep / QA-01 / REL-01 qualification framework reconcile / WS3.
Owner / integration editor: `@wbdevworld` / WS3.
Requested human reviewer: `@Ben-001-sys` only. Emmanuel / `@Emmanuel-coder-prog`: UNAVAILABLE / NOT REQUESTED.
Mode: RECONCILE / QUALIFICATION PREPARATION.
Branch: `ws3/r10-qa-release-preparation` / PR #79.
Previous #79 head: `1399a8fac4c7b4b77fe436ccda1c88893a072101`
Start `origin/main`: `7c5d6ca0cd93d7aeb5a7a1c97153ca187548c3fb`
Reconciliation merge: `5e41031cf90794e55bda9ca82ab11eaccab1a084` (parents `1399a8fac...` + `7c5d6ca0...`; non-force two-parent merge)
Old merge-base: `c320be8c5ad41c190200381cd52f853dd95212dc`
New merge-base: `7c5d6ca0cd93d7aeb5a7a1c97153ca187548c3fb`
Overlap with merged #80 / #81: ZERO
Final task head SHA: record from `git rev-parse HEAD` after this evidence commit; do not embed it here.

Allowed: existing R10 Prep 14-file scope; CURRENT-WORK.md; WS3 STATUS/HANDOFF for exact reconciliation evidence; PR #79 description.
Forbidden: R9 implementation; #82–#88 implementation; REC-01 source changes; Woo commercial behavior; electronic payment execution; refund/restock execution; production promotion; VitePOS cutover; protected-main direct edits; self-merge; requesting Emmanuel.

Contracts changed: none. Database migrations: none. Architecture decisions: none.

## Local qualification (this checkout, before the evidence commit)

- `python scripts/verify_control_plane.py`: PASS
- `python -m unittest discover -s tests/tooling -v`: 72 PASS
- five R10 fail-closed files: 5 files / 13 tests PASS
- `pnpm --dir apps/pos-web lint`: PASS
- `pnpm --dir apps/pos-web typecheck`: PASS
- `pnpm --dir apps/pos-web test`: 119 files / 941 tests PASS (untracked #82 regression file was moved to `doc/` and not committed)
- `pnpm --dir apps/pos-web build`: PASS
- `pnpm --dir apps/pos-web test:e2e`: 15 passed
- `git diff --check`: PASS
- Windows `npx supabase@2.117.0 db reset --yes --local`: BLOCKED (cmd.exe heredoc). Linux CI remains reset+pgTAP authority.

Do not merge #79. Do not close QA-01 / #29 or REL-01 / #30. Production remains unauthorized. Next exact action: Ben independent exact-head review. After #79: PR #63 R9 reconciliation. Do not begin R9 in this assignment.

Freshness protocol:
START_FRESHNESS_SNAPSHOT UTC: 2026-09-20T12:40:00Z (assignment start; fetch completed 2026-09-20T12:42Z)
Start main SHA: `7c5d6ca0cd93d7aeb5a7a1c97153ca187548c3fb`
Start batch ref/SHA: `origin/ws3/r10-qa-release-preparation` = `1399a8fac4c7b4b77fe436ccda1c88893a072101`
Applicable contracts / ADRs / ownership / queue revision: CURRENT-WORK R10 Prep lease; ADR-012/014; OWNERSHIP unchanged.

Pass 1 fetch UTC / success evidence: 2026-09-20T12:42Z `git fetch origin --prune` succeeded
Pass 1 main SHA: `7c5d6ca0cd93d7aeb5a7a1c97153ca187548c3fb`
Pass 1 batch SHA: `1399a8fac4c7b4b77fe436ccda1c88893a072101`
Relevant upstream: merged #81 CD-01 + merged #80 REC-01; zero changed-file overlap with #79
Classification: COMPATIBLE inherit via two-parent merge; STALE_REQUIRES_FIX for R10 qualification truth and CURRENT-WORK current-authority
Actions taken: merge `5e41031...`; surgical CURRENT-WORK/STATUS; R10 docs refresh for accepted REC-01 evidence and #82–#88 GO/NO-GO truth
Tests rerun: listed above

Pass 2 fetch UTC / success evidence: recorded in the PR body after the independent post-commit fetch
Pass 2 main SHA: record after post-commit fetch
Final freshness status: pending Pass 2 observation
Delivery status: READY_FOR_INTEGRATION only after Pass 2 confirms main unchanged and exact-head CI is green
Pass 3: NOT PERMITTED for this assignment.
Review/merge/release status: independent Ben review required; no self-merge; production NO.

---

# WS3 previous handoff — STG-06 quote identity + register authority

Kind: TASK_COMPLETION. Date: 2026-09-18.

Task / batch / workstream: STG-06 live quote identity + register authority / WS3.
Owner / integration editor: `@wbdevworld` / WS3.
Requested human reviewer: independent senior review; no self-approve.
Mode: REMEDIATE.
Branch: `ws3/stg-06-quote-identity-register-authority`
Starting exact head: `a02cd21875d0717adb6694d293b41575302b2415`
Implementation SHA (pre-evidence): `5119054a2059ff5903a50d8b96644b63c38fdd48`
Start `origin/main`: `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`
Freshness cutoff `origin/main`: `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` at `2026-09-18T12:25:31Z`
Freshness cutoff batch: `origin/batch/stg-01-staging-runtime-acceptance` = `a02cd21875d0717adb6694d293b41575302b2415`
Originally declared implementation batch: `4e47a1f793bb8b75f6cf4fa03ee8f66675b4a897` (COMPATIBLE; already ancestor)
Evidence: `docs/integration/evidence/STG-06-QUOTE-IDENTITY-REGISTER-AUTHORITY.md`
Freshness: FRESH_2. Delivery: READY_FOR_INTEGRATION. Pass 3 not permitted.

Allowed: `apps/pos-web/src/server/**`, `apps/pos-web/src/core/**`, `apps/pos-web/src/app/**`, `apps/pos-web/src/local/**`, CURRENT-WORK, WS3 STATUS/HANDOFF, this evidence.
Forbidden: `main`, R9, WS1 feature/ui redesign, WS2 plugin, auth/CSRF/RLS weakening, CatalogItem.id = Woo ID, sourceItemId in Sell UI contracts, B2BKing/WoodMart pricing in BFF/frontend, new catalog migration.

Contracts changed: none. Database migrations: none. Architecture decisions: none. Existing `public.pos_catalog_items` is sufficient.

Do not merge. Do not modify `main`. Do not import/start R9. Live Preview still needs this contributor SHA imported and redeployed before quote/register defects can close. `pricingParityVerified=false`. CP-04 / #4 remain open. Next exact action: independent review, then integrate into `batch/stg-01-staging-runtime-acceptance` and re-run STG-06 against the new Preview. The final task head is the evidence commit after `5119054`; record it from `git rev-parse HEAD` after that commit, not inside it.

---

# WS3 previous handoff — STG-02 route session persistence

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

Do not merge. Do not modify `main`. Do not import/start R9. Current verified training/bridge truth: STG-05 plugin is deployed on `https://training.cetechbpa.com`; authenticated health/catalog/quote PASS as recorded in the evidence file. Do not treat `BLOCKED_TRAINING_PLUGIN_NOT_DEPLOYED_STG05` as current. Live Preview catalog is blocked by BFF→WordPress `bridge denied the BFF service identity`. Cash-sale acceptance, `pricingParityVerified=false`, and CP-04 / #4 remain open. Next exact action: integrate this contributor SHA into `batch/stg-01-staging-runtime-acceptance` after independent review, then re-run STG-06 against the new Preview.

---

# WS3 previous handoff — STG-01 integration composition

Kind: PROGRESS_CHECKPOINT. Date: 2026-09-17. Historical snapshot; the `BLOCKED_TRAINING_PLUGIN_NOT_DEPLOYED_STG05` line below is superseded by the 2026-09-18 current handoff above.



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
