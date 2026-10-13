import fs from 'node:fs/promises';
import {browser,pause} from './dealer-ux-cdp.mjs';
const phase=process.argv[2]??'console',base=process.argv[3]??'http://localhost:3006';const integrated=true;
const b=await browser(),checks=[];const assert=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
const out=`/tmp/enquiry-scroll-evidence/console-final-authenticated`;await fs.mkdir(out,{recursive:true});
await b.send('Network.clearBrowserCookies');await b.size(integrated?390:1280,844);await b.load(base+'/login');
await b.evaluate("document.querySelector('input[name=phone]').focus()");await b.send('Input.insertText',{text:'9840012345'});
await b.click("[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Send OTP'))");
await b.wait("document.querySelectorAll('input[aria-label^=\"Digit \"]').length===6");
assert(true,'Real isolated customer sign-in opens six-digit OTP');await b.shot(out+'/otp.png');
for(let i=0;i<6;i++){await b.evaluate(`document.querySelectorAll('input[aria-label^="Digit "]')[${i}].focus()`);await b.send('Input.insertText',{text:'123456'[i]});}
await b.click("[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Verify and sign in'))");
await b.wait("location.pathname==='/'");await b.wait("!!document.querySelector('button[aria-label^=\"Account menu for\"]')");
assert(true,'Existing verified fixture account signs in without registration');assert(true,'Public marketplace account menu remains available');
await b.click("document.querySelector('button[aria-label^=\"Account menu for\"]')");
await b.wait("!![...document.querySelectorAll('[role=menuitem]')].find(e=>e.textContent.includes('Sri Lakshmi Motors'))");
await b.click("[...document.querySelectorAll('[role=menuitem]')].find(e=>e.textContent.includes('Sri Lakshmi Motors'))");await b.wait("location.pathname==='/dealer'");await b.wait("!!document.querySelector('section[aria-label=\"Dashboard overview\"]')");await pause(700);
assert(true,'Existing public workspace action enters dealer console without reauthentication');
assert(await b.evaluate("!document.querySelector('header button[aria-label^=\"Account menu for\"]')"),'Authenticated dealer header has no avatar');

for(const width of [320,360,375,390,430,440]){
 await b.size(width,900);await b.load(base+'/dealer');await b.click("document.querySelector('button[aria-label=\"Open Dealer console menu\"]')");await b.wait("!!document.querySelector('[role=dialog]')");
 const state=await b.evaluate("(()=>{const d=document.querySelector('[role=dialog]');return{logout:!![...d.querySelectorAll('button')].find(e=>e.textContent==='Logout'),credits:d.innerText.toLowerCase().includes('credits'),status:d.innerText.includes('Verified'),overflow:d.scrollWidth>d.clientWidth};})()");
 assert(state.logout&&!state.credits&&state.status&&!state.overflow,'Drawer status, logout, credit removal and fit at '+width);await b.shot(out+'/drawer-'+width+'.png');await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await b.wait("!document.querySelector('[role=dialog]')");
}
await b.size(1440,900);await b.load(base+'/dealer');
assert(!await b.evaluate("!!document.querySelector('header button[aria-label^=\"Account menu for\"]')"),'Desktop dealer avatar stays removed');
assert(await b.evaluate("!![...document.querySelectorAll('aside button')].find(e=>e.textContent==='Logout')"),'Desktop sidebar hosts logout');await b.shot(out+'/desktop.png');
await b.size(390,844);await b.load(base+'/dealer');await b.click("document.querySelector('button[aria-label=\"Open Dealer console menu\"]')");await b.wait("!!document.querySelector('[role=dialog]')");
await b.click("[...document.querySelectorAll('[role=dialog] button')].find(e=>e.textContent==='Logout')");await b.wait("location.pathname==='/'");await b.wait("!document.querySelector('button[aria-label^=\"Account menu for\"]')");
const cookies=await b.send('Network.getCookies',{urls:[base]});assert(!cookies.cookies.some(c=>c.name==='dd_session'),'Logout removes browser session cookie and returns home');
await b.load(base+'/dealer');await b.wait("location.pathname.includes('login')");assert(true,'Protected dealer route redirects after logout');
await fs.writeFile(out+'/results.json',JSON.stringify({base,head:'14ae77630586c7cb5ab5e4442d69800d3681876d',checks},null,2));console.log(JSON.stringify({checks:checks.length,pass:true}));await b.close();
