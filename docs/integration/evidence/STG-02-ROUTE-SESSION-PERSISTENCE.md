# STG-02 route session persistence

Observer: WS3 senior / @wbdevworld
Task: STG-02 / #71 follow-up — live STG-06 navigation blocker
Branch: `ws3/stg-02-route-session-persistence`
Start SHA: `4e47a1f793bb8b75f6cf4fa03ee8f66675b4a897`
UTC: `2026-09-18`

Start `origin/main` (Pass 1): `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` — unchanged from start snapshot.
Start batch `origin/batch/stg-01-staging-runtime-acceptance` (Pass 1): `4e47a1f793bb8b75f6cf4fa03ee8f66675b4a897` — unchanged.
Classification: IRRELEVANT / COMPATIBLE. No upstream STG-01 or main drift since this contributor branch started.


## Defect

Each mounted POS `page.tsx` rendered `<PosApp route="…" />`. Next.js App Router unmounts page components on client navigation, so `PosRuntime` remounted, `StaffRuntimeController` started at `status: "restoring"`, and `runtime.restore()` ran again. While `status !== "ready"`, `PosRuntime` rendered `StaffAuthGate` ("Signing in…"). Live Preview therefore flashed Staff Sign-In between authenticated workspaces.

## Fix

`PosSessionProvider` now owns `PosApp` from the root layout. Mounted POS pages are route slots (`null`). `posRouteFromPathname` maps `/` and the eight mounted hrefs. Unknown paths do not mount the POS runtime. Authentication, CSRF, session verification, RLS, and register/shift authority are unchanged. Credentials are still not stored in IndexedDB/localStorage/sessionStorage. Restore still runs on a genuine runtime mount (hard reload / expired / signed-out / lock).

## Sell duplicate search/Scan rows

`SellScreen` composes a single `ProductSearch` toolbar. There is no second search/Scan component in mounted Sell composition. A live screenshot of two identical toolbars is consistent with a remount flash of `SellRuntimeScreen` during the same PosRuntime restore, not a duplicate Sell tree. No Sell redesign in this patch.

## Checks

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm --dir apps/pos-web lint` | PASS |
| `pnpm --dir apps/pos-web typecheck` | PASS |
| `pnpm --dir apps/pos-web test` | PASS 84 files / 738 tests |
| `pnpm --dir apps/pos-web build` | PASS |
| `pnpm --dir apps/pos-web test:e2e` | PASS 12 tests |
| `python scripts/verify_control_plane.py` | PASS |
| `git diff --check` | PASS |

Focused e2e: existing unauthenticated staff-session test remains green. New test establishes one authoritative session, enters `/sell`, then clicks POS sidebar buttons through orders, customers, returns, register, health, attention, settings, and back to sell. It asserts StaffAuthGate / Sign in / Signing in… never appear, cashier and assigned register remain visible, and session GET / catalog bootstrap / restore counts do not increase.

The existing `page.goto` workspace test is retained so full document loads are still covered and are not used to mask this defect.

## Remaining blockers

- Live Preview of this SHA is still required before STG-06 can accept the navigation fix.
- Training Woo plugin deploy / live catalog/quote/cash remain blocked independently (`BLOCKED_TRAINING_PLUGIN_NOT_DEPLOYED_STG05`).
- No production promotion. Do not merge from this evidence file.
