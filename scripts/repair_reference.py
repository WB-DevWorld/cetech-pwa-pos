"""Restore only CRLF conversions that prove the original SHA-256. Dry-run by default."""
import argparse
import json
from pathlib import Path
import sys
from reference_integrity import repair_reference

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    manifest = json.loads((ROOT / 'reference/frontend-approved/SHA256SUMS.json').read_text(encoding='utf-8'))
    paths = repair_reference(ROOT / 'reference/frontend-approved/artifact', manifest, args.apply)
    for path in paths:
        print(('RESTORED: ' if args.apply else 'WOULD RESTORE: ') + path)
    print(f'{len(paths)} proven CRLF conversions; ' + ('applied.' if args.apply else 'dry-run, no files changed.'))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, OSError) as exc:
        print(f'FAILED: {exc}', file=sys.stderr)
        sys.exit(1)
