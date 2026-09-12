# CP-04 — WS2 Commerce/Staging Intake

## Baseline

* repository: `https://github.com/WB-DevWorld/cetech-pwa-pos`
* branch: `ws2/cp-04-commerce-intake`
* HEAD inspected (intake base): `095696f15cd64b546003bc5c77b4600af7bc4c76` (`[CP-05] Pin toolchain and create Next.js/CI scaffold (#32)`)
* closeout re-fetch `origin/main` (2026-09-12 13:39 UTC): `ae6bac5cbffae3af13036e0447641e174a9227b5` (`docs: reconcile CP-05 merged status (#34)`). One unrelated WS3 docs commit (`CURRENT-WORK.md`, WS3 STATUS/HANDOFF). **No rebase performed.**
* orientation SHA (rechecked, no longer current): `15287691a71081ca2855b5b9bc325a787b2ca7c0`
* date/time UTC: 2026-09-12 13:20–13:22 UTC
* operator: Developer 2 / WS2 / @Emmanuel-coder-prog
* task: CP-04 WS2 commerce/staging evidence contribution (bounded intake; not BR-01 implementation; does not complete CP-04)
* environment accessed: public read-only HTTPS/REST index of user-reported host `https://training.cetechbpa.com`; GitHub public issue API; official documentation; local repository. No wp-admin, no WP-CLI, no Application Password, no orders, no stock writes.

## Evidence Classification

* **VERIFIED**: independently observed in this intake (command/API/docs page) at the recorded time.
* **USER-REPORTED**: supplied in `LIVE-ENVIRONMENT-FACTS.md` / Site Health statement; not independently re-proven here.
* **REPOSITORY-VERIFIED**: observed in the current Git tree / frozen contracts / GitHub issue JSON.
* **UNVERIFIED**: no safe accessible evidence in this intake.
* **BLOCKED**: a required check cannot be performed without an unauthorized or mutating action, a secret in chat, or unsafe production risk.
* **NOT APPLICABLE**: not required for the named operation.

User-reported values are **not** upgraded by this document.

## Findings

