import fs from 'node:fs/promises';
import {browser,pause} from './dealer-ux-cdp.mjs';
const phase=process.argv[2]??'before',base=process.argv[3]??'http://localhost:3008';
const out='/tmp/enquiry-scroll-evidence/'+phase;
await fs.mkdir(out,{recursive:true});
const b=await browser(),checks=[];
const check=(name,ok,detail)=>checks.push({name,pass:!!ok,detail});
try {
 await b.send('Network.clearBrowserCookies');await b.size(390,844);await b.load(base+'/login');
 await b.evaluate("document.querySelector('input[name=phone]').focus()");await b.send('Input.insertText',{text:'9840012345'});
 await b.click("[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Send OTP'))");
 await b.wait("document.querySelectorAll('input[aria-label^=\"Digit \"]').length===6");
 for(let i=0;i<6;i++){await b.evaluate(`document.querySelectorAll('input[aria-label^="Digit "]')[${i}].focus()`);await b.send('Input.insertText',{text:'123456'[i]});}
 await b.click("[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Verify and sign in'))");
 await b.wait("location.pathname==='/'");
 const fixture=JSON.parse(await fs.readFile('/tmp/mobile-route-fixtures.json','utf8'));
 for(const [width,height] of [[320,640],[360,740],[375,812],[390,844],[430,932],[440,900],[390,360],[568,320]]){
  await b.size(width,height);await b.load(base+'/car/'+fixture.car);
  await b.wait("!![...document.querySelectorAll('button')].find(e=>e.textContent==='Enquire now'&&e.getBoundingClientRect().width>0&&!e.disabled)");
  await b.evaluate('window.scrollTo(0,document.documentElement.scrollHeight)');await pause(250);
  const before=await b.evaluate('({scrollY,scrollHeight:document.documentElement.scrollHeight})');
  await b.click("[...document.querySelectorAll('button')].find(e=>e.textContent==='Enquire now'&&e.getBoundingClientRect().width>0)");
  await b.wait("!!document.querySelector('textarea[name=message]')");await pause(300);
  const detail=await b.evaluate(`(()=>{const m=document.querySelector('textarea[name=message]'),r=m.getBoundingClientRect(),h=document.querySelector('header').getBoundingClientRect();return{scrollY,top:r.top,bottom:r.bottom,headerBottom:h.bottom,height:innerHeight,cta:[...document.querySelectorAll('button')].filter(e=>e.textContent==='Enquire now'&&e.getBoundingClientRect().width>0).length};})()`);
  check(`Bottom CTA reaches message at ${width}x${height}`,detail.top>=detail.headerBottom&&detail.bottom<=height,{before,...detail});
  await b.shot(out+`/enquiry-${width}x${height}.png`);
  await b.evaluate("document.querySelector('textarea[name=message]').focus()");await b.send('Input.insertText',{text:'Can I view this car tomorrow?'});
  check(`Message editable at ${width}x${height}`,await b.evaluate("document.querySelector('textarea[name=message]').value==='Can I view this car tomorrow?'"));
 }
 await b.size(390,360);await b.load(base+'/car/'+fixture.car+'?enquire=1');await b.wait("!!document.querySelector('textarea[name=message]')");await pause(300);
 const returned=await b.evaluate("(()=>{const r=document.querySelector('textarea[name=message]').getBoundingClientRect(),h=document.querySelector('header').getBoundingClientRect();return{top:r.top,bottom:r.bottom,headerBottom:h.bottom,height:innerHeight};})()");
 check('Return from login reaches message at short height',returned.top>=returned.headerBottom&&returned.bottom<=returned.height,returned);
 const dealers=await(await fetch('http://localhost:4001/v1/dealers?q=Capital')).json();
 const capital=dealers.data?.find(d=>/Capital Region Motors/.test(d.brandName??d.name??''));
 const slugs=[fixture.dealer,...(capital?[capital.slug]:[])];
 for(const slug of slugs){for(const width of [320,360,375,390,430,440,768,1024,1280,1440]){
  await b.size(width,900);await b.load(base+'/dealers/'+slug);await b.evaluate('window.scrollTo(0,0)');await pause(200);
  const geometry=await b.evaluate(`(()=>{const title=document.querySelector('h1'),identity=title.parentElement.parentElement,grid=identity.parentElement,address=identity.querySelector('p.ink-secondary'),logo=grid.firstElementChild;const a=address.getBoundingClientRect(),l=logo.getBoundingClientRect(),t=title.parentElement.getBoundingClientRect();return{name:title.textContent,address:{left:a.left,right:a.right,top:a.top,width:a.width},logo:{left:l.left,bottom:l.bottom},titleBottom:t.bottom,gridWidth:grid.clientWidth,overflow:document.documentElement.scrollWidth>innerWidth};})()`);
  if(width<768)check(`Address below logo, full width: ${slug} ${width}`,Math.abs(geometry.address.left-geometry.logo.left)<1&&geometry.address.top>=Math.max(geometry.logo.bottom,geometry.titleBottom)&&!geometry.overflow,geometry);
  else check(`Desktop fits: ${slug} ${width}`,!geometry.overflow,geometry);
  await b.evaluate("document.querySelectorAll('nextjs-portal').forEach(e=>e.remove())");
  await b.shot(out+`/portfolio-${slug}-${width}.png`);
 }}
 await fs.writeFile(out+'/results.json',JSON.stringify({phase,base,checks},null,2));
 console.log(JSON.stringify({phase,checks:checks.length,failed:checks.filter(c=>!c.pass).map(c=>c.name)}));
}finally{await b.close();}
