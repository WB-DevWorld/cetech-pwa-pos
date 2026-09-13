# CP-04 authenticated staging audit

**Historical audit, preserved.** The later senior decision [ADR-011](../../decisions/ADR/011.md) supersedes this report's blanket CORE-01 blocking conclusion. Development baseline is SATISFIED; the observed unsafe/unverified remote-write findings remain open. No audit values or original conclusions below were rewritten.

## Audit identity

- UTC start: 2026-09-12T16:08:53Z (SSH connect)
- UTC primary WP-CLI read: 2026-09-12T16:12:39Z
- Auditor: WS3 senior / @wbdevworld
- Branch: `ws3/cp-04-authenticated-staging-evidence`
- Base SHA: `ceea3c4ebb3b95d7c3195d6cc089d1f3713d1d19` (`origin/main` at continuation start)
- Environment under audit: `https://training.cetechbpa.com`
- Operator confirmation: @wbdevworld identified the training origin as SSH `ubuntu@` an operator-provided IPv4; remote hostname `cetechtrainingappserver`; WordPress path `/home/cetechtraining/htdocs/training.cetechbpa.com`
- Methods: existing SSH key + WP-CLI `eval-file` read-only PHP. No Application Password created. No `.env` created. No wp-admin login. No orders, payments, stock writes, plugin/theme/setting changes.
- Production SSH was **not** used in this continuation (operator instruction). Production comparison remains the prior public REST identity of `https://cetechbpa.com` from `docs/integration/evidence/CP-04-LIVE-AUDIT.md`.
- Public read-only chronology in CP-04-LIVE-AUDIT.md is preserved. This file only adds authenticated facts.

## Access

| Item | Result |
| --- | --- |
| Authenticated route | Route A — WP-CLI over SSH on the operator-identified training origin |
| Did access pre-exist? | yes (SSH key already on the workstation; operator named the host) |
| Were any credentials created? | NO |
| wp-admin session | not used |
| Woo REST application password | not used / not created |

## Environment identity

| Fact | Observed value | Method | Checked by | UTC | Redaction | Status | Gate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WP environment type | `staging` | `wp_get_environment_type()` | @wbdevworld | 2026-09-12T16:12:39Z | none | VERIFIED | blocks CORE-01 until known; now satisfied for identity |
| home / siteurl | `https://training.cetechbpa.com` | `get_option` | @wbdevworld | 2026-09-12T16:12:39Z | none | VERIFIED | matches public REST |
| blogname | contains `TRAINING` | `get_option` | @wbdevworld | 2026-09-12T16:12:39Z | none | VERIFIED | identity |
| WordPress | 7.1 | `get_bloginfo('version')` | @wbdevworld | 2026-09-12T16:12:39Z | none | VERIFIED | upgrades public generator |
| PHP web/FPM | 8.5.9 | site pool `/etc/php/8.5/fpm/pool.d/training.cetechbpa.com.conf`; `php-fpm8.5 -v` | @wbdevworld | 2026-09-12T16:14Z | pool listen path not recorded | VERIFIED | matches prior Site Health |
| PHP CLI | 8.4.24 | `php -v` on the app host | @wbdevworld | 2026-09-12T16:12:39Z | none | VERIFIED | CLI ≠ FPM; do not treat CLI as the web runtime |
| Multisite | no | `is_multisite()` | @wbdevworld | 2026-09-12T16:12:39Z | none | VERIFIED | |
| WooCommerce | 11.1.0 active | plugin list + `WC_VERSION` | @wbdevworld | 2026-09-12T16:12:39Z | full plugin inventory not committed | VERIFIED | upgrades USER-REPORTED version |
| WoodMart | 8.5.7 parent; Woodmart Child 1.0.0 active; Woodmart Core 1.1.8 active | theme/plugin list | @wbdevworld | 2026-09-12T16:12:39Z | none | VERIFIED | |
| B2BKing | Core 5.2.50 active; Pro 5.6.30 active | plugin list | @wbdevworld | 2026-09-12T16:12:39Z | none | VERIFIED | Pro was not in the earlier Core-only Site Health cell |
| VitePOS | Lite 3.5.1 **active**; Pro 3.6.0 **inactive** | plugin list | @wbdevworld | 2026-09-12T16:12:39Z | none | VERIFIED | matches earlier installed/inactive Pro note |
| Paystack plugin | 5.8.5 **inactive** | plugin list | @wbdevworld | 2026-09-12T16:12:39Z | keys not read | VERIFIED inactive | runtime card processor not loaded |

## Staging vs production

