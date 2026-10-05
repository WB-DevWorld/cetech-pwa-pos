# Phase 2 — bounded performance and scanner safety qualification

Base: exact tester source `816e0bb6963aff760609a3c7e4817e603c4ffdf0`, not protected main. Branch: `ws3/performance-safety-2026-10-05`. The owner authorized implementation after the Phase-1 technical verdict on 5 October 2026.

This candidate preserves the incumbent hybrid: local catalog/drafts, Supabase POS operations and rebuildable projections, authoritative Woo pricing/stock/orders, provider settlement truth. No architecture, schema, index, dependency, payment, receipt, journal, service-worker or Delivery Engine change is authorized in this batch.

## Frozen impact scopes

- [SCAN-INTENT-01](scope-scan-intent-01.json): preserve independent and repeated local barcode events in input order; pause at required choices; prevent unresolved scans from using an old confirmed price to start Pay.
- [REGISTER-REFRESH-GUARD-01](scope-register-refresh-guard-01.json): recheck captured authority after awaited hydration before state/preference/offline publication. A real active-shift barrier exposed a preexisting stale-shift overwrite; original and read-reuse-only source failed the negative control, guarded source passes.
- [Scanner test maintenance](scope-scan-test-maintenance.json): adapt one obsolete literal boundary assertion after the expanded scanner gate, retaining its modal/catalog protection.
- [REGISTER-READ-01](scope-register-read-01.json): reuse only the successful matching register response fetched in the same hydration, removing one duplicate BFF GET while retaining fresh session, assignments and active shift checks.

These manifests were recorded before product edits and frozen separately for actual-diff validation. They are a manual bounded substitute for unimplemented general #104 enforcement, not an implementation of #104.

- [CI receipt alert locator](scope-ci-alert-locator-01.json): narrow an ambiguous existing error assertion to its intended receipt-unavailable alert; no receipt runtime change.

## Baseline evidence and limits

The Phase-1 actual mounted Sell component diagnostic accepted two distinct scan events before local lookups settled and added only the second product: one line/revision1 instead of two/revision2. This is a correctness defect, not a latency measurement.

The actual staff controller with synthetic injected ports made four requests on a one-register restore/refresh (context, register, duplicate register, active shift), and five with two assignments plus a stored selection. Explicit selection made two requests. No network or commercial writes were involved. Source tracing associates the removable register endpoint with five PostgREST reads; actual database latency/query plans remain separate qualification evidence.

Twenty committed cart revisions at 25ms intervals still produced twenty simultaneous quote calls in the actual deployed hook diagnostic. Quote scheduling is intentionally unchanged in this batch: a one-active policy can delay a current quote behind an obsolete request. #115 and #132 remain open investigations; no complete PostgREST reliability resolution is claimed.

## Acceptance and regression

Required: independent/repeated scan intent preservation, maximum one queued local lookup, collision/variation pause, truthful lookup failure and retry/cancel, cart transition and unmount isolation, unavailable catalog pause, pending-scan Pay guard, unchanged authoritative quote and durable checkout identity. Register tests must preserve auth failures, explicit-switch freshness, epoch/sign-out races, offline behavior and preference isolation.

Local fixtures prove browser/controller behavior; they do not prove authenticated staging performance, Woo stock concurrency, provider settlement, installed-PWA/hardware performance or public-site capacity. Exact-head CI, different competent human review and separately authorized staging qualification remain release gates. No production promotion or tester alias change is part of this batch.

## Rollback

Revert only the bounded candidate source commits to the compatible tester base. Local imported controller commit `b80bd9e` contains both register task IDs: reverting it reverses both. Removing only one of those fixes requires a separately reviewed forward repair; the frozen pre-edit guard manifest describes the logical optimization, not a separately published guard commit. There is no migration or state repair. Preserve local drafts/journal, current receipt parser support, existing orders and unsettled operation evidence. Do not clear browser storage. Do not reuse a consumed release exception.

## Integrated batch handoff

