"""Controlled Git scenarios, not a claim that software can judge agent reasoning."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/check_upstream_drift.py'
spec = importlib.util.spec_from_file_location('drift', SCRIPT)
drift = importlib.util.module_from_spec(spec)
spec.loader.exec_module(drift)


class DriftTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name)
        self.git('init', '-b', 'main')
        self.git('config', 'user.name', 'Test Fixture')
        self.git('config', 'user.email', 'fixture@example.invalid')
        self.git('config', 'core.autocrlf', 'false')
        self.write('apps/pos-web/src/features/sell.txt', 'consumer\n')
        self.start = self.commit('start')

    def git(self, *args):
        return drift.git(self.repo, *args).decode().strip()

    def write(self, path, value):
        p = self.repo / path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(value, encoding='utf-8')

    def commit(self, title):
        self.git('add', '.')
        self.git('commit', '-m', title)
        return self.git('rev-parse', 'HEAD')

    def cli(self, *args):
        return subprocess.run([sys.executable, str(SCRIPT), '--repo', str(self.repo),
                               *args], capture_output=True, text=True)

    def test_a_irrelevant_upstream_no_checkout_edit(self):
        self.write('docs/notes/spelling.md', 'typo fixed\n')
        upstream = self.commit('unrelated spelling')
        self.git('switch', '-c', 'contributor', self.start)
        before = self.git('status', '--porcelain')
        record = drift.compare(self.repo, self.start, upstream, 1)
        self.assertEqual(record['changed_paths'], ['docs/notes/spelling.md'])
        self.assertEqual(record['critical_paths'], [])
        self.assertEqual(self.git('rev-parse', 'HEAD'), self.start)
        self.assertEqual(self.git('status', '--porcelain'), before)

    def test_b_compatible_additive_contract_requires_consumer_verification(self):
        self.write('docs/contracts/fixture.json', '{"required": ["id"]}')
        base = self.commit('fixture contract')
        self.write('docs/contracts/fixture.json',
                   '{"required": ["id"], "optional": ["displayName"]}')
        upstream = self.commit('add optional field')
        record = drift.compare(self.repo, base, upstream, 1)
        self.assertIn('docs/contracts/fixture.json', record['critical_paths'])
        # Scenario's explicit consumer compatibility check; helper does not decide.
        schema = json.loads((self.repo / 'docs/contracts/fixture.json').read_text())
        payload = {'id': 'synthetic-customer'}
        self.assertTrue(all(key in payload for key in schema['required']))
        # An authorized consumer fixture can adopt the optional field while the
        # upstream contract remains byte-identical. Reverify both old/new input.
        contract_before = self.git('hash-object', 'docs/contracts/fixture.json')
        self.write('apps/pos-web/src/features/customer.py',
                   "def label(customer):\n"
                   "    return customer.get('displayName') or customer['id']\n")
        consumer = {}
        exec((self.repo / 'apps/pos-web/src/features/customer.py').read_text(), consumer)
        self.assertEqual(consumer['label'](payload), 'synthetic-customer')
        self.assertEqual(consumer['label']({**payload, 'displayName': 'Fixture'}),
                         'Fixture')
        self.assertEqual(self.git('hash-object', 'docs/contracts/fixture.json'),
                         contract_before)
        self.commit('authorized consumer fixture adjustment, verified')
        self.assertEqual(record['semantic_classification'],
                         'REQUIRES_AGENT_OR_OWNER_ASSESSMENT')

    def test_c_owner_conflict_never_changes_contract(self):
        self.write('docs/contracts/fixture.json', '{"required": ["id", "scope"]}')
        upstream = self.commit('breaking fixture owner decision')
        self.git('switch', '-c', 'ws1', self.start)
        record = drift.compare(self.repo, self.start, upstream, 1)
        self.assertIn('docs/contracts/fixture.json', record['critical_paths'])
        self.assertFalse((self.repo / 'docs/contracts/fixture.json').exists())
        self.assertEqual(self.git('status', '--porcelain'), '')
        # Semantic handoff must say DECISION_REQUIRED/CONFLICT_REQUIRES_OWNER;
        # this read-only tool intentionally cannot claim to make that decision.

    def test_d_second_pass_detects_new_change_only(self):
        self.write('docs/notes/one.md', 'first')
        first = self.commit('pass one snapshot')
        r1 = drift.compare(self.repo, self.start, first, 1)
        self.write('OWNERSHIP.md', 'changed editor')
        second = self.commit('between passes')
        r2 = drift.compare(self.repo, first, second, 2)
        self.assertEqual(r1['upstream_sha'], first)
        self.assertEqual(r2['changed_paths'], ['OWNERSHIP.md'])
        self.assertEqual(r2['critical_paths'], ['OWNERSHIP.md'])

    def test_e_post_cutoff_change_cannot_start_pass_three(self):
        first = drift.compare(self.repo, self.start, self.start, 1)
        second = drift.compare(self.repo, first['upstream_sha'], self.start, 2)
        self.write('CURRENT-WORK.md', 'post cutoff')
        later = self.commit('after pass two')
        self.assertNotEqual(later, second['upstream_sha'])
        self.assertEqual(second['upstream_sha'], self.start)
        with self.assertRaises(ValueError):
            drift.compare(self.repo, second['upstream_sha'], later, 3)
        result = self.cli('--base', self.start, '--upstream', later, '--pass-number', '3')
        self.assertEqual(result.returncode, 2)
        self.assertEqual(self.git('rev-parse', 'HEAD'), later)

    def test_rename_and_delete_include_both_paths(self):
        self.write('docs/contracts/old name.json', '{}')
        base = self.commit('old contract')
        self.git('mv', 'docs/contracts/old name.json', 'docs/contracts/new name.json')
        upstream = self.commit('rename contract')
        r = drift.compare(self.repo, base, upstream, 1)
        self.assertEqual(set(r['critical_paths']),
                         {'docs/contracts/old name.json', 'docs/contracts/new name.json'})

    def test_non_forward_history_is_flagged_and_cli_fails(self):
        self.write('one.txt', 'one')
        later = self.commit('later')
        r = drift.compare(self.repo, later, self.start, 1)
        self.assertEqual(r['history_relation'], 'NON_FORWARD')
        self.assertEqual(self.cli('--base', later, '--upstream', self.start,
                                 '--pass-number', '1').returncode, 1)

    def test_invalid_ref_is_not_reported_fresh(self):
        result = self.cli('--base', self.start, '--upstream', 'missing-ref',
                          '--pass-number', '1')
        self.assertEqual(result.returncode, 2)
        self.assertIn('UNVERIFIED', result.stderr)

    def test_json_and_markdown_contain_exact_cutoff(self):
        args = ['--base', self.start, '--upstream', self.start, '--pass-number', '2']
        r = self.cli(*args)
        self.assertEqual(json.loads(r.stdout)['upstream_sha'], self.start)
        self.assertIn(self.start, self.cli(*args, '--format', 'markdown').stdout)

    def test_option_like_ref_is_rejected(self):
        with self.assertRaises(ValueError):
            drift.compare(self.repo, '--help', 'HEAD', 1)

    def test_untracked_work_preserved(self):
        self.write('untracked.txt', 'keep me')
        before = self.git('status', '--porcelain')
        drift.compare(self.repo, self.start, self.start, 1)
        self.assertEqual(self.git('status', '--porcelain'), before)


if __name__ == '__main__':
    unittest.main()
