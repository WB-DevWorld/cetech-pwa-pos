# Concrete corrected-Preview deployment request

Status: **DISPATCHED · READY** — owner approval GRANTED `2026-10-09T07:53:29Z` (empty origins + missing independent-review exception for this Preview only). Independent APPROVED still not claimed.  
Live: `dpl_F3uXpLZA7xrkTb5av4TNzDc3ZGry` · https://cetech-pos-staging-srx2grakx-wbdevworlds-projects.vercel.app · BUILD_ID `452c446fd0e3821fc3bfdb5de85a01d19a331809`  
Account `wbdevworld` · team `team_d9vbGZ8t7FDiO94FTROnmE6r` · project `prj_tgfdys6XJN9HLDRbAvelsLlOt5lq`  
f0 retained: `dpl_4Vk3XQ…` / BUILD_ID `f0feb44…` — do not attribute Reprint fix to f0  
Staff-documentation impact: **NONE**  
Receipt: `PREVIEW-452c446-DEPLOY-RECEIPT.md`

## Source

| Field | Value |
| --- | --- |
| Branch / PR | `ws3/combined-candidate-2026-10-08` / #144 |
| `candidate_sha` / Git source / `BUILD_ID` | `452c446fd0e3821fc3bfdb5de85a01d19a331809` |
| Product composition | Still matches `542d3ef2f862394a762de43eacf00c724b17aaec` for `pos-app.tsx` + `history-receipt-ports.ts` |

## Why ordinary Exact SHA Preview is insufficient

`scripts/exact_sha_preview.py` `create_payload()` sets only:

```json
"env": { "BUILD_ID": "<sha>" },
"build": { "env": { "BUILD_ID": "<sha>" } }
```

Project Preview still inherits **Secret** `APP_ORIGIN` (presence verified via `vercel env ls preview`; value not read). Explicit `APP_ORIGIN` wins over platform hostname → new immutable hosts get FORBIDDEN / Access denied.

## Validated request shape (matches working f0 pattern)

Same team/project/Git-linked deploy as f0 (`dpl_4Vk3XQ…`), which used BUILD_ID + **empty** `APP_ORIGIN` / `NEXT_PUBLIC_APP_ORIGIN` overrides. Ordinary workflow must **not** be silently substituted.

### Literal `POST /v13/deployments` body (tokens omitted)

Fill `<SHA>` and `repoId` from live project link at dispatch. No `--prod`. No alias assignment.

```json
{
  "name": "cetech-pos-staging",
  "project": "prj_tgfdys6XJN9HLDRbAvelsLlOt5lq",
  "gitSource": {
    "type": "github",
    "org": "WB-DevWorld",
    "repo": "cetech-pwa-pos",
    "ref": "ws3/combined-candidate-2026-10-08",
    "sha": "<SHA>",
    "repoId": "<from Vercel project Git link>"
  },
  "gitMetadata": {
    "remoteUrl": "https://github.com/WB-DevWorld/cetech-pwa-pos.git",
    "commitRef": "ws3/combined-candidate-2026-10-08",
    "commitSha": "<SHA>",
    "dirty": false,
    "ci": true,
    "ciType": "github-actions"
  },
  "target": null,
  "env": {
    "BUILD_ID": "<SHA>",
    "APP_ORIGIN": "",
    "NEXT_PUBLIC_APP_ORIGIN": ""
  },
  "build": {
    "env": {
      "BUILD_ID": "<SHA>",
      "APP_ORIGIN": "",
      "NEXT_PUBLIC_APP_ORIGIN": ""
    }
  }
}
```

### Equivalent authenticated CLI (operator machine; no token in docs)

```text
# Prerequisites: vercel whoami = wbdevworld; scope wbdevworlds-projects;
# CI green + APPROVED on <SHA>; owner exception for empty origin overrides granted.
# From a clean checkout of <SHA> at repo root (CD-01 prebuilt path):

vercel pull --environment=preview --scope wbdevworlds-projects --yes
$env:BUILD_ID="<SHA>"
vercel build --scope wbdevworlds-projects
vercel deploy --prebuilt --scope wbdevworlds-projects --yes `
  --env BUILD_ID=<SHA> `
  --env APP_ORIGIN= `
  --env NEXT_PUBLIC_APP_ORIGIN= `
  --build-env BUILD_ID=<SHA> `
  --build-env APP_ORIGIN= `
  --build-env NEXT_PUBLIC_APP_ORIGIN=
```

Empty `--env APP_ORIGIN=` / `--build-env APP_ORIGIN=` is the intentional override (same class as f0). Do **not** edit project-wide Secret. Do **not** move shared tester alias. Do **not** label the result `f0`.

## Post-READY checks (only after authorized deploy)

1. Metadata: Preview target; Git SHA = `<SHA>`; BUILD_ID request + observed release-policy / SW `?build=<SHA>`.
2. Same-origin session: Origin = immutable host → AUTH_REQUIRED without cookie (not FORBIDDEN).
3. Orders Reprint for 50317: no register; selected register without open shift; amount/currency unchanged; print dialog + cleanup; no new sale.

## Rollback

Retain f0. Leave shared tester. Delete or ignore the new Preview if origin/BUILD_ID wrong — no alias change required.