| Fact | Current value | Evidence/source | Checked at | Verification level | Operation blocked if missing | Exact next check | Owner |
| ---- | ------------- | --------------- | ---------- | ------------------ | ---------------------------- | ---------------- | ----- |
| Inspected repository HEAD | `095696f15cd64b546003bc5c77b4600af7bc4c76` | `git fetch` + `git rev-parse origin/main` | 2026-09-12 13:18 UTC | VERIFIED | Coordination only | Re-fetch before BR-01 branch | WS2/WS3 |
| Orientation baseline still current? | No; local main was behind 1 commit (`1528769` → `095696f`) | `git fetch origin` | 2026-09-12 13:18 UTC | VERIFIED | None | Keep pulling main | WS2 |
| `ws2/cp-04-commerce-intake` pre-existed | No local or remote branch before this task | `git branch -a` after fetch | 2026-09-12 13:18 UTC | VERIFIED | None | None | WS2 |
| Unrelated uncommitted work | None; tree clean on pull | `git status` | 2026-09-12 13:18 UTC | VERIFIED | Overwrite risk | Preserve other worktrees | WS2 |
| Issue #4 CP-04 | Open; assignee `@wbdevworld`; milestone M0 | GitHub API `GET /issues/4` (rechecked closeout) | 2026-09-12 13:20:54 UTC and 13:39 UTC | VERIFIED | CP-04 completion remains WS3 | WS3 consolidates this intake | WS3 |
| Issue #13 BR-01 | Open; unassigned; milestone M0 | GitHub API `GET /issues/13` (rechecked closeout) | 2026-09-12 13:20:54 UTC and 13:39 UTC | VERIFIED | BR-01 assignment | Assign after WS3 accepts this intake | WS2/WS3 |
| `wordpress/cetech-pos-bridge/**` | Only `README.md` (do not install as plugin; do not claim health exists) | Git tree listing | 2026-09-12 13:19 UTC | REPOSITORY-VERIFIED | BR-01 implementation | BR-01 creates plugin | WS2 |
| `tests/bridge/**` | Absent | Git tree | 2026-09-12 13:19 UTC | REPOSITORY-VERIFIED | BR-01 tests | BR-01 | WS2 |
| `tests/fixtures/commerce/**` | Absent | Git tree | 2026-09-12 13:19 UTC | REPOSITORY-VERIFIED | BR-03+ corpus | Later BR tasks | WS2 |
| Pricing-parity rows | All UNVERIFIED / BLOCKED | `docs/runbooks/PRICING-PARITY.md` | 2026-09-12 13:19 UTC | REPOSITORY-VERIFIED | G2 / checkout | BR-03/04/05 | WS2 |
| Target host HTTPS | TLS HTTP/1.1 `200` on `https://training.cetechbpa.com/` | `curl.exe -sS -I` | 2026-09-12 13:21:31 UTC | VERIFIED | Bridge auth over TLS | None for HTTPS itself | WS2 |
| Public WordPress REST index | `200`; `Link: rel="https://api.w.org/"`; `url`/`home` = `https://training.cetechbpa.com` | HEAD + GET `/wp-json/` (redacted) | 2026-09-12 13:21:33 UTC | VERIFIED | None for starting BR-01 local implementation after WS3 acceptance | Do not scrape catalog/users | WS2 |
| Demonstrably staging vs production | User-reported `WP_ENVIRONMENT_TYPE=staging`; production URL UNVERIFIED; public REST does not expose environment type | `LIVE-ENVIRONMENT-FACTS.md`; REST index lacks env field | 2026-09-12 13:21 UTC | USER-REPORTED / BLOCKED for independent proof | Live plugin install / privileged inspection | Authorized operator: wp-admin Site Health / `wp config get WP_ENVIRONMENT_TYPE` and confirm production URL isolation | WS3 + operator |
| Remote inspection without commerce effects | Public GET/HEAD only; no POST; no orders/stock | This intake | 2026-09-12 13:21 UTC | VERIFIED for public reads | Privileged facts remain BLOCKED | Operator WP-CLI/admin read-only | WS2/operator |
| WordPress installed (public) | REST index present | `/wp-json/` | 2026-09-12 13:21 UTC | VERIFIED (presence only) | None for BR-01 local code | Site Health / `wp core version` | WS2/operator |
| WordPress version | 7.1 | `LIVE-ENVIRONMENT-FACTS.md` | 2026-09-12 recorded | USER-REPORTED | Compatibility *declaration* | Read-only Site Health / `wp core version` | WS3/WS2 |
| WooCommerce installed (public) | Namespaces include `wc/v3`, `wc/v2`, `wc/v1`, `wc/store`, `wc/store/v1` | REST index namespaces (filtered) | 2026-09-12 13:21 UTC | VERIFIED (presence only) | None for BR-01 detection code | Do not call `/wc/v3/*` without authorization | WS2 |
| WooCommerce version / active | 11.1.0 active | `LIVE-ENVIRONMENT-FACTS.md` | 2026-09-12 recorded | USER-REPORTED | Compatibility *declaration* | `wp plugin get woocommerce --field=version,status` | Operator |
| PHP version | 8.5.9 64-bit | `LIVE-ENVIRONMENT-FACTS.md` | 2026-09-12 recorded | USER-REPORTED | Compatibility *declaration* | Site Health / hosting panel | Operator |
| Local PHP / WP-CLI | Not installed on this workstation | `php --version`, `wp --info` missing | 2026-09-12 13:20 UTC | VERIFIED | Local `make` PHP tests after BR-01 creates them | Install PHP later; do not invent PASS | WS2 |
| WoodMart parent | 8.5.7 | `LIVE-ENVIRONMENT-FACTS.md` | 2026-09-12 recorded | USER-REPORTED | BR-01 detection target; parity later | `wp theme list` read-only | Operator |
| WoodMart Child | Active 1.0.0 | `LIVE-ENVIRONMENT-FACTS.md` | 2026-09-12 recorded | USER-REPORTED | Same | `wp theme list` | Operator |
| B2BKing | Core 5.2.50; 5.2.60 available, no upgrade performed | `LIVE-ENVIRONMENT-FACTS.md` | 2026-09-12 recorded | USER-REPORTED | BR-01 detection target; parity later | `wp plugin list` | Operator |
| VitePOS | Active 3.5.1; Pro 3.6.0 installed inactive | `LIVE-ENVIRONMENT-FACTS.md` | 2026-09-12 recorded | USER-REPORTED | Cutover / stock-mode later | Admin/plugin list | Operator |
| VitePOS REST presence | Public namespace `vitepos/v1`; CORS headers advertise `VITE_POS_TOKEN`, `outlet` | REST HEAD/index | 2026-09-12 13:21 UTC | VERIFIED (presence only, not version/mode) | None for BR-01 | Do not call VitePOS routes | WS2 |
| Dedicated bridge service identity / capability | None in repo; no `cetech-pos` namespace | Plugin README + REST namespaces | 2026-09-12 13:21 UTC | REPOSITORY-VERIFIED / VERIFIED absent on host | Live authenticated health | Later authorized operator creates identity; **do not create now** | Operator |
| WordPress Application Passwords available on host | REST index `authentication` keys = `application-passwords`; authorization endpoint advertised | Official WP check via public `/wp-json/` | 2026-09-12 13:21 UTC | VERIFIED (feature advertised) | Live bridge auth | Operator creates dedicated password later; do not create/print secrets here | WS2/operator |
| Application Password official availability rule | Core feature since WP 5.6; default available over HTTPS; may be disabled by filter | https://developer.wordpress.org/advanced-administration/security/application-passwords/ | 2026-09-12 | VERIFIED (docs) | None | Confirm profile UI / `wp_is_application_passwords_available` on host | Operator |
| Bridge health endpoint exists | `404` on `GET/HEAD /wp-json/cetech-pos/v1/health`; namespace absent | curl HEAD | 2026-09-12 13:21:35 UTC | VERIFIED | Expected until BR-01 deploy | BR-01 | WS2 |
| HPOS feature exists (docs vs this store) | Official: Woo ≥8.2 has HPOS; default on for *new* installs. This store’s mode unknown | https://woocommerce.com/document/high-performance-order-storage/ | 2026-09-12 | VERIFIED (docs) / UNVERIFIED (this store) | BR-06 / G3, not BR-01 | WooCommerce → Settings → Advanced → Features; do not toggle | Operator |
| HPOS compatibility check passes | UNVERIFIED | No admin/CLI | 2026-09-12 | UNVERIFIED | BR-06 if incompatible plugins | Read-only incompatible-plugins list | Operator |
| HPOS compatibility mode enabled | UNVERIFIED | No admin/CLI | 2026-09-12 | UNVERIFIED | Not BR-01 | Same Features screen | Operator |
| HPOS enabled | UNVERIFIED | `LIVE-ENVIRONMENT-FACTS.md`; Site Health pass ≠ enabled | 2026-09-12 | UNVERIFIED | BR-06 | Official UI/CLI read | Operator |
| HPOS custom tables authoritative | UNVERIFIED | Official: authoritative iff HPOS selected / `woocommerce_custom_orders_table_enabled` true | 2026-09-12 | UNVERIFIED | BR-06 prepare/resolve | `OrderUtil::custom_orders_table_usage_is_enabled()` via authorized CLI; do not toggle | Operator |
| Woo stock management | UNVERIFIED | LIVE facts | 2026-09-12 | UNVERIFIED | BR-06 / G3 | Woo inventory settings read-only | Operator |
| Backorders | UNVERIFIED | LIVE facts | 2026-09-12 | UNVERIFIED | BR-06 | Same | Operator |
| VitePOS Woo single-stock vs outlet/multi-stock | UNVERIFIED | LIVE facts | 2026-09-12 | UNVERIFIED | BR-06 / cutover | VitePOS settings read-only | Operator |
| VitePOS pending/offline queue | UNVERIFIED | LIVE facts | 2026-09-12 | UNVERIFIED | REL-01 / cutover | Device queue inspection | Operator |
| Barcode source | UNVERIFIED | LIVE facts | 2026-09-12 | UNVERIFIED | CORE-04 / FE-03 live scan | Product attribute/meta mapping | WS3/WS2 |
| Currency | UNVERIFIED (GHS expected, not proven) | DOMAIN-CONTRACTS.md; LIVE facts | 2026-09-12 | UNVERIFIED | Quote/prepare live | Woo general settings | Operator |
| Woo price decimal precision/rounding | UNVERIFIED | LIVE facts | 2026-09-12 | UNVERIFIED | BR-02+ parity | Woo currency options | Operator |
| Fractional-quantity usage | UNVERIFIED | LIVE facts | 2026-09-12 | UNVERIFIED | Quote/prepare | Product unit settings | Operator |
| Tax/GRA/fiscal process | UNVERIFIED | LIVE facts | 2026-09-12 | UNVERIFIED | BR-05 / release | Tax settings + business process | WS3/operator |
| Stock reservation/reduction | UNVERIFIED | LIVE facts; ADR-008 | 2026-09-12 | UNVERIFIED | BR-06 | Observe prepare on staging later | WS2 |
| Active VitePOS operations | UNVERIFIED | LIVE facts | 2026-09-12 | UNVERIFIED | Cutover | Shift/queue audit | Operator |
| WoodMart Dynamic Discount rules configured | UNVERIFIED; official docs describe Theme Settings → Shop + Products → Dynamic Discounts | https://xtemos.com/docs-topic/dynamic-discounts/ (updated 2026-08-13) | 2026-09-12 | UNVERIFIED | BR-03/05 | Count/list rules only; no proprietary hook selected | WS2/operator |
| B2BKing groups/tier/customer-specific rules configured | UNVERIFIED; official docs describe group prices, customer price lists, tiers | https://woocommerce-b2b-plugin.com/docs/how-to-set-different-prices-for-different-users-groups/ | 2026-09-12 | UNVERIFIED | BR-04/05 | List groups/rule kinds only; no customer PII | WS2/operator |
| WoodMart/B2BKing overlap/precedence | UNVERIFIED | PRICING-PARITY.md | 2026-09-12 | UNVERIFIED | BR-05 / G2 | Isolated runtime matrix | WS2 |
| Paystack / production payment provider | Paystack gateway 5.8.5 installed inactive; methods user-confirmed in use; technical config UNVERIFIED | LIVE facts | 2026-09-12 | USER-REPORTED / UNVERIFIED | PAY-01 / release | Do not activate or test-charge | WS3 |
| Staging sanitization | UNVERIFIED | LIVE facts | 2026-09-12 | UNVERIFIED | Privileged catalog/customer reads | Operator confirmation | WS3 |
| Hosting (nginx/PHP-FPM) | User-reported Linux/nginx/PHP-FPM; public `Server: cloudflare` only | LIVE facts vs HEAD | 2026-09-12 | USER-REPORTED (origin) / VERIFIED (CF edge) | None for BR-01 | Do not change hosting | Operator |
| Repo inspection tooling for live Woo/HPOS | None. TOOLCHAIN.md: PHP/Woo/WP tests still unavailable. No WP-CLI/PHP locally | TOOLCHAIN.md + local PATH | 2026-09-12 | REPOSITORY-VERIFIED / VERIFIED | Live HPOS/version proof | Operator CLI/admin | WS3/WS2 |
| Foundation verifier | PASS | `python scripts/verify_control_plane.py` exit 0 | 2026-09-12 13:21 UTC | VERIFIED | Control-plane | Re-run on BR-01 | WS2 |

