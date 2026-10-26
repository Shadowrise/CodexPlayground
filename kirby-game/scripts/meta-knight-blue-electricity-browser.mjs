import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const output=fileURLToPath(new URL('../node_modules/.cache/meta-knight-blue-electricity/',import.meta.url));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],frames=[];
 page.setDefaultTimeout(180000);page.on('pageerror',e=>{errors.push(e.stack);console.error(e.stack);});
 page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text())){errors.push(m.text());console.error(m.text());}});
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.blueQA={THREE,travel:cosmicArena,renderer,sounds,get c(){return character}};'});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5173/');await page.locator('#startup-loader').waitFor({state:'hidden'});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Синее электричество');await page.locator('#start-game').click();await page.waitForFunction(()=>!!window.blueQA?.c);
 console.log('Game loaded');
 await page.evaluate(async()=>{
  const q=blueQA;await q.travel.enter(q.c);await q.sounds.prepareKnightCosmic();q.renderer.setAnimationLoop(null);
  q.c.actor.position.set(2000,0,-2);q.travel.soloNow=1000000;q.travel.startBattle();q.travel.setGodMode(true);q.travel.setPhase(4);
  q.input={forward:false,backward:false,left:false,right:false,jump:false,attack:false};
  q.step=dt=>q.travel.update(dt,q.travel.soloNow/1000,q.c,q.input,0,0,false,false);
  q.go=(stage,f)=>{let frames=0;while(q.travel.battle.stage!==stage&&frames++<2500)q.step(1/60);if(q.travel.battle.stage!==stage)throw Error(`Missing stage ${stage}`);const s=q.travel.battle,target=s.since+(s.until-s.since)*f;while(q.travel.soloNow<target-.001)q.step(Math.min(1/60,(target-q.travel.soloNow)/1000));q.travel.render();};
  q.initialGlErrors=[];for(let i=0;i<8;i++){const error=q.renderer.getContext().getError();if(!error)break;q.initialGlErrors.push(error);}
  q.metrics=()=>{
   const T=q.THREE,v=q.travel.battleView,fx=v.cosmic,charge=v.refuge.charge,s=q.travel.battle,center=charge.group.position;
   let minHeight=Infinity;const matrix=new T.Matrix4(),p=new T.Vector3();
   for(let i=0;i<fx.lightning.hot.count;i++){fx.lightning.hot.getMatrixAt(i,matrix);for(const end of [-.5,.5])minHeight=Math.min(minHeight,p.set(0,end,0).applyMatrix4(matrix).y);}
   const path=v.refuge.gravityPaths[0];
   return {stage:s.stage,height:q.c.actor.position.y,core:fx.lightning.hotMaterial.color.getHexString(),glow:fx.lightning.glowMaterial.color.getHexString(),eyes:q.travel.knight.actor.getObjectByName('Eyes_glow').children.map(o=>o.material?.color?.getHexString()).filter(Boolean),bolts:fx.lightning.hot.count,minHeight,charge:charge.group.visible,radius:charge.radius,chargeCenter:center.toArray(),pullStart:path?.[0]?.toArray(),pullStartRadius:path?.[0]?.distanceTo(center),gravity:v.refuge.gravity.hot.count,glError:q.renderer.getContext().getError()};
  };
 });
 console.log('Arena loaded');
 const shot=async(stage,f,name,label,close=false)=>{
  const metrics=await page.evaluate(({stage,f,close})=>{
   const q=blueQA,T=q.THREE;q.go(stage,f);
   if(close){const camera=q.travel.camera,boss=q.travel.knight.actor,center=q.travel.battleView.refuge.charge.group.getWorldPosition(new T.Vector3()),focus=center.clone().lerp(boss.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,5,0)),.2);q.savedCamera={p:camera.position.clone(),q:camera.quaternion.clone(),fov:camera.fov};camera.position.copy(focus).add(new T.Vector3(13,4,24).applyAxisAngle(T.Object3D.DEFAULT_UP,boss.rotation.y));camera.lookAt(focus);camera.fov=44;camera.updateProjectionMatrix();q.travel.render();}
   return q.metrics();
  },{stage,f,close});assert.equal(metrics.glError,0);console.log(JSON.stringify({name,...metrics}));
  const path=output+name+'.png';await page.screenshot({path});frames.push({...metrics,path,label});
  if(close)await page.evaluate(()=>{const q=blueQA,camera=q.travel.camera;camera.position.copy(q.savedCamera.p);camera.quaternion.copy(q.savedCamera.q);camera.fov=q.savedCamera.fov;camera.updateProjectionMatrix();q.travel.render();});return metrics;
 };
 for(const [stage,f,name,label] of [
  ['cosmic-charge',.8,'01-blue-charge','Синий заряд и глаза перед ударом'],
  ['cosmic-surge',.65,'02-blue-surface','Синие разряды расходятся по арене'],
  ['cosmic-rise',.12,'03-first-ascent','Первый подъём · хвосты обрезаны над полом']
 ]){const m=await shot(stage,f,name,label);assert.equal(m.glow,'215cff');assert(m.eyes.every(c=>c==='53adff'));assert(m.minHeight>=.05);}
 const floorProbe=await page.evaluate(()=>{
  const q=blueQA,T=q.THREE,source=q.travel.battleView.cosmic.group,scene=new T.Scene(),copy=source.clone(true),center=source.getWorldPosition(new T.Vector3());copy.matrixAutoUpdate=false;copy.matrix.copy(source.matrixWorld);scene.add(copy);
  const camera=new T.OrthographicCamera(-70,70,40,-40,.1,300);camera.position.set(center.x,0,center.z+140);camera.lookAt(center.x,0,center.z);
  const target=new T.WebGLRenderTarget(512,256),oldTarget=q.renderer.getRenderTarget(),clear=q.renderer.getClearColor(new T.Color()),alpha=q.renderer.getClearAlpha(),pixels=new Uint8Array(512*256*4);
  q.renderer.setClearColor(0,1);q.renderer.setRenderTarget(target);q.renderer.render(scene,camera);q.renderer.readRenderTargetPixels(target,0,0,512,256,pixels);
  let below=0,above=0;for(let i=0;i<pixels.length;i+=4)if(Math.max(pixels[i],pixels[i+1],pixels[i+2])>2){if(i<512*128*4)below++;else above++;}
  q.renderer.setRenderTarget(oldTarget);q.renderer.setClearColor(clear,alpha);target.dispose();copy.traverse(o=>{if(o instanceof T.InstancedMesh)o.dispose();});q.travel.render();return {below,above,glError:q.renderer.getContext().getError()};
 });assert.equal(floorProbe.below,0,'even the wide camera-facing coronas must not render below the arena');assert(floorProbe.above>100);assert.equal(floorProbe.glError,0);console.log(JSON.stringify({floorProbe}));
 await shot('cosmic-rise',.4,'04-high-ascent','Синие молнии поднимают всех над ареной');
 const flight=await shot('cosmic-flight',.1,'05-arrival','Завершение подъёма');assert.equal(flight.glow,'ffb52b');
 await page.evaluate(()=>{const q=blueQA;q.travel.setPhase(4,3);q.step(0);});
 const start=await shot('cosmic-star-draw',.15,'06-small-orb','Небольшой электрический шар у клинка',true);
 const middle=await shot('cosmic-star-open',.4,'07-growing-orb','Шар растёт, пока игроки летят к звезде',true);
 const full=await shot('cosmic-star-open',.96,'08-charged-orb','Накопленный синий заряд вокруг меча',true);
 const pull=await shot('cosmic-planet-draw',.6,'09-planet-bolt','Из шара выходит молния к большой планете',true);
 assert(start.charge&&middle.charge&&full.charge&&pull.charge);assert(start.radius<middle.radius&&middle.radius<full.radius&&full.radius<pull.radius);assert(Math.abs(pull.pullStartRadius-pull.radius*.96)<.02);
 await shot('cosmic-planet-sweep',.1,'10-planet-hold','Шар удерживает планету синими молниями');
 await page.setViewportSize({width:844,height:390});await page.evaluate(()=>{const q=blueQA;q.renderer.setSize(844,390);q.travel.camera.aspect=844/390;q.travel.camera.updateProjectionMatrix();q.travel.render();});await page.screenshot({path:output+'11-mobile.png'});
 await page.evaluate(()=>{const q=blueQA;q.travel.setPhase(1);q.step(0);q.travel.render();});assert(!await page.evaluate(()=>blueQA.travel.battleView.refuge.charge.group.visible));
 assert.deepEqual(errors,[]);const initialGlErrors=await page.evaluate(()=>blueQA.initialGlErrors);
 const sheet=await browser.newPage({viewport:{width:1440,height:1000}}),selected=frames.filter(f=>['04-high-ascent.png','06-small-orb.png','08-charged-orb.png','09-planet-bolt.png'].some(name=>f.path.endsWith(name))),images=await Promise.all(selected.map(async f=>({...f,src:`data:image/png;base64,${(await readFile(f.path)).toString('base64')}`})));
 await sheet.setContent(`<style>body{margin:0;padding:16px;background:#080d20;color:#e8edff;font:18px system-ui}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}figure{margin:0}img{width:100%}figcaption{padding:8px}</style><div class="grid">${images.map(f=>`<figure><img src="${f.src}"><figcaption>${f.label}</figcaption></figure>`).join('')}</div>`);await sheet.screenshot({path:output+'overview.png',fullPage:true});
 await writeFile(output+'report.json',JSON.stringify({frames,floorProbe,initialGlErrors,errors},null,2));console.log(JSON.stringify({output,floorProbe,initialGlErrors,errors}));
}finally{await browser.close();}
