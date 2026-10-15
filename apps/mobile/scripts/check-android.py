"""Inspect generated release outputs, without declaring signing or device readiness."""
from pathlib import Path
import struct
import xml.etree.ElementTree as ET
import zipfile

root = Path(__file__).resolve().parents[1] / 'android' / 'app' / 'build'
manifests = list(root.glob('intermediates/merged_manifests/release/**/AndroidManifest.xml'))
if len(manifests) != 1:
    raise SystemExit(f'Expected one merged release manifest, found {len(manifests)}')
manifest = ET.parse(manifests[0]).getroot()
a = '{http://schemas.android.com/apk/res/android}'
application = manifest.find('application')
assert application is not None
assert application.get(a + 'debuggable', 'false') == 'false'
assert application.get(a + 'allowBackup') == 'false'
assert application.get(a + 'usesCleartextTraffic', 'false') == 'false'
sdk = manifest.find('uses-sdk')
assert sdk is not None and int(sdk.get(a + 'targetSdkVersion', '0')) >= 36
allowed = {'android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE'}
permissions = {item.get(a + 'name') for item in manifest.findall('uses-permission')}
assert permissions <= allowed, f'Unexpected release permissions: {permissions - allowed}'
apk = root / 'outputs/apk/release/app-release.apk'
libs = 0
with zipfile.ZipFile(apk) as archive:
    for name in archive.namelist():
        if not name.startswith('lib/') or not name.endswith('.so'):
            continue
        data = archive.read(name)
        assert data[:4] == b'\x7fELF', name
        assert data[4:6] == b'\x02\x01', f'Expected 64-bit little-endian ELF: {name}'
        offset = struct.unpack_from('<Q', data, 32)[0]
        size, count = struct.unpack_from('<HH', data, 54)
        for index in range(count):
            header = offset + index * size
            if struct.unpack_from('<I', data, header)[0] == 1:
                alignment = struct.unpack_from('<Q', data, header + 48)[0]
                assert alignment >= 16384, f'ELF LOAD alignment below 16 KB: {name}'
        libs += 1
assert libs, 'No native libraries inspected'
print(f'Release manifest/permissions and {libs} native ELF alignments pass; device testing remains required.')
