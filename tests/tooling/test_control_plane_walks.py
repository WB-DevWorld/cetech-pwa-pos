from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from verify_control_plane import (
    generated_path,
    skip_markdown_link_check,
    skip_secret_tripwire,
)


class ControlPlaneWalkTests(unittest.TestCase):
    def test_generated_install_paths_are_excluded_from_both_walks(self):
        samples = [
            ROOT / 'node_modules' / 'pkg' / 'README.md',
            ROOT / 'apps' / 'pos-web' / 'node_modules' / 'pkg' / 'index.js',
            ROOT / 'apps' / 'pos-web' / '.next' / 'types' / 'routes.d.ts',
            ROOT / 'apps' / 'pos-web' / 'playwright-report' / 'index.html',
            ROOT / 'apps' / 'pos-web' / 'test-results' / 'trace.zip',
            ROOT / 'coverage' / 'index.html',
            ROOT / 'dist' / 'index.js',
            ROOT / 'out' / 'index.html',
            ROOT / '.git' / 'config',
        ]
        for path in samples:
            with self.subTest(path=str(path.relative_to(ROOT))):
                self.assertTrue(generated_path(path))
                self.assertTrue(skip_markdown_link_check(path))
                self.assertTrue(skip_secret_tripwire(path))

    def test_artifact_is_skipped_from_markdown_link_validation(self):
        path = ROOT / 'reference' / 'frontend-approved' / 'artifact' / 'README.md'
        self.assertFalse(generated_path(path))
        self.assertTrue(skip_markdown_link_check(path))

    def test_artifact_is_not_skipped_from_secret_tripwire(self):
        path = ROOT / 'reference' / 'frontend-approved' / 'artifact' / 'README.md'
        self.assertFalse(generated_path(path))
        self.assertFalse(skip_secret_tripwire(path))

    def test_ordinary_docs_are_scanned_by_both_walks(self):
        path = ROOT / 'CURRENT-WORK.md'
        self.assertFalse(generated_path(path))
        self.assertFalse(skip_markdown_link_check(path))
        self.assertFalse(skip_secret_tripwire(path))
