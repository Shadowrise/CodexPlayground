import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {extname,resolve,sep} from 'node:path';
import {build} from 'vite';

const root=fileURLToPath(new URL('../',import.meta.url)),cache=resolve(root,'.cache'),publicDir=resolve(root,'public');
const output=fileURLToPath(new URL('../node_modules/.cache/metapidgie-combat-regressions/',import.meta.url));
await Promise.all([mkdir(output,{recursive:true}),mkdir(cache,{recursive:true})]);
// Compile a snapshot of the real travel/controller/view code. Development hot
// reloads elsewhere in the workspace cannot interrupt this arena regression.
await writeFile(resolve(cache,'metapidgie-combat-qa.html'),'<html><body><script type="module" src="./metapidgie-combat-qa.ts"></script></body></html>');
await writeFile(resolve(cache,'metapidgie-combat-qa.ts'),`
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '../src/controller';
import {createPlayerModel} from '../src/player-model';
import {KIRBY_VARIANTS} from '../src/variant-palette';
import {FollowCamera} from '../src/follow-camera';
import {MetaKnightArenaTravel} from '../src/meta-knight-arena-travel';
import {startHelperAbility} from '../src/meta-knight-helper';
import {advanceKnightBattle} from '../src/meta-knight-battle';
import '../src/style.css';import '../src/meta-knight-battle.css';
const names=['kirby','meta-knight','metapidgie','pigeon','snowball','ugolyok','ryzhik','kurlyk'];
const models=Object.fromEntries(await Promise.all(names.map(async n=>[n,await new GLTFLoader().loadAsync('/models/'+n+'-animated.glb')])));
const plumages={metapidgie:models.metapidgie,pidgie:models.pigeon,snowball:models.snowball,ugolyok:models.ugolyok,ryzhik:models.ryzhik,kurlyk:models.kurlyk};
const make=(variant:number)=>{const m=createPlayerModel(models.kirby,KIRBY_VARIANTS[variant],models.pigeon,false,models['meta-knight'],models.snowball,plumages);return new CharacterController(m.model,m.clips);};
const c=make(23),renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.append(renderer.domElement);document.body.className='in-meta-knight-arena';
const travel=new MetaKnightArenaTravel(renderer,new THREE.Scene(),new FollowCamera(),()=>{},boss=>make(boss==='metapidgie'?23:18),{
 boss:()=>'metapidgie',online:()=>false,state:()=>undefined,id:()=>'solo',now:()=>Date.now(),actors:()=>[],send:()=>{},win:()=>{},cue:()=>{},makeOpponent:make,
 profiles:()=>[{id:'solo',name:'Мета Пиджи QA',variant:23,location:'meta-knight-arena',p:[c.actor.position.x-2000,c.actor.position.y,c.actor.position.z]}]
});
(window as any).combatQA={THREE,renderer,travel,c,startHelperAbility,advanceKnightBattle};
document.body.dataset.ready='true';
`);
console.log('Compiling the real arena regression fixture');
const compiled=await build({root,configFile:false,logLevel:'error',build:{write:false,minify:false,target:'es2022',rollupOptions:{input:resolve(cache,'metapidgie-combat-qa.html')}}});
const files=new Map(compiled.output.map(item=>['/'+item.fileName,Buffer.from(item.type==='chunk'?item.code:item.source)]));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp'};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>{errors.push(e.stack);console.error(e.stack);});
 page.on('console',m=>{if(m.type()==='error'&&/WebGL|shader|THREE/i.test(m.text()))errors.push(m.text());});
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url()),name=url.pathname==='/'?'/.cache/metapidgie-combat-qa.html':decodeURIComponent(url.pathname);let body=files.get(name);
  if(!body){const path=resolve(publicDir,'.'+name);if(!path.startsWith(publicDir+sep))return route.abort();try{body=await readFile(path);}catch(error){if(error.code==='ENOENT')return route.fulfill({status:404});throw error;}}
  await route.fulfill({contentType:types[extname(name)]??'application/octet-stream',body});
 });
 await page.goto('http://127.0.0.1:5216/',{waitUntil:'commit'});
 await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:120000});
 await page.evaluate(async()=>{
  const q=combatQA;await q.travel.enter(q.c);if(!q.travel.active)throw Error('Arena loading failed: '+q.travel.overlay.innerText);
  q.empty={forward:false,left:false,right:false};q.tick=(dt=1/60)=>q.travel.update(dt,1,q.c,q.empty,0,0,false,false);
  q.c.actor.position.set(2000,0,-2);q.travel.startBattle();q.travel.chooseSide('boss');q.tick();
  q.s=q.travel.battle;for(const p of Object.values(q.s.players))p.invulnerable=1e12;
  q.feet=c=>{c.actor.updateWorldMatrix(true,true);return ['Left_foot','Right_foot'].map(n=>{const foot=c.actor.getObjectByName(n);return foot?new q.THREE.Box3().setFromObject(foot).min.y:null;});};
  q.photo=(x,y,z,fx,fy,fz)=>{q.travel.camera.position.set(x,y,z);q.travel.camera.lookAt(fx,fy,fz);q.travel.camera.updateMatrixWorld();q.travel.render();};
 });
 console.log('Entered the real Meta Pidgie arena');
 const gather=await page.evaluate(()=>{
  const q=combatQA,{startHelperAbility,advanceKnightBattle}=q;
  const result=[];
  for(const phase of [1,2,3,4]){
   const y=phase===4?180:0,s=q.s;delete s.duet;delete s.cosmicRefuge;delete s.cosmicMeteor;s.players.solo.helper={cooldowns:[0,0,0,0],phase};
   Object.assign(s,{phase,hp:phase===3?3:phase===4?6:12,stage:phase===4?'cosmic-recover':'open',pattern:'leap',since:q.travel.soloNow,until:q.travel.soloNow+100,checked:q.travel.soloNow,from:[-12,y,-12],to:[-12,y,-12],height:0});
   q.c.actor.position.set(2027,phase===4?180:2.9,-18);q.c.setActivity('Fly');q.c.updateActivity(.3);
   const a=q.travel.localActor(q.c);if(!startHelperAbility(s,a,4,q.travel.soloNow))throw Error('ability four rejected');
   advanceKnightBattle(s,[a],s.until);if(s.stage!=='duet-gather')throw Error('gather not started: '+phase+' / '+s.stage);q.travel.soloNow=s.since;
   const samples=[];
   for(let i=0;i<90;i++){q.tick();if(i%15===14)samples.push({boss:q.travel.knight.actor.position.y,helper:q.c.actor.position.y,bossFeet:q.feet(q.travel.knight),helperFeet:q.feet(q.c)});}
   result.push({phase,stage:s.stage,samples,action:q.travel.battleView.key});
  }
  return result;
 });
 await page.evaluate(()=>{const q=combatQA,d=q.travel.cosmicFrame.position;q.photo(2015+d.x,190,30+d.z,2000+d.x,185,d.z);});
 await page.screenshot({path:output+'cosmic-gather.png'});
 const stars=await page.evaluate(()=>{
  const q=combatQA,result=[],duet=structuredClone(q.s.duet);
  for(const [phase,stage] of [[1,'stunned'],[3,'crystal-break'],[4,'cosmic-hit'],[4,'cosmic-star-stun'],[4,'duet-recover']]){
   const s=q.s,y=phase===4?180:0;Object.assign(s,{phase,stage,since:q.travel.soloNow,until:q.travel.soloNow+3000,checked:q.travel.soloNow,from:[0,y,0],to:[0,y,0],cosmicRefuge:{at:q.travel.soloNow,angle:0,world:0,contacts:{}}});
   if(stage==='duet-recover'){s.duet={...duet,stage:'recover',floor:y,bossHit:q.travel.soloNow};}else delete s.duet;
   q.tick();const head=q.travel.knight.actor.getObjectByName('Head').getWorldPosition(new q.THREE.Vector3()),stars=q.travel.scene.getObjectByName('Meta Pidgey golden dizziness stars');
   const centre=stars.getWorldPosition(new q.THREE.Vector3());result.push({phase,stage,visible:stars.visible,offset:centre.sub(head).toArray()});
  }
  return result;
 });
 await page.evaluate(()=>{const q=combatQA,p=q.travel.knight.actor.getWorldPosition(new q.THREE.Vector3());q.photo(p.x+16,p.y+11,p.z+26,p.x,p.y+6,p.z);});
 await page.screenshot({path:output+'cosmic-dazed.png'});
 const lightning=await page.evaluate(()=>{
  const q=combatQA,s=q.s;delete s.duet;Object.assign(s,{phase:4,stage:'cosmic-surge',since:q.travel.soloNow,until:q.travel.soloNow+1900,checked:q.travel.soloNow,from:[0,0,0],to:[0,0,0]});
  const v=q.travel.battleView.cosmic,arc=v.lightning.arc,groundEnergy=[];v.lightning.arc=function(...args){if(args[2]>=931&&args[2]<943)groundEnergy.push(args[8]??1);return arc.apply(this,args);};
  q.travel.soloNow+=800;q.tick();v.lightning.arc=arc;
  return {opacity:v.lightning.hotMaterial.opacity,groundEnergy};
 });
 await page.evaluate(()=>{const q=combatQA;q.photo(2026,30,34,2000,0,0);});await page.screenshot({path:output+'ground-lightning.png'});
 const report={gather,stars,lightning,errors};await writeFile(output+'report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({output,gather:gather.map(({phase,stage,action})=>({phase,stage,action})),stars,lightning,errors}));
 if(!process.argv.includes('--baseline')){
  assert.deepEqual(errors,[]);
  for(const row of gather){assert.equal(row.stage,'duet-gather');for(const sample of row.samples){assert.equal(sample.boss,row.phase===4?180:0);assert.equal(sample.helper,row.phase===4?180:0);assert(sample.bossFeet.every(Number.isFinite));assert(sample.helperFeet.every(Number.isFinite));if(row.phase<4){assert(Math.min(...sample.bossFeet)<.08,'one boss foot stays planted');assert(Math.min(...sample.helperFeet)<.03,'one helper foot stays planted');}else{assert(Math.abs(sample.bossFeet[0]-sample.bossFeet[1])<.01,'the boss flies instead of running in space');}}if(row.phase===4)assert.match(row.action,/Boss_cosmic-flight/);}
  for(const row of stars){assert(row.visible,row.stage);assert(Math.hypot(row.offset[0],row.offset[2])<.001,JSON.stringify(row));assert(Math.abs(row.offset[1]+5.8)<.001,JSON.stringify(row));}
  assert.equal(lightning.groundEnergy.length,12);assert(lightning.groundEnergy.every(e=>Math.abs(e-1)<1e-6));
 }
}catch(error){
 const page=browser.contexts()[0]?.pages()[0];if(page){await page.screenshot({path:output+'failure.png'}).catch(()=>{});console.error(await page.evaluate(()=>({url:location.href,qa:!!window.combatQA,text:document.body.innerText.slice(-2000)})).catch(()=>null));}
 console.error(errors);throw error;
}finally{await browser.close();}
