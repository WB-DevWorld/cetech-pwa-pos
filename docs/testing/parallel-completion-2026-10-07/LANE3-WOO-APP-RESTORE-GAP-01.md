# Lane 3 — Woo application restore gap (extend successful DB capture)

Status: **DB restore ACCEPTED · files partial · full WP boot NOT RUN**  
Cutoff DB: `20261009T062133Z` · WP core **7.1.2** (training read 2026-10-09)  
Staff-documentation impact: **NONE** · no hosted rewrite · raw dumps stay private

## Accepted (carry forward)

| Artifact | Identity |
| --- | --- |
| Named MariaDB target | `cetech-pos-r10-woo-20261009` · `127.0.0.1:3310` · MariaDB 11.4 |
| DB dump | `…T062133Z.sql.gz` · 15,517,138 B · SHA-256 `575b1e102f077eca479e8adf946fb213aab781fd40b23a41e27c489ff33ecf61` |
| SQL checks | order **50317**; stock **49111=3**; **49663=1** / price **12500** / backorders off |
| Partial files tarball (host) | `…-woo-files-…T062133Z.tgz` · 197,224,227 B · SHA-256 `58093638eb2d866506312a6fb4811fb8b873e50c9e6301d3f86975bd34feff78` |
| Private local copy | `%LOCALAPPDATA%\CETECH-POS-R10\cetech-pos-r10-woo-20261009\` — SHA-256 **matches** host (`58093638…`) |
| Partial files contents | `wp-config.php` + `cetech-pos-bridge` + uploads tree only — **not** complete WordPress |

## Version fingerprint (training live, for reproducible completion)

| Piece | Version / note |
| --- | --- |
| WordPress | **7.1.2** |
| Active theme | `woodmart-child` **1.0.0** (parent `woodmart` **8.6.2**) |
| WooCommerce | **11.1.2** |
| POS bridge | `cetech-pos-bridge` **0.6.0-stg05** (also in partial tarball) |
| Paystack | `woo-paystack` **5.8.5** |
| B2BKing | `b2bking` **5.6.50** + wholesale **5.2.60** |
| Delivery Engine | `cetech-woocommerce-delivery-engine` **1.0.0-dev.attention-count.1** |
| Woodmart core | `woodmart-core` **1.1.9** |
| MU plugins present | `cetech-training-safety.php`, CP-04 mail containment, VitePOS guards, WP Rocket guards, etc. (11 files under `mu-plugins/`) |
| Drop-ins | none listed at capture time |

Full active plugin list recorded in operator session log (do not treat this doc as a license redistributor).

## How to obtain exact remaining bytes (without re-dumping DB)

1. Keep existing SQL.gz — **do not** re-export the whole database solely for app boot.
2. On training (read-only archive), create a **second** files archive that includes at least:
   - `wp-admin/`, `wp-includes/`, root WP PHP files matching 7.1.2
   - `wp-content/themes/woodmart` + `woodmart-child`
   - `wp-content/plugins/` (all active plugins above)
   - `wp-content/mu-plugins/`
   - Exclude secrets from handoff; keep `wp-config.php` private only
3. Or install WP 7.1.2 + listed plugin/theme versions from licensed sources, then overlay the existing partial tarball (bridge + uploads + private config) and import the accepted SQL.
4. Copy archives only into `%LOCALAPPDATA%\CETECH-POS-R10\cetech-pos-r10-woo-20261009\` (never GitHub).

## Before any restored WP boot

- Outbound isolation (not just loopback publish ports).
- Disable cron, mail, webhooks, payment dispatch, external integrations.
- Point DB only at local `127.0.0.1:3310`; do **not** boot a copied `wp-config.php` that still targets training.
- POS/bridge read-only checks: load bridge, order 50317, stocks 49111/49663 — no new order/payment/stock mutation.

## Remaining after this note

| Item | Status |
| --- | --- |
| Full WP application boot against restored DB | **NOT RUN** — missing core/themes/plugins package |
| POS staging dump/import | **BLOCKED** — needs operator DB password (see POS credential action) |
