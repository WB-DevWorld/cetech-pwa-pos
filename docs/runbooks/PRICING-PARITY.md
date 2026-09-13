# Pricing parity evidence

WS2 captures Woo checkout and bridge outputs using identical staging cart, buyer/location/tax context and installed configuration. Expected totals come from authoritative runtime, never a manually reimplemented plugin formula. Amount comparison is exact minor units after documented Woo rounding. Quote latency measured with environment/device and p50/p95.

| Scenario | Expected source | Bridge result / evidence | Status |
| --- | --- | --- | --- |
| Walk-in/guest | Actual Woo checkout | Synthetic isolated runtime: exact minor-unit match in `tests/fixtures/commerce/parity/BR-02-GUEST-SIMPLE.json`. Live training quote **PERMISSION_REQUIRED** (R3 plugin not deployed; `/quotes` is `rest_no_route` on training). | SYNTHETIC_ISOLATION PASS; live BLOCKED |
| Registered retail | Actual Woo checkout | Synthetic isolated runtime: exact match in `BR-02-RETAIL-SIMPLE.json`. Live **PERMISSION_REQUIRED**. | SYNTHETIC_ISOLATION PASS; live BLOCKED |
| WoodMart below threshold | Actual Woo checkout | Synthetic isolation `BR-03-SYNTHETIC-QTY-BELOW.json` (injected breakpoint, not training). Live **PERMISSION_REQUIRED**. | SYNTHETIC_ISOLATION; live BLOCKED |
| WoodMart at threshold | Actual Woo checkout | Synthetic isolation `BR-03-SYNTHETIC-QTY-AT.json` (qty 5 / unit 9.00 / subtotal 45.00). Harness asserts `unitPriceMinor` independently of totals after the discovered production mapping defect. Live **PERMISSION_REQUIRED**. | SYNTHETIC_ISOLATION; live BLOCKED |
| WoodMart above threshold | Actual Woo checkout | Synthetic isolation `BR-03-SYNTHETIC-QTY-ABOVE.json`. Live **PERMISSION_REQUIRED**. | SYNTHETIC_ISOLATION; live BLOCKED |
| B2BKing group | Actual Woo checkout | Synthetic isolation `BR-04-SYNTHETIC-B2B-GROUP.json`. Live **PERMISSION_REQUIRED**. Unauthorized kind switch denied in unit tests. | SYNTHETIC_ISOLATION; live BLOCKED |
| B2BKing tier | Actual Woo checkout | Live configuration unread in this process. | PERMISSION_REQUIRED |
| Customer-specific terms | Actual Woo checkout | Presence readable only from authorized runtime config. | PERMISSION_REQUIRED |
| Variations | Isolated runtime | Synthetic variation line exact in BR-02 unit tests. Live **PERMISSION_REQUIRED**. | SYNTHETIC_ISOLATION; live BLOCKED |
| WoodMart + B2BKing overlap | Actual Woo checkout | Synthetic isolation `BR-05-SYNTHETIC-OVERLAP-QTY-B2B.json` uses runtime-injected overlap total; no CETECH precedence algorithm. Live **PERMISSION_REQUIRED**. | SYNTHETIC_ISOLATION; live BLOCKED |
| Relevant tax/exemption/rounding | Actual Woo checkout | Training tax calc **off** (CP-04): `BR-05-TAX-OFF-TRAINING.json` NOT_APPLICABLE_WITH_EVIDENCE. Tax-on/GRA not configured. | NOT_APPLICABLE_WITH_EVIDENCE (tax-off); tax-on BLOCKED |
| Concurrent distinct buyers | Actual isolated checkout contexts | Nested guest/retail isolation unit tests PASS. Live **PERMISSION_REQUIRED**. | SYNTHETIC_ISOLATION; live BLOCKED |

For each: commit, WP/Woo/PHP/plugin versions, configuration fingerprint, sanitized buyer/product mapping, quantities, expected/actual lines/subtotal/discount/tax/total, observed precedence, timestamp/reviewer. Unconfigured cases need evidenced applicability approval; never mark untested rows PASS. Any unexplained difference blocks G2.
