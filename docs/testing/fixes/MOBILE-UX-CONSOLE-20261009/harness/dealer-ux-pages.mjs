import fs from 'node:fs/promises';
const tab=await(await fetch('http://127.0.0.1:9226/json/new',{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const phase=process.argv[2]??'after';const base=process.argv[3]??'http://localhost:3000';
await send('Page.enable');await fs.mkdir(`/tmp/dealer-ux-evidence/${phase}`,{recursive:true});
let fixtures;
try{fixtures=JSON.parse(await fs.readFile('/tmp/mobile-route-fixtures.json','utf8'));}
catch{const cars=await(await fetch('http://localhost:4000/v1/vehicles?limit=1')).json();const dealer=await(await fetch('http://localhost:4000/v1/dealer')).json();const admin=await(await fetch('http://localhost:4000/v1/admin/dealers?limit=5')).json();fixtures={car:cars.data[0].slug,dealer:dealer.slug,dealerId:dealer.id,adminDealer:admin.data?.[0]?.id??dealer.id};await fs.writeFile('/tmp/mobile-route-fixtures.json',JSON.stringify(fixtures));}
const routes=process.env.UX_ROUTES?.split(',')??['/','/cars','/car/'+fixtures.car,'/dealers','/dealers/'+fixtures.dealer,'/contact','/saved','/enquiries','/invitations','/support-requests','/support-requests/new','/login','/dealer/login','/admin/login','/dealer/onboarding','/dealer','/dealer/inventory','/dealer/enquiries','/dealer/profile','/dealer/team','/dealer/vehicles/new','/admin','/admin/dealers','/admin/dealers/'+fixtures.adminDealer,'/admin/listings','/admin/enquiries','/admin/support','/admin/members','/admin/notifications','/admin/config','/sales','/sales/dealers','/sales/dealers/new'];
const widths=[320,360,375,390,430,440,768,1024,1280,1440];const results=[];
for(const route of routes){
 await send('Page.bringToFront');
 const nav=await send('Page.navigate',{url:base+route});await pause(150);
 for(let n=0;n<20;n++){if(await evaluate("document.readyState==='complete' && !!document.body?.querySelector('h1,h2,main')"))break;await pause(150);}
 await evaluate('document.fonts.ready');await pause(500);
 if(await evaluate("document.body.innerText.includes('This page could not be loaded')"))throw Error('Route failed: '+route);
 for(const width of widths){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await pause(80);
  const data=await evaluate(`(()=>{return {path:location.pathname,title:document.title,text:document.body.innerText.slice(0,100),scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,overflow:[...document.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&(b.right>innerWidth+1||b.left<-1)&&!e.closest('.overflow-x-auto,.dd-strip,.dd-rail,[role="group"].overflow-x-auto')}).slice(0,8).map(e=>({tag:e.tagName,classes:e.className,right:e.getBoundingClientRect().right}))};})()`);
  results.push({route,width,...data});
  const image=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(`/tmp/dealer-ux-evidence/${phase}/${encodeURIComponent(route)}-${width}.png`,Buffer.from(image.data,'base64'));
 }
 await fs.writeFile(`/tmp/dealer-ux-evidence/${phase}/results.json`,JSON.stringify(results,null,2));
 console.log(phase,route,results.filter(r=>r.route===route&&r.scroll>r.width+1).map(r=>r.width));
}
await fs.writeFile(`/tmp/dealer-ux-evidence/${phase}/results.json`,JSON.stringify(results,null,2));ws.close();
