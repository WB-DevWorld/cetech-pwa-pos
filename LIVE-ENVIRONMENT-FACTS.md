# Live environment facts

**CP-04 DEVELOPMENT BASELINE: SATISFIED. CP-04 WRITE-SAFETY / CUTOVER: OPEN / DEFERRED for production and for training order/stock/tender writes.** Training is the development reference under [ADR-011](docs/decisions/ADR/011.md). W1/W4 training gates are historical PASS (PR #43) with 2026-09-15 CURRENT_PASS freshness. [Remaining actions and production deltas](docs/runbooks/CP-04-REMAINING-WORK.md). Missing production access does not block unrelated local implementation.

Updated 2026-09-15 for R6 CP-04 freshness (SSH/WP-CLI + public HTTPS). Earlier cells remain 2026-09-12 unless a cell says otherwise. Evidence levels matter: **user-reported Site Health** means the user supplied the field/value and check date; the underlying report and staging runtime were not independently inspected in this repair. **USER-CONFIRMED** records an explicit human statement. **VERIFIED** means repository evidence records a live connector, public probe or attributed authenticated read; see each cell for the actual method and observer. Design assumptions do not fill unknown cells.

WS3 coordinates CP-04; WS2 may contribute Woo/public intake on WS2-owned paths. Preserve checked-by, UTC date and redacted evidence for subsequent checks. The supplied staging versions do not prove pricing parity, plugin compatibility, production versions or deployment readiness. No plugins were activated, upgraded or removed. CP-04 2026-09-12 public audit: `docs/integration/evidence/CP-04-LIVE-AUDIT.md`. Authenticated WP-CLI continuation: `docs/integration/evidence/CP-04-AUTHENTICATED-AUDIT.md` (historical audit determination preserved; development gating subsequently revised by ADR-011; no new write tests).

| Field | Value | Checked by / date / evidence |
| --- | --- | --- |
| WordPress version | 7.1 | VERIFIED 2026-09-12 14:10 UTC @wbdevworld: public generator meta `WordPress 7.1` on `https://training.cetechbpa.com/` and `/shop/`. Previously user-reported Site Health 2026-09-12. |
| WooCommerce version | 11.1.0 active | VERIFIED 2026-09-12 16:12 UTC @wbdevworld WP-CLI plugin list + `WC_VERSION` on training origin. Previously USER-REPORTED Site Health. |
| WoodMart version | 8.5.7 parent; Woodmart Child 1.0.0 active; Woodmart Core 1.1.8 active | VERIFIED 2026-09-12 16:12 UTC @wbdevworld WP-CLI theme/plugin list. Previously USER-REPORTED / HTML string only. |
| B2BKing version | B2BKing Core 5.2.50 active; B2BKing Pro 5.6.30 active | VERIFIED 2026-09-12 16:12 UTC @wbdevworld WP-CLI. Earlier Site Health listed Core 5.2.50 only. |
| VitePOS version | Vitepos Lite 3.5.1 **active**; VitePOS Pro 3.6.0 installed **inactive** | VERIFIED 2026-09-12 16:12 UTC @wbdevworld WP-CLI. Matches earlier USER-REPORTED installed/inactive Pro. |
| PHP version | Web/FPM 8.5.9; CLI 8.4.24 | VERIFIED 2026-09-12 16:14 UTC @wbdevworld: site FPM pool under `php/8.5`; `php-fpm8.5 -v` = 8.5.9. CLI `php -v` = 8.4.24. Site Health 8.5.9 matches FPM, not CLI. |
| HPOS enabled | yes; authoritative custom orders table; compatibility data-sync **off** | VERIFIED 2026-09-12 16:12 UTC @wbdevworld: `OrderUtil::custom_orders_table_usage_is_enabled()` = HPOS_ENABLED; `woocommerce_custom_orders_table_enabled=yes`; `woocommerce_custom_orders_table_data_sync_enabled=no`. |
| Woo stock management | global `woocommerce_manage_stock=yes`; hold-stock 60 minutes | VERIFIED 2026-09-12 16:12 UTC @wbdevworld WP-CLI options. Reduction-on-payment runtime still not write-tested. |
| Backorders configuration | product-meta `_backorders=no` for 154 rows; no other values | VERIFIED 2026-09-12 16:12 UTC @wbdevworld aggregate query. Still product-level, not a single global switch. |
| VitePOS stock mode — Woo single stock | Woo manage-stock yes **and** public VitePOS `stockable=N` | VERIFIED combination 2026-09-12. Do not claim VitePOS outlet-multi is executing. |
| VitePOS stock mode — outlet/multi-stock | 2 active GH warehouses/outlets (one main); 2 counters mapped 1:1; public `stockable=N` | VERIFIED 2026-09-12 16:14 UTC @wbdevworld table counts/flags only (names/contact fields redacted). Full-stock/outlet-stock execution still not claimed. |
| VitePOS offline pending queue | Configured `offline_order_status=N`; runtime behavior BLOCKED | 2026-09-12 public VitePOS settings + `/vitepos/` HTML contains offline/pending strings. No disconnect/sale test (isolation not proven). |
| Barcode source — SKU/GTIN/product ID/custom meta/VitePOS field | VitePOS barcode field = SKU | VERIFIED 2026-09-12 14:10 UTC @wbdevworld: public `GET /wp-json/vitepos/v1/basic/settings` → `barcode_field=SKU`. Scan no-match / multi-match / variation resolve BLOCKED. Storefront SKU labels VERIFIED separately. |
| Current tax/GRA E-VAT/CIS process | Woo tax calc **off**, 0 rates; GRA BLOCKED; VitePOS public `is_incl_tax=false` | VERIFIED 2026-09-12 16:12 UTC @wbdevworld: `woocommerce_calc_taxes=no`, prices excl, 0 tax-rate rows. GRA/E-VAT/CIS still BLOCKED. Not Ghana compliance. |
| Current payments — cash | USER-CONFIRMED in use; VitePOS tender `Cash` VERIFIED; Woo `cod` **enabled** | VERIFIED 2026-09-12 16:12 UTC @wbdevworld runtime gateway `cod\|yes`. |
| Current payments — Mobile Money | USER-CONFIRMED operationally; public FAQ VERIFIED; **no enabled Woo MoMo gateway** | 2026-09-12 16:12 UTC @wbdevworld: runtime Woo gateways are invoice + COD only. Processor still UNVERIFIED. Keys not read. |
| Current payments — card | USER-CONFIRMED operationally; public FAQ VERIFIED; **no enabled Woo card gateway**; Paystack plugin inactive | 2026-09-12 16:12 UTC @wbdevworld. VitePOS `Swipe Machine` remains a tender label. Keys not read. |
| Current payments — other | VitePOS tender `Other` (`id=O`, offline) | VERIFIED as VitePOS configured method 2026-09-12. Mapping to MoMo/other processors UNVERIFIED. |
| Paystack/provider status | Paystack WooCommerce Payment Gateway 5.8.5 installed **inactive**; not in runtime gateway list | VERIFIED 2026-09-12 16:12 UTC @wbdevworld WP-CLI. Provider account/keys not inspected. |
| Scanner models | UNVERIFIED | No physical inspection. Software barcode field is SKU. |
| Printer models | UNVERIFIED | No physical inspection. VitePOS invoice `page_width=80` is template config only. |
| Cash drawer | UNVERIFIED | No physical inspection. `single_cash_drawer=N` in public VitePOS settings. |
| Payment terminal | UNVERIFIED | No physical inspection. |
| Hosting | Linux / nginx / PHP-FPM (USER-REPORTED); public front door Cloudflare (VERIFIED) | Site Health 2026-09-12 plus 2026-09-12 `Server: cloudflare` on staging and comparison hosts. Provider UNVERIFIED. |
| Staging URL | https://training.cetechbpa.com | VERIFIED public 2026-09-12 14:06 UTC. Authenticated 2026-09-12 16:12 UTC @wbdevworld: `home`/`siteurl` match; operator-identified SSH origin hostname `cetechtrainingappserver`; `WP_ENVIRONMENT_TYPE=staging` VERIFIED. |
| Production URL | Public comparison host https://cetechbpa.com is a distinct WordPress app; not proven to be the Woo production operations URL | VERIFIED distinct public identity 2026-09-12 (REST name `CETECH Ghana`, no `wc/v3`/`vitepos` namespaces). Whether it is *the* production shop remains UNVERIFIED. |
| Supabase region/project | UNVERIFIED | UNVERIFIED |
| Deployment platform | UNVERIFIED | UNVERIFIED |
| Known latency | UNVERIFIED | UNVERIFIED |
| Currency and precision | Admin + public: GHS, 2 decimals, left, `.` / `,` | VERIFIED 2026-09-12 16:12 UTC @wbdevworld Woo options `woocommerce_currency=GHS`, `woocommerce_price_num_decimals=2`. Matches earlier public Store API. |
| Fractional-quantity products | Sampled Store API `multiple_of=1`; Woo decimal-qty setting BLOCKED | 2026-09-12 sample of 20 Store API products. Do not infer policy from price decimals. |
| Stock reserve/expiry/reduction behavior | hold-stock 60 minutes VERIFIED; reduction-on-payment runtime BLOCKED | 2026-09-12 16:12 UTC @wbdevworld `woocommerce_hold_stock_minutes=60`. No write test. |
| WordPress bridge service identity/capabilities | Historical W4 PASS (PR #43). Current: plugin `0.2.7-br02` active; user `cetech-pos-bridge-svc` ID 22 subscriber; `cetech_pos_bridge_access` only; App Password label `cetech-pos-bff-r2-health`. Anonymous health 401; authenticated health 200 healthy. BR-07 sale routes **not** installed. | HISTORICAL PASS 2026-09-13 `67ea42ce…` / `edf24af…`. CURRENT_PASS identity/health 2026-09-15 @wbdevworld WP-CLI + on-host authenticated GET (secret not displayed/rotated). Routes: `/health`, `/quotes` only — DRIFTED vs R6 `0.4.0-br07`. |
| Production staff role mapping | UNVERIFIED | UNVERIFIED |
| Cash variance approval policy | UNVERIFIED | UNVERIFIED |
| Current active VitePOS shifts | UNVERIFIED | UNVERIFIED |
| Independent recovery contacts | UNVERIFIED | UNVERIFIED |
| Developer 1 GitHub username | @Ben-001-sys — write access VERIFIED | User assignment plus live GitHub collaborator-permission response, 2026-09-12. |
| Developer 2 GitHub username | @Emmanuel-coder-prog — write access VERIFIED | User assignment plus live GitHub collaborator-permission response, 2026-09-12. |
| Backup technical reviewer | UNVERIFIED | UNVERIFIED |
| Sprint start/end UTC | UNVERIFIED | UNVERIFIED |
| Staging dataset sanitization | BLOCKED / not proven sanitized | 2026-09-12 public catalog 54 items. Authenticated counts: 20 users, 12 customer-capability rows, 51 HPOS orders. No PII exported. |
| Production invoice owner/signoff | UNVERIFIED | UNVERIFIED |
| Staging isolation vs production writes | NOT PROVEN vs production. Training outbound mail currently contained | 2026-09-12: MailPoet active / `admin_email` domain `cetechbpa.com` → UNSAFE (historical). 2026-09-13 W1 apply PASS (`af7e2a2…`). 2026-09-15 CURRENT_PASS: MailPoet inactive; notify domains `training.invalid`; W1 MU present; webhooks 0; mailq empty. Production fingerprint still unavailable. See R6-CP04-CHRONOLOGY.md. |

Repository observations belong in docs/runbooks/GITHUB-REALITY.md. Unknowns block only dependent operations, never unrelated local implementation or synthetic tests. Repeat the audit via docs/runbooks/CP-04-STAGING-AUDIT.md.
