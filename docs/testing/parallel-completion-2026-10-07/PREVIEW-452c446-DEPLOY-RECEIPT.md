# Preview 452c446 — deploy receipt (owner-approved empty origin)

Status: **READY · origin admission VERIFIED · staff sign-in / Orders Reprint IN PROGRESS**  
Acting: `@wbdevworld` / WS3  
Owner approval: **GRANTED** `2026-10-09T07:53:29Z` (empty origin overrides + missing independent-review exception for this Preview only)  
Owner PR #144 bypass acceptance: `2026-10-09T07:58:44Z` · COMMENT review `5467420094` pinned to `452c446…` (owner acceptance, not independent APPROVED)  
Staff-documentation impact: **NONE**  
Production / alias / merge: **NOT** authorized by this receipt

## Deployment

| Field | Value |
| --- | --- |
| id | `dpl_F3uXpLZA7xrkTb5av4TNzDc3ZGry` |
| immutable URL | https://cetech-pos-staging-srx2grakx-wbdevworlds-projects.vercel.app |
| git / BUILD_ID | `452c446fd0e3821fc3bfdb5de85a01d19a331809` |
| product composition | still matches `542d3ef2f862394a762de43eacf00c724b17aaec` |
| target | preview (`null` omitted on create; inspect shows preview) |
| readyState | **READY** (created ~2026-10-09T08:15:38Z) |
| payload | BUILD_ID + empty `APP_ORIGIN` / `NEXT_PUBLIC_APP_ORIGIN` (env + build.env); `target` omitted (API rejects `null`) |
| branch alias (auto) | `…git-ws3-combined-853272…` only |
| shared tester | **unchanged** — release-policy still `816e0bb6963aff760609a3c7e4817e603c4ffdf0` |
| f0 retained | `dpl_4Vk3XQ…` / `gqg6tjedt` / BUILD_ID `f0feb44…` |
| prior automatic SHA Preview | `dpl_jq6HMj6…` / `aocddzqog` — **not** origin-qualified (no BUILD_ID / NEXT_PUBLIC_APP_ORIGIN override keys) |

## Runtime identity checks (unauthenticated)

| Check | Result |
| --- | --- |
| `GET /api/pos/v1/release-policy` (+ `X-Correlation-ID`) | `latestBuild` / `recommendedBuild` / `minimumSupportedBuild` = `452c446…` |
| `GET /sw.js?build=452c446…` | 200 |
| `manifest.webmanifest` | 200 standalone CETECH POS |
| Same-origin `GET /api/pos/v1/session` | **401 AUTH_REQUIRED** (not FORBIDDEN) |
| UI | Sign-in form visible (not Access denied) |

## Remaining on this Preview

1. Operator staff sign-in (private; no passwords in chat/evidence)
2. Orders Reprint for existing `50317` / `rcpt-33326bbc` / GHS29 — no register; selected register without open shift; print dialog + cleanup; no new sale
3. Authenticated software checks (search/cart/draft/offline/Pay disablement) per Lane 2

## Rollback

Retain f0 and shared tester. Ignore/delete this Preview if identity wrong — no protected-alias change required.
