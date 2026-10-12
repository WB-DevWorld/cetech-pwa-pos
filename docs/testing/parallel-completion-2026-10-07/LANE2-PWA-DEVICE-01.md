# Lane 2 — installed PWA / device / offline (f0 Preview)

Status: **PARTIAL (harness complete for safe draft/offline; installed PWA/hardware remain open)**  
Preview: `dpl_4Vk3XQsjoqweKD6jH1qiE1echsMy` / https://cetech-pos-staging-gqg6tjedt-wbdevworlds-projects.vercel.app  
BUILD_ID / release-policy: `f0feb44e9b3b241f0f712d3e306a9b768e0a070a`  
Lane 1 published SHA (source only; not this Preview): `542d3ef2f862394a762de43eacf00c724b17aaec`  
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
| Register chrome (this session) | **Register A · Shift open · Online** |

## Service worker / release

| Check | Result |
| --- | --- |
| SW registration | 1 · scope Preview origin |
| Active scriptURL | `/sw.js?build=f0feb44e9b3b241f0f712d3e306a9b768e0a070a` |
| Controller | **controlling=true** after signed-in session |
| release-policy | recommended/latest/minimumSupported = `f0feb44…` |

## Safe local draft (no Pay)

| Check | Result |
| --- | --- |
| Search `49111` | Found **XL INGCO Nitrile Frosted Coated Gloves** · SKU 49111 |
| Add qty 1 | Cart line present |
| Authoritative quote (later signed-in) | **Pay GHS 29.00** enabled (Register A / shift open) |
| Draft after re-sign-in | **PASSED** — qty 1 + Pay GHS 29.00 restored without second sale |
| Offline | Chrome **Offline**; local catalog searchable (`49111` found); cart qty retained; **Pay disabled** (truthful) |
| Reconnect | Chrome **Online**; **Pay GHS 29.00** restored |
| Clear test draft | **PASSED** — Clear sale confirmed; cart empty; Pay disabled; no commercial mutation |
| Sample search latency | ~16 s earlier harness sample (single sample; not a percentile) |

## Print / hardware on f0

| Check | Result |
| --- | --- |
| Orders detail 50317 | Walk-in · CashVerified · GHS 29.00 · Completed · POS-50317 |
| UI **Reprint** (this session) | **Present** — open shift supplies checkout-scoped ports on uncorrected f0 composition |
| Browser print after Reprint | Feedback **“Print dialog opened.”** (embedded Chromium; physical output not proven) |
| No-scope Reprint gap | Still the Lane 1 defect on builds without register/shift; corrected Preview still required for that path |
| Physical output width/totals | **NOT RUN** |
| Rapid distinct/repeated scans | **NOT RUN** |

## Label

All results above are **TEST-ONLY harness** unless performed later on the actual installed cashier client.
