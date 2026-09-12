# GitHub observed reality

## Current — 2026-09-12

Canonical repository: WB-DevWorld/cetech-pwa-pos, ID 1366623006. The user changed visibility to **public**; the live repository API confirms it. The earlier private-repository plan restriction is resolved. Main was `5ef051f19e6e8074b83e61da78de70ce1d9fd81d` at repair intake; its only change since `92e2dc8` was the user's CODEOWNERS update.

| Identity | Assigned role | Live collaborator permission |
| --- | --- | --- |
| @wbdevworld | Senior / WS3 | admin |
| @Ben-001-sys | Developer 1 / WS1 | write |
| @Emmanuel-coder-prog | Developer 2 / WS2 | write |

CODEOWNERS had three consecutive `*` entries. GitHub uses the last matching entry, so the effective unlisted-file owner was Ben rather than the senior. The repair keeps the user-assigned frontend/bridge owners and restores the documented senior default. Backup technical reviewer designation is still UNVERIFIED.

Branch read: `protected: false`. Rulesets read: `[]` (successful now). Merge settings allow merge/rebase/squash; the prepared squash-only settings are not yet confirmed applied. The user's CLI metadata attempts returned 404 then 422; the old script hid the response body and endpoint. Exact historic failure causes and partial label/milestone state cannot be inferred from those lines.

The connector exposes file/git/ref/issue/PR writes and protection reads, but no protection/settings/label/milestone administration writes. This is a tool capability limit, not an outstanding permission request or a current plan restriction. [GITHUB-SETUP.md](GITHUB-SETUP.md) provides the admin CLI step and read-back. No protection application is claimed here.

## Historical bootstrap — 2026-09-11

The repo initially existed empty and private. Connected wbdevworld had admin permission. Only this organization repository was visible in the discovery result; that did not establish the absence of other repositories. Colleague identities were not available then. Ruleset access returned the private-repository plan restriction. Those historical observations remain provenance and no longer describe current visibility/access.

Foundation commits, issues and CI evidence are recorded in CURRENT-WORK.md and BOOTSTRAP-REPORT.md. Files in Git are configuration intent until a corresponding GitHub setting write and read-back confirm enforcement.
