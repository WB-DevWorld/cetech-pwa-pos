from contextlib import redirect_stdout
import copy
import io
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
import github_setup as setup

LABEL = {'name': 'workstream:core', 'color': '5319e7', 'description': 'Core work'}
MILESTONE = {'key': 'M0', 'title': 'M0 — Control plane', 'description': 'Foundation'}
ISSUE = {'task_id': 'CP-01', 'labels': [LABEL['name']], 'milestone': 'M0'}
ISSUE_MAP = {'CP-01': {'number': 1}}


class FakeGithub:
    """Small stateful server fixture to verify reruns and preservation semantics."""
    def __init__(self, admin=False):
        self.calls = []
        self.repo = {'permissions': {'admin': admin, 'push': True}}
        self.labels = []
        self.milestones = []
        self.issue = {'labels': [{'name': 'human:keep'}], 'milestone': None}

    def __call__(self, method, path, payload=None):
        self.calls.append((method, path, copy.deepcopy(payload)))
        if path == 'user':
            return {'login': 'fixture-user'}
        if path == setup.BASE:
            if method == 'PATCH':
                if not self.repo['permissions']['admin']:
                    raise AssertionError('Non-admin settings write')
                self.repo.update(payload)
            return copy.deepcopy(self.repo)
        if path.startswith(setup.BASE + '/labels'):
            if method == 'GET':
                return copy.deepcopy(self.labels)
            if method == 'POST':
                if self.labels:
                    raise AssertionError('Duplicate label created')
                self.labels.append(copy.deepcopy(payload))
            else:
                assert set(payload) == {'new_name', 'color', 'description'}
                self.labels[0] = dict(payload, name=payload['new_name'])
                self.labels[0].pop('new_name')
            return copy.deepcopy(self.labels[0])
        if path.startswith(setup.BASE + '/milestones'):
            if method == 'GET':
                return copy.deepcopy(self.milestones)
            if method == 'POST':
                if self.milestones:
                    raise AssertionError('Duplicate milestone created')
                self.milestones.append(dict(payload, number=1, state='open'))
            else:
                self.milestones[0].update(payload)
            return copy.deepcopy(self.milestones[0])
        if path == setup.BASE + '/issues/1/labels':
            assert method == 'POST'
            self.issue['labels'].extend({'name': x} for x in payload['labels'])
            return copy.deepcopy(self.issue['labels'])
        if path == setup.BASE + '/issues/1':
            if method == 'PATCH':
                assert set(payload) == {'milestone'}
                self.issue['milestone'] = {'number': payload['milestone']}
            return copy.deepcopy(self.issue)
        raise AssertionError((method, path, payload))


