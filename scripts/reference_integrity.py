"""Exact approved-byte validation and conservative CRLF repair planning."""
import hashlib
from pathlib import PurePosixPath


def digest(data):
    return hashlib.sha256(data).hexdigest()


def manifest_key(path, base):
    # PureWindowsPath/WindowsPath and POSIX paths must produce the same wire key.
    return path.relative_to(base).as_posix()


def inspect_reference(base, manifest):
    """Return errors and provable repairs; never normalize away an integrity failure."""
    errors, repairs = [], []
    for key in manifest:
        path = PurePosixPath(key)
        if path.is_absolute() or '..' in path.parts or '\\' in key or key != path.as_posix():
            return [f'Invalid reference manifest path: {key}'], []
    if base.is_symlink():
        return ['Reference artifact directory must not be a symlink'], []
    actual = {}
    for path in base.rglob('*'):
        if path.is_symlink():
            errors.append(f'Reference symlink is forbidden: {manifest_key(path, base)}')
        elif path.is_file():
            actual[manifest_key(path, base)] = path
    for key in sorted(manifest.keys() - actual.keys()):
        errors.append(f'Approved reference missing: {key}')
    for key in sorted(actual.keys() - manifest.keys()):
        errors.append(f'Unexpected reference file: {key}')
    for key in sorted(manifest.keys() & actual.keys()):
        data = actual[key].read_bytes()
        if digest(data) == manifest[key]:
            continue
        candidate = data.replace(b'\r\n', b'\n')
        if b'\r\n' in data and b'\0' not in data and digest(candidate) == manifest[key]:
            errors.append(f'Approved reference CRLF conversion: {key}; run scripts/repair_reference.py')
            repairs.append((actual[key], data, candidate))
        else:
            errors.append(f'Approved reference bytes changed: {key} (not a proven CRLF-only conversion)')
    return errors, repairs


def repair_reference(base, manifest, apply=False):
    errors, repairs = inspect_reference(base, manifest)
    # Every mismatch must be a byte-for-byte provable line-ending conversion.
    if len(errors) != len(repairs):
        raise ValueError('No files changed. Review genuine/missing/extra files:\n' + '\n'.join(errors))
    if apply:
        for path, before, _ in repairs:
            if path.is_symlink() or path.read_bytes() != before:
                raise ValueError('Reference changed during inspection; no repair started.')
        for path, _, approved in repairs:
            path.write_bytes(approved)
    return [manifest_key(path, base) for path, _, _ in repairs]
