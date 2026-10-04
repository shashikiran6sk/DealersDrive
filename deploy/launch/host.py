#!/usr/bin/env python3
"""Host supervisor/deployer. AWS SDK only; never prints secrets."""
import base64
import fcntl
import json
import os
import pathlib
import re
import subprocess
import sys
import time
import urllib.request

import boto3

ROOT = pathlib.Path('/opt/dealers-drive')
CONFIG = json.loads((ROOT / 'host.json').read_text())
SESSION = boto3.Session(region_name=CONFIG['region'])
SSM = SESSION.client('ssm')


def run(*args, capture=False):
    return subprocess.run(args, cwd=ROOT, env={**os.environ, **compose_env()},
                          check=True, text=True, capture_output=capture)


def compose_env():
    path = ROOT / 'release.json'
    release = json.loads(path.read_text()) if path.exists() else {}
    return {'AWS_REGION': CONFIG['region'], 'API_DOMAIN': CONFIG['api_domain'],
            'TLS_EMAIL': CONFIG['email'], 'INSTANCE_ID': instance_id(),
            'API_IMAGE': release.get('api', 'unset'), 'MIGRATOR_IMAGE': release.get('migrator', 'unset')}


def instance_id():
    token = urllib.request.urlopen(urllib.request.Request(
        'http://169.254.169.254/latest/api/token', method='PUT',
        headers={'X-aws-ec2-metadata-token-ttl-seconds': '60'}), timeout=3).read().decode()
    return urllib.request.urlopen(urllib.request.Request(
        'http://169.254.169.254/latest/meta-data/instance-id',
        headers={'X-aws-ec2-metadata-token': token}), timeout=3).read().decode()


def parameter(name, decrypt=False):
    return SSM.get_parameter(Name=name, WithDecryption=decrypt)['Parameter']['Value']


def write_env(name, values):
    lines = []
    for key, value in values.items():
        if not re.fullmatch(r'[A-Z][A-Z0-9_]*', key) or not isinstance(value, str):
            raise ValueError('Runtime configuration must be a string-to-string environment object')
        if any(c in value for c in ['\n', '\r', '\x00', "'"]):
            raise ValueError(f'Unsupported environment value encoding for {key}')
        # Literal single quotes prevent Compose interpolation of dollars/backslashes.
        lines.append(f"{key}='{value}'")
    path = ROOT / name
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as out:
        out.write('\n'.join(lines) + '\n')


def registry_login():
    auth = SESSION.client('ecr').get_authorization_token()['authorizationData'][0]
    user, password = base64.b64decode(auth['authorizationToken']).decode().split(':', 1)
    subprocess.run(['docker', 'login', '--username', user, '--password-stdin', auth['proxyEndpoint']],
                   input=password, text=True, check=True, stdout=subprocess.DEVNULL)


def check_release(release):
    if not re.fullmatch(r'[0-9a-f]{40}', release['sha']):
        raise ValueError('Release requires a full Git SHA')
    for key in ['api', 'migrator']:
        expected = f"{CONFIG['registry']}/dealers-drive-launch-{key}:sha-{release['sha']}"
        if release[key] != expected:
            raise ValueError('Release image must match the approved registry/repository/SHA')


def ready(sha=None):
    try:
        with urllib.request.urlopen('http://127.0.0.1:4000/health/ready', timeout=4) as response:
            value = json.load(response)
        return value['status'] == 'ok' and (sha is None or value['version'] == sha)
    except (OSError, ValueError, KeyError):
        return False


def wait_ready(sha):
    for _ in range(45):
        if ready(sha):
            return
        time.sleep(2)
    raise RuntimeError('New API did not become ready with the expected Git SHA')


def refresh_credentials():
    credentials = SESSION.client('sts').assume_role(RoleArn=CONFIG['runtime_role'], RoleSessionName='media-runtime', DurationSeconds=3600)['Credentials']
    value = {'Version': 1, 'AccessKeyId': credentials['AccessKeyId'], 'SecretAccessKey': credentials['SecretAccessKey'], 'SessionToken': credentials['SessionToken'], 'Expiration': credentials['Expiration'].isoformat()}
    directory = ROOT / 'aws'
    directory.mkdir(exist_ok=True)
    path = directory / 'session.json'
    # Replace atomically: the directory bind mount observes the new inode.
    temporary = directory / 'session.tmp'
    temporary.write_text(json.dumps(value))
    temporary.chmod(0o644)
    temporary.replace(path)