## BR-01 Entry Assessment

No BR-01 plugin implementation exists. `wordpress/cetech-pos-bridge/` remains README-only. These results are intake evidence for WS3, not BR-01 completion or a deployed skeleton.

| Gate | Status |
| --- | --- |
| **BR-01 CODE PREREQUISITES** | ready for WS3 review |
| **BR-01 LIVE/RUNTIME ACCEPTANCE** | still blocked on authorized staging/service-identity evidence |

BR-01 local implementation may begin after WS3 accepts this intake. BR-01 runtime acceptance remains blocked pending authorized staging/service-identity evidence. This intake does not complete CP-04, does not complete or approve BR-01, and does not authorize staging installation. Pricing parity remains entirely unverified.

| Prerequisite | Result | Notes |
| --- | --- | --- |
| CP-03 frozen bridgeHealth / BridgeHealth v1.0.0 | **PASS** | Contracts on inspected HEAD; OpenAPI + schema unchanged |
| CP-04 facts needed to *target* later BR-01 local implementation (PHP/WP/Woo/theme/plugin names as user-reported) | **PASS** | Recorded; must not be treated as independently proven versions |
| Safe public read of reported host without creating commerce effects | **PASS** | GET/HEAD only |
| HTTPS available on reported host | **PASS** | TLS `200` |
| Application Password feature advertised on reported host | **PASS** | Official public REST `authentication.application-passwords` |
| Dedicated bridge user/capability already exists | **NOT REQUIRED FOR BR-01** | Creation is a later authorized operator action; do not create now |
| Independently proven `WP_ENVIRONMENT_TYPE=staging` and production isolation | **NOT REQUIRED FOR BR-01** local implementation; **BLOCKED** for live install/privileged admin on this host | Operator checklist below |
| Independently proven WP/Woo/PHP/theme/plugin *versions* | **NOT REQUIRED FOR BR-01** implementation; **BLOCKED** for compatibility *declaration* | TASKS.md risk: versions required before declaring compatibility |
| HPOS enabled / authoritative tables | **NOT REQUIRED FOR BR-01** | First required by BR-06 |
| Woo stock / backorders / VitePOS stock mode / queue | **NOT REQUIRED FOR BR-01** | BR-06 / cutover |
| Barcode / currency / decimals / fractional qty / tax | **NOT REQUIRED FOR BR-01** | BR-02+ / CORE-04 / release |
| WoodMart rules configured / B2BKing rules configured / overlap | **NOT REQUIRED FOR BR-01** | BR-03/04/05; detection ≠ configured ≠ parity |
| Payment provider / Paystack / sanitization | **NOT REQUIRED FOR BR-01** | PAY-01 / release |
| Local PHP/`make` already present | **NOT REQUIRED FOR BR-01** start; BR-01 *creates* check/test targets. Local PHP currently missing | Do not mark later `make` PASS without PHP |
| No BR-01 plugin code in repo yet | Expected | BR-01 implements it |

