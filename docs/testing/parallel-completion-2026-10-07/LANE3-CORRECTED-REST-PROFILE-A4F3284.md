# Lane 3 — corrected isolated `rest_api_init` profiling (a4f3284)

Task: `A4-RECOVERY-CASH-AND-PROFILING-03`  
Acting: `@wbdevworld` / WS3 · UTC `2026-10-10T03:12Z`–`03:16Z`  
Staff-documentation impact: **NONE**  
Live #132 / cashier speed: **NOT CLOSED**  
Owner auth required: **NONE** (local isolated only)

## Isolation / tool pin (reused, not reinstalled)

| Item | Value |
| --- | --- |
| App / DB | `cetech-pos-r10-woo-app` + `cetech-pos-r10-woo-20261009` on `cetech-pos-r10-woo-iso` |
| Outbound | `training.cetechbpa.com` **NO_DNS** |
| URL | `http://127.0.0.1:8088/` (HOME, not REST URL) |
| Phar | WP-CLI **2.12.0** under `%LOCALAPPDATA%\CETECH-POS-R10\a4-wpcli-profile-20261010\` |
| Profile package | `wp-cli/profile-command` ref **8202ab5** via existing `--require` bootstrap |
| PHP | container **8.3.35** · `memory_limit=512M` |
| Processes used | **2** (max) · wall ~114s + ~115s |

## Process 1 — focused `profile hook rest_api_init`

| Field | Result |
| --- | --- |
| Exit | **0** |
| stderr control | `{"profile_control":"rest_api_init_count","count":1}` |
| stdout | `[]` |
| stdout SHA-256 | `4F53CDA18C2BAA0C0354BB5F9A3ECBE5ED12AB4D8E11BA873C2F11161202B945` |
| Interpretation | **nested-init capture missing** — not zero cost. Profiler depth-zero filter did not emit focused callback rows while first init did run (count=1). |

## Process 2 — fallback `profile hook --all`

| Field | Result |
| --- | --- |
| Exit | **non-zero** (fatal during early invoke) |
| stderr control | still emitted `rest_api_init_count` **count=1** |
| Fatal | `Class "WP_CLI\Path" not found` in `profile-command` `Profiler.php:660` under this phar + `--require` bootstrap path |
| stdout | empty (SHA-256 of empty file `E3B0C442…`) |
| Top-five inclusive parents | **NOT CAPTURED** |

Stopped per packet: malformed/failed fallback; no third process; no profiler patch; no plugin disable; no training quote.

## Attribution status

| Need | Status |
| --- | --- |
| Exclusive REST callback timings | **UNAVAILABLE** (nested-init missing) |
| Inclusive top-level parent costs | **UNAVAILABLE** (`WP_CLI\Path` incompatibility on `--all`) |
| Prior registration inventory (88 callbacks) | still valid as **names only** — see `LANE2-REST-CALLBACK-ATTRIBUTION-A4F3284.md` |

## Narrow hypothesis (unchanged class; still untimed)

Shared first-load REST registration remains the leading hypothesis for cold REST cost on this clone. Without measured parent/callback times, **do not** rank Woo vs WP Rocket vs B2BKing vs bridge. Bridge remains one registered callback among many.

**Regression surface if later fixing measurement:** request-scoped HTTP first-init profile on isolated URL only, or a profiler bootstrap that provides `WP_CLI\Path` without editing vendor plugins — separate measured manifest.

**CLI vs HTTP differences to state:** WP-CLI runs `wp()` + template loader after bootstrap; object-cache/Redis and request auth differ from cashier BFF→bridge quote on training FPM.
