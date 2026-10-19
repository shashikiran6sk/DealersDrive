import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { setTimeout } from 'node:timers';
const { fetch, WebSocket } = globalThis;
import fs from 'node:fs/promises';
const debugUrl = process.env.CHROME_DEBUG_URL ?? 'http://127.0.0.1:9226';
const tab = await (await fetch(`${debugUrl}/json/new`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) p.reject(Error(JSON.stringify(m.error)));
    else p.resolve(m.result);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
await send('Page.enable');


const checks=[];
const assert=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
const load=async url=>{await send('Page.navigate',{url:'about:blank'});await pause(100);await send('Page.navigate',{url});await pause(500);for(let n=0;n<100;n++){if(await evaluate("document.readyState==='complete' && !!document.querySelector('h1,h2')"))break;await pause(100);}await pause(1200);};


await send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:false});


const phase=process.argv[2]??'after'; const base=process.argv[3]??'http://localhost:3000';
const output='/tmp/dealer-ux-evidence/filter-first-tap-'+phase;
await fs.mkdir(output,{recursive:true});
const frames=[];const writes=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Page.screencastFrame'){const n=frames.length;const file=output+'/frame-'+String(n).padStart(4,'0')+'.jpg';frames.push({file,timestamp:m.params.metadata.timestamp});writes.push(fs.writeFile(file,Buffer.from(m.params.data,'base64')));void send('Page.screencastFrameAck',{sessionId:m.params.sessionId});}});
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
await load(base+'/cars');
const click=async selector=>{const p=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});};
await click('button[aria-label=Filters]');await pause(250);
await evaluate("document.querySelector('#sheet-price-0').scrollIntoView({block:'center'})");await pause(200);
await send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:390,maxHeight:844,everyNthFrame:1});await pause(500);
const before=await evaluate("({url:location.href,checked:document.querySelector('#sheet-price-0').checked})");
await click('#sheet-price-0');
const immediate=await evaluate("({url:location.href,checked:document.querySelector('#sheet-price-0').checked})");
for(let n=0;n<100;n++){if(await evaluate("location.search.includes('maxPrice=')"))break;await pause(100);}await pause(1200);
const applied=await evaluate("({url:location.href,mobileChecked:document.querySelector('#sheet-price-0').checked,desktopChecked:document.querySelector('#filters-price-0').checked,resultAction:[...document.querySelectorAll('[role=dialog] button')].find(e=>e.textContent.startsWith('Show '))?.textContent})");
await send('Page.stopScreencast');await Promise.all(writes);
const report={phase,input:'CDP native mouse press/release',before,immediate,applied,frames:frames.length};console.log(report);await fs.writeFile(output+'/result.json',JSON.stringify(report,null,2));
let concat='';for(let i=0;i<frames.length;i++){concat+="file '"+frames[i].file+"'\n";concat+='duration '+String(i+1<frames.length?Math.max(.05,frames[i+1].timestamp-frames[i].timestamp):1.2)+'\n';}if(frames.length)concat+="file '"+frames.at(-1).file+"'\n";await fs.writeFile(output+'/frames.txt',concat);ws.close();await fetch(debugUrl+'/json/close/'+tab.id);
