# STG-05 training Woo catalog producer

Kind: TASK_COMPLETION evidence (WS2). Not live catalog/quote PASS on training and not a commercial sale.

- Task: STG-05 / issue #74
- Owner (commerce boundary): @Emmanuel-coder-prog / WS2
- Actual implementer (task-specific senior reassignment 2026-09-17): @wbdevworld
- Branch: `ws2/stg-05-training-bridge-runtime`
- Start SHA: `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`
- Plugin version: `0.6.0-stg05` (prior `0.5.0-br08`)
- DB version unchanged: **5**
- Contracts: **NONE** (producer DTO is bridge-local; POS `posItemId` is assigned by STG-04)
- `pricingParityVerified`: **false**

This is contributor-branch evidence. It does not close #70, #25, #54, or #4. It does not authorize production mutation.

## Existing training routes (inspected before adding)

Public `GET https://training.cetechbpa.com/wp-json/cetech-pos/v1` (unauthenticated, 2026-09-17) lists:

- `GET /health`
- `POST /quotes`
- `POST /sales/prepare`
- `GET /sales/{transactionId}`
- `POST /sales/finalize`
- `POST /sales/cancel`

No catalog producer existed in source (`class-plugin.php` registered 10 routes: health, quotes, prepare, resolve, finalize, cancel, commercial-refund + resolve, stock-disposition + resolve). Training's live namespace index does not yet include BR-08 return routes or catalog; that is a training deploy lag, not a second producer.

## New producer (smallest addition)

`GET /wp-json/cetech-pos/v1/catalog`

Auth: same dedicated `cetech_pos_bridge_access` capability as health/quotes. Server-to-server only.

Query:

| Param | Meaning |
| --- | --- |
| `cursor` | exclusive positive Woo product id string |
| `limit` | 1–200, default 50 |
| `modifiedAfter` | frozen Timestamp; filters `post_modified_gmt` |

Envelope `data`: `{ items, nextCursor }`.

Each item (no prices, no POS ids, no WP internals):

| Field | Source |
| --- | --- |
| `sourceSystem` | `woocommerce` |
| `sourceItemId` | Woo product/variation id as string |
| `sourceParentId` | variation parent Woo id as string |
| `sourceVersion` | `{sourceUpdatedAt}:{sourceItemId}` |
| `name` | Woo name |
| `sku` | Woo SKU **string** (omitted if empty) |
| `barcodes` | SKU string when present (CP-04 training barcode source = SKU) |
| `kind` | `simple` / `variable` / `variation` |
| `variationLabel` | attribute summary when present |
| `purchasable` | Woo `is_purchasable()` |
| `stockStatus` | `in_stock` / `out_of_stock` / `backorder` / `unknown` |
| `sourceUpdatedAt` | GMT ISO-Z |
| `deleted` | `true` when status is `trash` |

Grouped/external/unknown types are omitted. Listing uses product CPTs (`product`, `product_variation`); HPOS is an order store and is not used for this read.

STG-04 must assign opaque `posItemId` values and map `sourceParentId` onto local parent identity. Do not store WoodMart/B2BKing prices from this feed.

## Quote path (unchanged)

Authoritative quotes remain `POST /quotes` through isolated Woo runtime + B2BKing/WoodMart as already implemented. This task does not add a pricing engine. Harness retail/guest/variation quotes and B2B pricing-rule/prepare cases remain green. Live training quote with the dedicated service identity was **not** executed in this agent environment.

## Training probes (redacted; no credentials)

| Probe | Result | Classification |
| --- | --- | --- |
| `https://training.cetechbpa.com/` | HTTP 200 | host up |
| `GET /wp-json/` | HTTP 200 | WP REST index |
| `GET /wp-json/cetech-pos/v1/health` unauthenticated | HTTP 401 | route present; closed auth |
| `POST /wp-json/cetech-pos/v1/quotes` unauthenticated | HTTP 401 | route present; closed auth |
| `GET /wp-json/cetech-pos/v1/catalog` unauthenticated | HTTP 400 `rest_no_route` (bridge envelope) | catalog **not deployed** on training yet |
| Authenticated health/catalog/quote | not attempted | `BLOCKED_TRAINING_BRIDGE_CREDENTIALS_UNAVAILABLE` |
| Live B2B training quote | not attempted | `BLOCKED_TRAINING_BRIDGE_CREDENTIALS_UNAVAILABLE` |
| New training cash sale | not attempted | `BLOCKED_TRAINING_CASH_SALE_AWAITING_STG02_SESSION_AND_CP04` |

No customer PII. No secrets printed or committed. No live electronic payment. No production mutation. No refund/restock.

## Checks

Host: PHP **8.5.0** NTS, Node **24.21.0**, pnpm **12.4.1** frozen install (local `node_modules` only). Canonical syntax image: `php:8.5-cli` **8.5.10**.

| Command | Result |
| --- | --- |
| `python scripts/verify_control_plane.py` | PASS |
| `docker run php:8.5-cli make -C wordpress/cetech-pos-bridge check` | PASS (including catalog engine/controller) |
| `php tests/bridge/run.php` (make `test` equivalent; Windows `make` cannot run `command -v`) | **1614 passed, 0 failed** |
| `php tests/bridge/parity.php` | **138 passed, 0 failed, 19 skipped** |
| `git diff --check` | PASS |

Windows GNU Make `check`/`test`/`parity` fail in cmd.exe because the Makefile uses POSIX `command -v`. That is a pre-existing host limitation, not a plugin defect.

BR-06/BR-07 prepare/resolve/finalize/cancel regressions ran inside the same PHP suite and stayed green.

## Remaining blockers

- Training must be deployed with plugin `0.6.0-stg05` before a live catalog page can exist.
- Dedicated bridge Application Password is not present in this agent environment; do not paste it into chat.
- Live retail/B2B quote and authorized cash sale wait on credentials + STG-02 session authority + CP-04 synthetic-effect authorization.
- Issue #4 remains OPEN. `pricingParityVerified` remains false.
