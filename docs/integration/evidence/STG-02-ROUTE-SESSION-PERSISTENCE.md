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

Source inspection found only one `ProductSearch` in the Sell composition. The duplicate toolbar visible in the prior live screenshot was not reproduced or causally proven from source inspection. Re-test on the persistence-fixed protected Preview. If it disappears after the persistent runtime fix, that supports the remount hypothesis; if it remains, open/fix it as a separate Sell rendering defect. No Sell redesign in this patch.

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
- STG-05 CETECH POS Bridge is deployed on `https://training.cetechbpa.com`. Authenticated bridge health PASS (Woo, WoodMart, and B2BKing detected). Authenticated bridge catalog PASS with real training Woo products. Authoritative quote path PASS for product 14985: walk-in, retail customer 32, and B2B customer 21 all return 3000 GHS minor. Equal totals prove customer-context routing, not B2B price differential/parity. Product 9480 separately fails Woo `add_to_cart` validation and is not a bridge-wide failure. Do not claim training plugin deployment, catalog, or quote are still blocked. `BLOCKED_TRAINING_PLUGIN_NOT_DEPLOYED_STG05` is not current truth.
- The current live Preview catalog blocker is Vercel BFF → WordPress bridge health returning `bridge denied the BFF service identity`, so the live Preview catalog projection is unavailable.
- Cash-sale functional acceptance is still pending. `pricingParityVerified=false` remains open. CP-04 / issue #4 remains OPEN.
- No production promotion. Do not merge from this evidence file.
