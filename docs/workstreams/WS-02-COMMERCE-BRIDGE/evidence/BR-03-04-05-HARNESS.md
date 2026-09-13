# BR-03 / BR-04 / BR-05 local harness checkpoint

UTC: 2026-09-13
Branch: `batch/r3-authoritative-pricing-parity`
Plugin still `0.2.0-br02` (quote path unchanged; rule inspection added)

## What was proven

- WoodMart/B2BKing **configuration presence** can be read without computing provider prices.
- Absent plugins and empty rule sets are `NOT_APPLICABLE_WITH_EVIDENCE`, never synthetic live parity.
- Unreadable live config is `PERMISSION_REQUIRED`, never invented thresholds.
- Isolated quote engine matches injected runtime totals below/at/above a configured breakpoint, for a B2B customer, and for a qty+B2B overlap total the runtime returned.
- Training tax-off is recorded as `NOT_APPLICABLE_WITH_EVIDENCE` from CP-04 (`woocommerce_calc_taxes=no`).
- `pricingParityVerified` remains false. This is **not** BR-03/BR-04 PARITY VERIFIED and **not** the R3 pricing gate.

## What remains

Live WoodMart quantity thresholds, B2BKing commercial rules, and overlap matrix against training storefront/checkout require an explicit R3 training plugin-update authorization (artifact SHA, rollback, environment). R2 W4 does not cover it. Training `/quotes` is still `rest_no_route`.

## Tests

`php tests/bridge/run.php` **151 passed, 0 failed**.
`php tests/bridge/parity.php` **59 passed, 0 failed, 4 skipped** (3 PERMISSION_REQUIRED + tax-off NOT_APPLICABLE_WITH_EVIDENCE).
