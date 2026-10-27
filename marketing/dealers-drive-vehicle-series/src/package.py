"""Bundle only hash-verified job outputs; no network access or recursive repo archive."""
import hashlib, json, sys, zipfile
from pathlib import Path

job=Path(sys.argv[1]).resolve()
delivery=json.loads((job/'delivery.json').read_text())
archives=[]
for label,formats in [('vertical',['vertical']),('horizontal',['horizontal']),('all',['vertical','horizontal'])]:
    selected=[r for r in delivery['results'] if r['format'] in formats]
    target=job/f'car-promos-{label}.zip'
    with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_STORED) as z:
        for result in selected:
            source=(job/result['file']).resolve()
            if not source.is_relative_to(job) or hashlib.sha256(source.read_bytes()).hexdigest()!=result['sha256']:
                raise RuntimeError('An output changed after verification')
            z.write(source,result['format']+'/'+source.name)
        z.writestr('README.txt',('TEST FIXTURE OUTPUTS\n' if delivery['fixture'] else '')+'Dealers-Drive car promos: 20 seconds, 60 fps. Vertical 1080x1920; horizontal 1920x1080.\n')
    with zipfile.ZipFile(target) as z:
        if len([n for n in z.namelist() if n.endswith('.mp4')])!=len(selected) or z.testzip():
            raise RuntimeError('Archive failed validation')
    archives.append(str(target))
print(json.dumps(archives))
