# PERF-QUOTE-20261005 — quote context and diagnostic timing

Review candidate based on exact unmerged PR #139 head `3c2a5a6af4ab202988e46bb3af6d3ae365147be8`. The predecessor and this candidate require independent human review and live qualification. Neither is accepted deployment evidence. The shared tester remains at `816e0bb`; production is untouched.

## Retained changes and frozen scope

- **QUOTE-CONTEXT-01:** a stored confirmed quote applies only when its complete serialized commercial request matches the current cart identity, revision, customer/B2B context, location and lines. This check happens during render, before an effect can request a replacement. A previous-context quote cannot authorize current Pay or supply the previous price for a changed-price comparison. Equivalent presentation objects keep the same request key; same-request retry and changed-price review remain intact.
- **QUOTE-TIMING-01:** expose existing measured stages in `Server-Timing`: `bff`, `session`, `assignments`, `catalogIdentity`, `bridge`, `saveSnapshot`. Only entered, fixed-name phases with finite nonnegative durations are included. Total ends at result selection; it excludes JSON response serialization and network transfer. Bodies, status, correlation, no-store, CSRF/auth checks, upstream calls and deadlines remain unchanged. No identifiers, arbitrary strings, TAO or CORS access are added.
- **QUOTE-DISPATCH-01: HELD.** A 100ms prototype reduced a 20-edit burst from20 requests to6–7, but added about94ms to worst-phase healthy latest-quote readiness. An assumed two-slot synthetic provider model favored the prototype; real Woo/PHP capacity and cashier latency benefit remain unproved. No dispatch helper or scheduling delay is included. These measurements are prototype evidence, not achieved request elimination.

The three JSON manifests were frozen outside git before source edits and copied byte-for-byte here. Actual changed paths must remain inside their union. Only context and timing source scopes are implemented. The manual manifest evidence does not implement #104.

## Evidence and limits

The original mounted hook exposes old confirmed eligibility after same-revision location, customer or commercial-line changes. Native Chromium qualification compares the exact baseline and candidate hook: baseline passes10/14 scenarios; candidate passes14/14 scenarios and28/28 checks with no external requests or page errors. This proves the hook boundary with a synthetic PricingPort, not the reachability or duration of a wrong-price checkout in the full deployed application.

New mounted hook regressions cover context changes, equivalent objects, retry/price review, old responses, replacement carts, reconnect/offline, empty cart, expiry, Strict Mode and unmount. Actual quote-route tests exercise the real handler and Supabase adapters behind synthetic transport. Successful quote still performs6 PostgREST requests and1 Woo call; denied/failed paths retain their existing request counts and fail-closed results.

Combined qualification and exact-head CI results belong in the final PR and external batch report. Local gates cover all unit tests, the production build, typecheck, lint, foundation/tooling and the native browser suite. Test-generated evidence/fixtures are preserved externally and restored, not included in this diff. No test retries/skips or dependency changes are introduced.

## Runtime findings requiring separate work

Read-only staging database recovery confirms the existing privilege blocker remains: hosted defaults leave excessive grants, including authenticated TRUNCATE on11 operational tables. RLS does not cover TRUNCATE; no destructive reachability test was attempted. A separately approved additive privilege-hardening migration and hosted-default tests are required before pilot. No schema, grants, policy or index change is made here.

Issue #115 remains open. Fresh successful gateway events and sub-millisecond mean session/assignment SQL do not prove incident-time health. The exact recurring Warp message has an official upstream normal-termination logging case; its count must not be treated as failed cashier requests. Hosted PostgREST build and a request-correlated actual failure remain unverified. Current plans do not justify adding an index.

Two sequential anonymous training bridge health denials take16.7–17.7 seconds from this observer before source pricing execution. Connection/proxy/TLS and remaining first-byte delay are not isolated PHP or Woo calculation time. Historical authenticated quote evidence identifies the bridge boundary as dominant, but current installed bridge identity and internal phase costs remain unverified. Delivery Engine is a separate, untouched product.

Authenticated browser access is blocked by the browser tool's native-credential preflight. No quote POST, sale, payment, stock effect or load test was initiated. Representative installed-PWA, staging Woo/payment, hardware, concurrency, restore and rollback acceptance are still required. This candidate establishes correctness and diagnostic visibility; no checkout speed gain is claimed.

## Regression surface, rollback and handoff

Adjacent surfaces: scanner/Pay gating, customer and location context, cart restoration, retry/reconnect, current quote expiry and review, server session/assignment authority, failure envelopes and upstream deadlines. Commercial sources, operation identity/journal, settlement verification, orders, final stock, receipt truth and recovery are protected.

Revert this bounded application candidate to exact base `3c2a5a6a` or revert its isolated commits. No data/schema rollback or local-storage clearing is required or permitted. Existing operations must continue through their normal resolve/recovery path. Do not infer a safe business retry from a transport timeout.

Required next gates: independent different-human review; exact-SHA authenticated staging trace using existing safe correlation and new phase headers; transport headers/body and training runtime attribution under separate scopes; DB privilege hardening; WS2 isolated-quote concurrency safety; then cashier/device/payment/stock/rollback qualification. No protected merge, shared tester promotion, production release, VitePOS deactivation or cross-product change is authorized by this report.
