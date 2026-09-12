# CP-04 Live Environment Audit

## Audit identity

- UTC start: 2026-09-12T14:06:08Z
- UTC end: 2026-09-12T14:25:00Z
- Auditor: WS3 senior / @wbdevworld
- Branch: `ws3/cp-04-audit-live-environment-and-isolate-staging`
- Base SHA: `52caf39d010687084e0b1e1db74acd0b644ab4b0` (`origin/main` at audit start). This commit is a descendant of expected PR #34 merge `ae6bac5cbffae3af13036e0447641e174a9227b5`; FE-01 PR #33 had already merged after #34.
- Environment under audit: user-reported staging host `https://training.cetechbpa.com`
- Comparison host observed publicly: `https://cetechbpa.com` (not independently proven to be production operations, but it is a distinct public WordPress site)
- Methods used: read-only `curl.exe` HEAD/GET over TLS (`--ssl-revoke-best-effort`). No WP-CLI. No `.env` / Application Password / Woo keys on this workstation. No wp-admin login. No orders, payments, stock writes, plugin/theme changes.
- Browser MCP navigate to the homepage failed to register; Cursor `WebFetch` of the homepage returned HTTP 403 (Cloudflare). Those failures are not treated as site-down; `curl.exe` succeeded.
- Related unmerged WS2 intake (`origin/ws2/cp-04-commerce-intake`, files under `docs/workstreams/WS-02-COMMERCE-BRIDGE/**` only) was inspected for collision. It does **not** edit this evidence path. Overlapping public facts were independently re-probed by WS3 rather than copied as WS3 verification.

## Evidence classification rules

| State | Meaning |
| --- | --- |
| VERIFIED | Independently observed in this audit at the recorded time |
| USER-REPORTED | Prior Site Health / table value; not independently re-proven here |
| USER-CONFIRMED | Explicit human operational statement already in the repository |
| UNVERIFIED | No safe evidence obtained |
| BLOCKED | Required check needs authenticated staging access, production comparison, or would risk a write/secret |
| NOT APPLICABLE | Not required for the named observation |

A public storefront or Store API observation proves what was publicly displayed or returned. It does **not** automatically prove WooCommerce admin options, HPOS, gateway settlement, or database isolation.

No secrets, customer PII, VAT/TIN values, or full REST route maps are recorded below.

## Public read-only evidence

