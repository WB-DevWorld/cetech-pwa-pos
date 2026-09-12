# Toolchain and available checks

Pinned 2026-09-12 from official registries/docs. Exact versions, not floating `latest` ranges. Owner: WS3.

| Component | Selected version | Official source / support | Compatibility reason |
| --- | --- | --- | --- |
| Node.js | **24.21.0** (engines `>=24.21.0 <25`) | [nodejs.org download](https://nodejs.org/en/download) Active LTS 24.x Krypton; [nodejs/Release](https://github.com/nodejs/Release) Active LTS until 2026-10-20, security until 2028-04-30. Latest LTS patch 24.21.0 (2026-09-08). Node 26.8.2 is Current, not LTS. | Production POS uses LTS, not Current. Next 16.3.4 engines are `>=20.9.0`. Vitest 5 requires `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0`, so Node 20 cannot run the unit suite. |
| pnpm | **12.4.1** | npm dist-tags `latest` and `latest-12` = 12.4.1 (queried 2026-09-12). [pnpm 12.0](https://pnpm.io/blog/releases/12.0) stable since 2026-08-26. | Current stable npm `latest`. Not a pre-release. Pinned via root `packageManager` and CI `pnpm/action-setup`. |
| Next.js | **16.3.4** | [Support policy](https://nextjs.org/support-policy): 16.x Active LTS (released 2025-10-21). [v16.3.3](https://github.com/vercel/next.js/releases/tag/v16.3.3) security patches (Windows RCE GHSA-p293-qw3h-jr36; AVIF image-opt RCE GHSA-2xp9-vwfh-vxw4). [v16.3.4](https://github.com/vercel/next.js/releases/tag/v16.3.4) (2026-08-31) re-enables AVIF after the upstream fix. Snyk: 16.3.4 has no known direct vulns. 16.4 is canary-only. | Active LTS plus the post-16.3.3 security line. No production credentials required to build. |
| React / react-dom | **19.3.0** | [React 19.3 blog](https://react.dev/blog/2026/09/09/react-19-3) (2026-09-09). npm `latest` = 19.3.0. Next 16.3.4 peer: `^18.2.0 \|\| ^19.0.0`. | Current React stable inside Next’s declared peer range. |
| TypeScript | **6.0.3** | npm TS 6 line = 6.0.3. TS **7.0.2** is npm `latest`. Next 16.3.4 can drive `tsc` for TS 7, but `eslint-config-next@16.3.4` → `typescript-eslint@8.70.0` peers are `>=4.8.4 <6.1.0`. Proven with `pnpm peers check` on 2026-09-12 when TS 7.0.2 was installed. | Safer currently supported lint+Next combination. TS 7 is rejected for this scaffold because it breaks the required real ESLint path. `typecheck` still runs real `tsc --noEmit` after `next typegen`. `typescript.ignoreBuildErrors` is not set. |
| ESLint | **9.39.5** (npm `maintenance`) + **eslint-config-next 16.3.4** | npm `latest` = 10.10.0; `maintenance` = 9.39.5. `eslint-plugin-import` / `jsx-a11y` / `react` pulled by eslint-config-next 16.3.4 peer `eslint ^9`, not 10. Proven by `pnpm peers check`. Official Next 16.3.4 template uses flat `eslint.config.mjs` (`next lint` is not used). | Real ESLint. ESLint 10 is current latest but incompatible with this Next 16.3.4 plugin set. npm marks 9.39.5 deprecated in favor of 10; that is a dist-tag signal, not Next-plugin compatibility. |
| Vitest | **5.0.0** | npm `latest` = 5.0.0 (beta/rc exist; not used). engines `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0`. | Current stable unit runner. Requires Vite as a non-optional peer. |
| Vite | **8.3.0** | npm `latest` = 8.3.0. Vitest 5 peer `^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0`. | Installed only because Vitest 5 cannot run without it. Not an extra bundler/architecture. |
| Playwright | **@playwright/test 1.63.0** | npm `latest` = 1.63.0. engines `>=20`. Next 16.3.4 optional peer `^1.51.1`. | Current stable browser smoke runner. Not a Woo/payment/PWA proof. |
| @types/node | **24.13.4** | Latest 24.x on npm 2026-09-12 (npm `latest` tag remains 22.20.2). | Matches Node 24 typings. |
| GitHub Actions | checkout `11bd719…` v4.2.2 (existing); setup-python `ece7cb0…` v6 (existing); setup-node `8207627…` **v7.0.0**; pnpm/action-setup `ea17c68…` **v6.1.0** | Release tags resolved to commit SHAs via GitHub API 2026-09-12. | Immutable SHA pins. Job names **control-plane** and **control-plane-windows** preserved. |

Python 3.10+ remains the foundation verifier runtime. Local Windows uses `python`; Linux/CI uses `python3` where that is the installed command.

## Clean install

Linux / macOS:

```text
# Node 24.21.0 LTS from nodejs.org or a version manager
corepack enable
corepack prepare pnpm@12.4.1 --activate
pnpm install --frozen-lockfile
```

Windows (PowerShell):

```text
# Node 24.21.0 LTS from nodejs.org or a version manager
corepack enable
corepack prepare pnpm@12.4.1 --activate
pnpm install --frozen-lockfile
```

There is one lockfile: root `pnpm-lock.yaml`. Do not add `apps/pos-web/pnpm-lock.yaml`. Root and app packages are private. `pnpm-workspace.yaml` lists only `apps/pos-web`. pnpm 12 requires explicit `allowBuilds` in that file; this scaffold allows `unrs-resolver` (eslint TypeScript resolver native postinstall) and no other dependency build scripts.

## App commands

All of these are Windows-compatible (no Bash-only wrappers). Run from the repository root:

| Command | Proves |
| --- | --- |
| `pnpm --dir apps/pos-web lint` | ESLint flat config over the app. |
| `pnpm --dir apps/pos-web typecheck` | `next typegen` then `tsc --noEmit` with `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`. |
| `pnpm --dir apps/pos-web test` | Vitest run of the scaffold page unit test (non-empty). |
| `pnpm --dir apps/pos-web build` | Next production build. No Woo/Supabase/payment secrets required. |
| `pnpm --dir apps/pos-web test:e2e` | Playwright Chromium smoke: start the Next app, open `/`, assert the scaffold heading. Not connectivity, pricing, auth, payment, cash, or PWA. |
| `pnpm --dir apps/pos-web dev` | Local App Router server for WS1 inspection. |

## Playwright browsers

Once per machine (Windows/macOS contributors):

```text
pnpm --dir apps/pos-web exec playwright install chromium
```

Linux CI / Linux workstations with OS deps:

```text
pnpm --dir apps/pos-web exec playwright install --with-deps chromium
```

Local `test:e2e` builds then starts the production server. GitHub Actions `CI=true` reuses the workflow `build` step and only runs `pnpm start`.

## CI mapping

Protected context names are unchanged: **control-plane** (Linux) and **control-plane-windows**.

| Job | Checks |
| --- | --- |
| control-plane | `python3 scripts/verify_control_plane.py`; `python3 -m unittest discover -s tests/tooling -v`; Node 24.21.0; pnpm 12.4.1; `pnpm install --frozen-lockfile`; app lint; typecheck; unit test; production build; Playwright Chromium with OS deps; app E2E smoke. |
| control-plane-windows | Existing CRLF/reference Python 3.10 path, then the same frozen install, lint, typecheck, unit test, and build. No Windows browser install in CP-05. |

Foundation verifier still proves generator drift, schema fixtures, and **strict** reference hashes. After CP-05 it skips `node_modules`, `.next`, Playwright output, `coverage`, `dist`, and `out` so third-party README links are not treated as project contracts. It does not prove POS runtime correctness. App commands do not require production Woo, WordPress, Supabase, or Paystack credentials.

## WS1 / Ben handoff (after CP-05 merge)

- App package: `apps/pos-web`.
- Composition entry: `apps/pos-web/src/app/layout.tsx`, `apps/pos-web/src/app/page.tsx`.
- WS1 owns `apps/pos-web/src/features/**` and `apps/pos-web/src/ui/**`.
- WS1 delivers route-mount instructions; WS3 performs `src/app/**` composition.
- Canonical contracts stay in `docs/contracts`. Do not recreate Money/Quantity/Quote/Payment/Sale/ports in the app.
- Frontend reference conversion has **not** occurred. FE-02 waits for FE-01 **and** this CP-05 merge.
- Commands Ben runs after merge: the clean install plus lint/typecheck/test/build above. E2E is optional for FE-01 mapping work.

## Still unavailable (later tasks)

PHP/Woo/WordPress compatibility tests (CP-04 + BR-01). Supabase CLI / `supabase db reset --local` (CORE-01). Runtime JSON Schema validator / producer-consumer harness (CORE-06). Dexie, Serwist, payment SDKs, and business adapters are not CP-05 dependencies.
