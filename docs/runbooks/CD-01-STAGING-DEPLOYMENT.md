# CD-01 — Shared Staging Deployment

Status: proposed repository delivery control for issue #64. This runbook does **not** authorize production promotion, live electronic payment, refund/restock effects, or VitePOS cutover.

## Purpose

The repository already performs continuous integration on `main` and contributor/milestone branches. CD-01 adds the missing continuous-delivery step for accepted work: after the existing `CI` workflow succeeds for a push to `main`, the exact CI-tested commit is deployed to Vercel Preview for ongoing runtime, browser, device and integration testing while later milestones continue in parallel.

A custom staging domain is optional. Until one is configured, the immutable Vercel Preview deployment URL returned by the deployment command is the staging URL.

## Delivery model

```text
contributor branch / milestone PR
            |
            v
           CI
            |
     review + merge
            |
            v
          main
            |
            v
           CI  (exact main SHA)
            |
      SUCCESS only
            |
            v
  Staging CD workflow
            |
            v
 Vercel preview deployment
            |
            +--> immutable Vercel URL (required)
            |
            +--> stable custom alias (optional later)
            |
            v
 runtime/device testing
```

A failed CI run does not deploy. A successful CI run for anything other than a `push` to `main` does not deploy. The deployment workflow checks out `workflow_run.head_sha`, not a moving `main` branch.

## Why Vercel Preview is used for this transitional staging deployment

The current transitional architecture selected Vercel for the Next.js POS web application. Vercel Preview deployments provide a non-production target while keeping production promotion separate.

CD-01 uses the Vercel CLI sequence:

1. run `vercel pull --environment=preview` from the repository root;
2. verify the linked Vercel project declares `rootDirectory=apps/pos-web`;
3. set `BUILD_ID` in the build process environment and run `vercel build` from the repository root;
4. run `vercel deploy --prebuilt --env BUILD_ID=<exact-tested-sha>` from the repository root;
5. smoke-test the immutable deployment URL;
6. optionally `vercel alias set` when `VERCEL_STAGING_ALIAS` is configured;
7. if an alias is configured, smoke-test the alias.

The workflow pins Vercel CLI `59.17.0` rather than using an unbounded `latest` install. It invokes that transient CLI through pinned `npm exec` rather than `pnpm dlx`: pnpm 12's strict dependency-build policy blocks the transient Vercel CLI's `esbuild` install script unless separately approved. This avoids weakening the repository's workspace `allowBuilds` policy merely to run a deployment utility.

`vercel build` in CLI `59.17.0` does **not** accept `--build-env`. The exact CI-tested SHA is therefore supplied to the local build through the step's `BUILD_ID` process environment. The `--env BUILD_ID=...` flag remains on `vercel deploy --prebuilt` so the same exact SHA is available to the deployed runtime.

### Monorepo root invocation rule

The Vercel project owns the application subdirectory through `rootDirectory=apps/pos-web`. Therefore **all Vercel CLI commands in CD-01 run from the repository root**. Do not also set the GitHub Actions working directory to `apps/pos-web`, because that would cause Vercel to compose the configured project root a second time and resolve `apps/pos-web/apps/pos-web`.

The workflow now verifies `.vercel/project.json` after `vercel pull` and fails if the downloaded project settings do not report `apps/pos-web` as the configured root directory.

### Runtime evidence from the first two CD attempts

The first post-merge CD-01 attempt failed before deployment because `vercel build --build-env` is unsupported by CLI `59.17.0`. The second attempt confirmed the build-process environment fix worked: `vercel build` completed successfully, but `vercel deploy --prebuilt` then failed because the workflow was running inside `apps/pos-web` while the Vercel project also declared `rootDirectory=apps/pos-web`. Vercel therefore tried to resolve a nonexistent `apps/pos-web/apps/pos-web` path. No deployment, smoke test, alias change, production promotion, or business-system write occurred in either failed attempt.

## Origin protection without a custom staging domain

