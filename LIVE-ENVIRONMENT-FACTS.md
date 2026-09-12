# Live environment facts

Updated 2026-09-12. Evidence levels matter: **user-reported Site Health** means the user supplied the field/value and check date; the underlying report and staging runtime were not independently inspected in this repair. **USER-CONFIRMED** records an explicit human statement. **VERIFIED** means this repository captured a live connector or public read-only probe. Design assumptions do not fill unknown cells.

WS3 coordinates CP-04; WS2 may contribute Woo/public intake on WS2-owned paths. Preserve checked-by, UTC date and redacted evidence for subsequent checks. The supplied staging versions do not prove pricing parity, plugin compatibility, production versions or deployment readiness. No plugins were activated, upgraded or removed. CP-04 2026-09-12 public audit: `docs/integration/evidence/CP-04-LIVE-AUDIT.md` (PARTIAL / BLOCKED; no write tests).

| Field | Value | Checked by / date / evidence |
| --- | --- | --- |
| WordPress version | 7.1 | VERIFIED 2026-09-12 14:10 UTC @wbdevworld: public generator meta `WordPress 7.1` on `https://training.cetechbpa.com/` and `/shop/`. Previously user-reported Site Health 2026-09-12. |
| WooCommerce version | 11.1.0 | USER-REPORTED Site Health 2026-09-12. Independent 2026-09-12: `wc/v3` + Store API namespaces VERIFIED present; version string not in public index → version remains USER-REPORTED. |
| WoodMart version | 8.5.7; active Woodmart Child 1.0.0 | USER-REPORTED Site Health 2026-09-12. Independent 2026-09-12: `woodmart` string VERIFIED in staging HTML; numeric version not independently read. |
| B2BKing version | B2BKing Core 5.2.50 | User-reported Site Health, 2026-09-12; report lists 5.2.60 available. No upgrade performed. Not independently re-listed. |
| VitePOS version | Active Vitepos – Point of Sale 3.5.1; VitePOS Pro 3.6.0 installed but inactive | USER-REPORTED Site Health 2026-09-12. Independent 2026-09-12: `vitepos/v1` namespace and `/vitepos/` UI VERIFIED present; version string not in public settings payload. Installed/inactive does not mean executing. |
| PHP version | 8.5.9 64-bit | User-reported Site Health, 2026-09-12: php_version 8.5.9 64bit. Not visible on public HTML/REST. |
| HPOS enabled | BLOCKED | 2026-09-12 14:12 UTC @wbdevworld: Woo settings/system_status 401; no WP-CLI. Site Health checks reportedly pass; enabled/current authoritative order storage is not identified. See CP-04-LIVE-AUDIT.md. |
| Woo stock management | BLOCKED | 2026-09-12: unauthenticated `GET /wp-json/wc/v3/settings/general` = 401. Store API `is_in_stock` is display only. |
| Backorders configuration | BLOCKED | 2026-09-12: no authenticated Woo inventory settings; catalog not exported. |
| VitePOS stock mode — Woo single stock | UNVERIFIED / not claimed | 2026-09-12 public VitePOS settings: `stockable=N`. Vendor docs require enabling Full Stock Management before Woo-single vs outlet-multi. Consistent with outlet-stock not enabled; Woo `manage_stock` still BLOCKED. |
| VitePOS stock mode — outlet/multi-stock | Not indicated in public settings (`stockable=N`) | 2026-09-12 @wbdevworld: public VitePOS `basic_settings.stockable=N`. Outlet maps BLOCKED (no login). |
| VitePOS offline pending queue | Configured `offline_order_status=N`; runtime behavior BLOCKED | 2026-09-12 public VitePOS settings + `/vitepos/` HTML contains offline/pending strings. No disconnect/sale test (isolation not proven). |
| Barcode source — SKU/GTIN/product ID/custom meta/VitePOS field | VitePOS barcode field = SKU | VERIFIED 2026-09-12 14:10 UTC @wbdevworld: public `GET /wp-json/vitepos/v1/basic/settings` → `barcode_field=SKU`. Scan no-match / multi-match / variation resolve BLOCKED. Storefront SKU labels VERIFIED separately. |
| Current tax/GRA E-VAT/CIS process | Woo tax BLOCKED; GRA BLOCKED; VitePOS `is_incl_tax=false` | 2026-09-12: Woo tax APIs 401. VitePOS public `is_incl_tax=false`, `tax_method=B` (code meaning UNVERIFIED). Invoice `show_vat_reg=true` with VAT id present — value REDACTED. Not Ghana compliance. |
| Current payments — cash | USER-CONFIRMED in use; VitePOS tender `Cash` (`id=C`, offline) VERIFIED; Woo gateway BLOCKED | User marked method VERIFIED, 2026-09-12. Public FAQ 2026-09-12: cash at offline stores. Woo payment_gateways 401. |
| Current payments — Mobile Money | USER-CONFIRMED in use; public FAQ VERIFIED; technical configuration UNVERIFIED | User marked method VERIFIED, 2026-09-12. Public FAQ/payment-and-delivery: MoMo online (prepaid) and mentioned offline. No VitePOS method titled MoMo. No provider keys inspected. |
| Current payments — card | USER-CONFIRMED in use; public FAQ VERIFIED; Woo gateway BLOCKED | User marked method VERIFIED, 2026-09-12. FAQ: Credit/Debit Card online. VitePOS `Swipe Machine` (`id=S`, offline) is a POS tender label, not a processor. |
| Current payments — other | VitePOS tender `Other` (`id=O`, offline) | VERIFIED as VitePOS configured method 2026-09-12. Mapping to MoMo/other processors UNVERIFIED. |
| Paystack/provider status | Paystack WooCommerce Payment Gateway 5.8.5 installed but inactive; provider account/operational status UNVERIFIED | User-reported Site Health, 2026-09-12. Independent 2026-09-12: Woo payment_gateways 401 so inactive status not re-listed; VitePOS `payment_gws` length 0. |
| Scanner models | UNVERIFIED | No physical inspection. Software barcode field is SKU. |
| Printer models | UNVERIFIED | No physical inspection. VitePOS invoice `page_width=80` is template config only. |
| Cash drawer | UNVERIFIED | No physical inspection. `single_cash_drawer=N` in public VitePOS settings. |
| Payment terminal | UNVERIFIED | No physical inspection. |
| Hosting | Linux / nginx / PHP-FPM (USER-REPORTED); public front door Cloudflare (VERIFIED) | Site Health 2026-09-12 plus 2026-09-12 `Server: cloudflare` on staging and comparison hosts. Provider UNVERIFIED. |
| Staging URL | https://training.cetechbpa.com | VERIFIED reachable 2026-09-12 14:06 UTC @wbdevworld (`curl.exe` HEAD 200; REST `url`/`home` match). Previously user-reported Site Health with `WP_ENVIRONMENT_TYPE=staging` (environment type still not independently readable). |
| Production URL | Public comparison host https://cetechbpa.com is a distinct WordPress app; not proven to be the Woo production operations URL | VERIFIED distinct public identity 2026-09-12 (REST name `CETECH Ghana`, no `wc/v3`/`vitepos` namespaces). Whether it is *the* production shop remains UNVERIFIED. |
| Supabase region/project | UNVERIFIED | UNVERIFIED |
| Deployment platform | UNVERIFIED | UNVERIFIED |
| Known latency | UNVERIFIED | UNVERIFIED |
| Currency and precision | Public Store API + VitePOS settings: GHS, ₵, 2 minor units, `.` / `,` | VERIFIED 2026-09-12 @wbdevworld as public display/settings. Woo admin currency options BLOCKED (401). |
| Fractional-quantity products | Sampled Store API `multiple_of=1`; Woo decimal-qty setting BLOCKED | 2026-09-12 sample of 20 Store API products. Do not infer policy from price decimals. |
| Stock reserve/expiry/reduction behavior | BLOCKED | Woo hold/reduce options unread; no write test. |
| WordPress bridge service identity/capabilities | Absent on host (`cetech-pos` 404) | VERIFIED 2026-09-12 HEAD `/wp-json/cetech-pos/v1/health` 404. Application Passwords advertised on staging REST. |
| Production staff role mapping | UNVERIFIED | UNVERIFIED |
| Cash variance approval policy | UNVERIFIED | UNVERIFIED |
| Current active VitePOS shifts | UNVERIFIED | UNVERIFIED |
| Independent recovery contacts | UNVERIFIED | UNVERIFIED |
| Developer 1 GitHub username | @Ben-001-sys — write access VERIFIED | User assignment plus live GitHub collaborator-permission response, 2026-09-12. |
| Developer 2 GitHub username | @Emmanuel-coder-prog — write access VERIFIED | User assignment plus live GitHub collaborator-permission response, 2026-09-12. |
| Backup technical reviewer | UNVERIFIED | UNVERIFIED |
| Sprint start/end UTC | UNVERIFIED | UNVERIFIED |
| Staging dataset sanitization | BLOCKED | 2026-09-12 public catalog looks like real hardware products (54 Store API items). No sanitization proof. |
| Production invoice owner/signoff | UNVERIFIED | UNVERIFIED |
| Staging isolation vs production writes | NOT PROVEN | 2026-09-12: distinct public hosts/apps VERIFIED; DB/webhooks/payments/stock write isolation BLOCKED. No write tests. See CP-04-LIVE-AUDIT.md. |

Repository observations belong in docs/runbooks/GITHUB-REALITY.md. Unknowns block only dependent work, never unrelated UI/mock foundation work. Repeat the audit via docs/runbooks/CP-04-STAGING-AUDIT.md.
