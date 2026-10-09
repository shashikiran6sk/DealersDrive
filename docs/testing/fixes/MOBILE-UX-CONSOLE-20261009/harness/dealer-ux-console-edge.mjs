import fs from 'node:fs/promises';
import {browser,pause} from './dealer-ux-cdp.mjs';
const phase=process.argv[2]??'console',port=process.argv[3]??'6007',b=await browser(),checks=[];
const assert=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};const out=`/tmp/dealer-ux-evidence/${phase}-edge-states`;await fs.mkdir(out,{recursive:true});
for(const width of [320,360,375,390,430,440,768,1024,1280,1440]){
 await b.size(width,568);await b.load(`http://localhost:${port}/iframe.html?id=dealer-consoleutilities--multiple-workspaces&viewMode=story`);await b.wait("!!document.querySelector('summary')");await b.click("document.querySelector('summary')");
 assert(await b.evaluate("document.querySelector('details').open&&document.body.innerText.includes('Suspended — dealer access is closed')&&!!document.querySelector('a[href=\"/invitations\"]')"),`${width}: workspace disclosure retains suspended status and invitations`);
 assert(await b.evaluate("document.documentElement.scrollWidth<=document.documentElement.clientWidth"),`${width}: long workspace names fit viewport`);
 await b.evaluate("document.querySelector('[role=menuitem]').focus()");await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End'});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'End',code:'End'});
 assert(await b.evaluate("document.activeElement===Array.from(document.querySelectorAll('[role=menuitem]')).at(-1)"),`${width}: End reaches final enterable workspace`);
 await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
 assert(await b.evaluate("!document.querySelector('details').open&&document.activeElement?.tagName==='SUMMARY'"),`${width}: Escape closes workspace menu and restores focus`);
 await b.click("document.querySelector('summary')");await b.shot(out+`/workspace-${width}.png`);
 await b.load(`http://localhost:${port}/iframe.html?id=dealer-dashboardmetrics--large-values&viewMode=story`);await b.wait("!!document.querySelector('section[aria-label=\"Dashboard overview\"]')");
 await b.evaluate(`(()=>{const list=[...document.querySelectorAll('section *')].filter(e=>[...e.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim())).map(e=>({e,size:parseFloat(getComputedStyle(e).fontSize)}));for(const x of list)x.e.style.fontSize=x.size*2+'px';})()`);await pause(100);
 assert(await b.evaluate("(()=>{const s=document.querySelector('section');return s.scrollWidth<=s.clientWidth&&document.documentElement.scrollWidth<=document.documentElement.clientWidth;})()"),`${width}: 200% text fixture and large values fit`);
 await b.shot(out+`/large-values-text-200-${width}.png`);
}
await fs.writeFile(out+'/results.json',JSON.stringify({checks,textScale:'200% computed text size fixture',hardwareTextScaling:false},null,2));console.log(checks.length,'edge checks passed');await b.close();