## BR-01 Contract Snapshot

Inspected files: `docs/contracts/bridge-api.openapi.json`, `docs/contracts/pos-domain.schema.json`, `docs/contracts/API-CONVENTIONS.md`, `docs/contracts/ERROR-CONTRACT.md`. No contract fields invented or changed.

* **Path:** `GET /wp-json/cetech-pos/v1/health` (`servers.url` `/wp-json/cetech-pos/v1` + path `/health`)
* **operationId:** `bridgeHealth`
* **Authentication:** OpenAPI root `security: [{ bridgeService: [] }]`. `bridgeService` = HTTP Basic over TLS; description: dedicated WordPress application password with explicit bridge capability; server only.
* **Correlation:** required header `X-Correlation-ID` (`Uuid`). Echoed as `correlationId`. Not an idempotency key. Health is a GET; no `Idempotency-Key`.
* **Success envelope:** `{ ok: true, data: BridgeHealth, correlationId }` — `additionalProperties: false`
* **Failure envelope:** `$ref` `ApiFailure` — `{ ok: false, error: { code, message, retryable, nextAction, details? }, correlationId }` — closed objects; `details` allowlist `field` / `operationId` / `currentQuoteId` only
* **BridgeHealth** required fields only (`additionalProperties: false`):
  * `status`: `healthy` \| `degraded` \| `unavailable`
  * `contractVersion`: const `1.0.0`
  * `wooDetected`: boolean
  * `woodmartDetected`: boolean
  * `b2bkingDetected`: boolean
  * `pricingParityVerified`: boolean