| Fact | Observed value | Environment | Evidence method | Checked by | UTC timestamp | Evidence location | Redactions applied | Confidence/status | Operational implication |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Staging host reachable | HTTP/1.1 200; `Server: cloudflare`; HTML | `https://training.cetechbpa.com/` | `curl.exe -sS -I --ssl-revoke-best-effort` | @wbdevworld | 2026-09-12T14:06:08Z | this file | Cloudflare NEL/report URLs omitted | VERIFIED | Public HTTPS front door exists |
| Public site name / home | REST `name` includes `TRAINING`; `url` and `home` = `https://training.cetechbpa.com` | `/wp-json/` | GET JSON, filtered fields only | @wbdevworld | 2026-09-12T14:06:19Z | this file | Full 1.8MB index not retained | VERIFIED | Public identity is the training host, not a silent alias to `cetechbpa.com` |
| WordPress REST index | HTTP 200; `Link: rel="https://api.w.org/"`; `Allow: GET` | `/wp-json/` | HEAD | @wbdevworld | 2026-09-12T14:06:09Z | this file | none needed | VERIFIED | Unauthenticated index is readable |
| Application Passwords advertised | REST `authentication` keys = `application-passwords` | `/wp-json/` | GET filtered | @wbdevworld | 2026-09-12T14:06:19Z | this file | none | VERIFIED (feature advertised, not that a bridge identity exists) | BR-01 live auth still requires a dedicated identity created out-of-band |
| Woo REST/Store routes present | Namespaces include `wc/v3`, `wc/v2`, `wc/v1`, `wc/store`, `wc/store/v1`; 114 `wc/v3` routes and 66 store routes in the index | `/wp-json/` | GET filtered counts | @wbdevworld | 2026-09-12T14:06:19Z | this file | Route map not dumped | VERIFIED (presence only) | Does not prove Woo 11.1.0 or authenticated access |
| VitePOS REST present | Namespace `vitepos/v1`; 67 routes; CORS also advertises `VITE_POS_TOKEN`, `outlet` | `/wp-json/` HEAD/GET | filtered | @wbdevworld | 2026-09-12T14:06:15Z | this file | Route map not dumped | VERIFIED (presence only) | Not version/mode proof by itself |
| Dedicated CETECH bridge | `cetech-pos` namespace count 0; `HEAD /wp-json/cetech-pos/v1/health` = 404 | staging REST | HEAD/GET | @wbdevworld | 2026-09-12T14:06:11Z | this file | none | VERIFIED absent | Expected until BR-01 deploys a plugin |
| Store API catalog headers | `x-wp-total: 54` published products via Store API | `/wp-json/wc/store/v1/products` | HEAD | @wbdevworld | 2026-09-12T14:06:12Z | this file | no product list retained from HEAD | VERIFIED | Public catalog count; not a stock-policy proof |
| Storefront SKU labels | Shop HTML contains 54 `SKU` labels; homepage HTML contains 48 | `/shop/`, `/` | GET HTML, count only | @wbdevworld | 2026-09-12T14:06–14:10Z | this file | SKU values not recorded | VERIFIED | Storefront displays SKUs; does not prove POS scan source by itself |
| Store API currency | Sampled products: `currency_code=GHS`, symbol U+20B5, `currency_minor_unit=2`, decimal `.`, thousand `,` | Store API `?per_page=20` | GET, aggregates only | @wbdevworld | 2026-09-12T14:10Z | this file | names/prices/SKUs not listed | VERIFIED as public Store API display | Does not prove Woo admin `woocommerce_currency` option |
| Store API SKU field | 16/20 sampled products had a non-empty `sku`; variable parents may have empty `sku` | Store API | GET aggregates | @wbdevworld | 2026-09-12T14:10Z | this file | SKU strings not recorded | VERIFIED | Compatible with SKU-as-barcode, not a scan proof |
| Quantity step (sample) | Sampled 20 products: `add_to_cart.multiple_of=1`, `minimum=1` | Store API | GET aggregates | @wbdevworld | 2026-09-12T14:10Z | this file | none | VERIFIED for this public sample only | Does not prove Woo fractional-quantity setting |
| FAQ payment text | Homepage FAQ: cash and Mobile Money at offline stores; Credit/Debit Card and Mobile Money (MoMo) on the online store. Payment-and-delivery page: online orders require MoMo before delivery/pickup; offline pay-at-cashier | `/` and `/payment-and-delivery/` | GET HTML, PII redacted | @wbdevworld | 2026-09-12T14:12Z | this file | emails/phones redacted | VERIFIED as public copy | Operational marketing text, not gateway enablement |
| WordPress generator | `<meta name="generator" content="WordPress 7.1" />` on `/` and `/shop/` | staging HTML | GET | @wbdevworld | 2026-09-12T14:10Z | this file | none | VERIFIED | Upgrades prior USER-REPORTED 7.1 for this host |
| Theme signal | `woodmart` string present in homepage/shop HTML | staging HTML | GET | @wbdevworld | 2026-09-12T14:10Z | this file | none | VERIFIED (presence) | Does not prove WoodMart 8.5.7 |
| VitePOS UI path | `GET/HEAD /vitepos/` = 200; HTML title `pos`; login-related copy present | `/vitepos/` | GET HTML signals only | @wbdevworld | 2026-09-12T14:10Z | this file | no session | VERIFIED path exists | Login not performed |
| wp-admin | `HEAD /wp-admin/` → 302 to `wp-login.php` | staging | HEAD | @wbdevworld | 2026-09-12T14:06:17Z | this file | none | VERIFIED | Admin is not anonymously usable |
| Comparison host | `https://cetechbpa.com/` HTTP 200; REST `name=CETECH Ghana`; `url`/`home`=`https://cetechbpa.com`; 28 namespaces; **no** `wc/v3` or `vitepos`; `authentication` is an empty list | comparison host | HEAD/GET filtered | @wbdevworld | 2026-09-12T14:06:16Z | this file | full index not retained | VERIFIED distinct public WP app | Hostname isolation supporting evidence only |

Unauthenticated Woo admin APIs:

