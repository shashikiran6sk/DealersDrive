"""Failure recovery and secret encoding tests; no cloud connection or Docker."""
import importlib.util
import json
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import MagicMock, patch

FILE = pathlib.Path(__file__).resolve().parents[1] / 'host.py'
CONFIG = {'region': 'ap-south-1', 'api_domain': 'api.example.com', 'email': 'ops@example.com',
          'registry': '123.dkr.ecr.ap-south-1.amazonaws.com', 'release_parameter': '/release'}
SDK = MagicMock()
original_read = pathlib.Path.read_text


def config_read(path, *args, **kwargs):
    if str(path) == '/opt/dealers-drive/host.json':
        return json.dumps(CONFIG)
    return original_read(path, *args, **kwargs)


with patch.dict(sys.modules, {'boto3': SDK}), patch.object(pathlib.Path, 'read_text', config_read):
    spec = importlib.util.spec_from_file_location('host', FILE)
    host = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(host)


def release(char):
    sha = char * 40
    return {'sha': sha, 'api': f"{CONFIG['registry']}/dealers-drive-launch-api:sha-{sha}",
            'migrator': f"{CONFIG['registry']}/dealers-drive-launch-migrator:sha-{sha}"}


class HostRecovery(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        host.ROOT = pathlib.Path(self.directory.name)
        host.SSM = MagicMock()
        host.CONFIG = dict(CONFIG)

    def test_failed_health_restores_previous_immutable_release(self):
        old, new = release('a'), release('b')
        (host.ROOT / 'release.json').write_text(json.dumps(old))
        with patch.object(host, 'refresh_config'), patch.object(host, 'registry_login'), patch.object(host, 'run') as run, patch.object(host, 'wait_ready', side_effect=[RuntimeError('unhealthy'), None]):
            with self.assertRaisesRegex(RuntimeError, 'unhealthy'):
                host.deploy(new)
            self.assertEqual(json.loads((host.ROOT / 'release.json').read_text()), old)
            # A failure after migration restores code only; it never reruns a migration backwards.
            self.assertEqual(sum('run' in call.args and 'migrate' in call.args for call in run.call_args_list), 1)

    def test_rejected_release_does_not_repeatedly_migrate_in_timer(self):
        new = release('b')
        (host.ROOT / 'rejected-sha').write_text(new['sha'])
        with patch.object(host, 'refresh_credentials'), patch.object(host, 'parameter', return_value=json.dumps(new)), patch.object(host, 'deploy') as deploy, patch.object(host, 'emit_metrics'), patch.object(sys, 'argv', ['host.py', 'sync']):
            host.main()
            deploy.assert_not_called()

    def test_explicit_rollback_updates_desired_pointer_so_timer_keeps_it(self):
        old = release('a')
        (host.ROOT / 'previous.json').write_text(json.dumps(old))
        with patch.object(host, 'refresh_credentials'), patch.object(host, 'deploy') as deploy, patch.object(sys, 'argv', ['host.py', 'rollback']):
            host.main()
            deploy.assert_called_once_with(old, migrate=False)
            self.assertEqual(json.loads(host.SSM.put_parameter.call_args.kwargs['Value']), old)

    def test_failed_initial_deployment_has_no_false_active_pointer(self):
        with patch.object(host, 'refresh_config'), patch.object(host, 'registry_login'), patch.object(host, 'run', side_effect=RuntimeError('pull failed')):
            with self.assertRaises(RuntimeError):
                host.deploy(release('a'))
            self.assertFalse((host.ROOT / 'release.json').exists())

    def test_env_values_are_literal_and_private_and_reject_injection(self):
        host.write_env('runtime.env', {'SESSION_SECRET': 'a$literal\\value'})
        path = host.ROOT / 'runtime.env'
        self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        self.assertEqual(path.read_text(), "SESSION_SECRET='a$literal\\value'\n")
        for value in ["x\nEVIL=yes", "x'", 123]:
            with self.assertRaises(ValueError):
                host.write_env('runtime.env', {'SECRET': value})

    def test_release_rejects_other_repository_or_mutable_tag(self):
        bad = release('a')
        bad['api'] = CONFIG['registry'] + '/other:latest'
        with self.assertRaises(ValueError):
            host.check_release(bad)


if __name__ == '__main__':
    unittest.main()
