import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const url=process.env.KIRBY_URL??'http://127.0.0.1:5185/';
const baseline=process.argv.includes('--baseline'),phase=baseline?'before':'after';
const output=resolve(process.env.META_KNIGHT_ACTIONS_OUTPUT??fileURLToPath(new URL('../node_modules/.cache/meta-knight-actions/',import.meta.url)),phase);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[],assetReads=[],report={phase,assets:[],actions:{},firefly:{},errors};
async function command(page,text){await page.evaluate(()=>metaActionCheck.chat.show());await page.locator('#chat-input').fill(text);await page.keyboard.press('Enter');assert(await page.locator('#chat-composer').isHidden(),text);}
async function fixedCamera(page,view='front',distance=7){
 await page.evaluate(({view,distance})=>{
  const q=metaActionCheck,c=q.c,p=c.actor.position;
  q.camera.position.set(p.x+(view==='side'?distance:view==='ride'?distance*.75:0),p.y+(view==='ride'?3.2:2.2),p.z+(view==='side'?.1:view==='ride'?distance*.8:distance));
  q.camera.lookAt(p.x,p.y+(view==='ride'?.6:1.35),p.z);q.camera.fov=46;q.camera.updateProjectionMatrix();q.camera.updateMatrixWorld();q.renderer.render(q.scene,q.camera);
 },{view,distance});
}
async function pose(page,name,time,view){
 const metrics=await page.evaluate(async({name,time})=>{
  const q=metaActionCheck,c=q.c,T=await import('/node_modules/.vite/deps/three.js');
  for(const action of c.actions.values())action.stop();
  const action=c.actions.get(name);action.reset().stopFading().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
  c.mixer.setTime(time);c.actor.updateMatrixWorld(true);
  const node=label=>c.actor.getObjectByName(label),point=label=>node(label)?.getWorldPosition(new T.Vector3()).toArray();
  const blade=node('Galaxia'),tip=blade?blade.localToWorld(new T.Vector3(0,2.1,0)).toArray():undefined;
  return {time,leftFist:point('Left_fist'),leftHand:point('Left_gauntlet'),rightGrip:point('Right_grip'),body:point('Body_motion'),eyes:point('Eyes_glow'),swordTip:tip,swordAxis:blade?new T.Vector3(0,1,0).transformDirection(blade.matrixWorld).toArray():undefined,leftShoulder:node('Left_shoulder')?.quaternion.toArray(),leftHandRotation:node('Left_gauntlet')?.quaternion.toArray(),swordRotation:node('Right_grip')?.getWorldQuaternion(new T.Quaternion()).toArray()};
 },{name,time});
 await fixedCamera(page,view);
 const path=resolve(output,`${name.toLowerCase()}-${view}-${String(time).replace('.','_')}.png`);
 await page.screenshot({path,animations:'disabled'});return {...metrics,view,path};
}
async function contactSheet(name,frames){
 const sheet=await browser.newPage({viewport:{width:1800,height:950},deviceScaleFactor:1});
 const images=await Promise.all(frames.map(async frame=>({...frame,src:`data:image/png;base64,${(await readFile(frame.path)).toString('base64')}`})));
 await sheet.setContent(`<html><head><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#142132;color:#f2f5ff;font:16px system-ui}h1{margin:0 0 8px;font-size:27px}p{margin:0 0 20px;color:#bfcee2}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}figure{margin:0;border:1px solid #465772;background:#203147;border-radius:10px;overflow:hidden}img{display:block;width:100%;aspect-ratio:1.25;object-fit:cover}figcaption{padding:10px;font-weight:600}</style></head><body><h1>Meta Knight · ${name} · ${phase}</h1><p>Native gameplay clip after keyboard input · Front and right-side cameras · Seconds from clip start</p><div class="grid">${images.map(frame=>`<figure><img src="${frame.src}"><figcaption>${frame.view} · ${frame.time.toFixed(2)} s</figcaption></figure>`).join('')}</div></body></html>`);
 await sheet.screenshot({path:resolve(output,`${name.toLowerCase()}-contact-sheet.png`),fullPage:true});await sheet.close();
}
async function fireflySnapshot(page,label){
 const data=await page.evaluate(async()=>{
  const q=metaActionCheck,c=q.c,T=await import('/node_modules/.vite/deps/three.js'),mount=q.fireflies.mount;
  c.actor.updateMatrixWorld(true);mount.carrier.updateMatrixWorld(true);
  const body=c.actor.getObjectByName('Body_motion'),point=body.getWorldPosition(new T.Vector3());
  const shellSeat=mount.shellSeat?.getWorldPosition(new T.Vector3()).y;
  const skin=body.children.find(node=>node.isMesh&&node.name.startsWith('Body_motion_surface'));
  let bodyBottom=Infinity;const vertex=new T.Vector3();
  for(let i=0;i<skin.geometry.getAttribute('position').count;i++){skin.getVertexPosition(i,vertex).applyMatrix4(skin.matrixWorld);bodyBottom=Math.min(bodyBottom,vertex.y);}
  return {native:c.isMetaKnight,state:c.state,active:q.fireflies.riding,index:q.fireflies.bugs.indexOf(mount),actor:c.actor.position.toArray(),mount:mount.carrier.position.toArray(),mountScale:mount.firefly.object.scale.x,body:point.toArray(),bodyBottom,shellSeat,contactGap:shellSeat===undefined?undefined:bodyBottom-shellSeat,leftFoot:c.actor.getObjectByName('Left_foot_pivot').getWorldPosition(new T.Vector3()).toArray(),nativeClipTime:c.actions.get('FireflyRide').time};
 });
 await page.evaluate(()=>metaActionCheck.pause());await fixedCamera(page,'ride',8.5);
 await page.screenshot({path:resolve(output,`firefly-${label}.png`),animations:'disabled'});
 await page.evaluate(()=>metaActionCheck.resume());return data;
}
try{
 const page=await browser.newPage({viewport:{width:1000,height:800},deviceScaleFactor:1});
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 page.on('response',response=>{if(/meta-knight[^/]*\.glb(?:\?|$)/.test(response.url()))assetReads.push(response.body().then(bytes=>report.assets.push({url:response.url(),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})));});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');localStorage.setItem('kirby-meta-knight-unlocked-v1','1');});
 await page.route('http://127.0.0.1:8787/**',route=>route.fulfill({json:{count:0,players:0,occupiedVariants:[],capacity:19,ok:true}}));
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch();const source=await response.text();
  assert(source.includes('renderer.setAnimationLoop('),'Vite entry still registers its gameplay animation loop');
  const captured=source.replace('renderer.setAnimationLoop(','(callback=>{window.metaKnightActionLoop=callback;renderer.setAnimationLoop(callback);})(');
  await route.fulfill({response,body:captured+`
window.metaActionCheck={get c(){return character},get selected(){return selected},get playing(){return playing},get fireflies(){return fireflies},chat,scene,camera,renderer,followCamera,pause(){renderer.setAnimationLoop(null)},resume(){renderer.setAnimationLoop(window.metaKnightActionLoop)}};
`});
 });
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.waitForFunction(()=>window.metaActionCheck&&!document.querySelector('#start-game').disabled&&metaActionCheck.fireflies,null,{timeout:120000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Meta Knight QA');await page.locator('.variant-button.meta-knight-character').click();await page.locator('#start-game').click();
 await page.waitForFunction(()=>metaActionCheck.playing&&metaActionCheck.c?.isMetaKnight);assert.equal(await page.evaluate(()=>metaActionCheck.selected[0]),'Meta Knight');
 await command(page,'/time 12');
 await page.evaluate(()=>{const q=metaActionCheck,c=q.c;c.setActivity('Idle');c.actor.position.set(0,0,0);c.actor.rotation.set(0,0,0);c.yaw=0;c.swimming=false;c.surfaceY=0;});
 const hiddenUi=await page.addStyleTag({content:'body > :not(#game):not(script):not(style){visibility:hidden!important}'});
 for(const [name,key,times] of [['Hello','1',[0,.5,.72,.95,1.18]],['Push','q',[0,.10,.23,.37,.62]]]){
  await page.keyboard.press(key);await page.waitForFunction(name=>metaActionCheck.c.state===name&&metaActionCheck.c.actions.get(name).time>0,name);
  const native=await page.evaluate(name=>{const c=metaActionCheck.c;return {native:c.isMetaKnight,state:c.state,clip:c.actions.get(name).getClip().name,hasNative:c.hasNativeAnimations};},name);
  assert(native.native&&native.hasNative&&native.state===name&&native.clip===name);await page.evaluate(()=>metaActionCheck.pause());
  const frames=[];for(const view of ['front','side'])for(const time of times)frames.push(await pose(page,name,time,view));
  if(!baseline&&name==='Hello'){
   const raised=frames.filter(frame=>frame.view==='front'&&frame.time>.4);
   assert(raised.every(frame=>frame.leftFist[1]-frame.body[1]>.3),'free left fist stays raised above the visor');
   const [a,b]=raised.map(frame=>frame.leftHandRotation),dot=a.reduce((sum,value,index)=>sum+value*b[index],0);
   assert(2*Math.acos(Math.min(1,Math.abs(dot)))>.2,'raised left wrist waves between the sampled poses');
  }
  if(!baseline&&name==='Push'){
   const rest=frames.find(frame=>frame.view==='front'&&frame.time===0),lunge=frames.find(frame=>frame.view==='front'&&frame.time===.23);
   assert(lunge.swordAxis[2]>.95,'native lunge points the blade forward at the gameplay hit');
   assert(lunge.swordTip[2]-rest.swordTip[2]>1,'sword point reaches forward rather than repeating the idle sword pose');
  }
  report.actions[name]={keyboard:key,native,frames};await contactSheet(name,frames);
  await page.evaluate(()=>{metaActionCheck.c.setActivity('Idle');metaActionCheck.resume();});await page.waitForTimeout(150);
 }
 await hiddenUi.evaluate(style=>style.remove());
 const boarded=await page.evaluate(()=>{
  const q=metaActionCheck,c=q.c;for(let i=0;i<q.fireflies.bugs.length;i++)if(!q.fireflies.occupiedByNpc(i)){
   const bug=q.fireflies.bugs[i];c.setActivity('Idle');c.swimming=false;c.actor.position.copy(bug.carrier.position).setY(0);bug.carrier.position.y=0;bug.land=true;
   // Boarding uses the real attraction, not a replacement rider or mount.
   if(q.fireflies.board(c))return true;
  }return false;
 });
 assert(boarded,'real firefly boarding succeeds');await page.waitForFunction(()=>metaActionCheck.c.state==='FireflyRide');
 await page.waitForTimeout(2400);const rideUi=await page.addStyleTag({content:'body > :not(#game):not(script):not(style){visibility:hidden!important}'});
 report.firefly.settled=await fireflySnapshot(page,'settled');assert(report.firefly.settled.native&&report.firefly.settled.active&&report.firefly.settled.state==='FireflyRide');
 const from=await page.evaluate(()=>metaActionCheck.c.actor.position.toArray());await page.keyboard.down('w');await page.waitForTimeout(1200);await page.keyboard.up('w');
 report.firefly.moving=await fireflySnapshot(page,'moving');
 assert(Math.hypot(report.firefly.moving.actor[0]-from[0],report.firefly.moving.actor[2]-from[2])>1,'keyboard movement carries the actual native rider');
 assert(report.firefly.moving.nativeClipTime>0);await rideUi.evaluate(style=>style.remove());
 if(!baseline)for(const [label,snapshot] of Object.entries(report.firefly))assert(Math.abs(snapshot.contactGap)<.015,`${label}: native belly meets the animated firefly shell (${snapshot.contactGap})`);
 await page.evaluate(()=>metaActionCheck.fireflies.disembark());await page.waitForFunction(()=>!metaActionCheck.fireflies.riding&&metaActionCheck.c.state==='Idle');
 await Promise.all(assetReads);assert(report.assets.length>0,'native GLB response recorded');
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({phase,output,assets:report.assets,actions:Object.keys(report.actions),firefly:report.firefly,errors}));
}finally{await browser.close();}
