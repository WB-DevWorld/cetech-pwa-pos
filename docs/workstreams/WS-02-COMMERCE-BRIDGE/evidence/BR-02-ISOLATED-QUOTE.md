# BR-02 isolated Woo runtime quote — checkpoint

UTC: 2026-09-13 (session after R3 activation `da73928`)
Task: BR-02 / issue #14
Branch: `batch/r3-authoritative-pricing-parity`
Plugin version: `0.2.0-br02`

## Behavior

- `POST /wp-json/cetech-pos/v1/quotes` requires the same dedicated capability as health.
- Isolated Woo cart/session/customer context; `calculate_totals()` is the pricing engine.
- Snapshot/restore in `finally`, including on exception.
- Frozen v1 Quote normalization. No WoodMart/B2BKing formula copy.
- No Woo order, stock, payment, or mail side effects in the quote path.
- `pricingParityVerified` remains false.

## Tests

PHP 8.5.0 at `C:\tools\php85\php.exe`. GNU Make was **not on PATH** in this session (`make` command missing; Chocolatey install of make 4.4.1 failed without elevation). Makefile targets exist. Equivalent commands that the Makefile invokes:

| Command | Exit | Result |
| --- | --- | --- |
| `python scripts/verify_control_plane.py` | 0 | PASS foundation |
| `php -l` on plugin + `tests/bridge` sources | 0 | PASS |
| `php tests/bridge/run.php` | 0 | **131 passed, 0 failed** |
| `php tests/bridge/parity.php` | 0 | **22 passed, 0 failed, 3 permission-required/skipped**. Not a pricing-gate PASS. |
| `python -m unittest discover -s tests/tooling -v` | 0 | 48 tests OK |
| `git diff --check` | 0 | PASS |

Do not treat the PHP-equivalent run as a substitute if a reviewer requires the exact `make -C` driver on a machine with GNU Make.

## Live training

- Host `https://training.cetechbpa.com` still serves BR-01 health plugin.
- `GET /wp-json/cetech-pos/v1/quotes` → `rest_no_route` (normalized). No R3 quote endpoint deployed.
- R2 W4 grant does not cover this plugin mutation. Live quote/parity: **PERMISSION_REQUIRED**.
- Public Store API products GET is read-only 200 (54 items). No cart POST, no order, no stock, no payment, no catalog dump committed.

## Classification

BR-02 local isolated quoting: **COMPLETE** (local/mock + synthetic isolation).
BR-02 live guest/retail against training Woo: **PERMISSION_REQUIRED**.
WoodMart/B2BKing live parity: not claimed.