* **Closed-field policy:** request/response schemas reject unexpected fields; additive fields still need reader compatibility tests.
* **Acceptance already specified:** unauthenticated/unauthorized rejected; health must **never** set `pricingParityVerified=true` from plugin/theme detection alone.

BR-01, once approved to implement, may add only: plugin bootstrap/build/`make check`/`make test`; a dedicated capability; authenticated `bridgeHealth`; official WP detection (`is_plugin_active` / `wp_get_theme` or equivalent core APIs). It may not implement quote/prepare/finalize, select WoodMart/B2BKing proprietary pricing hooks, claim parity, or edit contracts.

## Later-Task Evidence Matrix

| Unknown / unverified fact | First task/gate that actually requires it |
| --- | --- |
| Independently proven staging isolation + sanitization | Live BR-01 deploy / privileged CP-04 remaining audit (not local implementation start) |
| Dedicated bridge identity + capability + app password | Live authenticated health (after BR-01 code exists) |
| Exact WP/Woo/PHP/theme/plugin versions | Compatibility declaration; keep targeting user-reported until then |
| HPOS compatibility / enabled / authoritative tables | BR-06, G3 |
| Woo stock, backorders, reserve/reduce behavior | BR-06, G3 |
| Isolated whole-cart quote / guest+retail | BR-02 |
| WoodMart Dynamic Discount *configured* rules + thresholds | BR-03 |
| B2BKing groups/tier/customer-specific *configured* rules | BR-04 |
| Overlap/precedence + tax/exemption/rounding matrix | BR-05, G2 |
| Currency, decimals, fractional quantities | BR-02 live quotes; reject incompatible currency per DOMAIN-CONTRACTS |
| Barcode source | CORE-04 / FE-03 live scan |
| VitePOS stock mode, pending queue, active shifts | REL-01 / cutover (ADR-009) |
| Payment provider technical config / Paystack | PAY-01 / release |
| Tax/GRA/fiscal / statutory invoice | Release gates / cutover |
| Local PHP runtime for `make -C wordpress/cetech-pos-bridge` | BR-01 test execution after targets exist |

