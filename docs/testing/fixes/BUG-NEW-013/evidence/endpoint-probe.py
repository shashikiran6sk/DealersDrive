import ast,json,os,secrets,subprocess,tempfile
from pathlib import Path
r=Path('/workspace/DealersDrive-fixes');p=r/'docs/testing/fixes/BUG-006/evidence/diagnostics/configuration-probes.py'
tree=ast.parse(p.read_text());node=next(n for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='base' for t in n.targets));base=eval(compile(ast.Expression(node.value),str(p),'eval'))
rows=[]
with tempfile.TemporaryDirectory() as tmp:
 cwd=Path(tmp)/'a/b/c';cwd.mkdir(parents=True)
 for mode in ['omitted','explicit-localhost']:
  configured=dict(base)
  if mode=='omitted':configured.pop('S3_ENDPOINT')
  else:configured['S3_ENDPOINT']='http://localhost:9000'
  code='import {env} from '+json.dumps(str(r/'apps/api/src/config/env.ts'))+';console.log(JSON.stringify({driver:env.STORAGE_DRIVER,endpoint:env.S3_ENDPOINT,nodeEnv:env.NODE_ENV}))'
  run=subprocess.run(['node','--import',str(r/'apps/api/node_modules/tsx/dist/loader.mjs'),'--input-type=module','-e',code],env=configured,cwd=cwd,text=True,capture_output=True,timeout=15)
  assert run.returncode==0, 'unexpected validator failure'
  rows.append({'configuration':mode,'exitCode':run.returncode,'observed':json.loads(run.stdout)})
report={'finding':'BUG-NEW-013','severity':'P2','title':'Production R2 configuration accepts missing endpoint and defaults to local MinIO address','sha':subprocess.check_output(['git','rev-parse','HEAD'],cwd=r,text=True).strip(),'providerCalls':False,'databaseCalls':False,'credentials':'generated inert values never recorded','cases':rows,'scope':'Configuration acceptance only; no live R2 failure or provider write claimed','expected':'Production R2 configuration requires explicit usable provider endpoint','actual':'Production validator accepts omitted or explicit loopback endpoint; shared adapter receives localhost:9000','disposition':'Separate later PR; no endpoint policy change in BUG-006'}
Path('/workspace/dd-fix-evidence/BUG-NEW-013-ENDPOINT.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
