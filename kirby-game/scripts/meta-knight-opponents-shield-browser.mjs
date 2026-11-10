import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url)),publicDir=resolve(root,'public'),output=resolve(process.env.QA_OUTPUT??resolve(root,'.cache/opponents-shield')),cache=resolve(root,'.cache');
await mkdir(output,{recursive:true});await mkdir(cache,{recursive:true});
// Exercise the actual arena, controllers, views and shared combat without loading the meadow.
await writeFile(resolve(cache,'opponents-shield-qa.html'),'<html><body><script type="module" src="./opponents-shield-qa.ts"></script></body></html>');
await writeFile(resolve(cache,'opponents-shield-qa.ts'),`
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '../src/controller';
import {createPlayerModel} from '../src/player-model';
import {KIRBY_VARIANTS} from '../src/variant-palette';
import {KNIGHT,startKnightBattle,advanceKnightBattle} from '../src/meta-knight-battle';
import {MetaKnightOpponentsView} from '../src/meta-knight-opponents-view';
import {MetaKnightBattleView} from '../src/meta-knight-battle-view';
import {createMetaKnightArena} from '../src/meta-knight-arena';
import '../src/style.css';import '../src/meta-knight-battle.css';
const [kirby,knight]=await Promise.all(['kirby','meta-knight'].map(name=>new GLTFLoader().loadAsync('/models/'+name+'-animated.glb')));
const make=(variant:number)=>{const m=createPlayerModel(kirby,KIRBY_VARIANTS[variant],undefined,false,knight);return new CharacterController(m.model,m.clips);};
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);document.body.append(renderer.domElement);document.body.className='in-meta-knight-arena';
const arena=createMetaKnightArena(renderer),camera=new T.PerspectiveCamera(45,innerWidth/innerHeight,.1,4000),cosmic=new T.Group();arena.scene.add(cosmic);
camera.position.set(2065,90,75);camera.lookAt(2000,0,0);camera.updateMatrixWorld();
const boss=make(18);boss.actor.scale.setScalar(KNIGHT.modelScale);arena.scene.add(boss.actor);
const view=new MetaKnightBattleView(boss,arena.scene,()=>{},()=>{}),opponents=new MetaKnightOpponentsView(make);
const human:any={id:'solo',p:[0,0,-2],yaw:0,available:true,metaKnight:true,variant:18,side:'boss'};
let s:any,now=100000,distance:number[]=[],running:boolean[]=[];
function tick(dt:number){
 const bots=Object.values(s.opponents) as any[],old=bots.map(b=>[...b.p]);now+=dt*1000;
 advanceKnightBattle(s,[human],now);opponents.update(s,arena.scene,cosmic,now,dt);view.update(s,'solo',now,dt,false,'V',true,false,undefined,camera);view.updateParty(s,'solo',[],true);arena.update(now/1000,s,now);
 bots.forEach((b,i)=>{distance[i]+=Math.hypot(b.p[0]-old[i][0],b.p[2]-old[i][2]);if(opponents.characters.get(b.id)?.state==='Run')running[i]=true;});
}
function metrics(){return {stage:s.stage,hp:s.hp,broken:s.brokenCrystals,ms:now-100000,distance:[...distance],running:[...running],bots:(Object.values(s.opponents) as any[]).map(b=>{const c=opponents.characters.get(b.id);return {id:b.id,p:[...b.p],model:!!c,state:c?.state,projection:c?[c.actor.position.x-2000,c.actor.position.y,c.actor.position.z]:null};})};}
(window as any).qa={
 prepare(inside:boolean){
  opponents.clear();human.p=[0,0,-2];s=startKnightBattle([human],'solo',100000);human.p=[30,0,-25];now=100000;distance=[0,0,0];running=[false,false,false];
  Object.assign(s,{phase:3,hp:3,pattern:'star',stage:'shield',step:11,starSequenceVersion:1,since:now,checked:now,until:1e12,from:[0,0,0],to:[0,0,0],activeCrystal:0});
  (Object.values(s.opponents) as any[]).forEach((b,i)=>{const a=Math.PI+(i-1)*.4,r=inside?i*3:11.15;b.variant=[0,5,11][i];b.p=[Math.sin(a)*r,0,Math.cos(a)*r];b.yaw=Math.atan2(-b.p[0],-b.p[2]);b.goal=[...b.p];b.thinkAt=now;b.shoveReady=1e12;});tick(0);return metrics();
 },
 step(ms:number){const end=now+ms;while(now<end&&s.stage==='shield')tick(Math.min(.05,(end-now)/1000));return metrics();},
 metrics,draw(){renderer.render(arena.scene,camera);renderer.render(arena.scene,camera);}
};document.body.dataset.ready='true';
`);
console.log('Compiling the isolated arena fixture.');
const compiled=await build({root,configFile:false,logLevel:'error',build:{write:false,minify:false,target:'es2022',rollupOptions:{input:resolve(cache,'opponents-shield-qa.html')}}});
const files=new Map(compiled.output.map(item=>['/'+item.fileName,Buffer.from(item.type==='chunk'?item.code:item.source)]));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp'};
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let page;const errors=[],checks=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url()),name=url.pathname==='/'?'/.cache/opponents-shield-qa.html':decodeURIComponent(url.pathname);let body=files.get(name);
  if(!body){const path=resolve(publicDir,'.'+name);if(!path.startsWith(publicDir+sep))return route.abort();try{body=await readFile(path);}catch(error){if(error.code==='ENOENT')return route.fulfill({status:404});throw error;}}
  await route.fulfill({contentType:types[extname(name)]??'application/octet-stream',body});
 });
 page=await context.newPage();page.on('pageerror',e=>{errors.push(e.stack);console.log('PAGE ERROR: '+e.stack);});
 page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 console.log('Loading the real arena and GLB models.');await page.goto('http://127.0.0.1:5197/',{waitUntil:'commit'});
 await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:120000});console.log('Arena ready.');
 for(const inside of [false,true]){
  await page.evaluate(inside=>qa.prepare(inside),inside);const frames=[];
  for(let step=0;step<8;step++){
   const metrics=await page.evaluate(step=>{if(step)qa.step(3000);qa.draw();return qa.metrics();},step);
   assert(metrics.bots.every(b=>b.model&&b.projection&&Math.hypot(b.projection[0]-b.p[0],b.projection[2]-b.p[2])<.001),'models must follow authoritative positions');
   if(metrics.stage==='shield')assert(metrics.bots.every(b=>Math.hypot(b.p[0],b.p[2])>=11.149),'no NPC remains inside the dome');
   await page.screenshot({path:resolve(output,`${inside?'inside':'opposite'}-${step}.png`)});frames.push(metrics);
   if(metrics.stage!=='shield')break;
  }
  const last=frames.at(-1);assert.equal(last.stage,'crystal-break');assert.equal(last.hp,2);assert.equal(last.broken,1);
  assert(last.distance.every(d=>d>20));assert(last.running.every(Boolean),'every NPC must visibly run');
  checks.push({inside,frames});console.log(`PASS ${inside?'inside':'opposite'}: all three NPCs run, route around the dome and reach the crystal phase end.`);
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify({checks,errors},null,2));
 console.log(JSON.stringify({output,checks:checks.map(c=>({inside:c.inside,last:c.frames.at(-1)})),errors}));
}catch(error){console.log(JSON.stringify({errors}));if(page)await page.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});throw error;}
finally{await browser.close();}
