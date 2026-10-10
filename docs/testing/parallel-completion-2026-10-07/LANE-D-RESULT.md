# Lane D — PWA / client lifecycle result

| Field | Value |
| --- | --- |
| Task | `PARALLEL-LANE-D-PWA` |
| Workstream / lane | WS3 Lane D |
| Branch | `ws3/lane-d-pwa-2026-10-07` |
| Base / tested SHA | `0e383d84f11573ca89d6533c8cb7c35d79d7b261` |
| Scope | `docs/testing/parallel-completion-2026-10-07/scope-lane-d-pwa.json` |
| Outcome | **PASS_WITH_GATES** — automated + desktop isolated-profile evidence PASS; installed-PWA / cashier-hardware / production remain unclaimed |
| Staff-documentation impact | **NONE** — verification and docs only; no cashier-facing behavior change |
| Production effects | **NONE** — no promotion, no tester-alias change, no storage wipe |

## What was verified

| Concern | Evidence level | Result |
| --- | --- | --- |
| Reload / reconnect discovery | unit (`service-worker-lifecycle` foreground/reconnect/long-session) + desktop reload | PASS |
| Assignment freshness | unit (`staff-runtime` register assignment A–J, revocation, stale AUTH) | PASS |
| Expired / signed-out sessions | unit + composition (`staff-runtime`, `offline-staff-presentation`, `staff-runtime-composition`) | PASS |
| Multi-tab lifecycle lease | unit (`pwa-lifecycle` lease) + desktop two-tab shared SW controller | PASS (desktop); installed multi-window **UNVERIFIED** |
| Pending-operation update deferral | unit (`assessUpdateActivation`, waiting-worker blocked while tender/critical/passive) + `checkout-client-r9` tender markers | PASS |
| Stale-bundle / A→B transition | unit (build-specific worker registration, SHA inequality not treated as unsupported, waiting activation gated) | PASS (synthetic); live A→B deploy **UNVERIFIED** |
| Storage failures | source fail-closed clear on sign-out; journal/draft survive schema upgrade (`pwa-upgrade`); desktop IDB marker survives reload | PASS for covered paths |
| Durable transaction identity | journal reopen / `response_unknown` retention / idempotency conflict tests | PASS |
| Safe service-worker lifecycle | `sw.js` install does **not** call `skipWaiting`; only `CORE07_ACTIVATE_WAITING_UPDATE` may; API paths uncached | PASS |

## Commands and results

Worktree: `C:\Users\Jane\Desktop\Learning 2026\Cursor\cetech-pwa-pos-lane-d-pwa`

```text
pnpm install --frozen-lockfile
→ EXIT 0

pnpm --dir apps/pos-web exec vitest run \
  src/local/pwa-lifecycle.test.ts \
  src/local/service-worker-lifecycle.test.ts \
  src/app/pwa-lifecycle-runtime.test.ts \
  src/core/identity/staff-runtime.test.ts \
  src/core/identity/offline-staff-presentation.test.ts
→ 5 files / 95 tests PASS

pnpm --dir apps/pos-web exec vitest run \
  ../../tests/integration/sync/pwa-upgrade.test.ts \
  ../../tests/integration/sync/operation-journal.test.ts \
  ../../tests/integration/auth/staff-runtime-composition.test.ts \
  ../../tests/frontend/r9-system-status-recovery.test.ts
→ 4 files / 16 tests PASS

pnpm --dir apps/pos-web exec vitest run \
  src/app/checkout-client-r9.test.ts \
  src/app/checkout-client-journal.test.ts \
  src/local/release-policy-client.test.ts \
  src/server/release/handle-release-policy.test.ts
→ 4 files / 11 tests PASS

BUILD_ID=0e383d84f11573ca89d6533c8cb7c35d79d7b261 pnpm --dir apps/pos-web build
→ EXIT 0 (Next.js 16.3.4 production build)

next start --hostname 127.0.0.1 --port 3014  (BUILD_ID same)
+ isolated Chromium persistent profile smoke
→ 7/7 steps PASS — see browser-desktop-evidence.json
```

Focused automated total: **122 tests PASS** across the suites above. One production build reused for browser checks.

