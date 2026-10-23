import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const output=fileURLToPath(new URL('../node_modules/.cache/meta-knight-telegraphs/',import.meta.url));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.stack));
 page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.telegraphQA={THREE,travel:cosmicArena,renderer,get c(){return character}};'});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5196/');
 await page.waitForFunction(()=>!!window.telegraphQA,null,{timeout:180000});
 await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Стрелочки');await page.locator('#start-game').click();
 await page.waitForFunction(()=>!!telegraphQA.c);
 await page.evaluate(async()=>{
  const q=telegraphQA,T=q.THREE;await q.travel.enter(q.c);q.renderer.setAnimationLoop(null);q.c.actor.position.set(2022,0,-12);
  q.rules=await import('/src/meta-knight-battle.ts');q.sword=await import('/src/meta-knight-sword-swing.ts');
  q.camera=(wide=false)=>{const camera=q.travel.camera;camera.aspect=innerWidth/innerHeight;camera.fov=55;camera.position.set(2000,wide?115:47,wide?100:43);camera.lookAt(2000,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();};
  q.pose=(stage,step=0)=>{
   const s=q.rules.startKnightBattle([{id:'solo',p:[0,0,-2],yaw:0,available:true}],'solo',1000);
   Object.assign(s,{stage,step,pattern:stage.startsWith('dash')?'flight':'sword',phase:stage.startsWith('dash')?2:1,since:100000,until:101600,from:[0,0,0],to:stage.startsWith('dash')?[0,0,27]:[0,0,0],yaw:0,height:0});
   q.travel.soloBattle=s;q.travel.soloNow=100700;q.camera();q.travel.battleView.update(s,'solo',100700,0,false,'Q',true,false,undefined,q.travel.camera);q.travel.render();return s;
  };
  q.arrowPixels=()=>{
   const scene=q.travel.scene,camera=q.travel.camera,renderer=q.renderer,arrows=q.travel.battleView.arrows.filter(a=>a.visible);
   const size=renderer.getDrawingBufferSize(new T.Vector2()),target=new T.WebGLRenderTarget(size.x,size.y),old=renderer.getRenderTarget();
   const pixels=()=>{const data=new Uint8Array(size.x*size.y*4);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,size.x,size.y,data);return data;};
   renderer.setRenderTarget(target);const withArrows=pixels();arrows.forEach(a=>a.visible=false);const without=pixels();arrows.forEach(a=>a.visible=true);
   const counts=arrows.map(a=>{const p=a.getWorldPosition(new T.Vector3()).project(camera),cx=Math.round((p.x+1)*size.x/2),cy=Math.round((p.y+1)*size.y/2);let changed=0;
    for(let y=Math.max(0,cy-16);y<Math.min(size.y,cy+17);y++)for(let x=Math.max(0,cx-16);x<Math.min(size.x,cx+17);x++){const i=(y*size.x+x)*4;if(Math.max(...[0,1,2].map(c=>Math.abs(withArrows[i+c]-without[i+c])))>8)changed++;}return changed;
   });
   renderer.setRenderTarget(old);target.dispose();q.travel.render();return {arrows:arrows.length,changedPixels:counts};
  };
 });
 for(const [stage,step] of [['slash-warn',0],['slash-warn',2],['slash',0],['dash-warn',0],['dash',1]]){
  const result=await page.evaluate(({stage,step})=>{const q=telegraphQA,s=q.pose(stage,step);return {stage,step,direction:q.sword.knightSwordDirection(s),...q.arrowPixels()};},{stage,step});
  assert.equal(result.arrows,stage.startsWith('slash')?3:8);
  // The moving boss can cover nearby floor arrows during an active dash.
  assert(result.changedPixels.filter(n=>n>12).length>=(stage==='dash'?5:result.arrows),JSON.stringify(result));checks.push(result);
  await page.screenshot({path:output+stage+'-'+step+'.png'});
 }
 await page.setViewportSize({width:844,height:390});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const mobile=await page.evaluate(()=>{const q=telegraphQA;q.pose('dash-warn');return q.arrowPixels();});
 assert(mobile.changedPixels.every(n=>n>3));checks.push({mobile:true,...mobile});await page.screenshot({path:output+'mobile-dash-arrows.png'});
 await page.setViewportSize({width:1280,height:900});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 // Landing opens immediately; the ring remains after a counter and the next attack.
 const wave=await page.evaluate(()=>{
  const q=telegraphQA,s=q.pose('dash-warn'),a={id:'solo',p:[31,1.2,3],yaw:Math.PI,available:true};
  Object.assign(s,{pattern:'dive',stage:'dive',step:1,cycle:2,hp:8,from:[12,0,-12],to:[31,0,0],since:100000,until:100450,checked:100000});
  q.c.actor.position.set(2031,1.2,3);q.rules.advanceKnightBattle(s,[a],s.until);q.waveAt=s.since;q.waveUntil=q.rules.knightPressureWave(s,s.since).until;q.waveState=s;q.waveActor=a;
  q.wavePose=(elapsed,close=false)=>{const now=q.waveAt+elapsed;q.rules.advanceKnightBattle(s,[a],now);q.camera(!close);if(close){q.travel.camera.position.set(2052,14,25);q.travel.camera.lookAt(2031,2,0);q.travel.camera.updateMatrixWorld();}q.travel.battleView.update(s,'solo',now,0,false,'Q',true,false,undefined,q.travel.camera);q.travel.render();const body=q.travel.scene.getObjectByName('Meta Knight solid golden impact wave');return {stage:s.stage,hp:s.hp,radius:body.material.uniforms.radius.value,visible:body.parent.visible,origin:body.parent.position.toArray(),bodyY:q.travel.knight.actor.getObjectByName('Body_motion').position.y,target:q.travel.scene.getObjectByName('Meta Knight available hit target').visible};};
  return {duration:q.waveUntil-q.waveAt,...q.wavePose(0,true)};
 });
 assert.equal(wave.stage,'open');assert(wave.target&&wave.bodyY<.95&&wave.visible&&wave.duration>5500);checks.push(wave);
 await page.screenshot({path:output+'dive-immediate-opening.png'});
 const hit=await page.evaluate(()=>{const q=telegraphQA;q.rules.knightAttack(q.waveState,q.waveActor,q.waveAt);const result=q.wavePose(140,true);q.waveState.players.solo.invulnerable=1e12;return result;});
 assert.equal(hit.stage,'stunned');assert.equal(hit.hp,7);assert(hit.visible&&!hit.target);checks.push(hit);await page.screenshot({path:output+'dive-hit-while-wave-flies.png'});
 const continued=await page.evaluate(()=>telegraphQA.wavePose(3000));assert(!['wave','open','stunned'].includes(continued.stage));assert(continued.visible&&continued.radius>40);checks.push(continued);
 await page.screenshot({path:output+'wave-beyond-old-radius.png'});
 const far=await page.evaluate(()=>telegraphQA.wavePose(5200));assert(far.visible&&far.radius>72);assert.deepEqual(far.origin,[31,0,0]);checks.push(far);
 await page.screenshot({path:output+'wave-far-edge.png'});
 const expired=await page.evaluate(()=>{const q=telegraphQA;return q.wavePose(q.waveUntil-q.waveAt);});assert(!expired.visible);checks.push(expired);
 const third=await page.evaluate(async()=>{
  const q=telegraphQA,T=q.THREE,v=q.travel.battleView;q.star=await import('/src/meta-knight-star-assault.ts');
  q.pose('slash-warn');const phase1={gold:v.amber.uniforms.tint.value.getHex(),arrow:v.arrows[0].material.color.getHex(),opacity:v.amber.uniforms.baseOpacity.value};
  q.pose('dash-warn');const phase2={gold:v.amberLane.uniforms.tint.value.getHex(),arrow:v.arrows[0].material.color.getHex(),opacity:v.amberLane.uniforms.baseOpacity.value};
  const s=q.pose('slash-warn');Object.assign(s,{phase:3,hp:4,pattern:'star',stage:'cross-warn',step:1,cycle:1,since:100000,until:103600,from:[0,0,-9],to:[0,0,-9],starCross:{pairs:[[0,4],[2,6]],side:0}});q.starState=s;q.c.actor.position.set(2028,0,-12);
  q.thirdPose=(now=100900)=>{q.travel.soloNow=now;q.travel.battleView.update(s,'solo',now,0,false,'Q',true,false,undefined,q.travel.camera);q.travel.starCameraMix=1;q.travel.placeCamera(q.c,0);q.travel.render();};q.thirdPose();
  const u=v.assault.cross.mesh.material.uniforms,phase3={gold:u.gold.value.getHex(),arrow:u.arrowTint.value.getHex(),opacity:u.baseOpacity.value};
  const bolts=q.travel.scene.getObjectByName('Golden crystal lightning cores'),blade=q.travel.knight.actor.getObjectByName('Galaxia'),tip=blade.localToWorld(new T.Vector3(-.315,2.05,0));tip.x-=2000;
  const m=new T.Matrix4(),endpoints=q.star.crossPairs(s).flat().map((index,i)=>{bolts.getMatrixAt(i*44,m);const start=new T.Vector3(0,-.5,0).applyMatrix4(m);bolts.getMatrixAt(i*44+31,m);const end=new T.Vector3(0,.5,0).applyMatrix4(m);return {fromError:start.distanceTo(tip),toError:end.distanceTo(new T.Vector3().fromArray(q.star.crystalPoint(index)))};});
  q.cameraBounds=()=>{const camera=q.travel.camera,points=[];for(let i=0;i<256;i++){const a=i*Math.PI/128;points.push(new T.Vector3(2000+Math.sin(a)*46.25,0,Math.cos(a)*46.25).project(camera));}return {minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y)),distance:q.travel.starDistance};};
  return {phase1,phase2,phase3,bolts:bolts.count,lightning:bolts.parent.visible,endpoints,bounds:q.cameraBounds()};
 });
 assert.deepEqual(third.phase1,third.phase2);assert.deepEqual(third.phase1,third.phase3);assert.equal(third.bolts,176);assert(third.lightning);assert(third.endpoints.every(p=>p.fromError<.0001&&p.toError<.0001));checks.push(third);
 await page.screenshot({path:output+'phase-3-gold-lightning.png'});
 const flicker=await page.evaluate(()=>{const q=telegraphQA,b=q.travel.scene.getObjectByName('Golden crystal lightning cores'),before=Array.from(b.instanceMatrix.array);q.thirdPose(100960);return Array.from(b.instanceMatrix.array).some((v,i)=>v!==before[i]);});assert(flicker);
 for(const [width,height] of [[1920,1080],[3440,1440],[1280,1024],[844,390],[390,844]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const bounds=await page.evaluate(()=>{telegraphQA.thirdPose();return telegraphQA.cameraBounds();});assert(bounds.minX>-.99&&bounds.maxX<.99&&bounds.minY>-.99&&bounds.maxY<.99);checks.push({width,height,...bounds});
  await page.screenshot({path:output+`phase-3-camera-${width}x${height}.png`});
 }
 await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const route=await page.evaluate(()=>{const q=telegraphQA,s=q.starState;Object.assign(s,{stage:'ricochet-warn',step:5,since:104000,until:105550});q.star.planStarRoute(s,[28,0,-12]);q.star.lockStarFlight(s,[28,0,-12]);q.thirdPose(104700);const u=q.travel.battleView.assault.routes[0].mesh.material.uniforms;return {gold:u.gold.value.getHex(),arrow:u.arrowTint.value.getHex(),lightning:q.travel.scene.getObjectByName('Golden crystal lightning cores').parent.visible};});
 assert.equal(route.gold,third.phase1.gold);assert.equal(route.arrow,third.phase1.arrow);assert(!route.lightning);checks.push(route);await page.screenshot({path:output+'phase-3-shared-gold-route.png'});
 assert.deepEqual(errors,[]);await writeFile(output+'checks.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();}
