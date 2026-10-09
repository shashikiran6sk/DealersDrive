import fs from 'node:fs/promises';
import {browser,pause} from './dealer-ux-cdp.mjs';
const phase=process.argv[2]??'console',base=process.argv[3]??'http://localhost:3003';
const b=await browser(), checks=[];const assert=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
await b.size(1440);await b.load(base+'/dealer');
const dashboard=await(await fetch('http://localhost:4000/v1/dealer/dashboard')).json();
const expected=[dashboard.stats.find(s=>s.key==='activeListings'),dashboard.listingStats.find(s=>s.key==='PENDING_REVIEW'),dashboard.stats.find(s=>s.key==='newEnquiries'),dashboard.stats.find(s=>s.key==='views')];
for(const width of [320,360,375,390,430,440,768,1024,1280,1440]){
 await b.size(width);
 const cards=await b.evaluate(`(()=>{const s=document.querySelector('section[aria-label="Dashboard overview"]');return [...s.children].map(e=>{const r=e.getBoundingClientRect();return{text:e.innerText,x:r.x,y:r.y,w:r.width,h:r.height};});})()`);
 assert(cards.length===4,`${width}: exactly four primary metrics`);
 assert(expected.every((e,i)=>cards[i].text.includes(e.label)&&cards[i].text.includes(e.valueLabel??String(e.value))&&(!e.delta||cards[i].text.includes(e.delta))),`${width}: API labels, formatted values and deltas preserved`);
 assert(width>=1024?cards.every(c=>Math.abs(c.y-cards[0].y)<1):Math.abs(cards[0].y-cards[1].y)<1&&Math.abs(cards[2].y-cards[3].y)<1&&cards[2].y>cards[0].y,`${width}: ${width>=1024?'four columns':'two columns and two rows'}`);
 assert(cards.every(c=>Math.abs(c.w-cards[0].w)<1&&Math.abs(c.h-cards[0].h)<1),`${width}: equal card dimensions`);
 assert(await b.evaluate("(()=>{const s=document.querySelector('section[aria-label=\"Dashboard overview\"]');return s.scrollWidth<=s.clientWidth;})()"),`${width}: four-card summary fits content viewport`);
 if(width!==320||phase==='integrated')assert(await b.evaluate("document.documentElement.scrollWidth<=document.documentElement.clientWidth"),`${width}: whole page fits content viewport`);
 assert(await b.evaluate("!document.querySelector('header button[aria-label^=\"Account menu for\"]')"),`${width}: dealer avatar removed`);
 assert(await b.evaluate("document.querySelector('section[aria-label=\"Dashboard overview\"] a').getAttribute('href')==='/dealer/inventory?status=PENDING_REVIEW'"),`${width}: pending review retains inventory destination`);
 if(width>=768)assert(await b.evaluate("!![...document.querySelectorAll('aside button')].find(e=>['Logout','Sign out'].includes(e.innerText))"),`${width}: logout is in desktop sidebar`);
}
await b.size(1280,568);assert(await b.evaluate("document.documentElement.scrollWidth<=document.documentElement.clientWidth"),'Short desktop: no horizontal overflow');
await b.shot(`/tmp/dealer-ux-evidence/${phase}-interactions/short-desktop.png`);
await fs.writeFile(`/tmp/dealer-ux-evidence/${phase}-interactions/results.json`,JSON.stringify({checks,expected:expected.map(e=>({label:e.label,value:e.valueLabel??String(e.value),delta:e.delta??null}))},null,2));
console.log(checks.length,'checks passed');await b.close();
