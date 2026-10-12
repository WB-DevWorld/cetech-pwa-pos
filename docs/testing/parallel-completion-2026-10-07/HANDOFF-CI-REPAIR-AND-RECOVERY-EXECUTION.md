# Handoff — CI repair and recovery execution (2026-10-09)

```text
Kind: BATCH_COMPLETION · CETECH-POS-WS3-CI-Repair-and-Recovery-Execution.md
WS3 @wbdevworld · bridge review WS2 @Emmanuel-coder-prog (reviews still empty at last check)
Branch: ws3/combined-candidate-2026-10-08 · PR #144
Broken head: 14cc175ecfc19135d9a956481348dd81f0809142
Obsolete freeze: 2e6d704228a522f1f5728c5f2d70cfb08c90e393
Product composition: 542d3ef2f862394a762de43eacf00c724b17aaec (unchanged)
Corrected head: record from git after this publish (single push)
Production: NOT READY · A+D consumed · RD-01 not re-applied · no alias move · no silent f0
Staff-documentation impact: NONE
```

## What works now

- Orders Reprint **product** composition remains accepted at `542d3ef…`.
- Local integration Playwright for real Orders composition remains accepted (TEST-ONLY).
- App typecheck passes after fixing the e2e harness import depth (CI failure cause).
- Woo DB dump/import on `cetech-pos-r10-woo-20261009` remains accepted; partial files tarball is now local with matching checksum.
- Concrete Preview deploy request with empty origin overrides is written (not dispatched).

## What is still unproved / blocked

| Lane | Single operator unlock |
| --- | --- |
| Corrected Preview + no-scope Reprint | Independent APPROVED + CI green + **one-off empty `APP_ORIGIN`/`NEXT_PUBLIC_APP_ORIGIN` exception** (or authorized tooling change) — see `PREVIEW-DEPLOY-REQUEST-CI-REPAIR.md` |
| Full Woo WP boot | Complete core/themes/plugins archive (or licensed reinstall overlay) — `LANE3-WOO-APP-RESTORE-GAP-01.md` |
| POS dump/import | Private staging **DB URI** on operator machine — `POS-CREDENTIAL-OPERATOR-ACTION.md` (do not paste into chat) |
| Installed PWA / scanner / printer | Dedicated device + `R10-DEVICE-AND-PWA-REHEARSAL.md` |
| B/C commercial | New senior GO; C prefers cheaper stock-1 than 49663@GHS12500 |
| Native FPM cutover | Remains UNVERIFIED historically |

## Matrix

| Check | Result | Evidence |
| --- | --- | --- |
| CI import-depth fix | **PASSED** local typecheck + Playwright | CI-REPAIR-ORDERS-REPRINT-IMPORTS-01.md |
| Scope + gitignore reconcile | **PASSED** | scope-print-history-reprint-integration.json; `.tmp-orders-reprint/` retained |
| PR CI on corrected head | **PENDING** at handoff write | allow run to finish |
| Independent GitHub APPROVED | **MISSING** | reviews empty |
| Orders composition e2e (accepted) | **PASSED** (carry forward + re-run 1/1) | orders-history-reprint-composition.spec.ts |
| Exact SHA Preview ordinary | **BLOCKED** (origin Secret) | PREVIEW-DEPLOY-REQUEST-CI-REPAIR.md |
| Woo SQL restore | **PASSED** (accepted) | LANE3-RESTORE-CAPTURE-01.md |
| Woo files private copy | **PASSED** checksum match | LANE3-WOO-APP-RESTORE-GAP-01.md |
| Full WP boot | **NOT RUN** | missing core/themes/plugins package |
| POS dump | **BLOCKED** | POS-CREDENTIAL-OPERATOR-ACTION.md |
| Installed PWA / hardware | **NOT RUN** | unchanged |
| B/C execution | **NOT RUN** | prep only |
| #115 / #132 | OPEN | unchanged |

## Identities

| Item | Value |
| --- | --- |
| f0 Preview | `dpl_4Vk3XQ…` / `gqg6tjedt` / `f0feb44…` |
| Shared tester | unchanged |
| Bridge | live `63094753…` / `89e4461c…` |
| A+D | txn `33326bbc…` / sale-50317 / Woo 50317 / `rcpt-33326bbc` |
| Maps | Woo 49111→`d7c385f0…`; Woo 49663→`cc0924d4…` |

## Next highest-impact action

Publish corrected head → wait CI green → obtain non-author APPROVED → present `PREVIEW-DEPLOY-REQUEST-CI-REPAIR.md` for one owner origin exception → qualify Reprint on the new Preview for 50317 without a second sale.
