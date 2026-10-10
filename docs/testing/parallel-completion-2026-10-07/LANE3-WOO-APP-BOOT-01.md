# Lane 3 — Woo application boot (isolated) + read-only checks

Status: **APPLICATION BOOT + READ-ONLY CHECKS PASSED** (SQL checks remain separately accepted)  
Acting: `@wbdevworld` / WS3 · ~2026-10-09T08:34Z  
Staff-documentation impact: **NONE** · no training/storefront mutation · no secrets in evidence

## Files captured (private local)

| Artifact | Path (under `%LOCALAPPDATA%\CETECH-POS-R10\cetech-pos-r10-woo-20261009\`) | SHA-256 | Bytes |
| --- | --- | --- | --- |
| Prior partial (uploads+bridge+config) | `…-woo-files-…T062133Z.tgz` | `58093638eb2d866506312a6fb4811fb8b873e50c9e6301d3f86975bd34feff78` | 197224227 |
| Complement (core/themes/plugins/mu; agent) | `…-app-complement-…T081523Z.tgz` | `ac084f0acd2394a77d238702be85e1e8ea6470e40095bf2a1058932409d6ae8b` | 408661219 |
| Core subset (active-plugin path) | `…-app-core-20261009T081736Z.tgz` | `59123d8a1709c5dd2b7fba2b21d81492e1e4b257393bea93b7a1560dc591c0cc` | 175853192 |
| Coordinator missing-archive (duplicate class) | `…-app-missing-20261009T082312Z.tgz` | `37969e547ae605d71c5a0707082147b5ccaf695b4ff0f23b159c7e65bc5ff3b8` | 408554873 |
| Extract used for boot | `wordpress-app\` (also `app\`) | WP **7.1.2**; bridge+woo present | — |

Partial tarball was **not** re-copied. Remote `/tmp` cleanup after scp succeeded.

## Isolation

| Control | Result |
| --- | --- |
| Network | Docker network `cetech-pos-r10-woo-iso` (internal) — app `cetech-pos-r10-woo-app` + MariaDB `cetech-pos-r10-woo-20261009` |
| Host publish | App **no** host ports; DB remains `127.0.0.1:3310` only |
| Outbound probe | `training.cetechbpa.com` **NO_DNS**; `1.1.1.1` **Network is unreachable** |
| Cron | `DISABLE_WP_CRON=true` in restored `wp-config` |
| DB target | `DB_HOST=db` (container alias) · `DB_NAME=cetechtraining` — not training host |
| Site URL | `WP_HOME` / `WP_SITEURL` = `http://127.0.0.1:8088` (local rewrite) |

## Application read-only proof (PHP `wp-load`, memory 512M)

Distinct from accepted SQL verify.

| Check | Result |
| --- | --- |
| `WP_LOADED` | yes |
| Order **50317** `wc_get_order` | id **50317** · status **processing** · total **29.00** · currency **GHS** |
| HPOS `wp_wc_orders` | id 50317 · `wc-processing` · `29.00000000` · GHS |
| Stock **49111** | **3** |
| Stock **49663** | **1** |
| Price **49663** | **12500** |
| `cetech-pos-bridge` active | **yes** |
| WooCommerce active | **yes** |

## Limits

- Filesystem complement capture time ≠ SQL cutoff `20261009T062133Z` (not atomic).  
- First `wp-load` at 128M OOM’d in Woo admin fulfillments; checks pass at 512M.  
- No storefront/plugin runtime edits; no payments/webhooks exercised.
