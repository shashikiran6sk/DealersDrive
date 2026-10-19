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


const base=process.env.UX_BASE_URL??'http://localhost:3000';
const output=process.env.UX_OUTPUT??'/tmp/dealer-ux-evidence/mobile-interactions';
const dealerProfile=await(await fetch('http://localhost:4000/v1/dealer')).json();
const fixtures=JSON.parse(await fs.readFile('/tmp/mobile-route-fixtures.json','utf8'));
await fs.mkdir(output,{recursive:true});
const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(output+'/'+name+'.png',Buffer.from(r.data,'base64'));};
const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100);}throw Error('Timed out: '+expression);};
const visible="e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'";
for(const width of [320,360,375,390,430,440,768,1024,1280,1440]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
 await load(base+'/car/'+fixtures.car);
 assert(await evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth'),'Car fits content viewport '+width);
 const data=await evaluate(`(()=>{const top=s=>document.querySelector(s)?.getBoundingClientRect().top; return {gallery:top('[aria-roledescription="carousel"], [aria-label="Vehicle photographs"], .vehicle-gallery'), identity:top('h1'), specs:top('#specs-heading'), description:top('#description-heading'), dealer:top('#vdp-dealer-heading'), ctas:[...document.querySelectorAll('button')].filter(e=>e.textContent.trim()==='Enquire now').filter(${visible}).length};})()`);
 // Gallery placeholders have no carousel semantics; inspect the first image region before h1 separately.
 if(width<1024){assert(data.identity<data.specs&&(!data.description||data.specs<data.description)&&data.specs<data.dealer,'Mobile vehicle identity precedes specs and dealer '+width);}
 assert(data.ctas===1,'Exactly one visible enquiry CTA '+width);
 await load(base+'/dealers/'+fixtures.dealer);
 assert(await evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth'),'Portfolio fits content viewport '+width);
 if(width<768){assert(await evaluate("(()=>{const title=document.querySelector('h1').getBoundingClientRect();const logo=[...document.querySelectorAll('span[aria-hidden=true]')].find(e=>e.textContent==='SL')?.getBoundingClientRect();return !!logo&&Math.abs(title.top-logo.top)<2;})()"),'Portfolio logo and name align '+width);}
 await load(base+'/dealer');
 assert(await evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth'),'Dealer console fits '+width);
 if(width<768){
  assert(await evaluate("![...document.querySelectorAll('nav')].some(e=>getComputedStyle(e).position==='fixed'&&e.getClientRects().length)"),'No dealer bottom navigation '+width);
  await evaluate("document.querySelector('button[aria-label=\"Open Dealer console menu\"]').click()");await pause(250);
  assert(await evaluate(`(()=>{const d=document.querySelector('[role=dialog]');const s=[...d.querySelectorAll('span')].find(e=>e.textContent===${JSON.stringify(dealerProfile.statusLabel)});const n=d.querySelector('nav');return !!s&&s.getBoundingClientRect().bottom<n.getBoundingClientRect().top&&!d.innerText.toLowerCase().includes('credits');})()`),'Actual status above nav without credits '+width);
  if(width===320)await shot('dealer-drawer-320');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await pause(200);
 }
}
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
await load(base+'/cars');await evaluate("document.querySelector('button[aria-label=Filters]').click()");await pause(200);
for(const group of ['price','km']){
 const selectedId=await evaluate(`document.querySelector('[role=dialog] input[id^=sheet-${group}-]:not([id$=-any]):not(:disabled)').id`);
 const selector='#'+selectedId;
 await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);await pause(100);await shot(group+'-before');
 await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
 assert(await evaluate(`document.querySelector(${JSON.stringify(selector)}).checked`),'First tap selects '+group+' immediately');
 await waitFor(`location.search.includes('${group==='price'?'maxPrice':'maxKm'}=')`);await pause(500);
 assert(await evaluate(`document.querySelector(${JSON.stringify(selector)}).checked`),'First tap remains selected after results '+group);await shot(group+'-after-first-tap');
 assert(await evaluate(`document.querySelector('#${selectedId.replace('sheet-', 'filters-')}').checked`),'Hidden rail matches applied '+group);
}
await evaluate("document.querySelector('button[aria-label=\"Close filters\"]')?.click()");
if(await evaluate("!!document.querySelector('[role=dialog]')")){await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});}await pause(200);
await evaluate("document.querySelector('button[aria-label^=Filters]').click()");await pause(200);
assert(await evaluate("[...document.querySelectorAll('[role=dialog] input[type=radio]:checked')].filter(e=>!e.id.endsWith('-any')).length===2"),'Selections persist closing and reopening sheet');
await evaluate("document.querySelector('button[aria-label=\"Clear every filter\"]').click()");await waitFor("location.search===''");await pause(200);
assert(await evaluate("document.querySelector('#sheet-price-any').checked&&document.querySelector('#sheet-km-any').checked"),'Clear restores both Any radios');
for(const group of ['brand','fuel','transmission','bodyType','color','owners','dealer']){
 const selector=`[role=dialog] input[type=checkbox][id^=sheet-${group}-]:not(:disabled)`;
 if(!(await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)))continue;
 const selected=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.click();return e.id;})()`);
 await waitFor(`location.search.includes('${group}=')`);await pause(200);
 assert(await evaluate(`document.getElementById(${JSON.stringify(selected)})?.checked===true`),'First tap applies and shows '+group);
}
const brandId=await evaluate("document.querySelector('[role=dialog] input[id^=sheet-brand-]:checked').id");
const model=await evaluate("document.querySelector('[role=dialog] input[id^=sheet-model-]:not(:disabled)')?.id");
if(model){await evaluate(`document.getElementById(${JSON.stringify(model)}).click()`);await waitFor("location.search.includes('model=')");assert(await evaluate(`document.getElementById(${JSON.stringify(model)}).checked`),'Model first tap remains selected');}
await evaluate(`document.getElementById(${JSON.stringify(brandId)}).click()`);await waitFor("!location.search.includes('brand=')");assert(await evaluate("!location.search.includes('model=')"),'Removing brand drops dependent model');
await evaluate("document.querySelector('button[aria-label=\"Clear every filter\"]').click()");await waitFor("location.search===''");
console.log(checks);await fs.writeFile(output+'/results.json',JSON.stringify(checks,null,2));ws.close();
