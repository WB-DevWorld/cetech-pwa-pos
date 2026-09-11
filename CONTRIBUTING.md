# Contributing

Read AGENTS.md and your task/workstream. Claim one bounded issue before editing; use `ws1/<task>-<slug>`, `ws2/<task>-<slug>`, `ws3/<task>-<slug>` or `fix/<task>-<slug>`. Short-lived branches target main. No standing develop/qa/uat hierarchy; staging is an environment, not a required branch.

```bash
git fetch origin
git switch main
git pull --ff-only
git worktree add ../pos-ws1-fe02 -b ws1/fe-02-responsive-shell origin/main
```

Use a distinct worktree per concurrent agent and distinct database instance/schema workflow where needed. Never share a working tree with another active agent. Review `git diff --name-only origin/main...HEAD` against task allowed paths before PR.

Run foundation checks plus actual scaffold checks; attach evidence to the PR template. Small PRs integrate every few hours. WS3 controls root/contract/migration changes and merge sequencing. No direct main pushes after bootstrap; no force pushes/deletion of main. Until branch protection is available, this is procedural only and must not be represented as enforcement.

Keep secrets in local excluded .env files and deployment secret settings. Do not use production data in tests. Preview and staging write to isolated Woo clones/Supabase/payment sandboxes. Never update merged migrations; add forward migrations. Audit requests produce findings first, not automatic code changes.