```text
GET /wp-json/wc/v3/settings/general     → 401 woocommerce_rest_cannot_view
GET /wp-json/wc/v3/webhooks             → 401
GET /wp-json/wc/v3/payment_gateways     → 401
GET /wp-json/wc/v3/system_status        → 401
```

GET Store API products also set a `shop_per_page` cookie. That is a display cookie, not a sale, stock, or payment write.

## WordPress/PHP/theme evidence

| Fact | Observed value | Status |
| --- | --- | --- |
| WordPress version | 7.1 from public generator meta | VERIFIED |
| PHP version | 8.5.9 64-bit | USER-REPORTED (Site Health 2026-09-12); not in public HTML/REST |
| WooCommerce version | 11.1.0 active | USER-REPORTED; Woo namespaces VERIFIED present |
| WoodMart / child | 8.5.7 / Woodmart Child 1.0.0 | USER-REPORTED; `woodmart` string VERIFIED in HTML |
| B2BKing Core | 5.2.50 | USER-REPORTED |
| Hosting | Linux / nginx / PHP-FPM | USER-REPORTED; this probe saw Cloudflare in front |
| WP_ENVIRONMENT_TYPE | staging | USER-REPORTED; **not** present on public REST index → BLOCKED for independent proof |
| WP-CLI / authenticated admin | Unavailable on this workstation (no `wp`, no `.env`, no Application Password) | BLOCKED |

## WooCommerce evidence

### HPOS

- HPOS enabled: BLOCKED
- Authoritative order storage: BLOCKED
- Compatibility/sync mode: BLOCKED
- Evidence: Woo `OrderUtil` / Features screen / authenticated settings were not reachable. Public REST route names are not HPOS proof. Official Woo docs (consulted 2026-09-12) say HPOS exists for Woo ≥8.2 and is default for *new* installs; this store’s mode is unknown.
- Timestamp: 2026-09-12T14:12Z

### stock

- Woo `woocommerce_manage_stock`: BLOCKED (401 on settings)
- Stock reduction / hold minutes / negative stock: BLOCKED
- Public Store API: sampled 20/20 `is_in_stock=true`; `low_stock_remaining` null in the first two products. That is availability display, not manage-stock configuration.
- Intended transitional rule “Woo remains transitional stock/order authority”: **not claimed**. Consistent with VitePOS `stockable=N` (below) but Woo option is unproven.

### backorders

- Global vs per-product policy: BLOCKED. No product-level backorder export was performed.

### currency/precision

- Public Store API and VitePOS public settings both report `GHS`, cedi prefix/symbol, 2 minor units, `.` / `,` separators.
- Status: VERIFIED as public storefront + VitePOS public settings. Woo admin currency options remain BLOCKED.

### tax

- VitePOS public `is_incl_tax=false` (VitePOS setting, not Woo).
- VitePOS `tax_method=B` recorded as an opaque vendor code; meaning UNVERIFIED.
- Woo tax enabled / entered-incl-excl / location basis / rates: BLOCKED (401).
- GRA E-VAT/CIS: BLOCKED pending business/accounting evidence. VitePOS invoice settings have `show_vat_reg=true` and a VAT registration value of length 11 — **value REDACTED**, not published. Presence of a field is not Ghana tax compliance.

## VitePOS evidence

### version/state

- User-reported: VitePOS 3.5.1 active; Pro 3.6.0 installed/inactive.
- This audit: `vitepos/v1` present; `/vitepos/` returns a POS login page. Version strings were **not** in the public settings payload inspected. Version remains USER-REPORTED.

### stock mode

Public unauthenticated `GET /wp-json/vitepos/v1/basic/settings` returned HTTP 200 (see sanitization). Selected non-secret fields:

