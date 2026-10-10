# Lane 2 — named `rest_api_init` attribution (isolated Woo)

Task: `A4-RECOVERY-AND-QUOTE-ATTRIBUTION-02`  
Acting: `@wbdevworld` / WS3 · UTC ~`2026-10-10T02:47Z`–`02:59Z`  
Staff-documentation impact: **NONE**  
Live FPM / #132 gate: **NOT CLOSED** by this lane  
Production effects: **NONE**

## Isolation (reconfirmed)

| Control | Result |
| --- | --- |
| App | `cetech-pos-r10-woo-app` on internal network `cetech-pos-r10-woo-iso` |
| DB | `cetech-pos-r10-woo-20261009` · host `127.0.0.1:3310` only |
| `training.cetechbpa.com` | **NO_DNS** inside app |
| Outbound ping `1.1.1.1` | fail (prior + this session) |
| `WP_HOME` / `WP_SITEURL` | `http://127.0.0.1:8088` |
| `DISABLE_WP_CRON` | true · `DB_HOST=db` |
| Profiling target | **isolated restore only** — not training DB |

## Tool pin (task-local)

| Item | Pin |
| --- | --- |
| Dir | `%LOCALAPPDATA%\CETECH-POS-R10\a4-wpcli-profile-20261010\` |
| `wp-cli.phar` | WP-CLI **2.12.0** · SHA-256 `CE34DDD8…20D85C` |
| `wp-cli/profile-command` | github `main` reference **`8202ab5`** (path package; Composer package-index blocked by local Avast TLS MITM — bootstrap via `--require` autoload) |
| Host PHP (phar help only) | 8.5.0 |
| Container PHP | **8.3.35** |
| WP | **7.1.2** |
| WooCommerce | **11.1.2** |
| Bridge plugin | `cetech-pos-bridge` **0.6.0-stg05** (isolated disk; training live remains `fa478ea4…` separately) |
| Memory | `php -d memory_limit=512M` required (128M OOM on plugin list) |

Private inventory JSON (not in Git): `...\a4-wpcli-profile-20261010\rest-api-init-inventory.json` (~23 KB).

## Timed `profile eval` result — exact limitation

Prescribed flow (`profile eval` + `rest_get_server()` once, `--hook=rest_api_init`) **cannot measure exclusive callback time on this stack via WP-CLI**:

After a fresh WP-CLI load (before any intentional `rest_get_server` in eval):

| Probe | Value |
| --- | --- |
| `did_action('rest_api_init')` | **1** |
| `$GLOBALS['wp_rest_server']` | **present** |
| Registered `rest_api_init` callbacks | **88** |

Therefore the process is already past first REST initialization. A guarded eval correctly targets `REST_ALREADY_INITIALIZED`; an unguarded second `rest_get_server()` does not re-fire meaningful init cost (observed empty `[]` JSON from one eval-file attempt). **Absent timing rows are not zero cost.**

CLI attribution here yields **named inventory**, not live FPM duration. Does **not** claim cashier speed gain.

Sample count for timed profile: **0 usable** (stopped on already-initialized REST). Inventory sample: **1** WP-CLI bootstrap.

## Callback inventory (registration, not exclusive time)

**88** callbacks registered. **79** at priority **10** (historical “priority-10 band” is dense, not a single culprit).

Plugin/theme path frequency (from file locations):

| Count | Source |
| ---: | --- |
| 24 | `woocommerce` |
| 10 | `wp-rocket` |
| 10 | `seo-by-rank-math` |
| 7 | `code-snippets` |
| 6 | `wp-core` (`wp-includes`) |
| 3 | `sitepress-multilingual-cms` (WPML) |
| 3 | theme `woodmart` |
| 3 | `woocommerce-analytics` |
| 3 | `support-genix` |
| 2 | `mailpoet` |
| 2 | `woolentor-addons` |
| 2 | `vitepos-lite` |
| 1 | **`cetech-pos-bridge`** → `Cetech_Pos_Bridge_Plugin->register_routes` @ `includes/class-plugin.php:86` |

Notable priority-10 named callbacks (candidates for a later request-scoped HTTP profile — not timed here):

- `B2bking->register_metadata` · `b2bking/includes/class-b2bking.php:6470`
- `Automattic\WooCommerce\RestApi\Server->register_rest_routes`
- Multiple `WP_Rocket\Engine\...` REST subscribers
- WoodMart/XTS Gutenberg REST field registrars
- `Cetech_Pos_Bridge_Plugin->register_routes` (present; **not** majority by count)

Time values: **UNALLOCATED** (exclusive vs nested unknown without a successful first-init profile).

## Difference vs training live shape

Isolated restore uses bridge package label **0.6.0-stg05** on disk; training runtime hash remains the accepted **`fa478ea4…`** proof. Plugin set is the captured training clone (heavy WP Rocket / Rank Math / WPML / Woolentor / MailPoet / VitePOS still active). Local registration density **can** inform hypotheses; it **does not** reproduce the measured ~8.8 s bridge phase on Preview quotes.

## Bounded remediation hypothesis (investigation only)

**Hypothesis:** First `rest_api_init` on this storefront is dominated by **many priority-10 route/metadata registrars** (Woo REST server + WP Rocket + Rank Math + B2BKing metadata + WoodMart), so any POS bridge quote that cold-starts or re-enters REST pays a large shared init tax before bridge work. Bridge `register_routes` is **one of 88**, not the plurality.

**Regression surface if later testing request-scoped deferral/lazy registration:** Woo/WoodMart/B2BKing admin & storefront REST, WP Rocket CDN/critical-CSS routes, Rank Math REST, WPML ATE routes, and POS bridge route availability. **Do not** disable plugins or edit vendor internals under this task.

**Next measurement (separate manifest):** one exact HTTP path on isolated URL only (or authorized training observer with path+runtime scope) that profiles **first** REST init — not another broad priority-band quote.
