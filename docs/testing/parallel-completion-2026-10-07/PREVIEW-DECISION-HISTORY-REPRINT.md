# Corrected-source Preview decision — history Reprint (PENDING AUTHORIZATION)

Status: **DECISION PREPARED — NOT EXECUTED**  
This prompt does **not** grant a new manual deployment exception or shared alias move.  
Prior one-off f0 exception (`dpl_4Vk3XQ…` / BUILD_ID `f0feb44…`) is **consumed**.  
Staff-documentation impact: **NONE** · Production effects: **NONE** if authorized as Preview-only

## Published source (GitHub-visible)

| Role | Full SHA | Parent | Notes |
| --- | --- | --- | --- |
| Selected base / prior #144 head | `7d5778fe904792360947d88122050e529587aa51` | (prior) | Root last read |
| Product correction | `542d3ef2f862394a762de43eacf00c724b17aaec` | `7d5778f…` | Application composition + regression |
| Evidence tip (PR head at publish) | `67b008c95439e4b49964f06d41554fd21a7627e1` | `542d3ef…` | Docs-only vs product |
| App/bridge/db tree `542d3ef` ↔ `67b008c` | **identical under `apps/`** | — | `git diff --name-only 542d3ef… 67b008c… -- apps/` empty |

Branch: `ws3/combined-candidate-2026-10-08` · PR: https://github.com/WB-DevWorld/cetech-pwa-pos/pull/144

## Recommended candidate for Exact SHA Preview

Prefer **product SHA** when PR head equals it. If PR head is an evidence tip with empty `apps/` diff vs product:

| Field | Value |
| --- | --- |
| `candidate_sha` | Exact current PR head after CI green (record at dispatch; initially `67b008c…` or later tip if only docs/tests follow) |
| `BUILD_ID` request | **Same as Git source SHA** (do not label a different commit as `542d3ef`) |
| Application equivalence | If head ≠ `542d3ef`, prove empty `apps/` (+ no bridge/db) diff vs `542d3ef` in the decision receipt |
| Vercel account / team / project | `wbdevworld` / `team_d9vbGZ8t7FDiO94FTROnmE6r` / `prj_tgfdys6XJN9HLDRbAvelsLlOt5lq` |
| Target | Preview only (`null` / not production) |
| Same-origin | Empty `APP_ORIGIN` / `NEXT_PUBLIC_APP_ORIGIN` overrides (match f0 pattern) |
| Shared tester alias | **Do not move** (`…git-integration-9578df…` retained) |
| Label | **Do not** call this deployment `f0` |

### Authorized execution path (preferred)

After exact-head independent review + CI `control-plane` / `control-plane-windows` green on the candidate SHA, from trusted main:

```text
gh workflow run "Exact SHA Preview" --ref main -f candidate_sha=<40-char-pr-head> -f pr_number=144
```

Gates from CD-01 Exact SHA Preview: PR head must equal `candidate_sha`; required CI on that SHA; one non-author APPROVED review; no alias assignment.

### Manual CLI path (only if separately owner-authorized; not granted here)

Same payload shape as consumed f0 create: reviewed BUILD_ID = Git SHA, empty origin overrides, Preview target, no alias. Record immutable `dpl_…` URL and observed release-policy BUILD_ID after READY.

## Post-deploy qualification (after authorization only)

On the **new** immutable Preview (not f0):

1. Sign in without selecting register / without open shift (or clear register selection).
2. Orders → 50317 / txn `33326bbc…` → Reprint offered.
3. Mount stored receipt → print dialog → cancel/return → cleanup → repeat Reprint.
4. Zero prepare/pay/finalize/stock/bridge.
5. Confirm SW `?build=<candidate_sha>` and release-policy builds match.

## Rollback

- Leave f0 Preview `dpl_4Vk3XQ…` retained for prior evidence.
- Do not alias-switch.
- Source rollback: revert product commit on the PR branch if needed.

## Tests retained before this decision

| Check | Result |
| --- | --- |
| Vitest reprint + connected (32 tests @ pre-strengthen head) | PASSED |
| Expanded no-register + selected-register-no-shift negative control | See follow-up commit |
| `tsc --noEmit` / focused eslint | PASSED |
| Scope vs IMPACT-PRINT-HISTORY-REPRINT allowlist | PASSED |