- `basic_settings.stockable` = `N`
- `basic_settings.pos_mode` = `G`
- Vendor docs (https://vitepos.com/docs/admin-panel/admin-settings/ , 2026-09-12): POS Mode includes Grocery. `G` is recorded as **consistent with Grocery mode**, not as a runtime feature inventory.
- Vendor docs (https://vitepos.com/docs/admin-panel/stock-management/): “Full Stock Management” is an enablement; then Woo single stock vs outlet-wise multi-stock.
- Interpretation allowed by evidence: VitePOS full/outlet stock management does **not** appear enabled in this public payload (`stockable=N`).
- Not proven: Woo shared stock is actually managed; POS writes update Woo immediately; outlet mappings.

### outlets

- CORS advertises header name `outlet`. VitePOS HTML contains `outlet` / register-related strings.
- Active outlet/register mapping: BLOCKED (no login, no admin). `show_outlet_info=true` on receipts is a template flag, not an outlet count.

### offline queue

- Configured: `offline_order_status=N`.
- Sync-looking intervals present: `p_sync_intval=60000`, `o_sync_intval=30000` (units not independently proven; recorded as integers only).
- `/vitepos/` HTML contains many `offline`/`pending` strings; no `indexedDB` / `localStorage` / `serviceWorker` / `dexie` literals in the HTML document retrieved (bundled JS may still use storage after login).
- Capability vs configured: UI bundle mentions offline; configured offline-order status is `N`.
- Disconnect/reconnect / duplicate finalization: **not tested**. Isolation is not proven, so no POS login and no sale.

### barcode source

- VitePOS `barcode_field=SKU` — VERIFIED from public settings.
- Vendor docs: barcode field may be Product ID (default), SKU, or custom field.
- Scan resolve exact variation / multiple matches / no match: BLOCKED (no scan test).
- Storefront SKUs being visible does not by itself prove scan behavior; the VitePOS setting does.

## Payments

### cash

- Public FAQ: cash accepted at offline stores — VERIFIED as displayed.
- VitePOS payment method `id=C` title `Cash` `offline=true` `split=true` — VERIFIED as VitePOS configured tender.
- USER-CONFIRMED in-use remains from 2026-09-12 table.
- Woo COD/cash gateway enablement: BLOCKED (401). Checkout HTML contained inconclusive substrings (`cod`, `cash`) without payment-method IDs.

### MoMo

- Public FAQ / payment-and-delivery: MoMo required for online orders before delivery/pickup; MoMo also mentioned for offline stores — VERIFIED as displayed.
- VitePOS configured methods are Cash / Swipe Machine / Other. There is **no** method titled Mobile Money/MoMo. Do not assume `Other` is MoMo.
- Technical provider/account: UNVERIFIED / BLOCKED.

### card

- Public FAQ: Credit/Debit Card on the online store — VERIFIED as displayed.
- VitePOS method `id=S` title `Swipe Machine` `offline=true` (optional last-4 note field) — VERIFIED as a POS tender label, not a card processor.
- Online card gateway: BLOCKED.

### active gateways/provider

- VitePOS `payment_gws` list length 0.
- Woo `payment_gateways` API 401.
- Paystack plugin 5.8.5 installed/inactive: USER-REPORTED Site Health; **not** independently re-listed.
- Provider settlement capability: UNVERIFIED.
- Concepts kept separate: operational methods (FAQ + VitePOS tenders) ≠ Woo gateway enabled ≠ provider settlement.

## Hardware

No physical inspection was possible from Cursor.

| Device | Status |
| --- | --- |
| Scanner | UNVERIFIED physically. VitePOS barcode field is SKU; that is software config. |
| Receipt printer | UNVERIFIED physically. Invoice template `page_width=80` / `font_size=12` is consistent with 80mm receipts, not proof a printer exists. |
| Cash drawer | UNVERIFIED. `single_cash_drawer=N`, drawer counted-amount flags `N`. |
| Payment terminal | UNVERIFIED. “Swipe Machine” is a VitePOS tender label. |
| Device class | UNVERIFIED |

If none of these devices have been selected, a human should say so explicitly rather than leaving UNVERIFIED.

## External integrations/webhooks

| Integration type | Enabled/disabled | Destination classification | Staging/production/unknown |
| --- | --- | --- | --- |
| Woo REST webhooks | BLOCKED (401) | unknown | unknown |
| VitePOS pusher interval fields present | integers present; destination unknown | unknown | unknown |
| Payment gateway callbacks | BLOCKED | unknown | unknown |
| Email/SMS/WhatsApp | public copy mentions WhatsApp/phone; production notification suppression unknown | unknown | unknown |
| CETECH POS bridge | absent (404) | n/a | n/a |
| WP Rocket | generator meta 3.23.3.3 on staging HTML | cache plugin presence | staging host only |
| Comparison host stack (not Woo) | Jetpack/Yoast/Wordfence/Kadence namespaces on `cetechbpa.com` | different public app | comparison host |

No webhook mutation tests.

## Staging isolation

| Check | Result |
| --- | --- |
| Public URL distinct | VERIFIED `training.cetechbpa.com` ≠ `cetechbpa.com` |
| Public WP identity distinct | VERIFIED different REST `name`/`home`; staging has Woo+VitePOS namespaces, comparison host does not |
| WP environment type staging | USER-REPORTED / BLOCKED independently |
| Database/service endpoints staging-specific | BLOCKED — no credentialed DB/hosting comparison; fingerprints not invented |
| Production Woo DB not reused | BLOCKED |
| Payment gateways cannot settle live | BLOCKED — Woo gateways unread; online FAQ claims real MoMo/card |
| Production webhooks absent | BLOCKED |
| Production fulfillment/email/SMS sandboxed | BLOCKED |
| Production API credentials unused | BLOCKED |
| Customer data sanitized | BLOCKED — public catalog is live-looking hardware products; sanitization unknown |
| Staging orders cannot alter production stock | BLOCKED — no write test; isolation unproven |
| Staging VitePOS cannot alter production stock | BLOCKED |

**SAFE FOR CONTROLLED STAGING WRITE TEST: no.**

## Sanitization/redaction

- Did not commit `wp-config`, `wp config list`, Site Health dumps, Woo system reports, or full REST indexes.
- Did not record VAT/TIN, emails, phones, customer names, SKU strings, prices, or product titles.
- VitePOS settings payload was inspected in memory; only named non-secret fields are in this file. Kitchen/order `token*` keys were not published because the names include `token`.
- Security note (not a write, not a secret dump): `GET /wp-json/vitepos/v1/basic/settings` is reachable without authentication and returns POS configuration. Treat as an exposure to review; do not use it as a substitute for Woo admin evidence.

## Remaining unknowns

HPOS; Woo manage-stock / hold / backorders / reduction; Woo tax; GRA fiscal process; Paystack/runtime gateway enablement; MoMo/card processor path; hardware; production URL confirmation; DB/webhook/payment/notification isolation; dataset sanitization; VitePOS outlet maps; offline queue actual behavior; barcode no-match/multi-match; fractional quantity admin setting; bridge service identity.

## Dependency impact

### BR-01

- Local plugin skeleton is not blocked by HPOS/stock unknowns (WS2 intake already argued this).
- Live authenticated health remains blocked: no dedicated bridge identity, health 404, isolation not proven.
- This audit does **not** authorize BR-01 implementation or staging install.

### CORE-01

- Remains **BLOCKED**. CP-05 is satisfied; CP-04 isolation and integration-critical Woo/HPOS/stock facts are not complete enough to treat staging as a safe operational source of truth for schema/RLS work against live services.

### later payment/POS gates

- PAY-01 / checkout / stock races remain blocked on gateway, isolation, and HPOS/stock evidence.

## Final CP-04 determination

**PARTIAL / BLOCKED**

Acceptance at public-audit time (“every integration-critical fact has verifier/time/evidence; staging isolated from production writes”) was **not** met. Public evidence was captured. Authenticated Woo/WP-CLI facts and staging-isolation proof were not available in that pass. No write tests were executed. Production was not modified.

The 2026-09-12 authenticated continuation (below) upgrades identity/HPOS/stock/tax/gateway cells and still does **not** meet isolation acceptance.

Were any write tests executed? **no**
Production touched? **NO**

## Authenticated continuation (2026-09-12)

Do not treat the public-only rows above as if they had always been WP-CLI verified. Continuation evidence is in `docs/integration/evidence/CP-04-AUTHENTICATED-AUDIT.md`.

Summary of upgrades (training origin WP-CLI, @wbdevworld, 2026-09-12T16:12Z): `WP_ENVIRONMENT_TYPE=staging`; Woo 11.1.0; HPOS enabled with data-sync off; manage-stock yes / hold 60 minutes; GHS / 2 decimals as admin options; tax calc off (0 rates); Paystack plugin inactive; enabled Woo gateways invoice + COD; Woo webhooks 0; MailPoet active with admin-email domain `cetechbpa.com`. Isolation remains **NOT PROVEN** / email **UNSAFE** for write tests. CORE-01 remains BLOCKED. Production was not SSH-probed in that continuation.
