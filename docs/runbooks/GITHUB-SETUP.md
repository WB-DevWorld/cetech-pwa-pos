# GitHub setup and Windows recovery

Current as of 2026-09-12: the repository is public; the earlier private-plan restriction is resolved. Ben-001-sys and Emmanuel-coder-prog have write permission; wbdevworld has admin permission. Use each person's own authenticated CLI account. Python 3.10.10 is supported. Authentication succeeded in the supplied transcript; repeated login is not a diagnosis for HTTP 422.

## Get the tooling repair

Review and merge the `fix/bootstrap-windows-setup` PR through the senior and another human reviewer, then from a clean task boundary:

```powershell
git status --short
git pull --ff-only
python scripts/verify_control_plane.py
```

Preserve existing edits if Git reports a conflict. To test the PR before merge, use a separate checkout/worktree; do not reset your working tree.

The old verifier used operating-system-dependent backslashes on Windows against forward-slash manifest keys. The repair uses POSIX keys. Windows Git line-ending conversion can also alter approved text bytes; `.gitattributes` now disables that conversion specifically for the immutable artifact. Existing converted checkouts may still need repair:

```powershell
python scripts/repair_reference.py
python scripts/repair_reference.py --apply
python scripts/verify_control_plane.py
```

The first command is a dry-run. Apply changes only files whose CRLF-to-LF conversion exactly reproduces the existing approved SHA-256. Missing, extra, binary or genuinely edited files cause refusal before any repair. It never changes the hash manifest. Review any refused files with the senior; do not use `git reset --hard`, bulk deletion, or hash regeneration to make the check pass.

## Labels, milestones and issue metadata — write account

```powershell
python scripts/github_setup.py --metadata-only
python scripts/github_setup.py --apply --metadata-only
```

This upserts 17 labels/four milestones and attaches the 30 mapped issues, preserving unrelated labels and completed milestone state. It does not create duplicate issues. Existing-label updates use GitHub's documented `new_name` field. Reads paginate; JSON/CLI encoding is UTF-8; repeated application is safe. An error names the method/endpoint and API validation details. Earlier successful writes may remain after a later failure.

`--apply` alone also applies repository settings for an admin; for a write account it completes metadata and explicitly reports the skipped admin step. An explicit admin-only request from a write account fails before mutations. Neither mode changes visibility or grants access.

## Repository settings and branch protection — admin account

The connected GitHub tools cannot write repository protection/settings, despite the connected account's admin role. Run the following on the senior's own authenticated GitHub CLI. The first two commands are read-only checks; the last applies the prepared configuration:

```powershell
gh api user --jq .login
gh api repos/WB-DevWorld/cetech-pwa-pos --jq .permissions.admin
python scripts/github_setup.py --apply --settings-only --with-protection
```

Proceed with the last command when the account is the intended senior/admin and the permission result is `true`. If a write-only developer runs it, use their metadata command above; do not share credentials or elevate roles just to run setup.

Prepared settings: issues enabled, squash merges only, automatic deletion of merged task branches. Prepared main protection: one other human approval, stale review dismissal, passing/up-to-date `control-plane` and `control-plane-windows` checks, resolved conversations, linear history, no force pushes/deletion, and enforcement for admins. Both named jobs must first be observed passing on the tooling repair PR. Code-owner approval enforcement remains false until a qualified backup architecture reviewer is designated, preventing a sole-owner self-approval deadlock.

The script reads back settings/protection before reporting CONFIGURED / VERIFIED. It preserves an existing equal/stronger rule and refuses to overwrite a differing rule. Review differing rules explicitly rather than weakening them. A protection 403/404 is reported with context; public visibility does not replace token/account administration permission.

Independent read-back:

```powershell
gh api repos/WB-DevWorld/cetech-pwa-pos/branches/main --jq .protected
gh api repos/WB-DevWorld/cetech-pwa-pos/branches/main/protection
```

Record the result; a committed JSON file is not enforcement. If a 422 persists, report the new `FAILED: METHOD endpoint`, HTTP status and `message/errors` lines. Never include tokens or raw authentication/debug logs. The old terse output cannot prove which request failed.

## Technical references

[GitHub CODEOWNERS precedence](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners), [label update payload](https://docs.github.com/en/rest/issues/labels#update-a-label), and [Git attributes and line-ending conversion](https://git-scm.com/docs/gitattributes). These explain tooling behavior; live access facts come from GITHUB-REALITY.md.
