# Testing standard

Foundation checks prove file/schema/reference consistency only. Once scaffold exists: lint/typecheck/unit/build, producer-consumer schema tests, bridge PHP/integration/parity, Supabase reset/RLS tests, Playwright smoke and staging failure injection. Match test evidence to risk; no screenshot proves payment authority. Pricing golden corpus must be captured from actual staging Woo checkout and include plugin config/version. Highest-risk tests: simultaneous last-unit buy online/POS, double click, crash between each external write and acknowledgement, duplicate/late provider callback, invalid evidence amount/currency, sale complete/POS unavailable, double refund/restock, shift close race, installed PWA pending journal upgrade. Preserve expected negative results. Do not widen tests merely for volume once concrete gates pass.

Owner: WS3. Controlling contracts/ADRs outrank generic examples. Done = evidence.
