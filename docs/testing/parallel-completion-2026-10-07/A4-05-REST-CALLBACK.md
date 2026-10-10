# A4-05 nested REST callback

Acting: `@wbdevworld` / WS3  
UTC: `2026-10-10T07:18Z`  
Isolated clone only. No training request, no plugin disable, no live optimization.

## Retained profile (not re-run)

| Check | Result |
| --- | --- |
| File | `%LOCALAPPDATA%\CETECH-POS-R10\a4-wpcli-profile-20261010\profile-hook-all-v215.stdout.json` |
| SHA-256 | `08315F036CEF3F46EF589BC91A16454B0B4872D7DD2E4DD3F9E8A1CDF13DB283` |
| Rows | **618** |
| `rest_api_init` rows | **1**, recorded time about **0.00003s** |

That near-zero time is the depth-zero profiler looking at a nested hook. It is not the cost of the callbacks inside `rest_api_init`. `rocket_init()` remains the large CLI parent from the earlier `--all` capture. It is not the callback measured here.

## This request

The clone network `cetech-pos-r10-woo-iso` is internal, so Docker did not wire a host port even when `127.0.0.1:8088` was requested. Apache inside the clone listens on port 80. A temporary process on the clone forwarded `127.0.0.1:8088` to port 80 for the measurement, then that process was removed.

One application POST:

`POST http://127.0.0.1:8088/index.php?rest_route=/cetech-pos/v1/quotes`

Client request id `7c2a1e44-6b0d-4f1a-9c3e-2a8b6d0e5f17`. No training credential. Result **401** `AUTH_REQUIRED`: “Authentication is required for the CETECH POS bridge.” Correlation `66291566-51f6-46e0-9720-4b8896d73a77`. That denial happens after route registration. It did not price a cart.

Two earlier requests did not produce this measurement. A pretty `/wp-json/...` URL was an Apache 404 because rewrites did not map it. A following front-controller request exhausted the default 128M PHP memory in `chaty/admin/class-admin-base.php` and returned HTTP 500 before the observer could finish. The measured request raised memory to 512M from the temporary observer, which matches the memory bound already required for this clone.

## Named callback

| Field | Value |
| --- | --- |
| Callback | `WoolentorOptions\Api->register_routes` |
| File | `wp-content/plugins/woolentor-addons/includes/admin-panel/includes/classes/Api.php` line **93** |
| Inclusive time | **2.798s** |
| Parent | direct `rest_api_init` callback |
| Direct callbacks timed | **82**, summing **9.96s**. That sum is the observed callbacks only. It is not complete REST-init coverage. |
| Untimed residual | **8** route registrations added during the hook (Code Snippets REST controllers and two WP Rocket MCP transports). Their time was not allocated. It is not folded into the Woolentor registrar. |

Next largest direct callbacks were `WP\MCP\Core\McpAdapter->init` (1.293s), WooCommerce `Server->register_rest_routes` (1.291s), WooCommerce `register_wp_admin_settings` (0.937s), and a MailPoet REST closure (0.922s).

## Local quote-only A/B

`WoolentorOptions\Api::register_routes` only constructs Woolentor admin API controllers and calls `register_rest_route`. The settings controller also reads the admin field catalog and adds a Woolentor settings sanitize filter. That is not POS pricing, tax, customer, stock, or checkout state. The plugin stayed loaded. The exclusion applied only to `POST /cetech-pos/v1/quotes`.

Cap before the run: two quote POSTs and one Woolentor GET. No retries. Same isolated container, loopback to Apache on port 80, memory limit 512M, cron unchanged.

| Pair | HTTP | Wall time | Woolentor registrar |
| --- | --- | --- | --- |
| Baseline `a4b06-baseline-7c2a1e44-6b0d-4f1a-9c3e-2a8b6d0e5f21` | 401 `AUTH_REQUIRED` | 106.097s | not removed |
| Candidate `a4b06-candidate-8d3b2f55-7c1e-4a2b-8d4f-3b9c7e1a6d32` | 401 `AUTH_REQUIRED` | 91.599s | removed |
| Own request `GET /woolentoropt/v1/settings` | 401 `rest_forbidden` “WOOLENTOR OPT: Permission Denied.” | 89.716s | not removed |

The candidate was 14.5s faster on this single pair. That is larger than the 2.798s inclusive sample and these requests vary by more than a few seconds, so the pair does not prove a stable gain. The exclusion was removed afterwards. This is not a live speed change and not a pricing-parity result. Issues #115 and #132 stay open.

## Hypothesis, not a change

If a later task moves `WoolentorOptions\Api->register_routes` off the quote request’s `rest_api_init`, this isolated sample says that one callback is the largest named piece, about 2.8s of roughly 10s of direct callback time. The risk is that Woolentor’s own admin or API routes would not register on the request that needs them. Rollback is to put that registration back on `rest_api_init`. This was not changed. It is not a cashier speed improvement. Issues #115 and #132 stay open.

## Postconditions

The observer, forwarder, and helper scripts were removed. `cetech-pos-r10-woo-app` is the original container again: no host port binding, network still internal, `DISABLE_WP_CRON` still true.