## Desktop browser evidence (not installed PWA)

Artifact: `docs/testing/parallel-completion-2026-10-07/browser-desktop-evidence.json`  
Helper (reproducible, non-runtime): `_browser-smoke.cjs`  
Profile: `%TEMP%\lane-d-pwa-profile-0e383d84` (isolated; no wipe of other profiles)

Observed on desktop Chromium:

- Home `200`, title `CETECH POS`
- `GET /api/pos/v1/release-policy` → `200`, `Cache-Control: no-store`, builds = tested SHA
- Service worker controlling page: `/sw.js?build=0e383d84f11573ca89d6533c8cb7c35d79d7b261`
- Reload keeps SW controller and IndexedDB marker (`markerPresent: true`, `storageWiped: false`)
- Second tab `/sell` shares the same SW registration/controller
- `/offline.html` `200`; install handler does not call `skipWaiting`; message path does; `/api/` uncached

**Explicitly not claimed:** installed PWA cold start, Android/Windows installed client, cashier hardware scanner/printer, live A→B waiting-worker on staging, production promotion, tester-alias move.

## Release / rollback / backup pointers

| Topic | Pointer | Lane D status |
| --- | --- | --- |
| Release gates | `docs/integration/RELEASE-GATES.md` | Installed PWA update/recovery still a release gate |
| R10 go/no-go | `docs/integration/evidence/R10/R10-GO-NO-GO.md` | Remains **NO-GO** until listed runtime gates |
| Device/PWA rehearsal | `docs/runbooks/R10-DEVICE-AND-PWA-REHEARSAL.md` | **PREPARED — not executed** here |
| Backup/restore | `docs/runbooks/R10-BACKUP-RESTORE-ROLLBACK.md` | **PREPARED — backup/restore unexecuted** |
| App rollback | same + `docs/runbooks/RELEASE-AND-ROLLBACK.md` | Code rollback ≠ commerce reversal |
| PWA recovery SOP | `docs/runbooks/PWA-RECOVERY.md`, `docs/standards/PWA.md` | Non-destructive recovery required |
| Staging CD / exact SHA Preview | `docs/runbooks/CD-01-STAGING-DEPLOYMENT.md` | Candidate Preview path exists; **do not** move tester alias in this lane |
| Application candidate pin | boundary/integration `RELEASE-CANDIDATE-2026-10-06` / `#140` | Same SHA `0e383d84…` |
| Shared tester baseline (unchanged) | `816e0bb6963aff760609a3c7e4817e603c4ffdf0` | Alias **not** changed by Lane D |

## Remaining live acceptance gates (from existing docs)

1. Q-PWA-01…06 installed-client / update / reconnect / multi-tab (`R10-AUTOMATED-QUALIFICATION-MAP.md` — deliberately not substituted by unit tests)
2. R9 installed-device evidence after frozen candidate (`R10-DEVICE-AND-PWA-REHEARSAL.md`)
3. Isolated backup/restore rehearsal (`R10-BACKUP-RESTORE-ROLLBACK.md`)
4. Application/bridge rollback rehearsal against intended pilot topology
5. Exact-SHA Preview deploy of this candidate **without** production/`--prod`/tester-alias assignment, then observe running `BUILD_ID`
6. Human production approval (never granted by this lane)

## Blockers

1. **Installed-PWA / cashier-hardware gates open** — desktop Chromium evidence is not Q-PWA PASS.
2. **Backup/restore and application rollback rehearsals unexecuted** — PREPARED only.
3. **No Lane D production or alias promotion** by design; candidate still needs authorized Preview + independent review for any shared staging move.

## Next action

Integration editor: accept Lane D evidence pack; if staging inspection is authorized, dispatch Exact SHA Preview for `0e383d84f11573ca89d6533c8cb7c35d79d7b261` per CD-01 **without** changing the tester alias; then execute `R10-DEVICE-AND-PWA-REHEARSAL.md` on a real installed client.

## Candidate deployment manifest

`docs/testing/parallel-completion-2026-10-07/CANDIDATE-DEPLOYMENT-MANIFEST.md`
