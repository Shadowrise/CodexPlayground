import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const output=fileURLToPath(new URL('../node_modules/.cache/centipede-warnings/',import.meta.url));await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],frames=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.warningQA={THREE,get c(){return character},get event(){return currentCentipede()},get model(){return arenaCentipede},view:centipedeView,scene,renderer,camera,followCamera,boatTime};'});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5194/');await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Дорожки');await page.locator('#start-game').click();await page.waitForFunction(()=>!!window.warningQA.c&&!!window.warningQA.model);
 await page.evaluate(()=>{const t=warningQA,p=t.model.startTrail(t.boatTime()).at(-1);t.c.actor.position.set(p[0]+3,0,p[1]);});
 await page.waitForFunction(()=>document.querySelector('#action-hint').textContent.includes('Поиграть с Топотушкой'));await page.keyboard.press('e');await page.waitForFunction(()=>warningQA.event?.stage==='invite');
 await page.evaluate(async()=>{
  const t=warningQA,T=t.THREE,R=await import('/src/centipede-event.ts'),{BOSS_ARENA:A}=await import('/src/boss-arena-site.ts');
  t.renderer.setAnimationLoop(null);t.rules=R;t.arena=A;
  const actor={id:'solo',p:[A.x+14,0,A.z+10],yaw:0,size:1,available:true,done:false,points:0};
  const warning=structuredClone(t.event);R.advanceCentipede(warning,warning.stageAt+R.CENTIPEDE_TIMES.invite,[actor]);
  const charge=structuredClone(warning);R.advanceCentipede(charge,charge.stageAt+R.CENTIPEDE_TIMES.warning,[actor]);
  const balls=structuredClone(charge);R.advanceCentipede(balls,balls.stageAt+R.CENTIPEDE_TIMES.charge,[actor]);
  const wheelWarning=structuredClone(balls);Object.assign(wheelWarning,{phase:3,hits:6,stage:'curl',from:[A.x,A.z],to:[A.x,A.z],route:undefined});R.advanceCentipede(wheelWarning,wheelWarning.stageAt+R.CENTIPEDE_TIMES.curl,[actor]);
  const wheelRoll=structuredClone(wheelWarning);R.advanceCentipede(wheelRoll,wheelRoll.stageAt+R.CENTIPEDE_TIMES.wheelWarning,[actor]);
  t.states={warning,charge,balls,wheelWarning,wheelRoll};t.c.actor.position.set(A.x+17,0,A.z+16);
  t.pose=(stage,elapsed,snapshot=false)=>{
   const q=snapshot?JSON.parse(JSON.stringify(t.states[stage])):t.states[stage],now=q.stageAt+elapsed;
   t.camera.position.set(A.x+20,61,A.z+64);t.camera.lookAt(A.x,0,A.z);t.camera.updateMatrixWorld();
   t.model.update(now/1000,t.camera.position,q,now);t.model.update(now/1000,t.camera.position,q,now+700);
   t.view.update(q,'solo',now,t.c.actor.position,true,'Q',t.camera);t.renderer.render(t.scene,t.camera);
   const lane=t.view.group.getObjectByName('Topotushka run and wheel countdown lane'),balls=t.view.group.getObjectByName('Дорожки перед волной шариков');
   const uniforms=m=>Object.fromEntries(['progress','attack','width','span'].map(k=>[k,m.material.uniforms[k].value]));
   const matrix=new T.Matrix4();if(balls.count)balls.getMatrixAt(0,matrix);
   const b=R.centipedeBalls(q,now).find(b=>!b.active),start=new T.Vector3(0,5.675,0).applyMatrix4(matrix),end=new T.Vector3(0,-5.675,0).applyMatrix4(matrix);
   return {stage,elapsed,lane:lane.visible,route:uniforms(lane),balls:balls.count,ballWarning:uniforms(balls),forward:b?((end.x-start.x)*b.dx+(end.z-start.z)*b.dz):undefined,draws:t.renderer.info.render.calls};
  };
 });
 for(const [stage,elapsed] of [['warning',0],['warning',900],['warning',1799],['charge',500],['balls',725],['balls',3325],['balls',5925],['wheelWarning',0],['wheelWarning',900],['wheelWarning',1799],['wheelRoll',2500]]){
  const frame=await page.evaluate(({stage,elapsed})=>warningQA.pose(stage,elapsed),{stage,elapsed});
  if(stage==='balls'){assert.equal(frame.balls,5);assert.equal(frame.ballWarning.progress,.5);assert.equal(frame.ballWarning.attack,0);assert(frame.forward>11,'every chevron follows the ball launch direction');}
  else {assert(frame.lane);assert.equal(frame.route.width,stage.startsWith('wheel')?2.85:1.55);assert.equal(frame.route.progress,stage==='charge'||stage==='wheelRoll'?1:elapsed/1800);assert.equal(frame.route.attack,stage==='charge'||stage==='wheelRoll'?1:0);}
  await page.screenshot({path:output+stage+'-'+elapsed+'.png'});frames.push(frame);
 }
 const late=await page.evaluate(()=>warningQA.pose('wheelWarning',900,true));assert.equal(late.route.progress,.5);assert.equal(late.route.width,2.85);
 const targetOverlay=await page.evaluate(()=>{
  const t=warningQA,T=t.THREE,q=structuredClone(t.states.warning);q.stage='exhausted';
  const now=q.stageAt,target=new T.Vector3().fromArray(t.rules.centipedeTarget(q));t.camera.position.copy(target).add(new T.Vector3(8,9,15));t.camera.lookAt(target);t.camera.updateMatrixWorld();
  t.model.update(now/1000,t.camera.position,q,now);t.model.update(now/1000,t.camera.position,q,now+700);t.view.update(q,'solo',now,t.c.actor.position,true,'Q',t.camera);t.renderer.render(t.scene,t.camera);
  const ring=t.view.targetCue.ring,size=t.renderer.getDrawingBufferSize(new T.Vector2()),gl=t.renderer.getContext(),pixel=new Uint8Array(4),samples=[];
  for(let i=0;i<24;i++){const a=i*Math.PI/12,p=ring.localToWorld(new T.Vector3(Math.sin(a)*1.05,Math.cos(a)*1.05,0)).project(t.camera);gl.readPixels(Math.floor((p.x+1)*size.x/2),Math.floor((p.y+1)*size.y/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);samples.push([...pixel]);}
  return {samples,complete:samples.every(p=>p[1]>p[0]+12&&p[1]>p[2]+8),depthTest:ring.material.depthTest};
 });assert(targetOverlay.complete&&!targetOverlay.depthTest,'the entire green target stays visible over the actual Topotushka model');await page.screenshot({path:output+'complete-green-target.png'});
 const resources=await page.evaluate(()=>{
  const t=warningQA,lane=t.view.group.getObjectByName('Topotushka run and wheel countdown lane');t.pose('wheelWarning',100);const geometry=lane.geometry;t.pose('wheelWarning',1700);const stable=lane.geometry===geometry;
  t.view.update(undefined,'solo',0,t.c.actor.position,true,'Q',t.camera);return {stable,hidden:!t.view.group.visible};
 });assert(resources.stable&&resources.hidden);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{document.body.classList.add('touch-ui');warningQA.camera.aspect=390/844;warningQA.camera.updateProjectionMatrix();warningQA.pose('wheelWarning',1200);});await page.screenshot({path:output+'wheel-mobile.png'});
 assert.deepEqual(errors,[]);await writeFile(output+'checks.json',JSON.stringify({frames,late,targetOverlay,resources,errors},null,2));console.log(JSON.stringify({result:'PASS',frames:frames.length,late,targetOverlay,resources,errors,output}));
}finally{await browser.close();}
