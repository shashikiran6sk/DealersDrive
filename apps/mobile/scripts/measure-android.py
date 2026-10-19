import argparse
import json
from pathlib import Path
import re
import statistics
import subprocess
import time
from defusedxml import ElementTree as ET

parser = argparse.ArgumentParser(description='Measure a nonproduction release install on an emulator. UI probe timings are upper bounds, not TTI.')
parser.add_argument('--serial', required=True)
parser.add_argument('--package', choices=['com.dealersdrive.customer.preview', 'com.dealersdrive.customer.dev'], required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
if not args.serial.startswith('emulator-'):
    parser.error('This automation is restricted to disposable emulators.')
adb = ['adb', '-s', args.serial]

def command(*parts):
    return subprocess.check_output(adb + list(parts), timeout=30).decode()

def ui():
    command('shell', 'uiautomator', 'dump', '/sdcard/dd-measure.xml')
    return list(ET.fromstring(command('exec-out', 'cat', '/sdcard/dd-measure.xml')).iter('node'))

args.output.mkdir(parents=True, exist_ok=True)
trials = []
for _ in range(5):
    command('shell', 'am', 'force-stop', args.package)
    started = time.monotonic()
    launch = command('shell', 'am', 'start', '-W', '-n', args.package + '/.MainActivity')
    total = re.search(r'^TotalTime: (\d+)', launch, re.M)
    trial = {'activity_launch_ms': int(total[1]) if total else None}
    for _ in range(5):
        elements = ui()
        elapsed = round((time.monotonic() - started) * 1000)
        if any(n.get('resource-id', '').endswith('home-title') for n in elements):
            trial.setdefault('home_visible_probe_upper_ms', elapsed)
        if any(n.get('content-desc', '').startswith('View 20') for n in elements):
            trial['inventory_visible_probe_upper_ms'] = elapsed
            break
    trials.append(trial)
    print(json.dumps(trial), flush=True)

command('shell', 'dumpsys', 'gfxinfo', args.package, 'reset')
for _ in range(6):
    command('shell', 'input', 'swipe', '540', '1850', '540', '700', '400')
for _ in range(6):
    command('shell', 'input', 'swipe', '540', '700', '540', '1850', '400')
gfx = command('shell', 'dumpsys', 'gfxinfo', args.package, 'framestats')
memory = command('shell', 'dumpsys', 'meminfo', args.package)
(args.output / 'gfxinfo.txt').write_text(gfx)
(args.output / 'memory.txt').write_text(memory)
medians = {key: statistics.median(t[key] for t in trials if t.get(key) is not None) for key in ['activity_launch_ms', 'home_visible_probe_upper_ms', 'inventory_visible_probe_upper_ms'] if any(t.get(key) is not None for t in trials)}
result = {'trials': trials, 'medians': medians, 'package': args.package, 'serial': args.serial, 'pixel_size': command('shell', 'wm', 'size').strip(), 'density': command('shell', 'wm', 'density').strip(), 'font_scale': command('shell', 'settings', 'get', 'system', 'font_scale').strip(), 'api_level': command('shell', 'getprop', 'ro.build.version.sdk').strip(), 'limitations': ['Activity launch is not JavaScript TTI.', 'UIAutomator adds probe overhead; visible timings are upper bounds.', 'Process-cold repeats retain OS disk/image caches; these are not first-install startup measurements.', 'Software-rendered emulator results do not establish budget physical-device performance.', 'No like-for-like F108 performance baseline; no numeric improvement claim.']}
(args.output / 'measurements.json').write_text(json.dumps(result, indent=2) + '\n')
