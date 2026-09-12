from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
CANONICAL = ROOT / 'tests' / 'integration' / 'rls' / 'test_rls_isolation.sql'
MIRROR = ROOT / 'supabase' / 'tests' / 'rls_isolation.sql'


def _executable_body(sql: str) -> str:
    marker = 'BEGIN;'
    index = sql.find(marker)
    if index < 0:
        raise AssertionError('SQL suite is missing BEGIN; marker')
    return sql[index:].replace('\r\n', '\n')


class RlsSuiteMirrorTests(unittest.TestCase):
    def test_canonical_and_supabase_pgTAP_bodies_match(self):
        canonical = CANONICAL.read_text(encoding='utf-8')
        mirror = MIRROR.read_text(encoding='utf-8')
        self.assertEqual(
            _executable_body(canonical),
            _executable_body(mirror),
            'supabase/tests/rls_isolation.sql must match tests/integration/rls/test_rls_isolation.sql after the header',
        )


if __name__ == '__main__':
    unittest.main()
