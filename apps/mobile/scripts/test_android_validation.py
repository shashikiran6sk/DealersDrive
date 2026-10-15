import importlib.util
from pathlib import Path
import struct
import tempfile
import unittest
from defusedxml.common import DTDForbidden

spec = importlib.util.spec_from_file_location('validation', Path(__file__).with_name('check-android.py'))
validation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validation)


class AndroidValidationTests(unittest.TestCase):
    def manifest(self, application='', permission='', target='36'):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'AndroidManifest.xml'
            path.write_text(f'''<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.example.preview">
<uses-sdk android:targetSdkVersion="{target}"/>{permission}
<application android:allowBackup="false" {application}/></manifest>''')
            validation.inspect_manifest(path)

    def test_refuses_debug_cleartext_sensitive_permissions_and_old_target(self):
        self.manifest()
        for attribute in ['android:debuggable="true"', 'android:usesCleartextTraffic="true"']:
            with self.assertRaises(AssertionError):
                self.manifest(application=attribute)
        with self.assertRaises(AssertionError):
            self.manifest(permission='<uses-permission android:name="android.permission.READ_SMS"/>')
        with self.assertRaises(AssertionError):
            self.manifest(target='35')

    def test_own_receiver_requires_signature_protection_and_exact_package(self):
        name = 'com.example.preview.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'
        self.manifest(permission=f'<permission android:name="{name}" android:protectionLevel="signature"/><uses-permission android:name="{name}"/>')
        for protection in ['normal', 'dangerous']:
            with self.assertRaises(AssertionError):
                self.manifest(permission=f'<permission android:name="{name}" android:protectionLevel="{protection}"/><uses-permission android:name="{name}"/>')

    def test_forbids_document_types_and_external_entities(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'AndroidManifest.xml'
            path.write_text('<!DOCTYPE manifest [<!ENTITY source SYSTEM "file:///unavailable-test-file">]><manifest>&source;</manifest>')
            with self.assertRaises(DTDForbidden):
                validation.inspect_manifest(path)

    def test_refuses_unaligned_or_unsupported_native_library(self):
        data = bytearray(128)
        data[:6] = b'\x7fELF\x02\x01'
        struct.pack_into('<Q', data, 32, 64)
        struct.pack_into('<HH', data, 54, 56, 1)
        struct.pack_into('<I', data, 64, 1)
        struct.pack_into('<Q', data, 112, 16384)
        validation.inspect_elf(data, 'valid.so')
        struct.pack_into('<Q', data, 112, 4096)
        with self.assertRaises(AssertionError):
            validation.inspect_elf(data, 'unaligned.so')
        data[4] = 1
        with self.assertRaises(AssertionError):
            validation.inspect_elf(data, 'unsupported.so')


if __name__ == '__main__':
    unittest.main()
