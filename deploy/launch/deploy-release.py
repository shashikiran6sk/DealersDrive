#!/usr/bin/env python3
"""CI deployment client: SDK, immutable images, single SSM command, safe failure."""
import json
import os
import re
import time

import boto3

sha = os.environ['GIT_SHA']
registry = os.environ['ECR_REGISTRY']
if not re.fullmatch(r'[0-9a-f]{40}', sha):
    raise ValueError('A full immutable Git SHA is required')
session = boto3.Session(region_name=os.environ['AWS_REGION'])
ssm = session.client('ssm')
ec2 = session.client('ec2')
parameter = '/dealers-drive/production/release'
release = {'sha': sha, 'api': f'{registry}/dealers-drive-launch-api:sha-{sha}',
           'migrator': f'{registry}/dealers-drive-launch-migrator:sha-{sha}'}
instances = ec2.describe_instances(Filters=[
    {'Name': 'tag:Application', 'Values': ['dealers-drive']},
    {'Name': 'tag:Environment', 'Values': ['production']},
    {'Name': 'tag:Name', 'Values': ['dd-launch-production']},
    {'Name': 'instance-state-name', 'Values': ['running']},
])
ids = [i['InstanceId'] for r in instances['Reservations'] for i in r['Instances']]
if len(ids) != 1:
    raise RuntimeError('Deployment requires exactly one running launch host')
try:
    previous = ssm.get_parameter(Name=parameter)['Parameter']['Value']
except ssm.exceptions.ParameterNotFound:
    previous = None
ssm.put_parameter(Name=parameter, Type='String', Value=json.dumps(release), Overwrite=True)
try:
    response = ssm.send_command(InstanceIds=ids, DocumentName='AWS-RunShellScript',
        Parameters={'commands': ['/opt/dealers-drive/venv/bin/python /opt/dealers-drive/host.py deploy'], 'executionTimeout': ['600']})
    command = response['Command']['CommandId']
    for _ in range(120):
        time.sleep(5)
        try:
            result = ssm.get_command_invocation(CommandId=command, InstanceId=ids[0])
        except ssm.exceptions.InvocationDoesNotExist:
            continue
        if result['Status'] == 'Success':
            print('Production deployment healthy:', sha)
            break
        if result['Status'] in ['Failed', 'Cancelled', 'TimedOut']:
            raise RuntimeError(f"Deployment {command} {result['Status']}; inspect SSM/CloudWatch logs")
    else:
        raise TimeoutError('Deployment did not finish within ten minutes')
except Exception:
    if previous is not None:
        ssm.put_parameter(Name=parameter, Type='String', Value=previous, Overwrite=True)
    raise
