"""Guard the declared milestone DAG and required CI trigger/check policy."""
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]


class BatchWorkflowTests(unittest.TestCase):
    def test_milestones_cover_remaining_tasks_in_dependency_order(self):
        tasks = {t['id']: t for t in json.loads(
            (ROOT / '.github/bootstrap/tasks.json').read_text())}
        baseline = {'CP-01', 'CP-02', 'CP-03', 'CP-04', 'CP-05', 'FE-01', 'FE-02'}
        # CP-04 is only the development baseline here, not runtime gate closure.
        accepted = set(baseline)
        rows = re.findall(r'^\| R(\d+) \|[^\n]*$',
                          (ROOT / 'docs/plans/MILESTONE-REVIEWS.md').read_text(), re.M)
        self.assertEqual([int(x) for x in rows], list(range(1, 11)))
        doc = (ROOT / 'docs/plans/MILESTONE-REVIEWS.md').read_text()
        for row in re.findall(r'^\| R\d+ \|[^\n]*$', doc, re.M):
            ids = re.findall(r'\b(?:CORE|BR|FE|PAY|RT|QA|REL)-\d+\b', row.split('|')[3])
            self.assertTrue(ids)
            for task in ids:
                self.assertNotIn(task, accepted)
                self.assertIn(task, tasks)
                deps = tasks[task]['deps'].split(', ')
                self.assertTrue(set(deps) <= accepted, (task, deps))
                accepted.add(task)
        self.assertEqual(accepted, set(tasks))

    def test_ci_covers_contributor_pushes_and_preserves_required_names(self):
        ci = (ROOT / '.github/workflows/ci.yml').read_text()
        trigger = re.search(r'(?m)^    branches: \[(.*)\]$', ci)
        self.assertIsNotNone(trigger)
        branches = {s.strip().strip("'\"") for s in trigger[1].split(',')}
        self.assertTrue({'main', 'ws1/**', 'ws2/**', 'ws3/**', 'fix/**', 'batch/**'} <= branches)
        self.assertRegex(ci, r'(?m)^  pull_request:\s*$')
        self.assertNotIn('pull_request_target:', ci)
        config = json.loads((ROOT / '.github/bootstrap/main-protection.json').read_text())
        names = set(re.findall(r'(?m)^    name: (.+)$', ci))
        self.assertTrue(set(config['required_status_checks']['contexts']) <= names)
        # Keep the existing R1 local DB and app acceptance commands mandatory.
        for command in ['supabase@2.117.0 db start', 'supabase@2.117.0 db reset',
                        'supabase@2.117.0 test db', 'pnpm install --frozen-lockfile',
                        'pnpm --dir apps/pos-web typecheck',
                        'pnpm --dir apps/pos-web test:e2e']:
            self.assertIn(command, ci)

    def test_staging_summary_does_not_command_substitute_ci_tested_sha(self):
        deploy = (ROOT / '.github/workflows/deploy-staging.yml').read_text()
        self.assertNotIn('`${CI_TESTED_SHA}`', deploy)
        self.assertIn('printf -- \'- CI-tested SHA: `%s`\\n\' "$CI_TESTED_SHA"', deploy)
        self.assertNotIn('pull_request_target:', deploy)
        self.assertIn("github.event.workflow_run.head_branch == 'main'", deploy)
        self.assertIn('--environment=preview', deploy)
        self.assertIn('cetech-pos-shared-staging', deploy)

    def test_exact_sha_preview_is_manual_main_only_git_source_and_preview_only(self):
        preview = (ROOT / '.github/workflows/deploy-exact-sha-preview.yml').read_text(
            encoding='utf-8')
        script = (ROOT / 'scripts/exact_sha_preview.py').read_text(encoding='utf-8')
        self.assertNotIn('pull_request_target:', preview)
        self.assertRegex(preview, r'(?m)^  workflow_dispatch:\s*$')
        self.assertNotRegex(preview, r'(?m)^  pull_request:')
        self.assertNotRegex(preview, r'(?m)^  workflow_run:')
        self.assertIn("github.ref == 'refs/heads/main'", preview)
        self.assertIn('candidate_sha:', preview)
        self.assertIn('pr_number:', preview)
        self.assertRegex(
            preview,
            r'(?ms)pr_number:.*?required: true',
        )
        self.assertIn('environment: staging', preview)
        self.assertIn('ref: ${{ github.sha }}', preview)
        self.assertNotIn('ref: ${{ env.CANDIDATE_SHA }}', preview)
        self.assertIn('exact-sha-preview-', preview)
        self.assertNotIn('cetech-pos-shared-staging', preview)
        self.assertNotIn('vars.VERCEL_STAGING_ALIAS', preview)
        self.assertNotIn('VERCEL_STAGING_ALIAS', preview)
        self.assertNotIn('vercel alias set', preview)
        self.assertNotIn('--environment=production', preview)
        self.assertNotRegex(preview, r'vercel deploy[^\n]*--prod')
        self.assertNotIn('vercel build', preview)
        self.assertNotIn('vercel deploy', preview)
        self.assertNotIn('vercel pull', preview)
        self.assertIn('vercel@59.17.0', preview)
        self.assertIn('actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683', preview)
        self.assertIn('scripts/exact_sha_preview.py', preview)
        self.assertIn('/v13/deployments', script)
        self.assertIn('gitSource', script)
        self.assertIn('BUILD_ID', script)
        self.assertIn('GIT_SOURCE_UNAVAILABLE', script)
        self.assertNotIn('--prod', script)
        self.assertNotIn('vercel build', script)
        self.assertNotIn('pull_request_target', script)
        self.assertNotIn('"target": "production"', script)
        self.assertNotIn("'target': 'production'", script)
        self.assertNotIn('"target": "staging"', script)


if __name__ == '__main__':
    unittest.main()
