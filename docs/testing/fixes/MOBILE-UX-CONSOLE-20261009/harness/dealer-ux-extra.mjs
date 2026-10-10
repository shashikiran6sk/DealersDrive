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


const originalChecks=[];
const assert=(ok,label)=>{if(!ok)throw Error(label);originalChecks.push(label);};
const load=async url=>{await send('Page.navigate',{url:'about:blank'});await pause(100);await send('Page.navigate',{url});await pause(500);for(let n=0;n<100;n++){if(await evaluate("document.readyState==='complete' && !!document.querySelector('h1,h2')"))break;await pause(100);}await pause(1200);};


await send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:false});


const base=process.env.UX_BASE_URL??'http://localhost:3000';const checks=[];
const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100);}throw Error(expression);};
const open=async()=>{await evaluate("document.querySelector('button[aria-label^=Filters]').click()");await pause(180);};
await send('Emulation.setDeviceMetricsOverride',{width:375,height:667,deviceScaleFactor:1,mobile:false});
for(const group of ['city','dealer']){
 await load(base+'/cars?district=vellore');await open();
 const id=await evaluate(`document.querySelector('[role=dialog] input[id^=sheet-${group}-]:not(:disabled)').id`);
 await evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);await waitFor(`location.search.includes('${group}=')`);await pause(150);
 check(await evaluate(`document.getElementById(${JSON.stringify(id)}).checked`),group+' first tap visually selected and applied');
}
await load(base+'/cars');await open();
const year=await evaluate("(()=>{const e=document.querySelector('#sheet-year-min');const option=[...e.options].find(o=>o.value);e.value=option.value;e.dispatchEvent(new Event('change',{bubbles:true}));return option.value;})()");
await waitFor("location.search.includes('minYear=')");await pause(150);check(await evaluate(`document.querySelector('#sheet-year-min').value===${JSON.stringify(year)}`),'Year first selection persists with results');
await evaluate("document.querySelector('button[aria-label=\"Clear every filter\"]').click()");await waitFor("location.search===''");await pause(150);
await evaluate("document.querySelector('#sheet-price-0').click()");await waitFor("location.search.includes('maxPrice=')");await pause(150);const first=await evaluate('location.search');
const kmId=await evaluate("document.querySelector('[role=dialog] input[id^=sheet-km-]:not([id$=-any]):not(:disabled)').id");await evaluate(`document.getElementById(${JSON.stringify(kmId)}).click()`);await waitFor("location.search.includes('maxKm=')");await pause(150);const second=await evaluate('location.search');
await evaluate('history.back()');await waitFor(`location.search===${JSON.stringify(first)}`);await pause(200);check(await evaluate("document.querySelector('#sheet-price-0').checked&&document.querySelector('#sheet-km-any').checked"),'Back restores checked appearance and URL');
await evaluate('history.forward()');await waitFor(`location.search===${JSON.stringify(second)}`);await pause(200);check(await evaluate(`document.querySelector('#sheet-price-0').checked&&document.getElementById(${JSON.stringify(kmId)}).checked`),'Forward restores both checked appearances and URL');
await load(base+'/cars');await open();await send('Network.enable');await send('Network.emulateNetworkConditions',{offline:false,latency:400,downloadThroughput:10000000,uploadThroughput:10000000});
const ids=await evaluate("['brand','fuel'].map(g=>document.querySelector('[role=dialog] input[id^=sheet-'+g+'-]:not(:disabled)').id)");
await evaluate(`document.getElementById(${JSON.stringify(ids[0])}).click()`);await pause(30);check(await evaluate("[...document.querySelectorAll('[role=dialog] button')].some(e=>e.textContent.includes('Updating'))"),'Pending results are announced');
await evaluate(`document.getElementById(${JSON.stringify(ids[1])}).click()`);await waitFor("location.search.includes('brand=')&&location.search.includes('fuel=')");await pause(300);
check(await evaluate(`${JSON.stringify(ids)}.every(id=>document.getElementById(id)?.checked)`),'Rapid taps retain both selections and applied parameters');
await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
const disabled=await evaluate("document.querySelector('[role=dialog] input:disabled')?.id");if(disabled){const before=await evaluate('location.search');await evaluate(`document.getElementById(${JSON.stringify(disabled)}).click()`);await pause(200);check(await evaluate(`location.search===${JSON.stringify(before)}&&!document.getElementById(${JSON.stringify(disabled)}).checked`),'Zero-count facet remains disabled without navigation');}
await load(base+'/cars');await open();const show=await evaluate("[...document.querySelectorAll('[role=dialog] button')].find(e=>/^Show all/.test(e.textContent))?.textContent");if(show){await evaluate("[...document.querySelectorAll('[role=dialog] button')].find(e=>/^Show all/.test(e.textContent)).click()");check(await evaluate("[...document.querySelectorAll('[role=dialog] button')].some(e=>e.textContent==='Show fewer')"),'Long facet list expands on first tap');}
const fixtures=JSON.parse(await fs.readFile('/tmp/mobile-route-fixtures.json','utf8'));await load(base+'/car/'+fixtures.car);await send('Emulation.setDeviceMetricsOverride',{width:568,height:320,deviceScaleFactor:1,mobile:false});await pause(150);
check(await evaluate("(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.textContent==='Enquire now'&&e.getClientRects().length);const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;})()"),'Sticky enquiry fits landscape and short height');
console.log(checks);await fs.writeFile('/tmp/dealer-ux-evidence/integrated-extra-interactions.json',JSON.stringify(checks,null,2));ws.close();await fetch(debugUrl+'/json/close/'+tab.id);
