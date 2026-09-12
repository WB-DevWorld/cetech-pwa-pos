# pos-web

CP-05 created the executable Next.js App Router scaffold in this package. It is the engineering foundation only. Canonical contracts remain under `docs/contracts` and are not duplicated here.

WS1 owns `src/features/**` and `src/ui/**`. WS1 should deliver route-mount instructions; WS3 owns `src/app/**` composition. Do not treat this scaffold as converted production POS UI.

## Commands

From the repository root, after Node 24 LTS and pnpm 12.4.1 are available:

```text
pnpm install --frozen-lockfile
pnpm --dir apps/pos-web lint
pnpm --dir apps/pos-web typecheck
pnpm --dir apps/pos-web test
pnpm --dir apps/pos-web build
pnpm --dir apps/pos-web test:e2e
```

Playwright browsers (Chromium) must be installed once per machine:

```text
pnpm --dir apps/pos-web exec playwright install chromium
```

Linux CI also needs OS dependencies:

```text
pnpm --dir apps/pos-web exec playwright install --with-deps chromium
```

See `docs/standards/TOOLCHAIN.md` for pinned versions and what each check proves.
