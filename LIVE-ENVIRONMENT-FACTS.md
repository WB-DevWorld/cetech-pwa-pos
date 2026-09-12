# Live environment facts

Updated 2026-09-12. Evidence levels matter: **user-reported Site Health** means the user supplied the field/value and check date; the underlying report and staging runtime were not independently inspected in this repair. **USER-CONFIRMED** records an explicit human statement. **VERIFIED through GitHub** means a live connector response was inspected. Design assumptions do not fill unknown cells.

WS3 coordinates CP-04; WS2 obtains Woo evidence. Preserve checked-by, UTC date and redacted evidence for subsequent checks. The supplied staging versions do not prove pricing parity, plugin compatibility, production versions or deployment readiness. No plugins were activated, upgraded or removed.

| Field | Value | Checked by / date / evidence |
| --- | --- | --- |
| WordPress version | 7.1 | User-reported Site Health, 2026-09-12: wp-core version 7.1. |
| WooCommerce version | 11.1.0 | User-reported Site Health, 2026-09-12: active WooCommerce 11.1.0. |
| WoodMart version | 8.5.7; active Woodmart Child 1.0.0 | User-reported Site Health, 2026-09-12: parent and child theme versions. |
| B2BKing version | B2BKing Core 5.2.50 | User-reported Site Health, 2026-09-12; report lists 5.2.60 available. No upgrade performed. |
| VitePOS version | Active Vitepos – Point of Sale 3.5.1; VitePOS Pro 3.6.0 installed but inactive | User-reported Site Health, 2026-09-12. Installed/inactive does not mean executing. |
| PHP version | 8.5.9 64-bit | User-reported Site Health, 2026-09-12: php_version 8.5.9 64bit. |
| HPOS enabled | UNVERIFIED | Site Health checks reportedly pass; enabled/current authoritative order storage is not explicitly identified. |
| Woo stock management | UNVERIFIED | UNVERIFIED |
| Backorders configuration | UNVERIFIED | UNVERIFIED |
| VitePOS stock mode — Woo single stock | UNVERIFIED | UNVERIFIED |
| VitePOS stock mode — outlet/multi-stock | UNVERIFIED | UNVERIFIED |
| VitePOS offline pending queue | UNVERIFIED | UNVERIFIED |
| Barcode source — SKU/GTIN/product ID/custom meta/VitePOS field | UNVERIFIED | UNVERIFIED |
| Current tax/GRA E-VAT/CIS process | UNVERIFIED | UNVERIFIED |
| Current payments — cash | USER-CONFIRMED in use; technical configuration UNVERIFIED | User marked method VERIFIED, 2026-09-12; supplied evidence also says gateway configuration not shown. No independent gateway/settlement verification. |
| Current payments — Mobile Money | USER-CONFIRMED in use; technical configuration UNVERIFIED | User marked method VERIFIED, 2026-09-12; supplied evidence also says gateway configuration not shown. No independent gateway/settlement verification. |
| Current payments — card | USER-CONFIRMED in use; technical configuration UNVERIFIED | User marked method VERIFIED, 2026-09-12; supplied evidence also says gateway configuration not shown. No independent gateway/settlement verification. |
| Current payments — other | UNVERIFIED | UNVERIFIED |
| Paystack/provider status | Paystack WooCommerce Payment Gateway 5.8.5 installed but inactive; provider account/operational status UNVERIFIED | User-reported Site Health, 2026-09-12: inactive plugins list. No active checkout/provider integration proved. |
| Scanner models | UNVERIFIED | UNVERIFIED |
| Printer models | UNVERIFIED | UNVERIFIED |
| Cash drawer | UNVERIFIED | UNVERIFIED |
| Payment terminal | UNVERIFIED | UNVERIFIED |
| Hosting | Linux / nginx / PHP-FPM; provider UNVERIFIED | User-reported Site Health, 2026-09-12: Linux 6.8.0-138-generic; nginx 1.30.4; PHP-FPM. |
| Staging URL | https://training.cetechbpa.com | User-reported Site Health, 2026-09-12: WP_HOME, WP_SITEURL and WP_ENVIRONMENT_TYPE=staging. Not independently probed. |
| Production URL | UNVERIFIED | UNVERIFIED |
| Supabase region/project | UNVERIFIED | UNVERIFIED |
| Deployment platform | UNVERIFIED | UNVERIFIED |
| Known latency | UNVERIFIED | UNVERIFIED |
| Currency and precision | UNVERIFIED | UNVERIFIED |
| Fractional-quantity products | UNVERIFIED | UNVERIFIED |
| Stock reserve/expiry/reduction behavior | UNVERIFIED | UNVERIFIED |
| WordPress bridge service identity/capabilities | UNVERIFIED | UNVERIFIED |
| Production staff role mapping | UNVERIFIED | UNVERIFIED |
| Cash variance approval policy | UNVERIFIED | UNVERIFIED |
| Current active VitePOS shifts | UNVERIFIED | UNVERIFIED |
| Independent recovery contacts | UNVERIFIED | UNVERIFIED |
| Developer 1 GitHub username | @Ben-001-sys — write access VERIFIED | User assignment plus live GitHub collaborator-permission response, 2026-09-12. |
| Developer 2 GitHub username | @Emmanuel-coder-prog — write access VERIFIED | User assignment plus live GitHub collaborator-permission response, 2026-09-12. |
| Backup technical reviewer | UNVERIFIED | UNVERIFIED |
| Sprint start/end UTC | UNVERIFIED | UNVERIFIED |
| Staging dataset sanitization | UNVERIFIED | UNVERIFIED |
| Production invoice owner/signoff | UNVERIFIED | UNVERIFIED |

Repository observations belong in docs/runbooks/GITHUB-REALITY.md. Unknowns block only dependent work, never unrelated UI/mock foundation work.
