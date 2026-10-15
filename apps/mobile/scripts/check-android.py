"""Inspect release outputs; signing and device readiness are separate gates."""
from pathlib import Path
import struct
import xml.etree.ElementTree as ET
import zipfile

ANDROID = '{http://schemas.android.com/apk/res/android}'


def inspect_manifest(path):
    manifest = ET.parse(path).getroot()
    application = manifest.find('application')
    assert application is not None
    assert application.get(ANDROID + 'debuggable', 'false') == 'false'
    assert application.get(ANDROID + 'allowBackup') == 'false'
    assert application.get(ANDROID + 'usesCleartextTraffic', 'false') == 'false'
    sdk = manifest.find('uses-sdk')
    assert sdk is not None and int(sdk.get(ANDROID + 'targetSdkVersion', '0')) >= 36
    allowed = {'android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE'}
    own_receiver = manifest.get('package', '') + '.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'
    for declaration in manifest.findall('permission'):
        if (declaration.get(ANDROID + 'name') == own_receiver and
                declaration.get(ANDROID + 'protectionLevel') == 'signature'):
            allowed.add(own_receiver)
    permissions = {item.get(ANDROID + 'name') for item in manifest.findall('uses-permission')}
    assert permissions <= allowed, f'Unexpected release permissions: {permissions - allowed}'


def inspect_elf(data, name):
    assert data[:4] == b'\x7fELF', name
    assert data[4:6] == b'\x02\x01', f'Expected 64-bit little-endian ELF: {name}'
    offset = struct.unpack_from('<Q', data, 32)[0]
    size, count = struct.unpack_from('<HH', data, 54)
    assert count > 0 and size >= 56, name
    loads = 0
    for index in range(count):
        header = offset + index * size
        if struct.unpack_from('<I', data, header)[0] == 1:
            alignment = struct.unpack_from('<Q', data, header + 48)[0]
            assert alignment >= 16384, f'ELF LOAD alignment below 16 KB: {name}'
            loads += 1
    assert loads, f'No ELF LOAD segments: {name}'


def main():
    root = Path(__file__).resolve().parents[1] / 'android' / 'app' / 'build'
    manifests = list(root.glob('intermediates/merged_manifests/release/**/AndroidManifest.xml'))
    assert len(manifests) == 1, f'Expected one merged release manifest, found {len(manifests)}'
    inspect_manifest(manifests[0])
    libs = 0
    with zipfile.ZipFile(root / 'outputs/apk/release/app-release.apk') as archive:
        for name in archive.namelist():
            if name.startswith('lib/') and name.endswith('.so'):
                inspect_elf(archive.read(name), name)
                libs += 1
    assert libs, 'No native libraries inspected'
    print(f'Release manifest/permissions and {libs} native ELF alignments pass; device testing remains required.')


if __name__ == '__main__':
    main()
