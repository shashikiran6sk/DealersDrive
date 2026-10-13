import fs from 'node:fs/promises';
import {browser,pause} from './dealer-ux-cdp.mjs';
const phase=process.argv[2]??'console',base=process.argv[3]??'http://localhost:3006';const integrated=phase==='integrated';
const b=await browser(),checks=[];const assert=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
const out=`/tmp/dealer-ux-evidence/${phase}-authenticated`;await fs.mkdir(out,{recursive:true});
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
if(!integrated){
 await b.shot(out+'/after-1280.png');await b.size(1440);await b.shot(out+'/after-1440.png');
 await b.load('http://localhost:3008/dealer');assert(await b.evaluate("!!document.querySelector('header button[aria-label^=\"Account menu for\"]')"),'Untouched main authenticated dealer header has avatar');await b.shot(out+'/before-1440.png');await b.size(1280);await b.shot(out+'/before-1280.png');await b.load(base+'/dealer');
}else{
 for(const width of [320,360,375,390,430,440]){
  await b.size(width,844);await b.click("document.querySelector('button[aria-label=\"Open Dealer console menu\"]')");await b.wait("!!document.querySelector('[role=dialog]')");
  const state=await b.evaluate(`(()=>{const d=document.querySelector('[role=dialog]'),nav=d.querySelector('nav'),status=[...d.querySelectorAll('*')].find(e=>e.textContent==='Verified');return{top:status&&!!(status.compareDocumentPosition(nav)&Node.DOCUMENT_POSITION_FOLLOWING),credits:d.innerText.toLowerCase().includes('credits'),logout:!![...d.querySelectorAll('button')].find(e=>e.innerText==='Logout'),overflow:d.scrollWidth>d.clientWidth};})()`);
  assert(state.top&&!state.credits&&state.logout&&!state.overflow,`${width}: real status above navigation, no credits, shared Logout and no drawer overflow`);
  await b.shot(out+`/drawer-${width}.png`);await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});await b.wait("!document.querySelector('[role=dialog]')");
  await b.wait("document.activeElement?.getAttribute('aria-label')==='Open Dealer console menu'");
  assert(true,`${width}: Escape restores drawer trigger focus`);
 }
 await b.size(568,320);await b.click("document.querySelector('button[aria-label=\"Open Dealer console menu\"]')");await b.wait("!!document.querySelector('[role=dialog]')");await b.click("document.querySelector('[role=dialog] summary')");
 await b.evaluate("document.querySelector('[role=dialog] [role=menuitem]').focus()");await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
 assert(await b.evaluate("!!document.querySelector('[role=dialog]')&&!document.querySelector('[role=dialog] details').open&&document.activeElement?.tagName==='SUMMARY'"),'Short landscape: workspace Escape closes disclosure before drawer');await b.shot(out+'/landscape-workspaces.png');
 await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});await b.wait("!document.querySelector('[role=dialog]')");
 const fixtures=JSON.parse(await fs.readFile('/tmp/mobile-route-fixtures.json','utf8'));await b.size(390,600);await b.load(base+'/car/'+fixtures.car);
 await b.wait("!!document.querySelector('button[aria-pressed]')");
 const alreadySaved=await b.evaluate("document.querySelector('button[aria-pressed]').getAttribute('aria-pressed')==='true'");
 if(!alreadySaved)await b.click("document.querySelector('button[aria-pressed]')");
 await b.wait("document.querySelector('button[aria-pressed]').getAttribute('aria-pressed')==='true'&&!document.querySelector('button[aria-pressed]').disabled");
 assert(true,'Authenticated save control updates and settles after the API response');
 await b.load(base+'/saved');assert(await b.evaluate(`!!document.querySelector('a[href="/car/${fixtures.car}"]')`),'Saved car persists on the authenticated saved page');
 await b.load(base+'/car/'+fixtures.car);
 if(!alreadySaved){await b.click("document.querySelector('button[aria-pressed]')");await b.wait("document.querySelector('button[aria-pressed]').getAttribute('aria-pressed')==='false'&&!document.querySelector('button[aria-pressed]').disabled");assert(true,'Unsave restores the original isolated fixture state');}
 await b.click("[...document.querySelectorAll('button')].find(e=>e.innerText==='Enquire now'&&e.getBoundingClientRect().width)");await b.wait("!!document.querySelector('textarea[name=message]')");assert(await b.evaluate("![...document.querySelectorAll('button')].some(e=>e.innerText==='Enquire now'&&e.getBoundingClientRect().width)"),'Authenticated enquiry form replaces the sole sticky CTA');
 await b.evaluate("document.querySelector('textarea[name=message]').focus()");await b.send('Input.insertText',{text:'Local integration review: please confirm viewing availability.'});await b.size(390,360);await b.click("[...document.querySelectorAll('button')].find(e=>e.innerText==='Send enquiry')");await b.wait("document.body.innerText.includes('Enquiry sent')");assert(true,'Enquiry submits against isolated API at reduced keyboard-like viewport height');await b.shot(out+'/enquiry-short-height.png');
 await b.load(base+'/dealer');await b.size(320,568);await b.click("document.querySelector('button[aria-label=\"Open Dealer console menu\"]')");await b.wait("!!document.querySelector('[role=dialog]')");
}
const cookies=await b.send('Network.getAllCookies');const session=cookies.cookies.find(c=>c.name==='dd_session');if(!session)throw Error('Session cookie missing before logout');
const cookieHeader=session.name+'='+session.value;const status=async()=> (await fetch('http://localhost:4001/v1/auth/me',{headers:{cookie:cookieHeader}})).status;
assert(await status()===200,'Session is authenticated before logout');
await b.click(`${integrated?"[...document.querySelector('[role=dialog]').querySelectorAll('button')]":"[...document.querySelectorAll('aside button')]"}.find(e=>e.innerText==='Logout')`);
await b.wait("location.pathname==='/'");await b.wait("!!document.querySelector('header a[href=\"/login\"]')");
assert(true,`${integrated?'Mobile drawer':'Desktop sidebar'} Logout preserves existing home destination`);
assert(!(await b.send('Network.getAllCookies')).cookies.some(c=>c.name==='dd_session'),'Logout clears browser session cookie');
assert(await status()===401,'Previous session token is rejected by API after logout');await b.shot(out+'/logged-out.png');await b.load(base+'/dealer');assert(await b.evaluate("location.pathname==='/login'||location.pathname==='/dealer/login'"),'Protected dealer route redirects after logout');await b.shot(out+'/protected-redirect.png');
await fs.writeFile(out+'/results.json',JSON.stringify({checks,sessionValuesRecorded:false,physicalKeyboardTested:false},null,2));console.log(checks.length,'authenticated checks passed');await b.close();