| Fact | Observed value | Status |
| --- | --- | --- |
| Staging URL | `https://training.cetechbpa.com` | VERIFIED |
| Staging WP environment type | `staging` | VERIFIED |
| Staging app hostname | `cetechtrainingappserver` | VERIFIED |
| Production URL | public comparison host `https://cetechbpa.com` (distinct WP app without Woo/VitePOS namespaces, prior public audit). Operator has **not** newly certified a Woo production operations URL in this continuation. | UNVERIFIED as Woo production; VERIFIED as a distinct public WP site |
| Production WP environment type | not read in this continuation | BLOCKED |
| Staging DB/service fingerprint | `sha256` `65da6808c0b3559426fbb5479b04c6c98816bf5234aa1778423563b439a26b1e` of `DB_HOST\|DB_NAME\|table_prefix` only | VERIFIED hash; inputs not recorded |
| Staging DB host class | private RFC1918 | VERIFIED class only |
| Staging DB name contains `train` | yes | VERIFIED boolean only |
| Production DB/service fingerprint | not collected (production SSH out of scope this continuation) | unavailable |
| Fingerprints same/different | cannot compare | BLOCKED |

Distinct public sites + a dedicated training app host + `WP_ENVIRONMENT_TYPE=staging` + a training-named DB **support** isolation. They do **not** prove the staging database is different from every production data store.

## Isolation matrix

| Area | Determination | Notes |
| --- | --- | --- |
| WordPress/database | BLOCKED | Staging identity VERIFIED on a dedicated training origin. Production DB fingerprint not compared. |
| Woo stock | BLOCKED | Staging `manage_stock=yes`. Cannot prove staging stock writes cannot change production stock without production comparison / write test (write test forbidden). |
| Woo orders | BLOCKED | 51 HPOS orders already exist on staging. No proof they are isolated from production order stores. |
| Payment | BLOCKED | Paystack plugin inactive; enabled Woo gateways are invoice + COD only. Inactive plugin options were **not** read (may still contain keys). Public FAQ still advertises card/MoMo. |
| Webhooks | VERIFIED none configured | Woo webhook count `0`. Destination isolation `NOT APPLICABLE`. |
| Email | UNSAFE | MailPoet **active**. `admin_email` domain is `cetechbpa.com` (not the training hostname). Woo from-address domain is `training.cetechbpa.com`. Staging can email; admin mail is not proven sandboxed. |
| SMS/WhatsApp | BLOCKED | Chaty **active** (customer-chat widget class). No dedicated SMS plugin in the filtered active set. No send test. |
| Fulfillment | BLOCKED | `cetech-woocommerce-delivery-engine` 1.0.0-rc.9 **active**. VitePOS adapter option `cetech_de_enable_vitepos_adapter=0`. Still a live fulfillment plugin. |
| Tax/fiscal | Woo tax VERIFIED off; GRA BLOCKED | `woocommerce_calc_taxes=no`; 0 tax rates. Not Ghana compliance. |
| Customer data | BLOCKED / likely unsanitized | 20 users, 12 customer-capability rows, 51 HPOS orders. No PII exported. Public catalog already looked operational. |
| Credentials | BLOCKED | Did not inspect gateway option blobs, application passwords, or SMTP secrets. |

**SAFE FOR CONTROLLED STAGING WRITE TEST: no.** Combined conclusion: **NOT PROVEN** (and email path **UNSAFE** until MailPoet/admin mail is sandboxed or accepted in writing).

Were write tests run? **NO**. Production touched? **NO**.

## HPOS / orders

| Fact | Value | Status |
| --- | --- | --- |
| HPOS | enabled (`OrderUtil::custom_orders_table_usage_is_enabled()` → `HPOS_ENABLED`) | VERIFIED |
| `woocommerce_custom_orders_table_enabled` | yes | VERIFIED |
| Compatibility / data sync | `woocommerce_custom_orders_table_data_sync_enabled=no` | VERIFIED off — HPOS is authoritative; posts table is not being synced |
| Incompatible-plugin warning | not separately enumerated | BLOCKED as a Woo-admin UI warning; not toggling features |
| Order count | 51 rows in HPOS orders table | VERIFIED count only |

## Woo stock / currency / tax

| Fact | Value | Status |
| --- | --- | --- |
| Global manage stock | yes | VERIFIED |
| Hold-stock minutes | 60 | VERIFIED |
| Hide out of stock | no | VERIFIED |
| Low/no-stock notify | yes / yes | VERIFIED options; no mail send test |
| Stock reduction on payment | not a separate readable global besides hold-stock; no write test | BLOCKED for runtime proof; option surface recorded |
| Backorders | product-meta `_backorders`: `no` × 154; no other values present | VERIFIED for stored meta; still product-level |
| Currency | GHS | VERIFIED admin option |
| Price decimals | 2 | VERIFIED admin option |
| Currency position / separators | left / `.` / `,` | VERIFIED admin options (matches public Store API) |
| Tax calc | no | VERIFIED |
| Prices include tax | no | VERIFIED |
| Tax based on | shipping | VERIFIED option even though calc is off |
| Tax round at subtotal | no | VERIFIED |
| Tax display shop/cart | excl / excl | VERIFIED |
| Active tax rates | 0 | VERIFIED |
| Default country | GH (region code redacted beyond country) | VERIFIED country GH |

Do not infer fractional-quantity support from 2 price decimals. Store API sample `multiple_of=1` from the public audit still stands; Woo decimal-qty admin setting was not a targeted option in this pass → remains BLOCKED.

## Payment gateways (IDs/names/status only)

Runtime `WC()->payment_gateways()`:

