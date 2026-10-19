import fs from 'node:fs/promises';
export const pause=ms=>new Promise(r=>setTimeout(r,ms));
const debug=process.env.CHROME_DEBUG_URL??'http://127.0.0.1:9226';
export async function browser(){
 const tab=await(await fetch(debug+'/json/new',{method:'PUT'})).json();
 const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0;const pending=new Map();
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timed out: '+method));},30000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{for(let n=0;n<150;n++){if(await evaluate(expression))return;await pause(100);}throw Error('Wait failed: '+expression+'; '+await evaluate('document.body.innerText.slice(0,500)'));};
 const load=async url=>{await send('Page.navigate',{url:'about:blank'});await pause(50);await send('Page.navigate',{url});await wait("document.readyState==='complete' && !!document.querySelector('main,h1,h2,#storybook-root > *')");await evaluate('document.fonts.ready');await pause(800);if(await evaluate("document.body.innerText.includes('This page could not be loaded')"))throw Error('Error page: '+url);};
 const size=async(width,height=900)=>{await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await pause(150);};
 const click=async expression=>{const box=await evaluate(`(()=>{const e=${expression};if(!e)throw Error('Missing click target');e.scrollIntoView({block:'center'});const b=e.getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2};})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...box});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...box});await pause(100);};
 const shot=async path=>{await fs.mkdir(path.slice(0,path.lastIndexOf('/')),{recursive:true});const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path,Buffer.from(r.data,'base64'));};
 const close=async()=>{ws.close();await fetch(`${debug}/json/close/${tab.id}`);};
 await send('Page.enable');await send('Network.enable');return{send,evaluate,wait,load,size,click,shot,close};
}
