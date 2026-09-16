# CD-01 — Shared Staging Deployment

Status: proposed repository delivery control for issue #64. This runbook does **not** authorize production promotion, live electronic payment, refund/restock effects, or VitePOS cutover.

## Purpose

The repository already performs continuous integration on `main` and contributor/milestone branches. CD-01 adds the missing continuous-delivery step for accepted work: after the existing `CI` workflow succeeds for a push to `main`, the exact CI-tested commit is deployed to one stable CETECH POS staging origin.

The staging deployment is for ongoing runtime, browser, device and integration testing while later milestones continue in parallel. It is deliberately separate from production activation.

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
            v
 stable staging alias
            |
            v
 runtime/device testing
```

A failed CI run does not deploy. A successful CI run for anything other than a `push` to `main` does not deploy. The deployment workflow checks out `workflow_run.head_sha`, not a moving `main` branch.

## Why Vercel Preview is used for this transitional staging deployment

The current transitional architecture selected Vercel for the Next.js POS web application. Vercel Preview deployments provide an isolated non-production target, while the stable alias gives the POS a consistent origin for authentication/origin checks and installed-PWA testing.

CD-01 uses the Vercel CLI sequence supported by the current Vercel deployment model:

1. `vercel pull --environment=preview`
2. `vercel build`
3. `vercel deploy --prebuilt`
4. `vercel alias set` to the stable staging hostname

The workflow pins Vercel CLI `59.17.0` rather than using an unbounded `latest` install. It invokes that transient CLI through pinned `npm exec` rather than `pnpm dlx`: pnpm 12's strict dependency-build policy blocks the transient Vercel CLI's `esbuild` install script unless separately approved. This avoids weakening the repository's workspace `allowBuilds` policy merely to run a deployment utility.

## One-time external setup

The repository cannot create or recover hosting-account credentials. Complete these one-time steps in the relevant accounts before expecting a real deployment.

### 1. Create/link the Vercel project

Create one Vercel project for the POS web application.

Recommended project settings:

- repository: `WB-DevWorld/cetech-pwa-pos`
- application/root directory: `apps/pos-web`
- framework preset: Next.js
- install/build/output commands: use the framework/project defaults unless a verified blocker requires an override
- production deployment remains unused by CD-01

Record the Vercel organization/team ID and project ID.

### 2. Configure GitHub staging deployment identity

Configure the GitHub `staging` environment (preferred) or repository-level secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Configure GitHub variable:

- `VERCEL_STAGING_ALIAS`

`VERCEL_STAGING_ALIAS` must be a hostname without a scheme, for example:

```text
pos-staging.example.com
```

Do not put Vercel tokens or application runtime secrets in source, issues, PR bodies, comments, or browser-exposed variables.

### 3. Configure the Vercel Preview runtime environment

The Preview environment must point only to CETECH staging/training dependencies.

At minimum configure the current server/runtime variables required by the application, using real secret storage in Vercel:

```text
APP_ENV=staging
APP_ORIGIN=https://<VERCEL_STAGING_ALIAS>
ALLOWED_ORIGINS=https://<VERCEL_STAGING_ALIAS>

SUPABASE_URL=<staging Supabase URL>
SUPABASE_PUBLISHABLE_KEY=<staging browser-safe publishable key>
SUPABASE_SERVICE_ROLE_KEY=<staging server-only service key>

WOO_BASE_URL=<training/staging WooCommerce origin>
WOO_CONSUMER_KEY=<server-only staging key>
WOO_CONSUMER_SECRET=<server-only staging secret>

BRIDGE_BASE_URL=<training/staging /wp-json/cetech-pos/v1 origin>
BRIDGE_USERNAME=<dedicated staging bridge service user>
BRIDGE_APPLICATION_PASSWORD=<server-only staging application password>

PAYMENT_PROVIDER=disabled
```

Do not configure a live Paystack key for CD-01. R7 retains its own sandbox/runtime acceptance gate. If a later milestone authorizes sandbox payment testing, that is a separate explicit change to the staging environment and must not silently become production authority.

The current app rejects public exposure of server-only configuration names. Keep privileged variables out of `NEXT_PUBLIC_*`.

### 4. Configure the staging hostname

The hostname in `VERCEL_STAGING_ALIAS` must be available to the Vercel project. Its DNS must ultimately resolve according to Vercel's domain instructions.

`APP_ORIGIN` must equal the stable HTTPS staging origin. This is important because the POS server uses the configured origin for mutation/origin protection.

## What happens after merge

When CD-01 lands on `main`:

1. the normal `CI` workflow runs on that merge commit;
2. if CI fails, no staging deployment occurs;
3. if CI succeeds, `Staging CD` receives that completed run;
4. it verifies required deployment configuration;
5. it checks out the exact SHA that CI tested;
6. it performs a frozen workspace install;
7. it pulls Vercel Preview configuration;
8. it builds and deploys a non-production prebuilt artifact;
9. it moves the stable staging alias to the new deployment;
10. it probes the stable root URL;
11. it records the CI SHA, deployment URL and stable alias in the workflow summary.

If Vercel credentials/project/alias configuration is missing, the workflow records `BLOCKED_CONFIGURATION` and performs no deployment. A skipped deployment must never be reported as deployed.

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

Do **not** expose repository/Vercel deployment secrets to arbitrary PR workflow code merely to obtain previews.

Preferred preview model:

- connect the GitHub repository to Vercel using Vercel's Git integration;
- let Vercel create provider-managed PR preview deployments;
- configure preview deployments to use only safe staging/training dependencies;
- never attach production Woo/payment credentials to PR previews.

CD-01 itself deploys only accepted `main` to the shared staging alias.

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
- root URL returns successfully through the stable alias;
- login/session origin behavior works through the alias;
- Supabase health is staging-only;
- bridge/Woo health points at training/staging only;
- no privileged browser secrets are present;
- electronic payment remains disabled unless separately authorized;
- one installed desktop/mobile PWA can load the deployed staging build;
- a subsequent accepted `main` merge advances the staging alias only after CI is green.

Do not claim CD-01 runtime acceptance until a real Vercel deployment has produced this evidence.

## Rollback

Application rollback is deployment-level and does not undo external commerce/payment/stock effects.

For an application-only staging regression:

1. identify the last known-good Vercel deployment associated with an accepted `main` SHA;
2. move the staging alias back to that deployment;
3. record the rollback SHA/deployment in issue #64 or release evidence;
4. reconcile any external effects separately rather than assuming code rollback reversed them.

Never clear IndexedDB or cashier durable state as a routine deployment rollback mechanism.
