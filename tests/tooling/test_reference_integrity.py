import hashlib
from pathlib import Path, PureWindowsPath
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from reference_integrity import inspect_reference, manifest_key, repair_reference


class ReferenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name) / 'artifact'
        (self.base / 'src').mkdir(parents=True)
        self.file = self.base / 'src' / 'example.ts'
        self.approved = 'const café = 1;\n// approved\n'.encode('utf-8')
        self.file.write_bytes(self.approved)
        self.manifest = {'src/example.ts': hashlib.sha256(self.approved).hexdigest()}

    def test_windows_paths_match_manifest_keys(self):
        self.assertEqual('src/example.ts', manifest_key(
            PureWindowsPath(r'H:\cursor\artifact\src\example.ts'),
            PureWindowsPath(r'H:\cursor\artifact')))

    def test_exact_reference_passes(self):
        self.assertEqual(([], []), inspect_reference(self.base, self.manifest))

    def test_crlf_fails_strict_check_and_dry_run_does_not_change_bytes(self):
        converted = self.approved.replace(b'\n', b'\r\n')
        self.file.write_bytes(converted)
        errors, _ = inspect_reference(self.base, self.manifest)
        self.assertIn('CRLF conversion', errors[0])
        self.assertEqual(['src/example.ts'], repair_reference(self.base, self.manifest))
        self.assertEqual(converted, self.file.read_bytes())

    def test_repair_restores_original_hash_and_is_repeat_safe(self):
        self.file.write_bytes(self.approved.replace(b'\n', b'\r\n'))
        repair_reference(self.base, self.manifest, apply=True)
        self.assertEqual(self.approved, self.file.read_bytes())
        self.assertEqual([], repair_reference(self.base, self.manifest, apply=True))

    def test_real_edits_refused(self):
        changed = self.approved + b'// human change\r\n'
        self.file.write_bytes(changed)
        with self.assertRaisesRegex(ValueError, 'No files changed'):
            repair_reference(self.base, self.manifest, apply=True)
        self.assertEqual(changed, self.file.read_bytes())

    def test_extra_file_blocks_all_repairs(self):
        converted = self.approved.replace(b'\n', b'\r\n')
        self.file.write_bytes(converted)
        extra = self.base / 'human-notes.txt'
        extra.write_text('keep me', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'Unexpected reference file'):
            repair_reference(self.base, self.manifest, apply=True)
        self.assertEqual(converted, self.file.read_bytes())
        self.assertEqual('keep me', extra.read_text(encoding='utf-8'))

    def test_missing_file_refused(self):
        self.file.unlink()
        with self.assertRaisesRegex(ValueError, 'missing'):
            repair_reference(self.base, self.manifest, apply=True)
        self.assertFalse(self.file.exists())

    def test_binary_edit_is_not_repaired(self):
        approved = b'\0\r\n\x89PNG\r\n'
        self.file.write_bytes(approved + b'x')
        self.manifest['src/example.ts'] = hashlib.sha256(approved).hexdigest()
        with self.assertRaises(ValueError):
            repair_reference(self.base, self.manifest, apply=True)
        self.assertEqual(approved + b'x', self.file.read_bytes())

    def test_invalid_manifest_path_refused(self):
        with self.assertRaisesRegex(ValueError, 'Invalid reference manifest path'):
            repair_reference(self.base, {'../outside': '0' * 64}, apply=True)

    def test_autocrlf_checkout_preserves_lf_crlf_and_binary_reference(self):
        """Exercise real Git filters with a Windows-style configuration on every OS."""
        repo = Path(self.temp.name) / 'repo'
        repo.mkdir()
        def git(*args, cwd=repo):
            return subprocess.run(['git', *args], cwd=cwd, check=True, capture_output=True)
        git('init')
        git('config', 'core.autocrlf', 'false')
        (repo / '.gitattributes').write_bytes((ROOT / '.gitattributes').read_bytes())
        ref = repo / 'reference/frontend-approved/artifact'
        ref.mkdir(parents=True)
        samples = {'lf.txt': b'one\ntwo\n', 'crlf.txt': b'one\r\ntwo\r\n',
                   'image.bin': b'\0\x89\r\n\xff\n'}
        for name, data in samples.items():
            (ref / name).write_bytes(data)
        git('add', '.')
        git('-c', 'user.name=Tooling test', '-c', 'user.email=test@example.invalid',
            '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture')
        clone = Path(self.temp.name) / 'clone'
        git('-c', 'core.autocrlf=true', 'clone', '--quiet', str(repo), str(clone))
        clone_ref = clone / 'reference/frontend-approved/artifact'
        for name, data in samples.items():
            self.assertEqual(data, (clone_ref / name).read_bytes())
        manifest = {name: hashlib.sha256(data).hexdigest() for name, data in samples.items()}
        self.assertEqual(([], []), inspect_reference(clone_ref, manifest))


if __name__ == '__main__':
    unittest.main()