def refresh_config():
    values = json.loads(parameter(CONFIG['runtime_parameter'], True))
    values.update({
        'NODE_ENV': 'production', 'APP_ENV': 'production', 'AUTH_MODE': 'cookie',
        'CACHE_DRIVER': 'postgres', 'STORAGE_DRIVER': 's3', 'S3_REGION': CONFIG['region'],
        'S3_ENDPOINT': f"https://s3.{CONFIG['region']}.amazonaws.com", 'S3_FORCE_PATH_STYLE': 'false',
        'S3_BUCKET': CONFIG['bucket'], 'WEB_ORIGIN': CONFIG['web_origin'],
        'WEB_BASE_URL': CONFIG['web_origin'], 'API_BASE_URL': 'https://' + CONFIG['api_domain'],
        'MEDIA_BASE_URL': 'https://' + CONFIG['media_domain'] + '/media',
        'GOOGLE_CALLBACK_URL': CONFIG['web_origin'] + '/v1/auth/google/callback',
        'DB_SSL_CA_FILE': '/run/rds-ca.pem', 'MAIL_DRIVER': 'resend',
        'PHONE_OTP_DRIVER': 'msg91', 'JOBS_ENABLED': 'true', 'DOCS_ENABLED': 'false',
        'SESSION_COOKIE_DOMAIN': '', 'HOST': '0.0.0.0', 'PORT': '4000',
    })
    for key in ['MIGRATION_DATABASE_URL', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']:
        values.pop(key, None)
    write_env('runtime.env', values)
    migration = json.loads(parameter(CONFIG['migration_parameter'], True))
    write_env('migration.env', {'DATABASE_URL': migration['DATABASE_URL'],
                              'NODE_ENV': 'production', 'NODE_EXTRA_CA_CERTS': '/run/rds-ca.pem'})


def deploy(release, migrate=True):
    check_release(release)
    previous = json.loads((ROOT / 'release.json').read_text()) if (ROOT / 'release.json').exists() else None
    refresh_config()
    registry_login()
    (ROOT / 'release.json').write_text(json.dumps(release))
    try:
        run('docker', 'compose', '-f', 'compose.yml', 'pull', 'api', 'worker', 'migrate', 'proxy')
        if migrate:
            run('docker', 'compose', '-f', 'compose.yml', '--profile', 'tools', 'run', '--rm', 'migrate')
        run('docker', 'compose', '-f', 'compose.yml', 'up', '-d', 'api', 'worker', 'proxy')
        wait_ready(release['sha'])
    except Exception:
        if previous:
            (ROOT / 'release.json').write_text(json.dumps(previous))
            run('docker', 'compose', '-f', 'compose.yml', 'up', '-d', 'api', 'worker', 'proxy')
            wait_ready(previous['sha'])
        else:
            (ROOT / 'release.json').unlink(missing_ok=True)
        raise
    if previous:
        (ROOT / 'previous.json').write_text(json.dumps(previous))
    print('Deployment healthy:', release['sha'])


def emit_metrics():
    metrics = {'Availability': int(ready())}
    try:
        worker = run('docker', 'compose', '-f', 'compose.yml', 'ps', '-q', 'worker', capture=True).stdout.strip()
        metrics['WorkerAlive'] = int(bool(worker) and run('docker', 'inspect', '-f', '{{.State.Running}}', worker, capture=True).stdout.strip() == 'true')
        ticks = [int(v) for v in pathlib.Path('/proc/stat').read_text().splitlines()[0].split()[1:]]
        snapshot = ROOT / 'cpu-ticks.json'
        if snapshot.exists():
            before = json.loads(snapshot.read_text())
            total = sum(ticks) - sum(before)
            if total > 0:
                metrics['CPUPercent'] = 100 * (1 - ((ticks[3] + ticks[4]) - (before[3] + before[4])) / total)
        snapshot.write_text(json.dumps(ticks))
        values = dict(line.split(':', 1) for line in pathlib.Path('/proc/meminfo').read_text().splitlines())
        metrics['MemoryPercent'] = 100 * (1 - int(values['MemAvailable'].split()[0]) / int(values['MemTotal'].split()[0]))
        result = run('docker', 'compose', '-f', 'compose.yml', 'exec', '-T', 'api', 'node', 'apps/api/dist/operations.js', capture=True)
        metrics.update(json.loads(result.stdout.strip().splitlines()[-1]))
    except Exception:
        print('Runtime metrics collection failed; availability is reported separately')
    SESSION.client('cloudwatch').put_metric_data(Namespace='DealersDrive/Production', MetricData=[
        {'MetricName': key, 'Value': value, 'Dimensions': [{'Name': 'Application', 'Value': 'dealers-drive'}]}
        for key, value in metrics.items()
    ])


def main():
    ROOT.mkdir(exist_ok=True)
    with (ROOT / 'deploy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        mode = sys.argv[1] if len(sys.argv) > 1 else 'sync'
        refresh_credentials()
        if mode == 'bootstrap':
            SESSION.client('ec2').associate_address(AllocationId=CONFIG['eip_allocation'],
                                                   InstanceId=instance_id(), AllowReassociation=True)
        if mode == 'rollback':
            previous = json.loads((ROOT / 'previous.json').read_text())
            deploy(previous, migrate=False)
            SSM.put_parameter(Name=CONFIG['release_parameter'], Value=json.dumps(previous), Type='String', Overwrite=True)
            return
        release = json.loads(parameter(CONFIG['release_parameter']))
        check_release(release)
        current = json.loads((ROOT / 'release.json').read_text()) if (ROOT / 'release.json').exists() else None
        rejected = ROOT / 'rejected-sha'
        if current != release or mode == 'deploy':
            if mode == 'sync' and rejected.exists() and rejected.read_text() == release['sha']:
                print('Rejected release requires an explicit deploy retry or a new SHA')
            else:
                try:
                    deploy(release)
                    rejected.unlink(missing_ok=True)
                except Exception:
                    rejected.write_text(release['sha'])
                    raise
        elif not ready():
            # Bounded automatic restart; DB outages must not create endless loops.
            failures = ROOT / 'health-failures'
            count = int(failures.read_text()) + 1 if failures.exists() else 1
            failures.write_text(str(count))
            if count == 3:
                run('docker', 'compose', '-f', 'compose.yml', 'restart', 'api', 'worker')
                print('Restarted unhealthy runtime after three health failures')
        else:
            (ROOT / 'health-failures').unlink(missing_ok=True)
        emit_metrics()


if __name__ == '__main__':
    main()
