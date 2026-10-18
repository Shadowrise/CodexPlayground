import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const output=fileURLToPath(new URL('../node_modules/.cache/meta-knight-polish/',import.meta.url));await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],frames=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.polishQA={THREE,travel:cosmicArena,renderer,get c(){return character}};'});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5194/');await page.waitForFunction(()=>!!window.polishQA,null,{timeout:180000});await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Дуэлянт');await page.locator('#start-game').click();await page.waitForFunction(()=>!!polishQA.c);
 await page.evaluate(async()=>{
  const q=polishQA;await q.travel.enter(q.c);q.renderer.setAnimationLoop(null);q.c.actor.position.set(1987,0,7);
  q.KNIGHT=(await import('/src/meta-knight-battle.ts')).KNIGHT;
  q.cues=[];const cue=q.travel.battleView.cue;q.travel.battleView.cue=kind=>{q.cues.push(kind);cue(kind);};
  q.travel.camera.position.set(2019,22,22);q.travel.camera.lookAt(2000,3,-5);q.travel.camera.updateMatrixWorld();
  q.pose=(stage,step,f,phase=1)=>{
   const duration={intro:3000,approach:900,slash:250,jump:850,slam:180,open:4000,shot:1800,'shot-warn':1100,'dive-warn':1920,dive:450,dash:700}[stage]??1600;
   const impact=['jump-warn','jump','slam'].includes(stage)||stage==='open'&&step===2,crescent=stage.startsWith('shot'),dash=stage.startsWith('dash');
   const s={id:7000,revision:step+1,stage,step,since:10000,until:10000+duration,checked:10000,phase,hp:12,players:{solo:{hp:5,hits:0,reflects:0}},target:'solo',from:stage==='slam'||stage==='open'&&step===2?[0,0,4]:[0,stage==='shot'||dash?q.KNIGHT.hoverHeight:0,-9],to:impact?[0,0,4]:crescent?[0,0,15]:dash?[0,0,20]:[0,0,-9],yaw:0,height:crescent||dash?q.KNIGHT.hoverHeight:0,cycle:1,pattern:crescent?'crescent':impact?'leap':dash?'flight':'sword',openHit:false};
   q.travel.battleView.update(s,'solo',s.since+duration*f,0,false,'Q',true);q.travel.battleView.update(s,'solo',s.since+duration*f,0,false,'Q',true);q.travel.render();const T=q.THREE;
   const blade=q.travel.knight.actor.getObjectByName('Galaxia'),tip=blade.localToWorld(new T.Vector3(-.315,2.05,0));
   const hilt=blade.getWorldPosition(new T.Vector3()),contact=hilt.clone().lerp(tip,-hilt.y/(tip.y-hilt.y));
   const support=blade.localToWorld(new T.Vector3(0,-.23,.025)),hand=q.travel.knight.actor.getObjectByName('Left_gauntlet').getWorldPosition(new T.Vector3());
   const projectile=q.travel.scene.getObjectByName('Galaxia solid crescent and magical wake'),solid=projectile.getObjectByName('Solid golden beveled crescent');
   const sector=q.travel.scene.getObjectByName('Meta Knight sword wind-up countdown'),circle=q.travel.scene.getObjectByName('Meta Knight impact countdown');
   const lane=q.travel.scene.getObjectByName('Meta Knight dash countdown lane');
   const gold=blade.children.find(o=>o instanceof T.Mesh&&o.material.emissive&&o.material.name.includes('gold'));
   const count=document.querySelector('#knight-battle-countdown'),r=count.getBoundingClientRect();
   return {stage,step,f,tip:tip.toArray(),bladeEmission:gold.material.emissiveIntensity,lane:{visible:lane.visible,progress:lane.material.uniforms.progress.value},swordDirection:tip.clone().sub(hilt).normalize().toArray(),sparks:q.travel.scene.getObjectByName('Meta Knight flying sword sparks').visible,impactError:Math.hypot(contact.x-2000-s.to[0],contact.z-s.to[2]),handError:hand.distanceTo(support),boss:q.travel.knight.actor.position.toArray(),sector:{visible:sector.visible,progress:sector.material.uniforms.progress.value,direction:sector.material.uniforms.direction.value},circle:{visible:circle.visible,progress:circle.material.uniforms.progress.value},count:count.hidden?'':count.textContent,countCentre:[r.x+r.width/2,r.y+r.height/2],projectile:projectile.visible,projectileY:projectile.position.y,projectileNormal:new T.Vector3(0,0,1).transformDirection(solid.matrixWorld).toArray(),stars:q.travel.scene.getObjectByName('Meta Knight golden dizziness stars').visible,arrows:[0,1,2].map(i=>{const a=q.travel.scene.getObjectByName('Meta Knight danger arrow '+i);return {position:a.getWorldPosition(new T.Vector3()).toArray(),forward:new T.Vector3(0,1,0).transformDirection(a.matrixWorld).toArray()};})};
  };
 });
 for(const [stage,step,f,label,group] of [
  ['intro',-1,0,'3','count'],['intro',-1,1/3,'2','count'],['intro',-1,2/3,'1','count'],['approach',-1,0,'FIGHT','count'],
  ['slash-warn',0,.25,'Forehand · 25%','sector'],['slash-warn',0,.5,'Forehand · 50%','sector'],['slash-warn',0,1,'Forehand · ready','sector'],
  ['slash-warn',2,.25,'Backhand · 25%','sector'],['slash-warn',2,.5,'Backhand · 50%','sector'],['slash-warn',2,1,'Backhand · ready','sector'],
  ['jump-warn',0,.8,'Two-handed wind-up','motion'],['jump',1,.25,'Both hands lift the sword','motion'],['jump',1,.8,'Sword reversal and plunge','motion'],
  ['open',2,.01,'Impact · guard already open','motion'],['open',2,.6,'Seated · boots meet body','motion'],
  ['shot-warn',0,1,'Horizontal crescent wind-up','motion'],['shot',1,220/1800,'Flat sword cut · release','motion'],['shot',1,.3,'Wide crescent along the ground','motion'],
  ['dash-warn',0,.25,'Dash countdown · 25%','motion'],['dash-warn',0,.5,'Dash countdown · 50%','motion'],['dash-warn',0,1,'Dash countdown · ready','motion'],['dash',1,.35,'Glowing forward blade and sparks','motion'],
 ]){
  const metrics=await page.evaluate(({stage,step,f})=>polishQA.pose(stage,step,f),{stage,step,f}),path=output+`${frames.length}-${stage}.png`;
  if(stage==='intro'||stage==='approach'){assert.equal(metrics.count,stage==='intro'?label:'БОЙ!');assert(Math.abs(metrics.countCentre[0]-640)<1&&Math.abs(metrics.countCentre[1]-450)<1);}
  if(stage==='slash-warn'){assert.equal(metrics.sector.progress,f);assert.equal(metrics.sector.direction,step<2?-1:1);}
  if(stage==='open')assert(metrics.stars&&!metrics.sector.visible&&(f<.045?metrics.circle.visible:!metrics.circle.visible));
  if(stage==='open'&&f<.045)assert(metrics.impactError<.05,'the held sword enters the target centre');
  if(stage==='jump'||stage==='jump-warn'||stage==='open'&&f<.045)assert(metrics.handError<.001,'both hands hold the sword');
  if(stage==='slam')assert.equal(metrics.circle.progress,1);
  if(stage==='shot'){assert(metrics.projectile);assert.equal(metrics.projectileY,1.2);assert(Math.abs(metrics.projectileNormal[1])>.999);assert.equal(metrics.boss[1],1.2);assert(Math.abs(metrics.tip[1]-1.2)<.001,'horizontal cut stays at the release height');}
  if(stage==='dash'){assert(metrics.sparks);assert(metrics.swordDirection[2]>.995,'sword points forward');}else assert(!metrics.sparks);
  if(stage.startsWith('dash')){assert(metrics.lane.visible);assert.equal(metrics.lane.progress,stage==='dash'?1:f);}
  assert(metrics.bladeEmission>.7,'gold stays lit even in shadow');
  await page.screenshot({path});frames.push({...metrics,label,group,path});
 }
 const arrows=await page.evaluate(()=>{
  const q=polishQA,results=[];for(const step of [1,3]){
   const a=q.pose('slash',step,.49),b=q.pose('slash',step,.51),dx=b.tip[0]-a.tip[0],dz=b.tip[2]-a.tip[2],direction=Math.sign((a.tip[2]-a.boss[2])*dx-(a.tip[0]-a.boss[0])*dz);
   const warn=q.pose('slash-warn',step-1,.5);results.push(warn.arrows.map(arrow=>{const x=arrow.position[0]-warn.boss[0],z=arrow.position[2]-warn.boss[2],r=Math.hypot(x,z);return (arrow.forward[0]*z-arrow.forward[2]*x)*direction/r;}));
  }return results;
 });for(const values of arrows)for(const dot of values)assert(dot>.999,'every ground arrow follows the actual blade velocity');
 const release=await page.evaluate(()=>({before:polishQA.pose('shot',1,.1).projectile,after:polishQA.pose('shot',1,.14).projectile}));assert(!release.before&&release.after);
 const phaseCounts=await page.evaluate(()=>[2,3].map(phase=>polishQA.pose('approach',-1,0,phase).count));assert.deepEqual(phaseCounts,['','']);
 const countdownSounds=await page.evaluate(()=>polishQA.cues.filter(k=>k==='count'||k==='start'));assert.deepEqual(countdownSounds,['count','count','count','start'],'each visible beat sounds once, with no replay at phase changes');
 for(const group of ['count','sector','motion']){
  const sheet=await browser.newPage({viewport:{width:1536,height:1000}}),images=await Promise.all(frames.filter(f=>f.group===group).map(async f=>({...f,src:`data:image/png;base64,${(await readFile(f.path)).toString('base64')}`})));
  await sheet.setContent(`<html><style>*{box-sizing:border-box}body{margin:0;padding:16px;background:#101628;color:#fff;font:16px system-ui}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}figure{margin:0;background:#1f2844;border-radius:10px;overflow:hidden}img{display:block;width:100%}figcaption{padding:8px 12px}h1{margin:0 0 12px;font-size:24px}</style><h1>Meta Knight · ${group}</h1><div class="grid">${images.map(f=>`<figure><img src="${f.src}"><figcaption>${f.label}</figcaption></figure>`).join('')}</div></html>`);
  await sheet.screenshot({path:output+group+'-contact-sheet.png',fullPage:true});await sheet.close();
 }
 assert.deepEqual(errors,[]);await writeFile(output+'report.json',JSON.stringify({arrows,release,phaseCounts,countdownSounds,frames,errors},null,2));console.log(JSON.stringify({output,arrows,release,phaseCounts,countdownSounds,errors}));
}finally{await browser.close();}
