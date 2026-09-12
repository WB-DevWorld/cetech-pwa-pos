"""Repeat-safe GitHub metadata setup. Python 3.10+, authenticated gh CLI.

Dry-run by default. No invitations, visibility changes, code pushes or deployments.
Repository settings/protection require admin access; metadata works with write access.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
REPO = 'WB-DevWorld/cetech-pwa-pos'
BASE = f'repos/{REPO}'


class SetupError(RuntimeError):
    pass


class ApiError(SetupError):
    def __init__(self, method, path, result):
        status = re.search(r'HTTP (\d{3})', result.stderr or '')
        self.status = int(status[1]) if status else None
        try:
            body = json.loads(result.stdout)
        except (ValueError, TypeError):
            body = {}
        # Only API diagnostics, never request headers, credential values or payloads.
        detail = {k: body[k] for k in ('message', 'errors') if k in body}
        message = json.dumps(detail, ensure_ascii=True) if detail else result.stderr.strip()
        message = re.sub(r'(?:gh[pousr]_[\w]+|github_pat_[\w]+)', '[REDACTED]', message)
        super().__init__(f'{method} {path}: HTTP {self.status or "unknown"}\n{message}')


def read_json(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))


def api(method, path, payload=None):
    cmd = ['gh', 'api', '--hostname', 'github.com', '--method', method,
           '-H', 'Accept: application/vnd.github+json',
           '-H', 'X-GitHub-Api-Version: 2022-11-28', path]
    if payload is not None:
        cmd += ['--input', '-']
    env = os.environ.copy()
    env.pop('GH_DEBUG', None)  # Never collect authentication headers in debug output.
    try:
        result = subprocess.run(cmd, input=json.dumps(payload) if payload is not None else None,
                                text=True, encoding='utf-8', capture_output=True, env=env)
    except FileNotFoundError as exc:
        raise SetupError('GitHub CLI (gh) was not found. Install it, then authenticate your own account.') from exc
    if result.returncode:
        raise ApiError(method, path, result)
    if not result.stdout.strip():
        return None
    try:
        return json.loads(result.stdout)
    except ValueError as exc:
        raise SetupError(f'{method} {path}: response was not valid JSON') from exc


def collection(path):
    result = []
    page = 1
    separator = '&' if '?' in path else '?'
    while True:
        batch = api('GET', f'{path}{separator}per_page=100&page={page}')
        if not isinstance(batch, list):
            raise SetupError(f'Expected a list from {path}')
        result.extend(batch)
        if len(batch) < 100:
            return result
        page += 1


def write(method, path, payload):
    print(f'APPLY {method} {path}', flush=True)
    return api(method, path, payload)


def configure_metadata(labels, milestones, issues, issue_map):
    existing = {x['name'].casefold(): x for x in collection(f'{BASE}/labels')}
    for label in labels:
        match = existing.get(label['name'].casefold())
        if match is None:
            write('POST', f'{BASE}/labels', label)
        elif any((match.get(k) or '') != v for k, v in label.items()):
            # The update endpoint uses new_name, unlike the create endpoint's name.
            payload = {'new_name': label['name'], 'color': label['color'],
                       'description': label['description']}
            write('PATCH', f'{BASE}/labels/{quote(match["name"], safe="")}', payload)

    existing_milestones = {x['title']: x for x in collection(f'{BASE}/milestones?state=all')}
    mapping = {}
    for milestone in milestones:
        match = existing_milestones.get(milestone['title'])
        if match is None:
            match = write('POST', f'{BASE}/milestones',
                          {k: milestone[k] for k in ('title', 'description')})
        elif (match.get('description') or '') != milestone['description']:
            write('PATCH', f'{BASE}/milestones/{match["number"]}',
                  {'description': milestone['description']})
        # Do not reopen a milestone completed by a human.
        mapping[milestone['key']] = match['number']

    for item in issues:
        number = issue_map[item['task_id']]['number']
        path = f'{BASE}/issues/{number}'
        current = api('GET', path)
        existing_names = {x['name'].casefold() for x in current['labels']}
        missing = [x for x in item['labels'] if x.casefold() not in existing_names]
        if missing:
            # Additive endpoint preserves unrelated labels, including concurrent additions.
            write('POST', path + '/labels', {'labels': missing})
        if (current.get('milestone') or {}).get('number') != mapping[item['milestone']]:
            write('PATCH', path, {'milestone': mapping[item['milestone']]})
    print(f'CONFIGURED: {len(labels)} labels, {len(milestones)} milestones, {len(issues)} mapped issues.')


def protection_satisfies(current, desired):
    """Recognize an existing equal/stronger baseline without replacing its extra rules."""
    checks = current.get('required_status_checks') or {}
    contexts = set(checks.get('contexts', []))
    contexts.update(x['context'] for x in checks.get('checks', []))
    reviews = current.get('required_pull_request_reviews') or {}
    return (
        checks.get('strict') is True
        and set(desired['required_status_checks']['contexts']) <= contexts
        and reviews.get('required_approving_review_count', 0) >= 1
        and reviews.get('dismiss_stale_reviews') is True
        and all((current.get(k) or {}).get('enabled') is True for k in
                ('enforce_admins', 'required_linear_history', 'required_conversation_resolution'))
        and all((current.get(k) or {}).get('enabled') is False for k in
                ('allow_force_pushes', 'allow_deletions'))
    )


def configure_protection():
    path = f'{BASE}/branches/main/protection'
    desired = read_json('.github/bootstrap/main-protection.json')
    # Distinguish an absent branch from an unprotected branch before handling a 404.
    branch = api('GET', f'{BASE}/branches/main')
    try:
        current = api('GET', path)
    except ApiError as exc:
        if exc.status != 404 or branch.get('protected') is not False:
            raise
        current = None
    if current is not None:
        if not protection_satisfies(current, desired):
            raise SetupError('Existing main protection differs from the prepared baseline. '
                             'Review it in GitHub; this script will not overwrite existing rules.')
        print('VERIFIED: existing main protection satisfies the baseline; extra rules retained.')
        return
    write('PUT', path, desired)
    if not protection_satisfies(api('GET', path), desired):
        raise SetupError('Protection write returned, but read-back did not confirm the required baseline.')
    print('CONFIGURED / VERIFIED: main protection.')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--metadata-only', action='store_true')
    group.add_argument('--settings-only', action='store_true')
    parser.add_argument('--with-protection', action='store_true')
    args = parser.parse_args(argv)
    if args.metadata_only and args.with_protection:
        parser.error('--with-protection cannot be combined with --metadata-only')
    labels = read_json('.github/bootstrap/labels.json')
    milestones = read_json('.github/bootstrap/milestones.json')
    issues = read_json('.github/bootstrap/issues.json')
    issue_map = read_json('.github/bootstrap/issue-map.json')
    for item in issues:
        if not isinstance(issue_map.get(item['task_id'], {}).get('number'), int):
            raise SetupError(f'Missing issue number for {item["task_id"]}; no writes performed.')
    if not args.apply:
        print(f'DRY RUN: {REPO}; no network requests or changes.')
        if not args.settings_only:
            print(f'Metadata: {len(labels)} labels, {len(milestones)} milestones, {len(issues)} mapped issues.')
        if not args.metadata_only:
            print('Settings: issues enabled, squash-only merges, branch deletion after merge (admin required).')
        print('Protection requested:', args.with_protection)
        return 0

    identity = api('GET', 'user')['login']
    repo = api('GET', BASE)
    permissions = repo.get('permissions', {})
    admin = permissions.get('admin') is True
    print(f'Authenticated as {identity}; repository={REPO}; admin={admin}', flush=True)
    if (args.settings_only or args.with_protection) and not admin:
        raise SetupError('Admin access is required for settings/protection; no writes performed. '
                         'Use --apply --metadata-only for labels/milestones/issues. '
                         'The senior must run the admin step with their own account.')
    if not args.settings_only:
        if not (permissions.get('push') or permissions.get('maintain') or admin):
            raise SetupError('Repository write access is required; no writes performed.')
        configure_metadata(labels, milestones, issues, issue_map)
    if not args.metadata_only:
        if admin:
            settings = {'has_issues': True, 'allow_squash_merge': True, 'allow_merge_commit': False,
                        'allow_rebase_merge': False, 'delete_branch_on_merge': True}
            if any(repo.get(k) != v for k, v in settings.items()):
                write('PATCH', BASE, settings)
            actual = api('GET', BASE)
            if any(actual.get(k) != v for k, v in settings.items()):
                raise SetupError('Settings read-back did not confirm the requested values.')
            print('CONFIGURED / VERIFIED: repository settings.')
        else:
            print('REQUIRES ADMIN: repository settings were skipped. '
                  'Senior command: python scripts/github_setup.py --apply --settings-only --with-protection')
    if args.with_protection:
        configure_protection()
    else:
        print('Protection was not requested or changed by this run.')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (SetupError, OSError, ValueError, KeyError) as exc:
        print(f'FAILED: {exc}\nEarlier successful writes may remain; a rerun is safe.', file=sys.stderr)
        sys.exit(1)
