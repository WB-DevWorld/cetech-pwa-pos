# Testing standard

Foundation checks prove file/schema/reference consistency only. Once scaffold exists: lint/typecheck/unit/build, producer-consumer schema tests, bridge PHP/integration/parity, Supabase reset/RLS tests, Playwright smoke and staging failure injection. Match test evidence to risk; no screenshot proves payment authority. Pricing golden corpus must be captured from actual staging Woo checkout and include plugin config/version. Highest-risk tests: simultaneous last-unit buy online/POS, double click, crash between each external write and acknowledgement, duplicate/late provider callback, invalid evidence amount/currency, sale complete/POS unavailable, double refund/restock, shift close race, installed PWA pending journal upgrade. Preserve expected negative results. Do not widen tests merely for volume once concrete gates pass.

Owner: WS3. Controlling contracts/ADRs outrank generic examples. Done = evidence.

## Batches and freshness

Contributor push CI now covers ws1/ws2/ws3/fix/batch patterns; PR events validate combined changes. Required job names remain unchanged. Linux keeps local Supabase reset/pgTAP; Windows keeps its existing checks. Some contributor-PR pushes run twice intentionally for simple reliable coverage. Do not skip required workflows/jobs or use pull_request_target for convenience. Two-pass freshness runs affected verification and milestone gates, not unrelated suites for every upstream typo. [Canonical policy](../plans/LONG-RUNNING-WORK.md).
