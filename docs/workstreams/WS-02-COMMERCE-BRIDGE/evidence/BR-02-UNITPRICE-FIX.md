# BR-02 QuoteLine unitPrice defect — local remediation

UTC: 2026-09-13T16:06:08Z start; tests after the production mapping fix.
Task: BR-02 continuation / issue #14 (bounded defect only)
Branch: `batch/r3-authoritative-pricing-parity`
Draft PR: #44
Plugin version after fix: `0.2.1-br02`
Prior plugin on this branch: `0.2.0-br02` contained the defective mapper.

## Defect (do not erase)

Production `Cetech_Pos_Bridge_Woo_Runtime::map_cart_item()` obtained quantity and `line_subtotal`, then `unit_price_string($subtotal, $qty)` returned the **subtotal for every quantity**. A quantity-5 cart item with authoritative per-unit `9.00` and subtotal `45.00` could emit `unitPrice = 45.00` instead of `9.00`. That violates frozen v1: UnitPrice is the display-rounded authoritative per-unit price; line identity is `total = subtotal - discount + tax`. Do not use `unitPrice × quantity` as line-total authority.

The original BR-02 checkpoint (`BR-02-ISOLATED-QUOTE.md`) and fake-runtime tests did not catch this because `Cetech_Pos_Bridge_Fake_Woo_Runtime` injects `unitPrice` and never calls production `map_cart_item()`.

## Fix

- Read the current per-unit price from the priced cart item's product `get_price()` after Woo pricing hooks.
- Convert only through `Cetech_Pos_Bridge_Money` (no binary float, no subtotal÷quantity).
- Missing/invalid/non-string unit price: `INTEGRATION_UNAVAILABLE`; `get_priced_cart()` propagates the error. No `"0"` or subtotal fallback.
- No WoodMart/B2BKing formulas. Frozen contracts unchanged.

## Tests (this workstation)

PHP 8.5.0. GNU Make **not available** — `make -C wordpress/cetech-pos-bridge check|test|parity` is **BLOCKED**, not PASS.

| Command | Exit | Result |
| --- | --- | --- |
| `python scripts/verify_control_plane.py` | 0 | PASS foundation |
| `python -m unittest discover -s tests/tooling -v` | 0 | 48 OK |
| `php -l` on changed PHP sources | 0 | PASS |
| `php tests/bridge/run.php` | 0 | **174 passed, 0 failed** |
| `php tests/bridge/parity.php` | 0 | **108 passed, 0 failed, 4 skipped** |
| `git diff --check` | 0 | PASS |

Do not reuse prior 151/59 or R2 83 counts as proof of this tree.

Production mapping regressions in `tests/bridge/test-woo-runtime.php`: qty 5 → unit 900 / subtotal 4500; qty 1; variation; fractional 2.5; fail-closed missing/empty/float price.

## Classification

BR-02 local mapping: defect **corrected locally**.
BR-02 live training: **PERMISSION_REQUIRED**. Not live-complete.
BR-03/04/05: still live-gated. `pricingParityVerified` **false**.
Training deployment: **NOT PERFORMED**.
