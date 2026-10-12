# RD-02 — f0feb44 replacement Preview create

Status: **READY / origin admission VERIFIED; staff receipt path pending operator sign-in**  
Acting: `@wbdevworld` / WS3  
A+D sale: **not repeated** (cap consumed)  
Staff-documentation impact: **NONE**  
Verdict: **NOT READY FOR PRODUCTION**

## Auth / team

| Check | Result |
| --- | --- |
| CLI | Vercel CLI 63.1.0 (global, outside repo deps) |
| whoami | `wbdevworld` |
| Team | `team_d9vbGZ8t7FDiO94FTROnmE6r` / slug `wbdevworlds-projects` |
| Project | `prj_tgfdys6XJN9HLDRbAvelsLlOt5lq` / `cetech-pos-staging` |

## Deployment (one-Preview cap)

| Field | Value |
| --- | --- |
| id | `dpl_4Vk3XQsjoqweKD6jH1qiE1echsMy` |
| immutable URL | https://cetech-pos-staging-gqg6tjedt-wbdevworlds-projects.vercel.app |
| gitSha | `f0feb44e9b3b241f0f712d3e306a9b768e0a070a` |
| target | preview (`null` / not production) |
| readyState | **READY** |
| payload | reviewed BUILD_ID + empty `APP_ORIGIN` / `NEXT_PUBLIC_APP_ORIGIN` overrides |
| shared tester | `…git-integration-9578df…` still HTTP 200 — **not** moved |

## Runtime identity

| Check | Result |
| --- | --- |
| `GET /api/pos/v1/release-policy` | `latestBuild` / `recommendedBuild` / `minimumSupportedBuild` = `f0feb44e9b3b241f0f712d3e306a9b768e0a070a` |
| `GET /sw.js?build=f0feb44…` | 200 |
| `manifest.webmanifest` | 200 standalone CETECH POS |
| Same-origin `GET /session` (Origin=Preview, no cookie) | **401 AUTH_REQUIRED** (not FORBIDDEN) |
| UI | Sign-in form visible (not Access denied) |
| Prior Preview `dpl_8pUT…` | Retained; release-lifecycle qualification **incomplete** |

## Remaining on this Preview

1. Operator staff sign-in on immutable URL above  
2. `GET /api/pos/v1/receipts/33326bbc-1dd7-4582-8409-ea434942d8db` + display/reprint/reload  
3. Candidate local scanner/cart/quote-context/register-refresh + PWA update checks  
4. No prepare/cash/finalize / second sale  
