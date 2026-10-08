# Candidate deployment manifest — combined final (#144) + Lane D baseline

Status: **CANDIDATE ONLY — DO NOT PROMOTE PRODUCTION — DO NOT CHANGE TESTER ALIAS**

Lane D prepared the `#140` application pin on 2026-10-07 after local automated + desktop-browser verification. This file is reconciled for the **combined final candidate** PR [#144](https://github.com/WB-DevWorld/cetech-pwa-pos/pull/144) on 2026-10-08 (root verify `2026-10-08T15:02Z`). It is not a GO, not staging acceptance, and not production approval.

## Exact artifact

| Field | Value |
| --- | --- |
| Candidate tip (CI-verified) | `ab5c7e1f3849ff65100a84058e92f8b281a14be2` |
| R144 product repair | `27e95b3565dbdf3c5487257a08042e09a51620a4` + final correction in `ab5c7e1` |
| Prior tip | `5ea92dc1258006186ba696e9d4f91f769d97aa11` (`dpl_fQq…` superseded) |
| Prior REQUEST CHANGES tip | `7d75c3944d41a5990aa64004c9e96954779c9730` |
| Application baseline SHA (`#140`) | `0e383d84f11573ca89d6533c8cb7c35d79d7b261` |
| Race-fix **product** SHA | `daac7e035d992c2798a317a0cf371f2925a9fe35` |
| Privilege repair (`#143`) | `c512b106bce1a0efcfd9c2caeddd54ad9e43dccd` (blob `6936b0e…`; hosted DDL still unauthorized) |
| Short app baseline | `0e383d8` |
| Branch | `ws3/combined-candidate-2026-10-08` |
| Application package | `apps/pos-web` |
| Intended `BUILD_ID` for Preview | tip under test (`ab5c7e1…`); Lane D local proof remains on `0e383d84…` |
| Includes | `#140` / `#139` `3c2a5a6af4ab202988e46bb3af6d3ae365147be8` + `#143` + race product `daac7e0` + R144 `ab5c7e1` |
| Excludes | `#141` diagnostic `4b1febb725c843cf0bf48f86dd9836d4a87b5bbe` |
| Rollback / previous known-good application pin | application baseline `0e383d84…`; shared tester remains `816e0bb…` |
| Protected main (context only) | `c49045dd02c46574af5d341cc65c177116fa7306` |
| Shared tester baseline (must remain unchanged) | `816e0bb6963aff760609a3c7e4817e603c4ffdf0` |
| Shared tester deployment | `dpl_nxWGrSLqaLBGNNN683QjdixNBjF6` **READY** (root-verified `2026-10-08T15:02Z`) |
| Reviewed candidate Preview | `dpl_CBSAUNVvXLmuXetnwC3z8DLeAdm2` **READY** — tip `ab5c7e1…` |

**Deploy wording:** candidate has an **automatic unpromoted Preview** (`dpl_CBSA…` READY for tip `ab5c7e1`). That is **not** shared-tester alias promotion and **not** production. Woo bridge remains uninstalled on training; runtime qualification incomplete. Do not blanket-claim “NOT DEPLOYED.”

**Product vs documentation tip:** candidate tip `ab5c7e1` is the product + docs head. Prior `5ea92dc`/`dpl_fQq` must not be qualified by inheritance.

## Local build proof (Lane D on app baseline)

```text
BUILD_ID=0e383d84f11573ca89d6533c8cb7c35d79d7b261
pnpm --dir apps/pos-web build
→ EXIT 0

Runtime observation (local Next start :3014):
  SW controller = /sw.js?build=0e383d84f11573ca89d6533c8cb7c35d79d7b261
  release-policy latest/recommended/minimumSupportedBuild = same SHA
```

Evidence: `LANE-D-RESULT.md`, `browser-desktop-evidence.json`. Combined tip has not claimed a new Lane D desktop re-run in this reconcile.

## Authorized deployment shape (when integration editor dispatches)

Follow `docs/runbooks/CD-01-STAGING-DEPLOYMENT.md` Exact SHA Preview path for **new** dispatches. Current Preview `dpl_CBSA…` already exists as automatic unpromoted Preview for tip `ab5c7e1…` (prior `dpl_fQq…`/`5ea92dc…` superseded).

1. Require open PR whose head equals the authorized candidate SHA.
2. Require CI jobs `control-plane` and `control-plane-windows` SUCCESS for that SHA.
3. Require one independent exact-head APPROVED review (not the PR author).
4. Dispatch Exact SHA Preview from `main` with `candidate_sha=<authorized SHA>` only when a **new** Preview is needed.
5. Supply matching `BUILD_ID` to the build/deploy request.
6. Record immutable Preview URL only.
7. Prove Preview target + Git source SHA; leave running-app `BUILD_ID` pending until observed.
8. **Do not** pass `--prod`, **do not** assign production aliases, **do not** move `VERCEL_STAGING_ALIAS` / tester alias (RD-03 release-switch).

Example (operator; not executed by Lane D / qualification prep):

```text
gh workflow run "Exact SHA Preview" --ref main \
  -f candidate_sha=<authorized SHA> \
  -f pr_number=144
```

## Compatibility / rollback notes for this candidate

- Local schema / journal / drafts: additive upgrade path covered by `tests/integration/sync/pwa-upgrade.test.ts` (catalog rebuild must not erase drafts/journal).
- Service worker: install never `skipWaiting`; activation only via `CORE07_ACTIVATE_WAITING_UPDATE` after update-safety checks.
- Opaque SHA inequality must not dead-lock as `UNSUPPORTED_APP_VERSION` (covered by unit tests).
- Application rollback reverts code/build only; it does **not** reverse Woo orders, payments, stock, refunds, or applied DB changes (`docs/runbooks/R10-BACKUP-RESTORE-ROLLBACK.md`).
- `#143` TRUNCATE revoke must **not** be re-granted on app rollback.
- Backup/restore rehearsal remains **unexecuted** — shared/paid/remote restore needs RD-03 (`QUALIFICATION-RD-DECISIONS.md`).
- Training bridge install of race-fix / R144 product remains a **separate** authorization (see `RUNTIME-DECISIONS-MANIFEST.md` RD-02).

## Post-deploy verification checklist (Preview; not Lane D)

- [x] Immutable Preview URL recorded — https://cetech-pos-staging-pji89co71-wbdevworlds-projects.vercel.app (`dpl_CBSA…` READY, tip `ab5c7e1…`)
- [ ] Running application `BUILD_ID` observed = authorized candidate SHA (operator confirm on Preview)
- [ ] Release-policy endpoint returns no-store + matching builds
- [ ] Desktop browser reload retains drafts/journal (no storage wipe)
- [ ] Installed-PWA path executed per `docs/runbooks/R10-DEVICE-AND-PWA-REHEARSAL.md` (separate evidence)
- [x] Tester alias still on prior baseline `816e0bb…` / `dpl_nxWG…` (root-verified READY; no alias move)

## Forbidden by this manifest

- Production promotion
- Tester alias change without RD-03
- Storage wipe / clear-all IndexedDB as recovery
- Hosted DDL without RD-01
- Claiming installed-PWA or cashier-hardware PASS from desktop-only evidence
- Treating unrepaired race as optional default acceptance (race is fixed in combined **source**; training install is separate)
- Blanket “NOT DEPLOYED” wording that ignores the existing unpromoted Preview
