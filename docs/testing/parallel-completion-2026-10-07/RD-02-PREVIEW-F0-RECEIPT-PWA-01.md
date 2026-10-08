# RD-02 — f0 Preview existing-receipt + candidate local/PWA checks

Status: **COMPLETE for authorized non-sale path**  
Preview: `dpl_4Vk3XQsjoqweKD6jH1qiE1echsMy` / https://cetech-pos-staging-gqg6tjedt-wbdevworlds-projects.vercel.app  
BUILD_ID / gitSha: `f0feb44e9b3b241f0f712d3e306a9b768e0a070a`  
A+D sale: **not repeated**  
Staff-documentation impact: **NONE**  
Verdict: **NOT READY FOR PRODUCTION**

## Session (after operator staff sign-in)

| Field | Value |
| --- | --- |
| organizationId | `org_a` |
| actorId | `manager_a` |
| assignedLocationIds | `loc_a1`, `loc_a2` |
| assignedRegisterIds | `reg_a`, `reg_a2`, `reg_b` |
| Preview register/shift chrome | **No register / No open shift** (expected on this Preview; open-shift was on shared tester) |

## Existing receipt (txn `33326bbc-1dd7-4582-8409-ea434942d8db`)

| Check | Result |
| --- | --- |
| `GET /api/pos/v1/receipts/33326bbc-…` | **200** · `rcpt-33326bbc` · orderReference **50317** · total **2900 GHS** · 1 line |
| Reload same GET | **identical identity** (id / txn / total) |
| Orders UI | Lists **50317 / POS-50317** · CashVerified · GHS 29.00 · Completed |
| Order detail display | Walk-in · Cash Verified · GHS 29.00 · Register A · line gloves · txn id shown under Reference |
| `GET /api/pos/v1/orders/33326bbc-…` | **200** · receiptNumber `POS-50317` · status completed |
| UI **Reprint** button | **absent** (printer port not wired → `onReprint` undefined) |
| Physical printer | **named hardware gap** — unchanged |

## Candidate local Sell / Register (no tender)

| Check | Result |
| --- | --- |
| Search `49111` + add qty 1 | Product found; cart line present |
| Authoritative quote | Pay label became **Pay GHS 29.00** |
| Clear without Pay | Cart cleared; Pay disabled — **no prepare/cash/finalize** |
| Register page | Hydrates open-register UI; device: “No active device available”; did **not** open shift |
| Rapid physical scanner | **UNVERIFIED** — no hardware |

## PWA / update identity

| Check | Result |
| --- | --- |
| `serviceWorker` | controlling=true · 1 registration |
| SW scriptURL | `/sw.js?build=f0feb44e9b3b241f0f712d3e306a9b768e0a070a` |
| release-policy | recommended/latest/minimumSupported = `f0feb44…` |
| `manifest.webmanifest` | 200 standalone (earlier create evidence) |

## Commercial records recheck (training)

| Check | Result |
| --- | --- |
| Product 49111 `_stock` | **3** (unchanged after quote-only) |
| No second sale | Honored |

## Prior Preview

`dpl_8pUT…` retained; release-lifecycle qualification incomplete (FORBIDDEN + local-dev BUILD_ID).
