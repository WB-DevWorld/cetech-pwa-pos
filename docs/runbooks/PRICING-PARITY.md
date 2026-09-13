# Pricing parity evidence

WS2 captures Woo checkout and bridge outputs using identical staging cart, buyer/location/tax context and installed configuration. Expected totals come from authoritative runtime, never a manually reimplemented plugin formula. Amount comparison is exact minor units after documented Woo rounding. Isolated POS quotes exclude storefront shipping because v1 Quote has no shipping field.

Live capture 2026-09-13T17:02:00Z on training, plugin `0.2.3-br02`. Details: [R3-TRAINING-LIVE.md](../integration/evidence/R3-TRAINING-LIVE.md). `pricingParityVerified` remains false. R3 gate NOT PASSED.

| Scenario | Expected source | Bridge result / evidence | Status |
| --- | --- | --- | --- |
| Walk-in/guest | Actual Woo add_to_cart | Synthetic `BR-02-GUEST-SIMPLE.json`. Live: B2BKing disables guest purchasable; `BR-02-LIVE-GUEST-REFUSAL.json` REFUSAL_MATCH (400 VALIDATION_ERROR). | SYNTHETIC_ISOLATION PASS; live REFUSAL_MATCH (not priced) |
| Registered retail | Actual Woo isolated cart | Synthetic `BR-02-RETAIL-SIMPLE.json`. Live qty 1: 4000/4000 exact `BR-02-LIVE-RETAIL-SIMPLE.json`. | SYNTHETIC + LIVE MATCH_EXACT |
| WoodMart below threshold | Actual Woo | Synthetic isolation plus live qty 19 / from-qty 20: `BR-03-LIVE-QTY-BELOW.json` unit 4000. | LIVE MATCH_EXACT |
| WoodMart at threshold | Actual Woo | Live qty 20: unit 3800 subtotal 76000 `BR-03-LIVE-QTY-AT.json`. | LIVE MATCH_EXACT |
| WoodMart above threshold | Actual Woo | Live qty 21: unit 4000 `BR-03-LIVE-QTY-ABOVE.json` (empty to-qty; runtime does not keep qty-20 unit). | LIVE MATCH_EXACT |
| B2BKing group | Actual Woo | Synthetic `BR-04-SYNTHETIC-B2B-GROUP.json`. Live B2B qty 1 exact 4000 `BR-04-LIVE-B2BKING-PENDING.json`. Distinct vs retail not observed on this cart. Unauthorized kind switch 403. | LIVE MATCH_EXACT (no distinct group total on this cart) |
| B2BKing tier / min-max / tax exemption | Actual Woo | Published rules are cart_total discount_percentage only. `BR-04-UNCONFIGURED-TYPES.json`. | NOT_APPLICABLE_WITH_EVIDENCE |
| Customer-specific terms | Actual Woo | Not used as a fixture; no PII edits. | NOT_APPLICABLE_WITH_EVIDENCE |
| Variations | Actual Woo | Live retail variation unit 20000 qty 1/2 `BR-02-LIVE-VARIATION.json`. | LIVE MATCH_EXACT |
| WoodMart + B2BKing overlap | Actual Woo | Retail qty 20 WoodMart applies; B2B qty 20 does not. `BR-05-LIVE-OVERLAP-PENDING.json`. | LIVE MATCH_EXACT |
| Relevant tax/exemption/rounding | Actual Woo | Training tax calc **off**: `BR-05-TAX-OFF-TRAINING.json`. | NOT_APPLICABLE_WITH_EVIDENCE (tax-off); tax-on BLOCKED |
| Concurrent distinct buyers | Isolated unit tests | Nested guest/retail isolation unit tests PASS. Live concurrent not run. | SYNTHETIC_ISOLATION; live not run |

Unexplained minor-unit difference: none on the captured matrix. Guest priced path absent. B2BKing cart_total effect not seen through qty 21. Tax-on unconfigured. Gate remains **NOT PASSED**.