The POS mutation guard requires the request origin to exactly match one of the server's allowed origins; wildcard origin trust is not allowed.

A Vercel CLI Preview deployment receives a unique deployment URL. For this no-custom-domain phase, `apps/pos-web/src/config/env.ts` resolves the application origin in this order:

1. explicit `APP_ORIGIN`;
2. explicit `NEXT_PUBLIC_APP_ORIGIN` for compatibility;
3. exact HTTPS origin derived from Vercel's runtime `VERCEL_URL` system value;
4. `http://localhost:3000` for local development.

`VERCEL_URL` is platform-provided deployment metadata, not a secret. It is accepted only as HTTPS and is normalized to an origin; malformed or non-HTTPS values are not trusted.

Vercel system environment variables must therefore be available to the deployment. New Vercel projects normally expose them by default; verify the project setting if runtime `VERCEL_URL` is absent.

## One-time external setup

The repository cannot create or recover hosting-account credentials. Complete these one-time steps in the relevant accounts before expecting a real deployment.

### 1. Create/link the Vercel project

Use one Vercel project for staging:

- project: `cetech-pos-staging`
- owner/team: the intended CETECH deployment account/team
- repository root used by the CLI: repository root
- project Root Directory in Vercel: `apps/pos-web`
- framework preset: Next.js
- Node.js: 24.x
- install/build/output commands: framework/project defaults unless a verified blocker requires an override
- Vercel Git auto-deployment may remain disconnected while GitHub Actions controls shared staging
- production deployment remains outside CD-01

Record the Vercel organization/team ID and project ID.

### 2. Configure GitHub staging deployment identity

Create GitHub environment `staging` and configure these environment secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

`VERCEL_STAGING_ALIAS` is **optional**. Do not create it until a stable custom hostname is ready. When used, it must be a hostname without a scheme, for example:

```text
pos-staging.example.com
```

Do not put Vercel tokens or application runtime secrets in source, issues, PR bodies, comments, or browser-exposed variables.

### 3. Configure the Vercel Preview runtime environment

The Preview environment must point only to CETECH staging/training dependencies.

At minimum configure the current server/runtime variables required by the application, using real secret storage in Vercel:

```text
APP_ENV=staging

SUPABASE_URL=<staging Supabase URL>
SUPABASE_PUBLISHABLE_KEY=<staging browser-safe publishable key>
SUPABASE_SERVICE_ROLE_KEY=<staging server-only service key>

BRIDGE_BASE_URL=<training/staging /wp-json/cetech-pos/v1 origin>
BRIDGE_USERNAME=<dedicated staging bridge service user>
BRIDGE_APPLICATION_PASSWORD=<server-only staging application password>

PAYMENT_PROVIDER=disabled
```

During the generated-URL phase, **do not set `APP_ORIGIN` or `ALLOWED_ORIGINS` merely to a guessed Vercel URL**. The application will use the exact runtime `VERCEL_URL`. If a stable custom domain is added later, set `APP_ORIGIN=https://<hostname>` and optionally add other explicitly trusted origins through `ALLOWED_ORIGINS`.

Do not configure a live Paystack key for CD-01. R7 retains its own sandbox/runtime acceptance gate. If a later milestone authorizes sandbox payment testing, that is a separate explicit change to the staging environment and must not silently become production authority.

The current app rejects public exposure of server-only configuration names. Keep privileged variables out of `NEXT_PUBLIC_*`.

### 4. Optional custom hostname later

A stable custom hostname is not required for the first staging deployment.

When one is added successfully later:

1. configure the hostname in Vercel;
2. configure GitHub variable `VERCEL_STAGING_ALIAS` with the hostname only;
3. configure Vercel Preview `APP_ORIGIN=https://<hostname>`;
4. redeploy;
5. verify both the immutable deployment URL and stable alias.

The alias step in CD-01 automatically activates only when `VERCEL_STAGING_ALIAS` is non-empty.

