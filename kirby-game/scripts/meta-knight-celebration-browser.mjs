import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../',import.meta.url)),output=root+'node_modules/.cache/meta-knight-helper/';await mkdir(output,{recursive:true});await mkdir(root+'.cache',{recursive:true});
await writeFile(root+'.cache/knight-celebration-qa.ts',`
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '/src/controller';
import {createPlayerModel} from '/src/player-model';
import {KIRBY_VARIANTS} from '/src/variants';
import {FollowCamera} from '/src/follow-camera';
import {MetaKnightArenaTravel} from '/src/meta-knight-arena-travel';
import {startKnightBattle,advanceKnightBattle,knightAttack,knightPosition} from '/src/meta-knight-battle';
import {startHelperAbility} from '/src/meta-knight-helper';
import '/src/style.css';
import '/src/meta-knight-player-dash.css';
document.body.className='in-meta-knight-arena';const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);document.body.append(renderer.domElement);
const gltf=await new GLTFLoader().loadAsync('/models/meta-knight-animated.glb'),variant=KIRBY_VARIANTS.find(v=>v[0]==='Meta Knight')!,make=()=>{const rig=createPlayerModel(gltf,variant,undefined,false,gltf);return new CharacterController(rig.model,rig.clips);};
const c=make(),actors=[{id:'hero',p:[0,0,-2] as [number,number,number],yaw:0,available:true},{id:'helper',p:[10,0,0] as [number,number,number],yaw:0,available:true,metaKnight:true,side:'boss' as const}];let state=startKnightBattle(actors,'hero',100000)!,clock=100000;
const profiles=[{id:'hero',name:'Кирби',variant:0,location:'meta-knight-arena' as const,p:[0,0,-2]},{id:'helper',name:'Метакнайт',variant:KIRBY_VARIANTS.indexOf(variant),location:'meta-knight-arena' as const,p:[10,0,0]}];
const travel=new MetaKnightArenaTravel(renderer,new T.Scene(),new FollowCamera(),()=>{},make,{online:()=>true,state:()=>state,id:()=> 'helper',now:()=>clock,actors:()=>actors,profiles:()=>profiles,send:()=>{},win:()=>{},cue:()=>{}});await travel.enter(c);c.actor.position.set(2010,0,0);
function render(now:number){clock=now;renderer.setSize(innerWidth,innerHeight);travel.update(1/60,now/1000,c,{forward:false,left:false,right:false,scheme:'keyboard'},0,0,false,false);travel.render();}
function victory(){state.stage='lost';state.phase=1;state.players.hero.hp=0;state.players.helper.hp=0;state.celebration={at:100000,boss:[-5,0,-6],helpers:{helper:[10,0,0]}};}
function ability(slot:1|2|3,phase=1){state=startKnightBattle(actors,'hero',100000)!;state.phase=phase as 1|4;state.stage='rest';state.until=1e12;state.players.helper.helper!.phase=phase;actors[1].p=[10,phase===4?180:0,0];startHelperAbility(state,actors[1],slot,100000);return state.players.helper.helper!.cast!;}
function storm(phase=1){actors[0].p=[-18,phase===4?180:0,10];actors[1].p=[14,phase===4?180:0,-20];state=startKnightBattle([{...actors[0],p:[0,0,-2]},actors[1]],'hero',100000)!;state.phase=phase as 1|4;state.hp=phase===4?6:12;state.stage=phase===4?'cosmic-recover':'open';state.cosmicPart=1;state.from=state.to=[-15,phase===4?180:0,-10];state.until=100100;state.players.helper.helper!.phase=phase;startHelperAbility(state,actors[1],4,100000);advanceKnightBattle(state,actors,100100);return state.duet!;}
function stormFrame(now:number){advanceKnightBattle(state,actors,now,'hero');render(now);}
function counter(which:'boss'|'helper',offset:number){const now=state.since+offset,p=which==='boss'?knightPosition(state,now):[3.3,state.duet!.floor!,0];actors[0].p=[p[0],p[1],p[2]-(which==='boss'?3.7:2)];actors[0].yaw=0;knightAttack(state,actors[0],now);stormFrame(now+150);return {hp:state.hp,helper:state.players.helper.hp};}
(window as any).preview={renderer,travel,c,render,victory,ability,storm,stormFrame,counter,get state(){return state}};victory();render(103600);document.body.dataset.ready='true';
`);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
try{
 await page.route('**/knight-celebration-qa',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><script type="module" src="/.cache/knight-celebration-qa.ts"></script></body></html>'}));
 await page.goto((process.env.GAME_URL??'http://127.0.0.1:5184')+'/knight-celebration-qa');await page.waitForFunction(()=>document.body.dataset.ready==='true',{},{timeout:180000});
 const snapshots=[];
 for(const [label,time] of [['run',101100],['hug',103600],['skip',109000],['hug-again',115000]]){await page.evaluate(t=>preview.render(t),time);await page.screenshot({path:output+'final-'+label+'.png'});snapshots.push(label);}

 const gait=await page.evaluate(()=>{
  const q=preview,actors=[q.travel.knight,q.c],samples=[];q.victory();
  for(const time of [100800,101000,108150,108400]){
   const calls=[0,0],originals=actors.map(c=>c.updateActivity);actors.forEach((c,i)=>c.updateActivity=function(...args){calls[i]++;return originals[i].apply(this,args)});q.render(time);actors.forEach((c,i)=>c.updateActivity=originals[i]);
   samples.push({time,calls,actors:actors.map(c=>({state:c.state,runTime:c.actions.get('Run').time,foot:c.actor.getObjectByName('Left_foot_pivot').position.toArray()}))});
  }
  return {samples,hearts:!!q.travel.scene.getObjectByName('Meta Knight friendship hearts')};
 });
 assert.equal(gait.hearts,false);for(const sample of gait.samples)assert.deepEqual(sample.calls,[1,1]);for(let i=0;i<2;i++){assert.equal(gait.samples[0].actors[i].state,'Run');assert.equal(gait.samples[1].actors[i].state,'Run');assert.notEqual(gait.samples[0].actors[i].runTime,gait.samples[1].actors[i].runTime);assert(Math.hypot(...gait.samples[2].actors[i].foot.map((v,j)=>v-gait.samples[3].actors[i].foot[j]))>.02);}
 for(const [width,height] of [[390,844],[844,390]]){await page.setViewportSize({width,height});await page.waitForTimeout(150);await page.evaluate(()=>preview.render(103600));await page.screenshot({path:output+'final-hug-'+width+'x'+height+'.png'});const b=await page.locator('#knight-party-hud').boundingBox();assert(b.x>=0&&b.x+b.width<=width&&b.y+b.height<=height);}
 await page.setViewportSize({width:1280,height:800});await page.waitForTimeout(150);
 for(const [slot,phase,label] of [[1,1,'crescent'],[2,1,'dash'],[3,1,'spin'],[1,4,'meteor']]){const cast=await page.evaluate(([slot,phase])=>preview.ability(slot,phase),[slot,phase]);await page.evaluate(t=>preview.render(t),cast.release-200);await page.screenshot({path:output+'final-'+label+'-warning.png'});await page.evaluate(t=>preview.render(t),cast.release+350);await page.screenshot({path:output+'final-'+label+'-active.png'});}
 const health=await page.evaluate(()=>{preview.ability(2);preview.render(100100);return {hero:document.querySelectorAll('.knight-party-hearts:not(.knight-helper-hearts)>span:not(.empty)').length,helper:document.querySelectorAll('.knight-helper-hearts>span:not(.empty)').length,color:getComputedStyle(document.querySelector('.knight-helper-hearts>span')).backgroundImage};});assert.equal(health.hero,8);assert.equal(health.helper,5);assert(health.color.includes('gradient'));
 await page.evaluate(()=>{preview.victory();preview.render(100000)});
 if(!(process.env.SKIP_VIDEO||process.argv.includes('--skip-video'))){const video=await page.evaluate(async()=>{const q=preview,stream=q.renderer.domElement.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:4000000}),chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const complete=new Promise(resolve=>recorder.onstop=resolve),start=performance.now();recorder.start();await new Promise(resolve=>{function frame(){const elapsed=performance.now()-start;q.render(100000+elapsed);if(elapsed<17000)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});recorder.stop();await complete;stream.getTracks().forEach(t=>t.stop());return Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer()));});await writeFile(output+'meta-knights-victory.webm',Buffer.from(video));}
 // The duet is sampled from the same authoritative state machine used by the Worker.
 const duet=await page.evaluate(()=>preview.storm());
 for(const [label,time] of [['gather',duet.at+1000],['raise',duet.gatherUntil+1500],['yellow',duet.gatherUntil+3500],['red',duet.gatherUntil+6350],['wave2',duet.gatherUntil+7500],['wave3',duet.gatherUntil+12000],['recovery',duet.gatherUntil+16000]]){await page.evaluate(t=>preview.stormFrame(t),time);await page.screenshot({path:output+'storm-'+label+'.png'});}
 const opening=await page.evaluate(()=>({big:preview.travel.scene.getObjectByName('Meta Knight available hit target').visible,small:preview.travel.helperViews.get(preview.c).target.group.visible}));assert.deepEqual(opening,{big:true,small:true});
 const hitBig=await page.evaluate(()=>preview.counter('boss',200));assert.deepEqual(hitBig,{hp:11,helper:5});assert.equal(await page.evaluate(()=>preview.travel.helperViews.get(preview.c).target.group.visible),true);await page.screenshot({path:output+'balance-boss-hit.png'});
 const hitSmall=await page.evaluate(()=>preview.counter('helper',1000));assert.deepEqual(hitSmall,{hp:11,helper:4});await page.screenshot({path:output+'balance-both-hit.png'});
 const slots=await page.evaluate(()=>{preview.state.players.hero.hp=7;preview.render(preview.state.since+1300);return {total:document.querySelectorAll('.knight-party-hearts:not(.knight-helper-hearts)>span').length,alive:document.querySelectorAll('.knight-party-hearts:not(.knight-helper-hearts)>span:not(.empty)').length,helperTotal:document.querySelectorAll('.knight-helper-hearts>span').length};});assert.deepEqual(slots,{total:8,alive:7,helperTotal:5});
 for(const [width,height] of [[390,844],[844,390]]){await page.setViewportSize({width,height});await page.waitForTimeout(150);const d=await page.evaluate(()=>preview.storm());await page.evaluate(t=>preview.stormFrame(t),d.gatherUntil+3500);await page.screenshot({path:output+'storm-'+width+'x'+height+'.png'});}
 await page.setViewportSize({width:1280,height:800});await page.waitForTimeout(150);await page.evaluate(()=>preview.storm());
 if(!(process.env.SKIP_VIDEO||process.argv.includes('--skip-video'))){const stormVideo=await page.evaluate(async()=>{const q=preview,stream=q.renderer.domElement.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:4500000}),chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const complete=new Promise(resolve=>recorder.onstop=resolve),start=performance.now();recorder.start();await new Promise(resolve=>{function frame(){const elapsed=performance.now()-start;q.stormFrame(100100+elapsed);if(elapsed<23000)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});recorder.stop();await complete;stream.getTracks().forEach(t=>t.stop());return Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer()));});await writeFile(output+'meta-knights-thunderstorm.webm',Buffer.from(stormVideo));}
 assert.deepEqual(errors,[]);await writeFile(output+'visual-report.json',JSON.stringify({snapshots,gait,health,opening,hitBig,hitSmall,slots,errors},null,2));console.log(JSON.stringify({output,snapshots,health,errors}));
}finally{await browser.close();}
