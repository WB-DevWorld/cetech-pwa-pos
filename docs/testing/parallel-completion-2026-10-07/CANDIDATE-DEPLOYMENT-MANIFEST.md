# Candidate deployment manifest — Lane D (PWA)

Status: **CANDIDATE ONLY — DO NOT PROMOTE PRODUCTION — DO NOT CHANGE TESTER ALIAS**

Prepared by WS3 Lane D on 2026-10-07 after local automated + desktop-browser verification. This file is an exact candidate record for an authorized non-production Preview. It is not a GO, not staging acceptance, and not production approval.

## Exact artifact

| Field | Value |
| --- | --- |
| Candidate SHA | `0e383d84f11573ca89d6533c8cb7c35d79d7b261` |
| Short | `0e383d8` |
| Branch (Lane D) | `ws3/lane-d-pwa-2026-10-07` |
| Application package | `apps/pos-web` |
| Intended `BUILD_ID` | `0e383d84f11573ca89d6533c8cb7c35d79d7b261` |
| Includes | `#140` / `#139` `3c2a5a6af4ab202988e46bb3af6d3ae365147be8` |
| Excludes | `#141` diagnostic `4b1febb725c843cf0bf48f86dd9836d4a87b5bbe` |
| Rollback / previous known-good application pin | same application baseline `0e383d84…` (see RELEASE-CANDIDATE-140) |
| Protected main (context only) | `c49045dd02c46574af5d341cc65c177116fa7306` |
| Shared tester baseline (must remain unchanged by this lane) | `816e0bb6963aff760609a3c7e4817e603c4ffdf0` |

## Local build proof (this lane)

```text
BUILD_ID=0e383d84f11573ca89d6533c8cb7c35d79d7b261
pnpm --dir apps/pos-web build
→ EXIT 0

Runtime observation (local Next start :3014):
  SW controller = /sw.js?build=0e383d84f11573ca89d6533c8cb7c35d79d7b261
  release-policy latest/recommended/minimumSupportedBuild = same SHA
```

Evidence: `LANE-D-RESULT.md`, `browser-desktop-evidence.json`.

## Authorized deployment shape (when integration editor dispatches)

Follow `docs/runbooks/CD-01-STAGING-DEPLOYMENT.md` Exact SHA Preview path:

1. Require open PR whose head equals `0e383d84f11573ca89d6533c8cb7c35d79d7b261`.
2. Require CI jobs `control-plane` and `control-plane-windows` SUCCESS for that SHA.
3. Require one independent exact-head APPROVED review (not the PR author).
4. Dispatch Exact SHA Preview from `main` with `candidate_sha=0e383d84f11573ca89d6533c8cb7c35d79d7b261`.
5. Supply `BUILD_ID=0e383d84f11573ca89d6533c8cb7c35d79d7b261` to the build/deploy request.
6. Record immutable Preview URL only.
7. Prove Preview target + Git source SHA; leave running-app `BUILD_ID` pending until observed.
8. **Do not** pass `--prod`, **do not** assign production aliases, **do not** move `VERCEL_STAGING_ALIAS` / tester alias.

Example (operator; not executed by Lane D):

```text
gh workflow run "Exact SHA Preview" --ref main \
  -f candidate_sha=0e383d84f11573ca89d6533c8cb7c35d79d7b261 \
  -f pr_number=<n>
```

## Compatibility / rollback notes for this candidate

- Local schema / journal / drafts: additive upgrade path covered by `tests/integration/sync/pwa-upgrade.test.ts` (catalog rebuild must not erase drafts/journal).
- Service worker: install never `skipWaiting`; activation only via `CORE07_ACTIVATE_WAITING_UPDATE` after update-safety checks.
- Opaque SHA inequality must not dead-lock as `UNSUPPORTED_APP_VERSION` (covered by unit tests).
- Application rollback reverts code/build only; it does **not** reverse Woo orders, payments, stock, refunds, or applied DB changes (`docs/runbooks/R10-BACKUP-RESTORE-ROLLBACK.md`).
- Backup/restore rehearsal remains **unexecuted** — do not claim recoverability from this manifest alone.

## Post-deploy verification checklist (Preview; not Lane D)

- [ ] Immutable Preview URL recorded
- [ ] Running application `BUILD_ID` observed = `0e383d84…`
- [ ] Release-policy endpoint returns no-store + matching builds
- [ ] Desktop browser reload retains drafts/journal (no storage wipe)
- [ ] Installed-PWA path executed per `docs/runbooks/R10-DEVICE-AND-PWA-REHEARSAL.md` (separate evidence)
- [ ] Tester alias still on prior baseline `816e0bb…` unless a **new** explicit release decision says otherwise

## Forbidden by this manifest

- Production promotion
- Tester alias change
- Storage wipe / clear-all IndexedDB as recovery
- Hosted DDL
- Claiming installed-PWA or cashier-hardware PASS from desktop-only evidence
