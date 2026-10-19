import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const url=process.env.KIRBY_URL??'http://127.0.0.1:5174/';
const output=resolve('node_modules/.cache/jump-gravity');await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={runs:[],errors:[]};
async function prepare(page){
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.routeWebSocket(`ws://${new URL(url).host}/**`,ws=>{const server=ws.connectToServer();server.onMessage(message=>{if(typeof message==='string'){try{if(['full-reload','update'].includes(JSON.parse(message).type))return;}catch{}}ws.send(message);});});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 await page.route('http://127.0.0.1:8787/**',r=>r.fulfill({json:{count:0,players:0,occupiedVariants:[],capacity:19,ok:true}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`
 window.jumpQA={get c(){return character},get playing(){return playing},renderer,scene,camera,history:[],elapsed:0};
 `});});
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.waitForFunction(()=>window.jumpQA&&!document.querySelector('#start-game').disabled,null,{timeout:120000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Гравитация');await page.locator('#start-game').click();
 await page.waitForFunction(()=>jumpQA.playing&&jumpQA.c,null,{timeout:120000});
 await page.evaluate(()=>{const q=jumpQA,c=q.c,update=c.update.bind(c);c.update=(dt,input)=>{update(dt,input);q.elapsed+=dt;q.history.push({t:q.elapsed,dt,jump:input.jump,attack:!!input.attack,hit:c.attackHit,armZ:c.actor.getObjectByName('Right_shoulder').position.z,height:c.flight.height,active:c.flight.active,hover:c.flight.levitating,velocity:c.flight.networkState()[6],hold:c.flight.networkState()[4],cloud:c.cloud.visible,state:c.state,rootY:c.animationRoot.position.y});};});
}
async function reset(page){
 await page.evaluate(()=>{const q=jumpQA;q.c.setActivity('Idle');q.c.actor.position.set(135,0,146);q.c.surfaceY=0;});
 await page.waitForFunction(()=>!jumpQA.c.flight.active);
 await page.evaluate(()=>{jumpQA.history=[];jumpQA.elapsed=0;});
}
async function finish(page){
 await page.waitForFunction(()=>jumpQA.history.some(f=>f.active)&&!jumpQA.c.flight.active,null,{timeout:15000});
 return page.evaluate(()=>jumpQA.history);
}
function checkArc(frames){
 const flight=frames.filter(f=>f.active);assert(flight.length>3);assert(flight.every(f=>!f.hover&&!f.cloud&&f.state==='Jump'));
 const peak=Math.max(...flight.map(f=>f.height));assert(peak>1.35&&peak<=1.450001);
 assert(flight.some(f=>f.velocity<0));assert(flight.every(f=>Math.abs(f.rootY)<1e-6));
 const start=frames.findIndex(f=>f.active);let time=0;
 for(const frame of frames.slice(start)){time+=frame.dt;const expected=Math.max(0,Math.sqrt(2*24*1.45)*time-12*time*time);assert(Math.abs(frame.height-expected)<1e-6,JSON.stringify({time,height:frame.height,expected}));}
 return {peak,airSeconds:time,frames:flight.length};
}
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:844,height:390}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage();await prepare(page);
  const touchButton=mobile?await page.locator('#touch-jump').boundingBox():undefined;
  const tap=()=>mobile?page.touchscreen.tap(touchButton.x+touchButton.width/2,touchButton.y+touchButton.height/2):page.keyboard.press('Space');
  const attackButton=mobile?await page.locator('#touch-attack').boundingBox():undefined;
  const push=()=>mobile?page.touchscreen.tap(attackButton.x+attackButton.width/2,attackButton.y+attackButton.height/2):page.keyboard.press('q');
  await reset(page);await tap();const single=checkArc(await finish(page));
  await reset(page);
  if(mobile){await tap();}else{await page.keyboard.down('Space');}
  await page.waitForFunction(()=>jumpQA.elapsed>1&&jumpQA.history.some(f=>f.active));
  if(!mobile)await page.keyboard.up('Space');
  const held=await page.evaluate(()=>jumpQA.history);checkArc(held);
  assert.equal(held.filter((f,i)=>f.active&&!held[i-1]?.active).length,1,'holding cannot repeat a jump');
  await reset(page);await tap();
  await page.waitForFunction(()=>jumpQA.c.flight.active&&jumpQA.c.flight.networkState()[6]<0);
  await tap();const late=checkArc(await finish(page));
  await reset(page);await tap();
  await page.waitForFunction(()=>jumpQA.c.flight.active&&jumpQA.history.filter(f=>f.active).reduce((sum,f)=>sum+f.dt,0)>=.1);
  await tap();await page.waitForFunction(()=>jumpQA.c.flight.levitating&&jumpQA.c.flight.atTop);
  await page.screenshot({path:resolve(output,mobile?'phone-hover.png':'desktop-hover.png')});
  await tap();const frames=await finish(page),peak=Math.max(...frames.map(f=>f.height));
  assert(Math.abs(peak-2.9)<1e-6);assert(frames.some(f=>f.cloud&&f.state==='Fly'));
  const plateau=frames.filter(f=>Math.abs(f.height-2.9)<1e-6),hoverSeconds=plateau.at(-1).t-plateau[0].t;
  assert(hoverSeconds>=1.85&&hoverSeconds<=2.05,`hover seconds: ${hoverSeconds}`);
  const falling=frames.filter(f=>f.velocity<0);assert(falling.length>2&&falling.every(f=>!f.hover&&!f.cloud));
  assert(falling.every((f,i)=>!i||f.velocity<falling[i-1].velocity));
  const airPush=[];
  for(const phase of ['ascent','descent','levitation']){
   await reset(page);await tap();
   if(phase==='levitation'){
    await page.waitForFunction(()=>jumpQA.c.flight.active&&jumpQA.history.filter(f=>f.active).reduce((sum,f)=>sum+f.dt,0)>=.1);
    await tap();await page.waitForFunction(()=>jumpQA.c.flight.levitating&&jumpQA.c.flight.atTop);
   }else await page.waitForFunction(falling=>jumpQA.c.flight.active&&(falling?jumpQA.c.flight.networkState()[6]<0:jumpQA.c.flight.height>.3&&jumpQA.c.flight.networkState()[6]>0),phase==='descent');
   await push();const pushed=await finish(page),hits=pushed.filter(f=>f.hit&&f.active);
   assert.equal(hits.length,1,`${phase}: push must hit once while airborne`);
   assert(pushed.some(f=>f.active&&f.armZ>.2),`${phase}: the arms must visibly reach forward`);
   if(phase==='levitation'){
    assert(hits[0].hover);const hover=pushed.filter(f=>Math.abs(f.height-2.9)<1e-6);
    assert(hover.at(-1).t-hover[0].t<=2.05,'push cannot extend levitation');
   }else checkArc(pushed);
   airPush.push({phase,hits:hits.length});
  }
  report.runs.push({mobile,single,late,double:{peak,hoverSeconds},heldOnce:true,airPush});console.log(`PASS ${mobile?'touch':'keyboard'} jump, timed hover, gravity and pushes during ascent, descent and levitation`);
  await context.close();
 }
 assert.deepEqual(report.errors,[]);await writeFile(resolve(output,'checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){
 for(const context of browser.contexts())for(const page of context.pages())console.error(JSON.stringify(await page.evaluate(()=>({pressed:jumpQA.history.filter(f=>f.jump),last:jumpQA.history.slice(-3)})).catch(()=>({closed:true}))));
 throw error;
}finally{await browser.close();}
