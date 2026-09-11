# Remaining GitHub configuration

The connector cannot perform settings/label/milestone/protection or member administration. Prepared JSON and an authenticated GitHub CLI script are committed. No production effects or repository visibility change are included.

After cloning on your authenticated machine:

```bash
gh auth login
python3 scripts/github_setup.py
python3 scripts/github_setup.py --apply
```

The first script call is a dry-run. The apply call creates/updates 17 labels, four milestones, attaches confirmed issues and configures issues/squash-only merges/branch deletion after merge. Review output; a failed action is not configured. It does not create duplicate issues.

For protection: GitHub's current private-repository capability returned a plan restriction. Check WB-DevWorld → Settings → Billing and plans; retain private visibility and enable a plan supporting private organization repository protections. Then run:

```bash
python3 scripts/github_setup.py --apply --with-protection
```

Prepared protection requires one other human review, current control-plane status, resolved conversations, no force push/deletion, linear history and enforcement for admins. Add actual lint/typecheck/test/build/bridge check names only after those workflows exist and report successfully. Protection enables PR checks; it is not currently applied by these repository files.

Colleague setup: repository Settings → Collaborators and teams → select each actual developer identity and grant appropriate write access. Identities are UNVERIFIED; do not guess. Update OWNERSHIP/CODEOWNERS with verified accounts and a backup reviewer. Initially code-owner-review enforcement is false so the sole listed owner cannot make senior-authored PRs impossible to approve. After adding a verified backup capable of architecture review, enable code-owner review and test routing on a PR. Review owner alone versus both architecture/implementation reviewers deliberately; CODEOWNERS multiple users requires only one matching owner approval by default.

Until plan/access are resolved, bounded local/task-branch preparation can continue, but fully enforced three-way readiness is conditional. Follow procedural main PR rules and record the residual gap honestly.
