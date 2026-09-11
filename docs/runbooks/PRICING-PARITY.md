# Pricing parity evidence

WS2 captures Woo checkout and bridge outputs using identical staging cart, buyer/location/tax context and installed configuration. Expected totals come from authoritative runtime, never a manually reimplemented plugin formula. Amount comparison is exact minor units after documented Woo rounding. Quote latency measured with environment/device and p50/p95.

| Scenario | Expected source | Bridge result / evidence | Status |
| --- | --- | --- | --- |
| Walk-in/guest | Actual Woo checkout | UNVERIFIED | BLOCKED |
| Registered retail | Actual Woo checkout | UNVERIFIED | BLOCKED |
| WoodMart below threshold | Actual Woo checkout | UNVERIFIED | BLOCKED |
| WoodMart at threshold | Actual Woo checkout | UNVERIFIED | BLOCKED |
| WoodMart above threshold | Actual Woo checkout | UNVERIFIED | BLOCKED |
| B2BKing group | Actual Woo checkout | UNVERIFIED | BLOCKED |
| B2BKing tier | Actual Woo checkout | UNVERIFIED | BLOCKED |
| Customer-specific terms | Actual Woo checkout | UNVERIFIED | BLOCKED |
| Variations | Actual Woo checkout | UNVERIFIED | BLOCKED |
| WoodMart + B2BKing overlap | Actual Woo checkout | UNVERIFIED | BLOCKED |
| Relevant tax/exemption/rounding | Actual Woo checkout | UNVERIFIED | BLOCKED |
| Concurrent distinct buyers | Actual isolated checkout contexts | UNVERIFIED | BLOCKED |

For each: commit, WP/Woo/PHP/plugin versions, configuration fingerprint, sanitized buyer/product mapping, quantities, expected/actual lines/subtotal/discount/tax/total, observed precedence, timestamp/reviewer. Unconfigured cases need evidenced applicability approval; never mark untested rows PASS. Any unexplained difference blocks G2.
