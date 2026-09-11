# Git Collaboration standard

Main is canonical. Short-lived ws1/ws2/ws3/fix task branches and PRs; no permanent develop/qa/uat tree. Staging environment receives integrated builds. One worktree per concurrent agent, no untracked shared checkout edits. Serialize central files through senior. All PRs include scope diff, tests and handoff. Architecture review checks owner/provider/contracts separately from code correctness. Owner changes require ADR/contract update; no personal memory overrides. Integrate small PRs every few hours in dependency order. CODEOWNERS is review routing, not file ACL. Main protections are not active until GitHub setup verified; procedural merge rules apply meanwhile. Senior-authored PRs need a different human reviewer.

Owner: WS3. Controlling contracts/ADRs outrank generic examples. Done = evidence.
