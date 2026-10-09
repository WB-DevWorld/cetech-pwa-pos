# Corrected-source Preview decision — history Reprint (NOT READY TO DISPATCH)

Status: **DECISION READY — ORDINARY WORKFLOW BLOCKED ON ORIGIN**  
Review date refresh: 2026-10-09 UTC (closeout).  
Prior one-off f0 exception (`dpl_4Vk3XQ…` / BUILD_ID `f0feb44…`) is **consumed**.  
Staff-documentation impact: **NONE** · Production effects: **NONE** if authorized as Preview-only  
Do **not** dispatch Exact SHA Preview until an owner origin exception is granted or protected-main tooling is separately authorized to clear Preview `APP_ORIGIN`.

## Published source (GitHub-visible)

| Role | Full SHA | Notes |
| --- | --- | --- |
| Selected base / prior #144 head | `7d5778fe904792360947d88122050e529587aa51` | Root last read |
| Product correction | `542d3ef2f862394a762de43eacf00c724b17aaec` | Application composition + unit regression |
| Integration-test tip (pre-freeze working tree) | `e0c5bcf4dca4970803afc94f7a35cdb7ef5597f2` + uncommitted e2e harness | Product files still match `542d3ef`; freeze after integration commit |
| Freeze tip for dispatch | **Re-verify exact PR head after CI green** | Git source SHA = request `BUILD_ID` |

Branch: `ws3/combined-candidate-2026-10-08` · PR: https://github.com/WB-DevWorld/cetech-pwa-pos/pull/144

### Tree equivalence (product composition)

| Compare | Result |
| --- | --- |
| `pos-app.tsx` + `history-receipt-ports.ts` @ `542d3ef` ↔ current tip | **identical** unless a product defect forces change |
| bridge / database | **unchanged** |

## Inspected Exact SHA Preview behavior (protected main)

Trusted workflow: `.github/workflows/deploy-exact-sha-preview.yml` on protected main `c49045dd…` family.  
Deploy authority: `scripts/exact_sha_preview.py` `create_payload()`:

```text
"env": {"BUILD_ID": sha},
"build": {"env": {"BUILD_ID": sha}},
```

**No** `APP_ORIGIN` / `NEXT_PUBLIC_APP_ORIGIN` keys are set or cleared.

### Effective Preview configuration (non-secret inspection, 2026-10-09)

Account / team / project: `wbdevworld` / `team_d9vbGZ8t7FDiO94FTROnmE6r` / `prj_tgfdys6XJN9HLDRbAvelsLlOt5lq` (`cetech-pos-staging`).

| Name | Type | Environments | Relevance |
| --- | --- | --- | --- |
| `APP_ORIGIN` | **Secret** | Preview (project-wide) | Inherited by ordinary Exact SHA Preview; **blocks new immutable Preview hostnames** when it names a fixed origin |
| `ALLOWED_ORIGINS` | Config | Preview | Also present; do not wildcard |
| `BUILD_ID` | Config | several branch-scoped Previews | Request override to candidate SHA still required |
| Branch-scoped `APP_ORIGIN` | Config | `ws3/management-remediation-2026-10-03` only | Not the Exact SHA path |

Values were **not** printed. Presence + Secret type is sufficient to invalidate the prior prose claim that Exact SHA Preview sends “empty origin overrides.”

### Application admission behavior

`resolveAppOrigin` / `staffAllowedOrigins()` prefer explicit `APP_ORIGIN` over platform `VERCEL_URL`. A fixed Preview Secret therefore rejects cookies/API on a new `*.vercel.app` immutable host — the same class that broke earlier Preview qualification (`Access denied` / FORBIDDEN), distinct from BUILD_ID identity.

## Concrete ready decision

| Field | Value |
| --- | --- |
| Preferred path | Trusted `Exact SHA Preview` **after** origin gate is satisfied |
| Ordinary workflow alone | **NOT ADEQUATE** today — payload sets only `BUILD_ID`; Preview Secret `APP_ORIGIN` remains |
| `candidate_sha` | Exact #144 head after freeze + CI green (product composition still = `542d3ef…`) |
| `BUILD_ID` | **Must equal** Git source SHA |
| Target | Preview only; **do not** move shared tester alias |
| Label | **Do not** call the deployment `f0` |
| Independent review | Required: non-author APPROVED on exact head. Current reviews list: **empty**. Root technical ACCEPT ≠ human approval. AI acceptance ≠ review. |
| CI gate | `control-plane` + `control-plane-windows` SUCCESS on candidate SHA |
| f0 retention | Keep `dpl_4Vk3XQ…` / `f0feb44…` |

### Owner exception required (one request, when ready)

Ask once for a **one-off per-deployment** Preview create that:

1. Uses Git source SHA = `BUILD_ID` = frozen #144 head;
2. Supplies **empty** `APP_ORIGIN` and `NEXT_PUBLIC_APP_ORIGIN` deployment overrides (or equivalent candidate-only origin admission for that immutable host only);
3. Does **not** edit project-wide Preview Secret, weaken Exact SHA review gates, amend protected-main tooling silently, move the shared tester alias, or target production.

Exact payload shape (manual CLI / authorized operator only — **not** granted by this decision doc):

```text
# Illustrative — execute only after owner exception + exact-head APPROVED + CI green
# Git SHA S = freeze head
vercel deploy --prebuilt …   # or trusted workflow after tooling/exception
# deployment env must include:
#   BUILD_ID=<S>
#   APP_ORIGIN=            (empty override)
#   NEXT_PUBLIC_APP_ORIGIN= (empty override)
# target: Preview; alias: unchanged
```

Until that exception (or separately authorized protected-main payload change) lands, **do not** run:

```text
gh workflow run "Exact SHA Preview" --ref main -f candidate_sha=<sha> -f pr_number=144
```

— it would create a Preview whose inherited `APP_ORIGIN` Secret likely rejects the new origin.

## Post-deploy qualification (after authorized deploy only)

On the **new** immutable Preview (not f0):

1. Sign in with no selected register / selected register without open shift.
2. Orders → 50317 / txn `33326bbc…` → Reprint offered.
3. Mount stored receipt → print dialog → cancel/return → cleanup → repeat Reprint.
4. Zero prepare/pay/finalize/stock/bridge.
5. Confirm SW `?build=<candidate_sha>` and release-policy builds match Git SHA.

## Rollback

- Leave f0 Preview `dpl_4Vk3XQ…` retained.
- Do not alias-switch.
- Source rollback: revert product commit on the PR branch if needed.

## Tests retained before this decision

| Check | Result |
| --- | --- |
| Vitest `pos-app.receipt-reprint.test.tsx` | **7 passed** |
| Playwright Orders composition (corrected vs checkout-only) | **1 passed** — `apps/pos-web/e2e/orders-history-reprint-composition.spec.ts` |
| Scope vs IMPACT allowlist | test-only e2e + docs |
| Independent GitHub review on #144 | **none** at decision refresh |
| Current tip CI @ `e0c5bcf…` | control-plane / control-plane-windows **SUCCESS** |
