import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const url=process.env.KIRBY_URL??'http://127.0.0.1:5193/';
const output=resolve('node_modules/.cache/player-dash');await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={runs:[],errors:[]};
async function prepare(page,pigeon){
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.routeWebSocket(`ws://${new URL(url).host}/**`,ws=>{const server=ws.connectToServer();server.onMessage(message=>{try{if(['full-reload','update'].includes(JSON.parse(message).type))return;}catch{}ws.send(message);});});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');localStorage.setItem('kirby-pidgie-unlocked-v1','1');});
 await page.route('http://127.0.0.1:8787/**',r=>r.fulfill({json:{count:0,players:0,occupiedVariants:[],capacity:19,ok:true}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`
 window.boostQA={get c(){return character},get playing(){return playing},renderer,scene,sounds,cues:[],played:[],frames:[]};
 const boostPlay=sounds.playPlayerDash.bind(sounds);sounds.playPlayerDash=kind=>{boostQA.cues.push(kind);boostPlay(kind);};
 `});});
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.waitForFunction(()=>window.boostQA&&!document.querySelector('#start-game').disabled,null,{timeout:120000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill(pigeon?'Ястреб':'Самолётик');
 await page.locator(pigeon?'#variant-grid .pigeon-character:not(.snowball-character)':'#variant-grid .variant-button').first().click();await page.locator('#start-game').click();
 await page.waitForFunction(()=>boostQA.playing&&boostQA.c,null,{timeout:120000});
 await page.locator('#game canvas').focus();
 await page.evaluate(()=>{
  const q=boostQA,c=q.c;c.setActivity('Idle');c.actor.position.set(135,0,146);c.surfaceY=0;
  const update=c.update.bind(c);c.update=(dt,input)=>{update(dt,input);const el=document.querySelector('#knight-dash-hud');q.frames.push({state:c.state,charge:c.playerDash.charge,held:input.dashHeld,jump:input.jump,hud:el.dataset.state,fill:Number(el.style.getPropertyValue('--dash-charge'))});};
  const ctx=q.sounds.context,create=ctx.createBufferSource.bind(ctx);ctx.createBufferSource=()=>{const source=create(),start=source.start.bind(source);source.start=(...args)=>{q.played.push([...q.sounds.buffers].find(([,buffer])=>buffer===source.buffer)?.[0]);start(...args);};return source;};
 });await page.waitForFunction(()=>boostQA.frames.some(f=>!f.held)&&!boostQA.c.playerDash.spent);
}
try{
 for(const {pigeon,mobile,viewport} of process.env.BOOST_POSES_ONLY==='1'?[]:[
  {pigeon:true,mobile:false,viewport:{width:1280,height:800}},
  {pigeon:false,mobile:false,viewport:{width:1280,height:800}},
  {pigeon:true,mobile:true,viewport:{width:844,height:390}},
  {pigeon:false,mobile:true,viewport:{width:390,height:844}},
 ]){
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile}),page=await context.newPage();await prepare(page,pigeon);
  const hud=page.locator('#knight-dash-hud');assert(await hud.isVisible());assert.equal(await hud.getAttribute('aria-label'),'Ускорение');assert.match(await hud.getAttribute('aria-description'),/0,3/);
  assert.equal(await hud.locator('.knight-dash-symbol').count(),1);
  await page.waitForFunction(pigeon=>boostQA.sounds.buffers.has(pigeon?'hawk-dash':'cheer'),pigeon);
  const session=mobile?await context.newCDPSession(page):undefined,box=mobile?await page.locator('#touch-jump').boundingBox():undefined;
  const down=()=>mobile?session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]}):page.keyboard.down('Space');
  const up=()=>mobile?session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}):page.keyboard.up('Space');
  await down();await page.waitForFunction(()=>boostQA.frames.some(f=>f.hud==='charging'&&f.fill>0));
  const charge=await page.evaluate(()=>boostQA.frames.find(f=>f.hud==='charging'&&f.fill>0));assert(charge.fill>0&&charge.fill<1);
  await page.waitForFunction(()=>boostQA.frames.some(f=>f.state==='Dash'));await up();
  assert(await page.evaluate(()=>boostQA.c.playerDash.cooldown>5));
  await page.waitForFunction(()=>document.querySelector('#knight-dash-hud').dataset.state==='cooldown');
  assert.match(await hud.locator('.knight-dash-countdown').textContent(),/^[1-6]$/);
  await page.waitForFunction(()=>boostQA.cues.length===1);
  const sound=await page.evaluate(()=>({cues:boostQA.cues,played:boostQA.played,audio:boostQA.sounds.context.state,hawkSeconds:boostQA.sounds.buffers.get('hawk-dash')?.duration}));
  assert.deepEqual(sound.cues,[pigeon?'pigeon':'kirby']);assert(sound.played.includes(pigeon?'hawk-dash':'cheer'));assert.equal(sound.audio,'running');
  await page.screenshot({path:resolve(output,`${pigeon?'pigeon':'kirby'}-${mobile?'touch':'keyboard'}.png`)});
  await page.waitForFunction(()=>!boostQA.c.playerDash.active);
  const bounds=await hud.boundingBox();assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=viewport.width&&bounds.y+bounds.height<=viewport.height);
  report.runs.push({pigeon,mobile,charge,sound,bounds});console.log(`PASS ${pigeon?'pigeon':'Kirby'} ${mobile?'touch':'keyboard'} charge, dash, cooldown, correct voice`);
  await context.close();
 }
 // Inspect the real shipped GLBs under neutral lighting at deterministic phases.
 const photo=await browser.newPage({viewport:{width:640,height:480}});
 await photo.route('**/__boost-poses',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><body style="margin:0;background:#19243a"><script type="module">
 import * as T from '/node_modules/three/build/three.module.js';
 import {GLTFLoader} from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
 import {CharacterController} from '/src/controller.ts';
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(640,480);renderer.setPixelRatio(1);document.body.append(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color('#26364d');scene.add(new T.HemisphereLight('#ffffff','#8b7ca7',2.5));const sun=new T.DirectionalLight('#fff0d4',3);sun.position.set(4,7,6);scene.add(sun);
 const camera=new T.PerspectiveCamera(32,640/480,.1,100);camera.position.set(5,2.7,4.5);camera.lookAt(0,1.25,0);
 const loader=new GLTFLoader();let c;
 window.pose=async(kind,seconds,front=false)=>{if(c)scene.remove(c.actor);const gltf=await loader.loadAsync('/models/'+kind+'-animated.glb');c=new CharacterController(gltf.scene,gltf.animations);scene.add(c.actor);for(let i=0;i<Math.round(seconds*100);i++)c.update(.01,{forward:false,left:false,right:false,jump:true});c.actor.position.set(0,0,0);camera.position.set(front?0:5,2.7,front?7:4.5);camera.lookAt(0,1.25,0);renderer.render(scene,camera);return {state:c.state,progress:c.playerDash.progress};};
 window.ready=true;
 </script></body></html>`}));
 await photo.goto(new URL('__boost-poses',url).href);await photo.waitForFunction(()=>window.ready);
 for(const kind of ['pigeon','kirby'])for(const [stage,seconds] of [['charge',.24],['launch',.37],['cruise',.62],['brake',.86],['recovered',1.05]]){
  await photo.evaluate(([kind,seconds])=>window.pose(kind,seconds),[kind,seconds]);await photo.screenshot({path:resolve(output,`${kind}-${stage}.png`)});
 }
 await photo.evaluate(()=>window.pose('kirby',.62,true));await photo.screenshot({path:resolve(output,'kirby-airplane-front.png')});
 await photo.close();assert.deepEqual(report.errors,[]);await writeFile(resolve(output,process.env.BOOST_POSES_ONLY==='1'?'checks-poses.json':'checks.json'),JSON.stringify(report,null,2));
}catch(error){for(const context of browser.contexts())for(const page of context.pages()){console.error(await page.evaluate(()=>({state:window.boostQA?.c?.state,dash:window.boostQA?.c?.playerDash,frames:window.boostQA?.frames.slice(-4),charged:window.boostQA?.frames.filter(f=>f.charge>0).slice(0,4),cues:window.boostQA?.cues,focus:document.activeElement?.outerHTML.slice(0,120)})).catch(()=>({closed:true})));await page.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});}throw error;}finally{await browser.close();}
