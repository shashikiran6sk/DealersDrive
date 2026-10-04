#!/usr/bin/env python3
"""Bounded read-only smoke test, usable locally or after deployment."""
import argparse
import json
import statistics
import time
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--api', required=True)
parser.add_argument('--web')
parser.add_argument('--sha')
parser.add_argument('--image', help='Known public CDN media URL')
args = parser.parse_args()


def get(url):
    start = time.perf_counter()
    with urllib.request.urlopen(url, timeout=15) as response:
        headers = dict(response.headers)
        body = response.read()
        return {'status': response.status, 'milliseconds': round((time.perf_counter() - start) * 1000, 1),
                'bytes': len(body), 'cache': {k: v for k, v in headers.items() if k.lower() in ['x-cache', 'age', 'cache-control', 'content-type', 'content-length']}, 'body': body}


health = get(args.api.rstrip('/') + '/health/ready')
ready = json.loads(health.pop('body'))
assert ready['status'] == 'ok'
if args.sha:
    assert ready['version'] == args.sha
print(json.dumps({'route': '/health/ready', **health, 'version': ready['version']}))
for route in ['/v1/dealers', '/v1/vehicles']:
    samples = []
    for _ in range(10):
        result = get(args.api.rstrip('/') + route)
        samples.append(result['milliseconds'])
        time.sleep(0.1)
    print(json.dumps({'route': route, 'samples': len(samples), 'p50_ms': statistics.median(samples), 'p95_ms': sorted(samples)[-1]}))
if args.web:
    for path in ['/', '/cars', '/dealers']:
        result = get(args.web.rstrip('/') + path)
        result.pop('body')
        print(json.dumps({'route': path, **result}))
if args.image:
    for phase in ['first-observed', 'repeat']:
        result = get(args.image)
        result.pop('body')
        print(json.dumps({'image': args.image, 'phase': phase, **result}))
