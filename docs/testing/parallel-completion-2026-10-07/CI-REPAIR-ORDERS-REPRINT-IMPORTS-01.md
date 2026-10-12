# CI repair — Orders Reprint harness import depth

Status: **SOURCE FIXED · local verify PASSED · awaiting PR CI on published head**  
Acting: `@wbdevworld` / WS3 · 2026-10-09  
Staff-documentation impact: **NONE** · Production effects: **NONE**

## Defect

`apps/pos-web/e2e/orders-reprint-composition-harness.tsx` lives under `apps/pos-web/e2e/`. Its type imports pointed at `../../../../docs/contracts/…` (one directory too high). Vite erased the type-only imports so Playwright passed locally while `tsc` failed on Linux and Windows App typecheck (runs `37893974254` / `37893968380` on head `14cc175…`).

## Fix

```diff
- ../../../../docs/contracts/domain.generated
+ ../../../docs/contracts/domain.generated
- ../../../../docs/contracts/ports
+ ../../../docs/contracts/ports
```

No product or commercial behavior change.

## Scope / gitignore reconciliation

- `scope-print-history-reprint-integration.json` now includes `.gitignore`.
- Root `.gitignore` retains reviewed `apps/pos-web/e2e/.tmp-orders-reprint/`.
- Removed redundant trailing `.vercel` / `.env*` duplicates (`.env.*` already present). Untracked `apps/pos-web/.gitignore` not added.

## Local verification

| Check | Result |
| --- | --- |
| `pnpm --dir apps/pos-web run typecheck` | **PASSED** |
| `pnpm --dir apps/pos-web exec playwright test -c e2e/orders-reprint.playwright.config.ts` | **1 passed** |
| Product `pos-app.tsx` / `history-receipt-ports.ts` | **unchanged** vs `542d3ef…` |

## Heads

| Role | SHA |
| --- | --- |
| Broken reviewed head | `14cc175ecfc19135d9a956481348dd81f0809142` |
| Prior freeze (obsolete for deploy) | `2e6d704228a522f1f5728c5f2d70cfb08c90e393` |
| Corrected head | *(record after this commit)* |
