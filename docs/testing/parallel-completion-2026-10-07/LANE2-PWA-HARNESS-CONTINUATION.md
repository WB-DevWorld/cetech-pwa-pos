# Lane 2 continuation — TEST-ONLY harness + remaining device gaps

Status: **HARNESS PASSED (TEST-ONLY)** · installed cashier PWA / hardware **NOT RUN**  
Preview still under test for prior checks: f0 `dpl_4Vk3XQ…` / BUILD_ID `f0feb44…`  
Published product composition: `542d3ef…` (PR tip may be later docs/test SHA)  
Staff-documentation impact: **NONE**

## Controlled-update / multi-tab (isolated harness)

| Command | Result |
| --- | --- |
| `pnpm exec vitest run src/local/pwa-lifecycle.test.ts src/local/service-worker-lifecycle.test.ts` (apps/pos-web) | **22/22 PASSED** |

These exercise CORE-07 multi-tab lifecycle lease and service-worker safety / standalone manifest invariants. Label: **TEST-ONLY** — not performed on an installed cashier client.

## Carry-forward from LANE2-PWA-DEVICE-01 (f0 harness)

| Check | Prior result |
| --- | --- |
| Draft re-sign-in persistence | PASSED |
| Offline local search + Pay disabled | PASSED |
| Reconnect Pay GHS 29.00 | PASSED |
| Clear draft without commercial mutation | PASSED |
| Open-shift browser Reprint “Print dialog opened.” | PASSED |
| display-mode standalone / Add to Home Screen install | **NOT RUN** |
| Physical scanner model/interface + rapid distinct scans | **NOT RUN** — hardware unavailable |
| Physical thermal printer output (width/totals/clipping) | **NOT RUN** — hardware unavailable |

## Precise remaining dependencies

1. Dedicated cashier device with true installed-PWA launch (`display-mode: standalone` or platform equivalent).
2. Operator-recorded scanner model + interface; rapid distinct/repeated barcode proof.
3. Operator-recorded receipt printer model + interface; paper output from stored receipt 50317 (dialog/PDF insufficient).
4. Optional: repeat no-scope Reprint on corrected Exact SHA Preview after authorization (Lane 1 decision).
