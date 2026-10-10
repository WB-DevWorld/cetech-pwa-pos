# Lane 3 — timings and diagnostic quotes (a4f3284)

Status: **EXECUTED (measurement only)**  
Task: `A4-REMAINING-QUALIFICATION-01` · `@wbdevworld` / WS3  
UTC: `2026-10-10T02:12Z`–`02:16Z`  
Build: `a4f3284…` · Preview `dpl_FAaW712…` / `q2u9baevb`  
Staff-documentation impact: **NONE**  
Issues **#115** / **#132**: remain **OPEN** (not closed by this sample)

## Environment

| Field | Value |
| --- | --- |
| Browser | Cursor embedded Chromium (Chrome/148 family) on Windows 10 |
| Session | Staging Manager · Register A · Shift already open (not opened/closed here) |
| Catalog (IndexedDB `catalogItems`) | **262** (warm session) |
| Journal | **0** |
| Profiler helper | **PARKED** — not installed |

## Startup / Register / Sell waterfall (browser Resource Timing)

One signed-in Register hydration after soft navigation (warm). Navigation TTFB ~194 ms; DCL ~208 ms; load ~554 ms.

| Request | Duration ms | TTFB ms | Bytes (transferSize) |
| --- | --- | --- | --- |
| `/api/pos/v1/release-policy` | 362 | 359 | 469 |
| `/api/pos/v1/session` | 866 | 863 | 573 |
| `/api/pos/v1/registers/reg_a` | 1001 | 994 | 433 |
| `/api/pos/v1/registers/reg_a2` | 1447 | 1445 | 438 |
| `/api/pos/v1/registers/reg_b` | 1254 | 1248 | 434 |
| `/api/pos/v1/registers/reg_a/active-shift` (repeat×) | 1085–1881 | ~same | ~547 |
| `/api/pos/v1/registers/reg_a/devices` | 2807 | 2802 | 418 |
| `/api/pos/v1/registers/reg_a/close-presentation` | 1460–1897 | ~same | ~426 |
| `/api/pos/v1/admin/context` | 779 | 777 | 608 |
| `/api/pos/v1/attention` | 1148 | 1146 | 391 |
| `/api/pos/v1/payments/capabilities` | 460 | 455 | 431 |

API-filtered resource count this window: **16**. Repeated `active-shift` / `close-presentation` fetches observed; do **not** treat as proven production Strict Mode doubling without a separate production vs development comparison. Sell grid presented with Pay disabled.

### Local search / cart feedback

| Metric | Value |
| --- | --- |
| Device | Windows desktop · embedded Cursor browser |
| Catalog size | 262 IndexedDB items |
| Warm/cold | warm-session |
| Sample count | 1 |
| Search “14985” feedback | ~413 ms to visible Safety Goggles control |
| Physical scanner | **NOT PROVEN** (tester-owned) |

## Diagnostic quotes (≤3, sequential, quote-only)

Fixture class: Woo **14985** · qty **1** · customer **4** / B2B · `loc_a1` · POS product `63482776-2418-5db8-b794-ca5e6e516e67`  
Serializer: deployed `POST /api/pos/v1/quotes` + CSRF + fresh UUID correlation; 60 s browser deadline; zero automatic retries; no concurrency; no Pay/prepare.

Preflight: assignment includes `loc_a1`; product mapped and `in_stock` in projection; currency GHS on responses. Customer id `4` is not listed in the first page of `/customers` search UI but was accepted by the quote path.

| # | Correlation | Browser elapsed ms | HTTP | Total | Server-Timing (ms) |
| ---: | --- | ---: | ---: | --- | --- |
| 1 | `919c6c5c-e4ba-4533-8ecd-5811c2332885` | 10107 | 200 | GHS **3000** minor | bff 9736 · session 358 · assignments 162 · catalogIdentity 116 · **bridge 8837** · saveSnapshot 263 |
| 2 | `b8bc0df4-0a53-4d51-890c-5efc7517cd84` | 9905 | 200 | GHS **3000** minor | bff 9557 · session 129 · assignments 131 · catalogIdentity 132 · **bridge 8688** · saveSnapshot 477 |
| 3 | `7f412de0-73f2-497f-a1e3-00e7f38dcf27` | 10260 | 200 | GHS **3000** minor | bff 9815 · session 119 · assignments 129 · catalogIdentity 119 · **bridge 8856** · saveSnapshot 592 |

| Aggregate (n=3) | Value |
| --- | --- |
| Median browser elapsed | **10107** ms |
| Range | 9905–10260 ms |
| Dominant allocated phase | **bridge** (~8.7–8.9 s) |
| p95/p99 | **NOT CLAIMED** (n=3) |
| Upstream Woo phase split beyond bridge | **UNALLOCATED** |
| BFF log retention retrieval | **NOT ACCESSED** this session (limit stated once) |

Response bodies not stored. Active cashier draft preserved (quote cartIds were ephemeral). Equal GHS 3000 totals match historical STG-05 routing evidence class; **not** B2B price-parity proof.

## Issue disposition

| Issue | Disposition |
| --- | --- |
| #115 (PostgREST / related) | **OPEN** — absence of errors in this window does not resolve |
| #132 (quote performance) | **OPEN** — timings recorded; no before/after speed claim; does not close |

No pool/index/cache/hook changes. No additional timing helper installed.
