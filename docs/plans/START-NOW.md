# First working session

All developers use their own verified GitHub/ChatGPT/Cursor identity; shared accounts/working folders are not required.

```bash
git clone https://github.com/WB-DevWorld/cetech-pwa-pos.git
cd cetech-pwa-pos
python scripts/verify_control_plane.py
```

If an existing Windows checkout reports CRLF reference conversions, follow [the guarded repair](../runbooks/GITHUB-SETUP.md); do not regenerate hashes or discard local changes.

Read AGENTS.md → source hierarchy → current architecture → Decision Register → ownership → your workstream's eight files → assigned GitHub issue. Do not copy the entire historical chat into Cursor.

| Person | First task | First branch | Completion evidence |
| --- | --- | --- | --- |
| Senior / you | Finish GitHub metadata/protection setup using GITHUB-SETUP.md; CP-04 remaining live audit; CP-05 shared scaffold | ws3/cp-05-scaffold after CP-03 | Actual pinned toolchain and green app checks; live facts with evidence; exact allowed config paths |
| Developer 1 / @Ben-001-sys | FE-01 reference/scenario mapping, then FE-02 shell after CP-05 | ws1/fe-01-reference-map | Prototype→component/test map, unchanged reference hashes; no pricing/backend edits |
| Developer 2 / @Emmanuel-coder-prog | Help CP-04 verify live Woo facts; BR-01 health then BR-02 quote spike | ws2/br-01-health after CP-04 | Authenticated bridge health/plugin detection; no quote parity claim until actual matrix |

Paste into each Cursor session: 'Read AGENTS.md and the complete WS[1/2/3] package. Work only on [task ID and issue]. Before editing report allowed/forbidden files, canonical owners, contract version, prerequisites and acceptance commands. Use a task branch; do not change shared contracts/config without an explicit delegation. Implement only this task and hand off evidence.'

Senior remains sole root/contract/migration editor. WS1 asks senior to mount UI into app routes; WS2 asks for schema changes rather than modifying them. Merge small PRs in docs/integration/MERGE-ORDER.md order. If colleague clone access fails, fix the real identity/access; do not create another repository. No production deployment or VitePOS deactivation in this first session.