class SetupTests(unittest.TestCase):
    def setUp(self):
        self.output = io.StringIO()
        redirect = redirect_stdout(self.output)
        redirect.__enter__()
        self.addCleanup(redirect.__exit__, None, None, None)

    def test_dry_run_does_not_call_gh(self):
        with patch.object(setup, 'api') as api:
            self.assertEqual(0, setup.main([]))
        api.assert_not_called()

    def test_create_then_repeat_keeps_manual_labels_and_has_no_second_writes(self):
        fake = FakeGithub()
        with patch.object(setup, 'api', fake):
            setup.configure_metadata([LABEL], [MILESTONE], [ISSUE], ISSUE_MAP)
            first = len(fake.calls)
            setup.configure_metadata([LABEL], [MILESTONE], [ISSUE], ISSUE_MAP)
        self.assertTrue(all(method == 'GET' for method, _, _ in fake.calls[first:]))
        self.assertEqual({'human:keep', LABEL['name']}, {x['name'] for x in fake.issue['labels']})
        self.assertEqual(MILESTONE['title'], fake.milestones[0]['title'])

    def test_existing_label_uses_new_name_and_closed_milestone_stays_closed(self):
        fake = FakeGithub()
        fake.labels = [dict(LABEL, name='Workstream:Core', color='000000')]
        fake.milestones = [dict(MILESTONE, number=1, state='closed')]
        with patch.object(setup, 'api', fake):
            setup.configure_metadata([LABEL], [MILESTONE], [ISSUE], ISSUE_MAP)
        update = next(x for x in fake.calls if x[0] == 'PATCH' and '/labels/' in x[1])
        self.assertIn('/labels/Workstream%3ACore', update[1])
        self.assertEqual(LABEL['name'], update[2]['new_name'])
        self.assertNotIn('name', update[2])
        self.assertEqual('closed', fake.milestones[0]['state'])

    def test_pagination_reads_past_first_hundred(self):
        with patch.object(setup, 'api', side_effect=[[{}] * 100, [{'name': 'last'}]]) as api:
            self.assertEqual(101, len(setup.collection('items?state=all')))
        self.assertIn('state=all&per_page=100&page=2', api.call_args.args[1])

    def test_write_user_default_skips_admin_and_reports_gap(self):
        with patch.object(setup, 'api', FakeGithub()), patch.object(setup, 'configure_metadata') as metadata:
            self.assertEqual(0, setup.main(['--apply']))
        metadata.assert_called_once()
        self.assertIn('REQUIRES ADMIN', self.output.getvalue())

    def test_explicit_admin_action_fails_before_any_mutation_for_write_user(self):
        for args in (['--apply', '--settings-only'], ['--apply', '--with-protection']):
            fake = FakeGithub()
            with patch.object(setup, 'api', fake), self.assertRaisesRegex(setup.SetupError, 'no writes performed'):
                setup.main(args)
            self.assertTrue(all(method == 'GET' for method, _, _ in fake.calls))

    def test_metadata_only_never_changes_admin_settings(self):
        fake = FakeGithub(admin=True)
        with patch.object(setup, 'api', fake), patch.object(setup, 'configure_metadata'):
            setup.main(['--apply', '--metadata-only'])
        self.assertTrue(all(method == 'GET' for method, _, _ in fake.calls))

    def test_admin_settings_verified_and_repeat_safe(self):
        fake = FakeGithub(admin=True)
        with patch.object(setup, 'api', fake):
            setup.main(['--apply', '--settings-only'])
            first = len(fake.calls)
            setup.main(['--apply', '--settings-only'])
        self.assertTrue(all(method == 'GET' for method, _, _ in fake.calls[first:]))
        self.assertIn('CONFIGURED / VERIFIED: repository settings', self.output.getvalue())

    def test_api_failure_includes_endpoint_status_and_stdout_validation_details(self):
        result = subprocess.CompletedProcess([], 1, json.dumps({
            'message': 'Validation Failed', 'errors': [{'resource': 'Label', 'field': 'name', 'code': 'already_exists'}]}),
            'gh: Validation Failed (HTTP 422)')
        with patch.object(setup.subprocess, 'run', return_value=result), self.assertRaises(setup.ApiError) as error:
            setup.api('POST', setup.BASE + '/labels', LABEL)
        self.assertEqual(422, error.exception.status)
        for detail in ('POST repos/', 'HTTP 422', 'already_exists', 'Label'):
            self.assertIn(detail, str(error.exception))

    def test_api_404_and_utf8_subprocess_configuration(self):
        result = subprocess.CompletedProcess([], 1, '{"message":"Not Found"}', 'gh: Not Found (HTTP 404)')
        with patch.object(setup.subprocess, 'run', return_value=result) as run, self.assertRaises(setup.ApiError) as error:
            setup.api('GET', setup.BASE)
        self.assertEqual(404, error.exception.status)
        self.assertEqual('utf-8', run.call_args.kwargs['encoding'])
        self.assertNotIn('GH_DEBUG', run.call_args.kwargs['env'])
        self.assertIn('github.com', run.call_args.args[0])

    def protection_response(self):
        desired = setup.read_json('.github/bootstrap/main-protection.json')
        return {**{k: {'enabled': v} for k, v in desired.items() if isinstance(v, bool)},
                'required_status_checks': desired['required_status_checks'],
                'required_pull_request_reviews': desired['required_pull_request_reviews']}

    def test_protection_create_and_read_back(self):
        response = self.protection_response()
        missing = setup.ApiError('GET', 'protection', subprocess.CompletedProcess(
            [], 1, '{"message":"Branch not protected"}', 'gh: Not Found (HTTP 404)'))
        with patch.object(setup, 'api', side_effect=[{'protected': False}, missing, response, response]) as api:
            setup.configure_protection()
        self.assertEqual('PUT', api.call_args_list[2].args[0])
        self.assertEqual('GET', api.call_args_list[3].args[0])

    def test_existing_stronger_protection_is_preserved(self):
        current = self.protection_response()
        current['required_pull_request_reviews']['required_approving_review_count'] = 2
        current['required_pull_request_reviews']['require_code_owner_reviews'] = True
        current['required_status_checks']['contexts'].append('additional-check')
        with patch.object(setup, 'api', side_effect=[{'protected': True}, current]) as api:
            setup.configure_protection()
        self.assertTrue(all(call.args[0] == 'GET' for call in api.call_args_list))

    def test_different_existing_protection_is_not_overwritten(self):
        with patch.object(setup, 'api', side_effect=[{'protected': True}, {}]) as api:
            with self.assertRaisesRegex(setup.SetupError, 'will not overwrite'):
                setup.configure_protection()
        self.assertTrue(all(call.args[0] == 'GET' for call in api.call_args_list))

    def test_protected_branch_permission_404_is_not_treated_as_absent(self):
        missing = setup.ApiError('GET', 'protection', subprocess.CompletedProcess(
            [], 1, '{"message":"Not Found"}', 'gh: Not Found (HTTP 404)'))
        with patch.object(setup, 'api', side_effect=[{'protected': True}, missing]) as api:
            with self.assertRaises(setup.ApiError):
                setup.configure_protection()
        self.assertTrue(all(call.args[0] == 'GET' for call in api.call_args_list))


if __name__ == '__main__':
    unittest.main()