| Field | Evidence |
|---|---|
| Scope | Three bounded fixes plus connected test/staff-documentation maintenance; 20 allowed paths |
| Base SHA | `816e0bb6963aff760609a3c7e4817e603c4ffdf0` |
| Local production-source checkpoint | `e9c92379` (register, browser and scanner imports); final documentation/test-maintenance tree recorded in the published PR |
| Final remote SHA | Record exact published head in PR; no self-referential commit hash is embedded here |
| Contributor imports | register `f194f841`; browser `e0be691f`; scanner `9fee56cd` |
| Schema/index changes | NONE |
| Remote business writes / production effects | NONE |
| Deployment / tester alias | Unchanged; Preview `dpl_nxWGrSLqaLBGNNN683QjdixNBjF6` remains base816e0bb |
| Baseline / after barcode | Native delayed local lookup: distinct additions1→2; repeated quantity1→2; queued variation/collision preserved; unresolved scan no longer opens Pay |
| Baseline / after register | Actual injected controller: one assignment restore/refresh4→3, two with stored selection5→4; no-choice3 and explicit-select2 unchanged |
| Baseline / after shift race | Original and read-reuse-only source overwrite newer shift; guarded source retains it |
| Improvement | Correct scan intent and stale-authority behavior; one duplicate BFF request removed per selected hydration. No staging/device millisecond or percentage speed claim |
| Tests | Full unit207 files/1,734 tests PASS (`TZ=UTC`); native Chromium153.0.8010.12 full browser77/77 PASS; production build PASS; full typecheck PASS; lint0 errors/5 warnings in untouched paths; focused changed-file lint0 warnings |
| Negative controls | Original scanner: five native tests fail for intended defect; strengthened same-event Pay test opens forbidden old checkout. Original/dedup controller fail entered-activeShift overlap; guarded controller passes |
| Regression matrix | Scanner/cart/quote; attempt/idempotency/checkout; register/auth/offline/session; Management/returns/attention; immutable receipt/reprint/PDF; responsive UI/navigation and PWA-related local restore coverage |
| Additional mounted evidence | Actual changed React StrictMode component11 synthetic scenarios PASS: FIFO/repeat, failures, modal/catalog/props, chooser, cart success/failure, unmount, checkout, synchronous Pay/no-op/throw and variation failure |
| Independent AI source review | Contributor exact source and integration `e9c92379` reviewed, production file parity verified; no unresolved source safety finding within scope. This is not human approval |
| Unexpected effects | Baseline unit harness regenerated39 tracked HTML/bridge fixture outputs; final combined tests regenerated51. Saved diagnostic diffs outside repository and restored only those generated outputs; none included in candidate. Baseline receipt unit assumed UTC and failed under host BST; it passes under `TZ=UTC`. No receipt change |
| Staging evidence | Base deployment identity reconciled; new candidate authenticated staging/cashier-device/installed-PWA/stock concurrency/provider runtime NOT YET QUALIFIED |
| Runtime limits | No latency distributions, Woo load reduction, DB plans or complete #115 resolution established by these local fixtures |
| Review / release | Different competent human review pending. Exact-head Linux/Windows CI belongs in PR handoff. No main merge, manual deployment or promotion authorized |
| Rollback | Revert bounded candidate to compatible base; controller fixes are combined as noted above. No migration/state repair; retain drafts/journal/receipt support and unresolved operations |
| Remaining risks | #115 recurring PostgREST reliability, #132 quote bursts, live stock/payment/recovery qualification, independent review and real rollback/device evidence |
| Next highest impact | Authenticated exact-source request/phase traces for #115/#132; measure latest quote readiness and upstream capacity before any batching/serialization change |

The final publication/freshness report records the exact source SHA, CI result and two-pass cutoff. Source and local fixtures establish a review candidate, not production qualification. Current verdict remains **NOT READY FOR PRODUCTION**.


Exact initial candidate7addddf3 CI37357308535 passed Windows and allLinuxgates except an existing receipt test locator (76/77 browserpassed). Bothrole=alert nodes were visible to the generic locator: businesserror andNext announcer. The test-only followup is scoped separately; it keeps error visibility and scope-denial controls assertions. Final remote head/CI followup belong in the external PR handoff.