Official docs consulted (no proprietary hook selected for BR-02):

* WordPress Application Passwords: https://developer.wordpress.org/advanced-administration/security/application-passwords/ and https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/
* WooCommerce HPOS: https://woocommerce.com/document/high-performance-order-storage/ and https://developer.woocommerce.com/docs/features/orders/high-performance-order-storage/
* Woo HPOS-safe order access: Woo CRUD / REST `wc/v3/orders`; detect authoritative tables with official `OrderUtil::custom_orders_table_usage_is_enabled()` — https://developer.woocommerce.com/docs/features/orders/high-performance-order-storage/recipe-book/
* WoodMart Dynamic Discounts (admin configuration only): https://xtemos.com/docs-topic/dynamic-discounts/
* B2BKing groups / customer lists / tiers: https://woocommerce-b2b-plugin.com/docs/how-to-set-different-prices-for-different-users-groups/

Installed ≠ active ≠ version-current ≠ rules-configured ≠ parity-verified.

## Security Notes

* No secrets captured; no Application Password created or requested.
* No private customer, order, or staff records copied. REST index parsed for `url`, `home`, `authentication` keys, and filtered namespaces only. Full route map not retained.
* Public REST currently sends `access-control-allow-origin: *` and VitePOS header names. Observed only; **not changed**. Bridge must still ship with no public privileged CORS (API-CONVENTIONS.md).
* Logs/redacted evidence in this file contain host, HTTP statuses, and namespace names only.
* No plugin install/activate, no HPOS toggle, no tax/stock/order/user/CORS/visibility changes, no GitHub admin changes, no production writes.

## Commands / Checks

Repository (this workstation):

