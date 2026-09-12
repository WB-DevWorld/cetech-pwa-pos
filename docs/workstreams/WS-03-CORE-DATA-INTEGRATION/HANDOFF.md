# WS3 current handoff — CP-05

Task: CP-05 — Pin toolchain and create Next.js/CI scaffold (issue #5).
Branch: `ws3/cp-05-pin-toolchain-and-create-next.js-ci-scaffold`
Commit(s):
- `c768230e3c1e7f219521a1853a7b299c92fbd1bf` — original implementation
- PR #32 review remediation commit on this branch (verifier walk split, ledger cleanup, CI evidence). Exact SHA is the PR head after that commit is pushed.
Base: `origin/main` `15287691a71081ca2855b5b9bc325a787b2ca7c0`.
Files changed: root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`; `apps/pos-web` App Router scaffold, tests, Playwright smoke; `.github/workflows/ci.yml`; `docs/standards/TOOLCHAIN.md`; lease/status/handoff; `scripts/verify_control_plane.py` generated-tree skip with artifact still on the secret tripwire; `tests/tooling/test_control_plane_walks.py`.
Contracts changed: none (v1.0.0 unchanged). Canonical re-export into `src/core/**` deferred.
Database migrations: none.
Architecture decisions: none. ADR-010 remains CURRENT; versions pinned from official sources rather than memory.
Toolchain selected: Node 24.21.0; pnpm 12.4.1; Next 16.3.4; React 19.3.0; TypeScript 6.0.3; ESLint 9.39.5 + eslint-config-next 16.3.4; Vitest 5.0.0; Vite 8.3.0 (Vitest peer only); Playwright 1.63.0.
Tests executed (Windows, Node v24.21.0, pnpm 12.4.1, Python 3.14.4):
- `python scripts/verify_control_plane.py` — EXIT 0
- `python -m unittest discover -s tests/tooling -v` — EXIT 0
- `pnpm install --frozen-lockfile` — EXIT 0
- `pnpm --dir apps/pos-web lint` — EXIT 0
- `pnpm --dir apps/pos-web typecheck` — EXIT 0 (`next typegen && tsc --noEmit`)
- `pnpm --dir apps/pos-web test` — EXIT 0 (1 file / 1 test)
- `pnpm --dir apps/pos-web build` — EXIT 0
- `pnpm --dir apps/pos-web exec playwright install chromium` — EXIT 0
- `pnpm --dir apps/pos-web test:e2e` — EXIT 0 (1 passed)
- `git diff --check` — EXIT 0
CI: GitHub Actions run [34694148734](https://github.com/WB-DevWorld/cetech-pwa-pos/actions/runs/34694148734)
- **control-plane** — SUCCESS. Linux ran foundation verifier, tooling tests, frozen install, lint, typecheck, unit, production build, and Playwright E2E.
- **control-plane-windows** — SUCCESS. Windows ran foundation verifier, tooling tests, frozen install, lint, typecheck, unit, and production build.
Runtime verification: local production `next start` smoke via Playwright. No Woo/Supabase/payment/auth runtime.
Assumptions: GitHub Actions `ubuntu-latest` / `windows-latest` install Node 24.21.0 and pnpm 12.4.1 from the pinned action SHAs. Linux CI uses `playwright install --with-deps chromium`.
Known limitations: executable foundation only. No staff auth, schema/RLS, BFF, bridge, pricing, catalog, Dexie, cash, payment, returns, service worker, installed PWA, or production evidence. `actions/checkout` remains pinned at v4.2.2; GHA annotates Node 20 deprecation inside that existing pin (non-blocking follow-up).
Unresolved risks: CP-04 live facts remain PARTIAL; CORE-01 still needs CP-04 as well as this scaffold; FE-02 still needs FE-01. Live branch read 2026-09-12: `main` `protected=true`; required checks include `control-plane` and `control-plane-windows`. This task does not change branch-protection settings. Human review of PR #32 is still required.
What this unblocks: WS1 FE-02 after FE-01; WS3 CORE-01 still also needs CP-04; WS2 BR-01 still needs CP-04. Not CORE-01 in this PR.
Requested reviewer: verified second human for senior-authored work (@wbdevworld cannot self-approve).
Recommended next task: complete remaining CP-04 evidence; FE-01 mapping; do not start CORE-01 until CP-04 and this merge.

Previous CP-01/02/03 handoff retained below.

# WS3 bootstrap handoff

Task: CP-01/02/03 engineering control plane and contract baseline.
Branch: main, authorized initial bootstrap in initially empty repository.
Commits: 026abb210af24108c9cf907a6071ec22fbe80cd9; 9229334a994760c715a546392eb8f80623708218; subsequent evidence documentation commit.

Files changed: 165 foundation files; final documentation adds one review file.
Contracts changed: initial v1.0.0 schema, generated types, ports, OpenAPI, errors and state machine.
Database migrations: none.
Architecture decisions: ADR-001–010.
Tests executed: python3 scripts/verify_control_plane.py PASS; YAML parse PASS; GitHub setup dry-run PASS; GitHub CI control-plane PASS on 9229334.
Runtime verification: GitHub main/ref/tree and 30 issues confirmed; every foundation blob SHA matched. No POS runtime exists yet.
Assumptions: live facts left UNVERIFIED; source chronology reconciled from supplied record and current instructions.
Known limitations: no app/PHP/RLS/payment/hardware tests; runtime validator/toolchain scaffold pending; M2 refund wire refinement pending.
Unresolved risks: colleague access, private-repo protection capability, actual stock/pricing/payment/tax facts.
Requested reviewer: senior/user and verified second human for senior-authored architecture work; no self-approval claimed.
Recommended next task: CP-04 live audit + CP-05 shared scaffold; FE-01 mapping; CP-04 evidence before BR-01.
