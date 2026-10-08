# Lane 2 — installed PWA / device / offline (f0 Preview)

Status: **PARTIAL** · harness ≠ installed cashier PWA  
Preview: `dpl_4Vk3XQsjoqweKD6jH1qiE1echsMy` / https://cetech-pos-staging-gqg6tjedt-wbdevworlds-projects.vercel.app  
BUILD_ID / release-policy: `f0feb44e9b3b241f0f712d3e306a9b768e0a070a`  
Staff-documentation impact: **NONE**  
Production effects: **NONE** · no second sale · no IndexedDB wipe

## Environment

| Field | Value |
| --- | --- |
| Device | Windows 10 (Win32) Cursor embedded Chromium (Electron) |
| User-Agent | Cursor/3.22.7 Chrome/148… Electron/42.10.0 |
| display-mode | **browser** (not standalone) |
| Installed PWA / standalone launch | **NOT RUN** — ordinary embedded tab; manifest `display: standalone` alone is not install evidence |
| Physical scanner / receipt printer | **NOT RUN** — hardware unavailable in this session |

## Service worker / release

| Check | Result |
| --- | --- |
| SW registration | 1 · scope Preview origin |
| Active scriptURL | `/sw.js?build=f0feb44e9b3b241f0f712d3e306a9b768e0a070a` |
| Controller | observed controlling after navigation; one sample showed controller null until reload |
| release-policy | recommended/latest/minimumSupported = `f0feb44…` |

## Safe local draft (no Pay)

| Check | Result |
| --- | --- |
| Search `49111` | Found **XL INGCO Nitrile Frosted Coated Gloves** · SKU 49111 · In stock · listed GHS 29.00 |
| Add qty 1 | Cart line present; quantity controls available |
| Authoritative quote | **Failed closed** with cashier copy “You don't have permission to do this.” · Pay remained disabled · **truthful** (no silent price) |
| Catalog banner | “Products may be out of date…” · Attention badge 1 |
| Sample search latency | ~16 s wall time in harness (single sample; not a percentile; not attributed to reprint fix) |
| Reload / close-reopen draft persistence | **NOT RUN** — full reload dropped staff session in this harness before draft re-check |
| Offline → reconnect | **NOT RUN** (session lost before Network.emulateOffline) |
| Clear test draft | **NOT RUN** after session loss (prior cart had no prepare/tender) |

## Print / hardware on f0

| Check | Result |
| --- | --- |
| Browser print dialog on f0 (uncorrected composition) | Prior evidence: Reprint absent without printer ports; this session also had open shift on Register A but session ended before Orders re-check |
| Physical output width/totals | **NOT RUN** |
| Rapid distinct/repeated scans | **NOT RUN** |

## Label

All results above are **TEST-ONLY harness** unless performed later on the actual installed cashier client.
