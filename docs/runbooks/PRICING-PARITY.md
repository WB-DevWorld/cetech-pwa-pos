# Pricing parity evidence

WS2 captures Woo checkout and bridge outputs using identical staging cart, buyer/location/tax context and installed configuration. Expected totals come from authoritative runtime, never a manually reimplemented plugin formula. Amount comparison is exact minor units after documented Woo rounding. Isolated POS quotes exclude storefront shipping because v1 Quote has no shipping field.

Live capture 2026-09-13T18:06:43Z on training plugin `0.2.6-br02` (single-line matrix). Multi-line ADR-013 capture 2026-09-13T18:58:36Z on `0.2.7-br02`: [R3-CART-DISCOUNT.md](../integration/evidence/R3-CART-DISCOUNT.md). Single-line regression on `0.2.7-br02` at 2026-09-13T19:02:19Z matched the prior matrix. `pricingParityVerified` remains **false**. Training R3 gate **PASS candidate** pending independent review of ADR-013.

| Scenario | Expected source | Bridge result / evidence | Status |
| --- | --- | --- | --- |
| Walk-in/guest | Actual Woo add_to_cart | Synthetic `BR-02-GUEST-SIMPLE.json`. Live: B2BKing disables guest purchasable; `BR-02-LIVE-GUEST-REFUSAL.json` REFUSAL_MATCH (400 VALIDATION_ERROR). | SYNTHETIC_ISOLATION PASS; live REFUSAL_MATCH (not priced) |
| Registered retail | Actual Woo isolated cart | Synthetic `BR-02-RETAIL-SIMPLE.json`. Live qty 1: 4000/4000 exact `BR-02-LIVE-RETAIL-SIMPLE.json`. | SYNTHETIC + LIVE MATCH_EXACT |
| WoodMart below threshold | Actual Woo | Live qty 19 / from-qty 20: `BR-03-LIVE-QTY-BELOW.json` unit 4000. | LIVE MATCH_EXACT |
| WoodMart at threshold | Actual Woo | Live qty 20: unit 3800 subtotal 76000 `BR-03-LIVE-QTY-AT.json`. | LIVE MATCH_EXACT |
| WoodMart above threshold | Actual Woo | Live qty 21: unit 3800 total 79800 `BR-03-LIVE-QTY-ABOVE.json` (fresh process; empty to-qty). | LIVE MATCH_EXACT |
| B2BKing group sale | Actual Woo | Live B2B qty 1 unit 3400 `BR-04-LIVE-B2BKING-PENDING.json`. Unauthorized kind switch 403. | LIVE MATCH_EXACT |
| B2BKing cart-total | Actual Woo | Qty 9/10/20 plus multi-line 3+7 / 13+7: `BR-04-LIVE-CART-TOTAL-*.json`, `BR-04-LIVE-MULTILINE-CART-DISCOUNT.json`, `BR-04-LIVE-MULTILINE-SEVEN-PERCENT.json`. ADR-013 allocation of negative Woo fee. | LIVE MATCH_EXACT |
| B2BKing cart-total remainder | Actual Woo | Configured 5%/7% on these bases leftover 0. `BR-04-LIVE-MULTILINE-REMAINDER.json`. Uneven leftover is a production-runtime test. | NOT_APPLICABLE_WITH_EVIDENCE |
| B2BKing tier / min-max / tax exemption | Actual Woo | Published rules are cart_total discount_percentage only. `BR-04-UNCONFIGURED-TYPES.json`. | NOT_APPLICABLE_WITH_EVIDENCE |
| Customer-specific terms | Actual Woo | Not used as a fixture; no PII edits. | NOT_APPLICABLE_WITH_EVIDENCE |
| Variations | Actual Woo | Live retail variation unit 20000 qty 1/2 `BR-02-LIVE-VARIATION.json`. | LIVE MATCH_EXACT |
| WoodMart + B2BKing overlap | Actual Woo | Retail qty 20 WoodMart 76000; B2B qty 20 group+cart-total 63240. `BR-05-LIVE-OVERLAP-PENDING.json`. One-cart WoodMart+fee: `BR-05-LIVE-MULTILINE-OVERLAP.json` N/A. | LIVE MATCH_EXACT (separate contexts); one-cart N/A WITH EVIDENCE |
| Relevant tax/exemption/rounding | Actual Woo | Training tax calc **off**: `BR-05-TAX-OFF-TRAINING.json`. | NOT_APPLICABLE_WITH_EVIDENCE (tax-off) |
| Concurrent distinct buyers | Actual HTTP POST /quotes | 12/12 pairs; retail 40000 vs B2B 32300; crossover 0. `BR-02-LIVE-CONCURRENT.json`. | LIVE VERIFIED |

Unexplained minor-unit difference: **0** on the captured matrix including multi-line ADR-013 allocation. Guest priced path absent by configuration (REFUSAL_MATCH). Tax-on unconfigured. Health field `pricingParityVerified` stays false.
