# RELEASE-CANDIDATE-140 scope manifest

Recorded before any application edit. No application file changed.

| Boundary | SHA |
| --- | --- |
| Application candidate | `0e383d84f11573ca89d6533c8cb7c35d79d7b261` |
| Included #139 | `3c2a5a6af4ab202988e46bb3af6d3ae365147be8` |
| Excluded #141 | `4b1febb725c843cf0bf48f86dd9836d4a87b5bbe` |
| Protected main | `c49045dd02c46574af5d341cc65c177116fa7306` |
| Integration | `1021cd113c783e25030fe9c0bda1be9ddcf5888c` |
| Shared tester | `816e0bb6963aff760609a3c7e4817e603c4ffdf0` |
| Bridge subtree | `9aaa031e4d1342cdb729cfdfb5373cd57ad2ca02` |

#140 is a descendant of #139 and of tester `816e0bb`. The three commits after the tester are `7addddf`, `3c2a5a6`, and `0e383d8`. #139 is not imported a second time. #141 stays outside this application batch.

Human review of `0e383d84` is still empty. Prior CI success on run `37365607929` is the exact-head pull_request result. The earlier push run `37365602897` failed and stays in the history.

## PRICE-DELAY-TRACE-01

No quote was sent. The existing `quote_request_timing` query for `2026-10-05T02:40:37Z` through `2026-10-06T02:40:37Z` returned no events. That window was not polled again. The longest measured segment is **UNVERIFIED**. No price-delay fix is authorized until that segment is measured.

Source observation on `0e383d84`, not a root cause:

- `useCartQuote` ignores a late response by setting `cancelled` and by `shouldIgnoreStaleQuoteResponse`.
- The effect cleanup does not abort the `PricingPort` call.
- `requestWholeCartQuote` calls `pricing.quote(request)` with no cancellation handle.
- `createBrowserPricingPort` aborts its own fetch only at the 60-second client deadline.

A superseded cart context can therefore leave the already dispatched quote running. Reported FPM `max_children` 3 makes capacity contention plausible. It is not proven. Browser cancellation would not, by itself, prove that PHP work had stopped.

## SALE-RECOVERY-CLASSIFY-01

Historical POS transaction `d6755ff1-9f1e-43c6-bde0-3cb04486a9e6`, read by root at `2026-10-06T02:45:57Z`:

- operation `7e4042f9-48f4-403d-872a-de7d74c6be26`
- operation `sale.prepare`, status `pending`, attempts `0`
- idempotency key `0d4031d5-5b4b-40f6-9afc-9c569af1de0d`
- durable intent present, outcome absent
- no POS checkout sale, payment, receipt, or cash_sale movement
- historical Woo claim `33`

This is an unresolved historical POS intent. It does not prove Woo order `50104` is absent or unpaid. It is not the identity of the owner's present blocked draft. No storage clear, Pay retry, or replacement order was performed. A human decision is required before any resolve or repair.

## Release verdict

**NOT READY FOR PRODUCTION.**
