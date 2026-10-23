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
 // A real shared-rule slam enters a ring that survives beyond the old 1.25 s.
 const wave=await page.evaluate(()=>{
  const q=telegraphQA,s=q.pose('dash-warn'),a={id:'solo',p:[-41,1.2,0],yaw:0,available:true};
  Object.assign(s,{pattern:'dive',stage:'slam',step:2,hp:8,from:[31,0,0],to:[31,0,0],since:100000,until:100180,checked:100000});
  q.rules.advanceKnightBattle(s,[a],s.until);q.waveState=s;q.waveActor=a;q.wavePose=elapsed=>{const now=s.since+elapsed;q.rules.advanceKnightBattle(s,[a],now);q.camera(true);q.travel.battleView.update(s,'solo',now,0,false,'Q',true,false,undefined,q.travel.camera);q.travel.render();const body=q.travel.scene.getObjectByName('Meta Knight solid golden impact wave');return {stage:s.stage,radius:body.material.uniforms.radius.value,visible:body.parent.visible,life:s.players.solo.hp};};
  return {duration:s.until-s.since,...q.wavePose(3000)};
 });
 assert.equal(wave.stage,'wave');assert(wave.visible&&wave.radius>40&&wave.duration>5500);checks.push(wave);
 await page.screenshot({path:output+'wave-beyond-old-radius.png'});
 const far=await page.evaluate(()=>telegraphQA.wavePose(5200));assert.equal(far.stage,'wave');assert(far.visible&&far.radius>72);assert.equal(far.life,5);checks.push(far);
 await page.screenshot({path:output+'wave-far-edge.png'});
 const expired=await page.evaluate(()=>{const q=telegraphQA;return q.wavePose(q.waveState.until-q.waveState.since);});assert.equal(expired.stage,'open');assert(!expired.visible);checks.push(expired);
 assert.deepEqual(errors,[]);await writeFile(output+'checks.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();}