```text
git fetch origin
# origin/main moved 15287691… → 095696f15…
git pull --ff-only origin main
git checkout -b ws2/cp-04-commerce-intake
python --version
# Python 3.14.3
php --version
# php not recognized (exit via missing command)
wp --info
# wp not recognized
python scripts/verify_control_plane.py
# exit 0
# PASS: 3 workstream packages, 30 scoped tasks/DAG, 28 immutable reference files, 61 schemas, 22 contract fixtures, shared OpenAPI refs, generated types, errors/state guards, local links and secret tripwires.
# LIMIT: no application/bridge/RLS/live payment/pricing/hardware tests have run in this foundation check.
```

`gh` CLI is not installed. Issue state used:

```text
curl.exe -sS -H "Accept: application/vnd.github+json" -H "User-Agent: cetech-ws2-intake" https://api.github.com/repos/WB-DevWorld/cetech-pwa-pos/issues/4
curl.exe -sS -H "Accept: application/vnd.github+json" -H "User-Agent: cetech-ws2-intake" https://api.github.com/repos/WB-DevWorld/cetech-pwa-pos/issues/13
# #4 open, assignee wbdevworld; #13 open, unassigned
```

Live-runtime (read-only; not a version or HPOS proof):

```text
curl.exe -sS -I --max-time 20 --ssl-revoke-best-effort https://training.cetechbpa.com/
# HTTP/1.1 200 OK; Server: cloudflare
curl.exe -sS -I --max-time 20 --ssl-revoke-best-effort https://training.cetechbpa.com/wp-json/
# HTTP/1.1 200 OK; Link rel="https://api.w.org/"; Allow: GET
curl.exe -sS -I --max-time 20 --ssl-revoke-best-effort https://training.cetechbpa.com/wp-json/cetech-pos/v1/health
# HTTP/1.1 404 Not Found
# Then GET /wp-json/ parsed in-memory for authentication keys + filtered namespaces only.
```

Further privileged runtime inspection **stopped** because staging cannot be independently distinguished from production and remaining facts require admin/CLI or would risk commerce/PII.

## Operator checklist (authorized human, read-only unless separately authorized)

Perform on the confirmed staging clone only. Do not paste secrets into chat. Do not create orders, users, or Application Passwords unless a later task authorizes it. Do not toggle HPOS.

1. Confirm production URL and that `training.cetechbpa.com` is not production; record `WP_ENVIRONMENT_TYPE`.
2. Site Health or WP-CLI: `wp core version`; `wp plugin list`; `wp theme list`; PHP version.
3. WooCommerce → Settings → Advanced → Features: order data storage (posts vs HPOS), compatibility mode, incompatible-plugin list. Screenshot/redact; do not change.
4. Optional later (not BR-01): inventory, currency, decimals, tax, VitePOS stock/queue, WoodMart Dynamic Discounts rule count, B2BKing group count.
5. After BR-01 code exists and staging is confirmed: create a dedicated least-privilege bridge identity + Application Password + capability out-of-band.

## Decision

BR-01 local implementation may begin after WS3 accepts this intake; BR-01 runtime acceptance remains blocked pending authorized staging/service-identity evidence.

| Gate | Status |
| --- | --- |
| **BR-01 CODE PREREQUISITES** | ready for WS3 review |
| **BR-01 LIVE/RUNTIME ACCEPTANCE** | still blocked on authorized staging/service-identity evidence |

This is an evidence recommendation to WS3/reviewer. It is **not** permission to declare CP-04 complete, complete or approve BR-01, prove HPOS, prove pricing parity, authorize staging installation, or claim that a BR-01 skeleton already exists.

CP-04 remains **PARTIAL** and WS3-owned. Live authenticated BR-01 proof still requires an authorized service identity/capability and safe staging confirmation.

## Recommended Next Task

After WS3 accepts this intake: BR-01 / issue #13 — Build bridge health and permission skeleton (`ws2/br-01-health` / `ws2/br-01-build-bridge-health-and-permission-skeleton`).

Do not begin BR-01 in this branch. Do not treat this intake as CP-04 done.