| ID | Enabled | Title | Test/sandbox option printed |
| --- | --- | --- | --- |
| `b2bking-invoice-gateway` | yes | CETECH Ghana — Pay by Invoice | none |
| `B2BKing_Purchase_Order_Gateway` | no | Purchase Order | none |
| `bacs` | no | Direct bank transfer | none |
| `cheque` | no | Check payments | none |
| `cod` | yes | Cash on delivery | none |

Paystack did **not** appear in the runtime gateway list because the plugin is inactive.

| Question | Answer |
| --- | --- |
| Online card processor | not an enabled Woo gateway on this host; Paystack plugin inactive |
| Mobile Money processor | no enabled Woo gateway titled MoMo; no filtered active MoMo plugin |
| Paystack | installed inactive |
| Live Paystack settlements from training.cetechbpa.com | not via an active plugin; **keys not inspected** |
| Sandbox/test mode | no testmode flags on the enabled invoice/COD gateways |

Public FAQ still claims Credit/Debit Card and MoMo online. Authenticated Woo runtime does not currently expose those processors. That is a **copy vs runtime mismatch**, not proof that stored Paystack keys are absent.

## VitePOS authenticated configuration

Public audit already recorded `barcode_field=SKU`, `stockable=N`, `offline_order_status=N`, Cash / Swipe Machine / Other. Not repeated as new proof.

| Fact | Value | Status |
| --- | --- | --- |
| Active plugin | vitepos-lite 3.5.1 | VERIFIED |
| Pro | 3.6.0 inactive | VERIFIED |
| Warehouses/outlets | 2 rows; both status `A`; country `GH`; one `main=Y`, one `main=N` | VERIFIED counts/flags; names/emails/phones/addresses not recorded |
| Counters/registers | 2 rows; `counter_number=1` on outlet 1 and outlet 2 | VERIFIED mapping without labels |
| Stock model | Woo `manage_stock=yes` **and** public VitePOS `stockable=N` | VERIFIED combination: Woo global stock on; VitePOS full/outlet stockable flag off. Do not claim outlet-multi stock is executing. |
| Offline/queue | public `offline_order_status=N`; no disconnect test | config previously VERIFIED; runtime BLOCKED |
| Active shifts | not queried (PII risk) | UNVERIFIED |
| Delivery-engine VitePOS adapter | option `0` | VERIFIED disabled |

## Email / notifications / side effects

Active plugins relevant to side effects (not a full inventory dump): MailPoet 5.37.0, Chaty 3.6.0, CETECH WooCommerce Delivery Engine 1.0.0-rc.9, PurchaseDesk 1.0.11, WP Rocket 3.23.3.3, WooCommerce Analytics 0.9.16, Contact Form 7, Support Genix, Simple History, User Switching, Code Snippets.

| Channel | Classification |
| --- | --- |
| Customer/staff email | production-capable (MailPoet active; admin domain `cetechbpa.com`) |
| SMTP | unknown (no dedicated SMTP plugin in the filtered set; MailPoet can send) |
| SMS | unknown |
| WhatsApp | unknown / widget present (Chaty active) |
| Push | WooCommerce `wc-push-notifications` namespace was public; plugin-level not separately proven |

## Dataset sanitization

No customer rows exported. Counts only: 20 users, 12 customer-capability entries, 51 HPOS orders, public catalog previously 54 products. Determination: **unknown / not proven sanitized** (operational counts, not a synthetic empty training set).

## Physical hardware

Remains BLOCKED / UNVERIFIED. Does **not** by itself block CORE-01 schema work.

## Facts that block CORE-01 vs later tasks

**Still material to CP-04 acceptance / live integration testing:**

- Staging vs production **database** fingerprint comparison
- Email isolation (MailPoet + admin domain on `cetechbpa.com`) — **UNSAFE for write tests**
- Fulfillment plugin isolation
- Dataset sanitization
- Proof that staging stock/orders cannot mutate production

**Now verified and useful to CORE-01 (schema/RLS design against known Woo facts), but not a CP-04 completion:**

- `WP_ENVIRONMENT_TYPE=staging`
- HPOS enabled, authoritative, compatibility sync off
- Woo manage-stock yes; hold 60 minutes; backorder meta all `no`
- Woo 11.1.0 / WP 7.1 / PHP-FPM 8.5.9
- Currency GHS / 2 decimals as admin options

**Later BR/PAY/REL (do not silently treat as CORE-01):**

- Hardware models
- GRA/fiscal process
- Paystack/MoMo/card production processor details
- Bridge service identity (still 404 from the public audit)
- VitePOS offline reconnect behaviour
- Barcode scan edge cases

## Final determination

**CP-04 = PARTIAL / BLOCKED**

Authenticated identity, HPOS, Woo stock/tax/currency, and gateway *runtime* lists are now evidenced. Isolation is **not** `SAFE FOR CONTROLLED STAGING WRITE TEST`. Issue #4 remains OPEN. CORE-01 remains **BLOCKED** until senior review accepts residual isolation risk or the remaining isolation cells are closed.

No `Closes #4`.