## What happens after merge

When CD-01 lands on `main`:

1. the normal `CI` workflow runs on that merge commit;
2. if CI fails, no staging deployment occurs;
3. if CI succeeds, `Staging CD` receives that completed run;
4. it verifies the required deployment credentials/project configuration;
5. it checks out the exact SHA that CI tested;
6. it performs a frozen workspace install;
7. from the repository root, it pulls Vercel Preview project settings and verifies `rootDirectory=apps/pos-web`;
8. it sets `BUILD_ID` to the exact CI-tested SHA in the local build process and creates the Vercel prebuilt artifact;
9. it deploys that prebuilt artifact and also supplies the exact SHA to runtime as `BUILD_ID`;
10. it captures the immutable Vercel deployment URL;
11. it smoke-probes the immutable deployment URL and fails on HTTP 4xx/5xx;
12. only after that smoke passes, if `VERCEL_STAGING_ALIAS` exists, it moves the alias to the deployment;
13. if an alias exists, it smoke-probes the alias and fails on HTTP 4xx/5xx;
14. it records the CI SHA and deployment URL, plus alias when present, in the workflow summary.

The required order is therefore:

`deploy immutable URL -> smoke immutable URL -> move optional alias -> smoke alias -> record deployment evidence`.

If Vercel token/org/project configuration is missing, the workflow records `BLOCKED_CONFIGURATION` and performs no deployment. A skipped deployment must never be reported as deployed.

## Staging safety rules

Shared staging is continuously replaceable application delivery, not permission to perform every business effect implemented in code.

The following remain independently gated:

- pricing parity/cutover truth in issue #4;
- electronic-payment provider sandbox/live execution;
- refunds and restock effects;
- production WooCommerce mutations not specifically authorized by their runtime gate;
- production promotion;
- VitePOS deactivation/cutover.

Feature/capability availability must continue to fail closed where its runtime authority is absent.

## PR previews

CD-01 deploys only accepted `main`. Do not expose GitHub/Vercel deployment credentials to arbitrary PR workflow code merely to obtain previews.

Provider-managed PR previews may be reconsidered later with an explicit safe-credentials model; they are not required for the shared staging deployment.

## Production remains separate

Production promotion should later be implemented as a separate release workflow with all of the following:

- explicit human invocation;
- protected `production` environment approval;
- exact reviewed/release SHA;
- production-specific secrets and runtime configuration;
- release/cutover gates from REL-01;
- rollback evidence;
- post-deploy smoke checks;
- no automatic promotion merely because `main` is green.

Until that release control exists and its acceptance gates pass, `main -> staging` is the highest automatic promotion level.

## Verification after first real staging deployment

Record evidence for:

- exact Git SHA shown by deployment/build diagnostics;
- generated Vercel Preview root URL returns successfully;
- `VERCEL_URL` is present at runtime and origin-protected session/mutation requests work from that exact deployment origin;
- Supabase health is staging-only;
- bridge/Woo health points at training/staging only;
- no privileged browser secrets are present;
- electronic payment remains disabled unless separately authorized;
- one installed desktop/mobile PWA can load the deployed staging build;
- a subsequent accepted `main` merge creates a new immutable staging deployment only after CI is green.

If a custom alias is added later, verify the alias separately.

Do not claim CD-01 runtime acceptance until a real Vercel deployment has produced this evidence.

## Rollback

Application rollback is deployment-level and does not undo external commerce/payment/stock effects.

Without a stable alias, rollback means reopening/retesting the last known-good immutable Vercel deployment while the fix is prepared. With a stable alias configured later, move the alias back to the last known-good deployment.

In either case:

1. identify the last known-good deployment associated with an accepted `main` SHA;
2. record the rollback/fallback SHA and deployment in issue #64 or release evidence;
3. reconcile any external effects separately rather than assuming code rollback reversed them.

Never clear IndexedDB or cashier durable state as a routine deployment rollback mechanism.
