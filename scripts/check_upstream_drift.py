"""Read-only upstream path evidence. No fetch, merge, scope or semantic decisions."""
import argparse
import json
from pathlib import Path
import subprocess
import sys

CRITICAL_FILES = {
    'AGENTS.md', 'SOURCE-OF-TRUTH.md', 'PROJECT-CONSTITUTION.md',
    'OWNERSHIP.md', 'CURRENT-WORK.md', 'CONTRIBUTING.md',
    'LIVE-ENVIRONMENT-FACTS.md', 'package.json', 'pnpm-lock.yaml',
    'pnpm-workspace.yaml', '.env.example', '.npmrc', '.gitattributes',
}
CRITICAL_PREFIXES = (
    'docs/contracts/', 'docs/decisions/', 'docs/standards/', 'docs/workstreams/',
    'docs/plans/', 'docs/integration/', 'docs/ai/', '.cursor/', '.github/',
    'supabase/', 'apps/pos-web/src/core/', 'apps/pos-web/src/server/',
    'apps/pos-web/src/config/', 'apps/pos-web/src/local/', 'apps/pos-web/public/',
)


def git(repo, *args):
    result = subprocess.run(['git', '-C', str(repo), *args], capture_output=True)
    if result.returncode:
        raise ValueError(result.stderr.decode('utf-8', errors='replace').strip())
    return result.stdout


def resolve(repo, ref):
    # --end-of-options prevents a supplied ref becoming a git option.
    return git(repo, 'rev-parse', '--verify', '--end-of-options',
               ref + '^{commit}').decode('ascii').strip()


def critical(path):
    return (path in CRITICAL_FILES or path.startswith(CRITICAL_PREFIXES)
            or (path.startswith('apps/pos-web/') and
                (Path(path).name in {'package.json', '.env.example'} or
                 Path(path).name.startswith(('tsconfig', 'next.config', 'vitest.config',
                                           'playwright.config', 'eslint.config')))))


def compare(repo, base, upstream, pass_number):
    if pass_number not in (1, 2):
        raise ValueError('Exactly two final passes are permitted; no Pass 3.')
    base_sha, upstream_sha = resolve(repo, base), resolve(repo, upstream)
    ancestry = subprocess.run(['git', '-C', str(repo), 'merge-base', '--is-ancestor',
                              base_sha, upstream_sha], capture_output=True)
    if ancestry.returncode not in (0, 1):
        raise ValueError('Cannot establish ancestry; inspect available history.')
    # Disable rename detection so both old/deleted and new paths are reported.
    # NUL separation preserves spaces, tabs and line breaks in Git filenames.
    raw = git(repo, 'diff', '--name-only', '-z', '--no-renames',
              base_sha, upstream_sha, '--')
    paths = [p.decode('utf-8', errors='surrogateescape')
             for p in raw.split(b'\0') if p]
    return {
        'schema_version': 1, 'pass_number': pass_number,
        'base_sha': base_sha, 'upstream_sha': upstream_sha,
        'history_relation': ('SAME' if base_sha == upstream_sha else
                             'FORWARD' if ancestry.returncode == 0 else 'NON_FORWARD'),
        'changed_paths': paths,
        'critical_paths': [p for p in paths if critical(p)],
        'semantic_classification': 'REQUIRES_AGENT_OR_OWNER_ASSESSMENT',
        'limit': 'Path hints do not establish relevance, authorization or readiness. '
                 'Missing history or NON_FORWARD requires owner assessment. '
                 'No third autonomous freshness pass.',
    }


def markdown(record):
    # JSON quoting protects unusual filenames from breaking evidence formatting.
    rows = '\n'.join('- ' + json.dumps(p, ensure_ascii=True)
                     for p in record['changed_paths']) or '- none'
    hints = '\n'.join('- ' + json.dumps(p, ensure_ascii=True)
                      for p in record['critical_paths']) or '- none'
    return (f"# Freshness Pass {record['pass_number']} path evidence\n\n"
            f"Base: `{record['base_sha']}`\n\nUpstream cutoff: `{record['upstream_sha']}`\n\n"
            f"History: {record['history_relation']}\n\nChanged paths:\n\n{rows}\n\n"
            f"Critical hints:\n\n{hints}\n\n{record['limit']}\n")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, default=Path.cwd())
    parser.add_argument('--base', required=True)
    parser.add_argument('--upstream', required=True)
    parser.add_argument('--pass-number', type=int, choices=(1, 2), required=True)
    parser.add_argument('--format', choices=('json', 'markdown'), default='json')
    args = parser.parse_args(argv)
    try:
        record = compare(args.repo, args.base, args.upstream, args.pass_number)
    except (ValueError, OSError) as exc:
        print(f'UNVERIFIED: {exc}', file=sys.stderr)
        return 2
    print(json.dumps(record, indent=2, ensure_ascii=True)
          if args.format == 'json' else markdown(record))
    return 1 if record['history_relation'] == 'NON_FORWARD' else 0


if __name__ == '__main__':
    raise SystemExit(main())
