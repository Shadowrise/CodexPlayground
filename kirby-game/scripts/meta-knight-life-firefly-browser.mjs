import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const cache=fileURLToPath(new URL('../.cache/',import.meta.url)),output=fileURLToPath(new URL('../node_modules/.cache/meta-knight-life-firefly/',import.meta.url));
await mkdir(cache,{recursive:true});await mkdir(output,{recursive:true});
await writeFile(cache+'life-firefly-qa.html','<html><head><link rel="icon" href="data:,"></head><body style="margin:0"><script type="module" src="./life-firefly-qa.ts"></script></body></html>');
await writeFile(cache+'life-firefly-qa.ts',String.raw`
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {CharacterController} from '../src/controller';
import {FollowCamera} from '../src/follow-camera';
import {MetaKnightArenaTravel} from '../src/meta-knight-arena-travel';
import * as rules from '../src/meta-knight-battle';
import * as bugs from '../src/meta-knight-life-firefly';
import {SoundEffects} from '../src/sfx';
import '../src/style.css';
const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
const loader=new GLTFLoader(),[kirby,knight,firefly]=await Promise.all(['kirby','meta-knight','firefly'].map(n=>loader.loadAsync('/models/'+n+'-animated.glb')));
const button=document.createElement('button'),slider=document.createElement('input');slider.value='60';const sounds=new SoundEffects(button,slider),cues=[];
const c=new CharacterController(clone(kirby.scene),kirby.animations),travel=new MetaKnightArenaTravel(renderer,new T.Scene(),new FollowCamera(),()=>{},()=>new CharacterController(clone(knight.scene),knight.animations),{online:()=>false,state:()=>undefined,id:()=>'solo',now:()=>Date.now(),actors:()=>[],send:()=>{},win:()=>{},cue:kind=>{cues.push(kind);sounds.playKnight(kind);},firefly:()=>firefly});
await travel.enter(c);c.actor.position.set(2000,0,-2);travel.soloNow=1000000;travel.startBattle();travel.toggleGodMode();
const input={forward:false,backward:false,left:false,right:false,jump:false,jumpPressed:false,sprint:false,dashHeld:false,attack:false,attackPressed:false};
const q={T,renderer,travel,c,cues,rules,bugs,sounds,input,
 tick(){travel.update(0,travel.soloNow/1000,c,input,0,0,false,false);travel.render();},
 get visitor(){return travel.battleView.lifeFirefly;},
 get s(){return travel.battle;},
 prepare(phase){travel.setPhase(phase,phase===4?2:undefined);let guard=0;while(travel.battle.lifeFirefly?.phase!==phase&&guard++<100){travel.soloNow=travel.battle.until;this.tick();}if(guard>=100)throw Error('no visitor');travel.soloNow=travel.battle.lifeFirefly.at+6500;this.tick();},
 close(){const p=this.visitor.carrier.getWorldPosition(new T.Vector3()),yaw=this.visitor.carrier.rotation.y+1.9;travel.camera.position.copy(p).add(new T.Vector3(Math.sin(yaw)*6,3.4,Math.cos(yaw)*6));travel.camera.lookAt(p.clone().add(new T.Vector3(0,1,0)));travel.camera.updateMatrixWorld();travel.render();},
 resize(){renderer.setSize(innerWidth,innerHeight);this.tick();},
};window.lifeQA=q;q.tick();
`);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text()+' '+m.location().url);});
 await page.goto((process.env.GAME_URL??'http://127.0.0.1:5173')+'/.cache/life-firefly-qa.html');await page.waitForFunction(()=>!!window.lifeQA,null,{timeout:120000});
 await page.evaluate(()=>lifeQA.sounds.unlock());
 for(const phase of [1,2,3,4]){
  await page.evaluate(phase=>lifeQA.prepare(phase),phase);
  const state=await page.evaluate(()=>({phase:lifeQA.s.phase,visitor:lifeQA.s.lifeFirefly.phase,visible:lifeQA.visitor.group.visible,heart:!!lifeQA.visitor.heart.model.getObjectByName('Health_heart_body'),altitude:lifeQA.visitor.carrier.position.y,color:lifeQA.s.lifeFirefly.color}));
  assert.equal(state.visitor,phase);assert(state.visible&&state.heart);assert(state.altitude>=(phase===4?180:0));checks.push(state);
  await page.screenshot({path:output+`phase-${phase}.png`});
  if(phase===3||phase===4){await page.evaluate(()=>lifeQA.close());await page.screenshot({path:output+(phase===3?'carried-heart-close.png':'cosmic-heart-close.png')});}
 }
 // Attack the actual visitor in the cosmic arena, using the normal input route.
 const hit=await page.evaluate(()=>{
  const q=lifeQA,s=q.s,now=q.travel.soloNow;s.players.solo.hp=5;const point=q.bugs.knightLifeFireflyPoint(s,now+160);q.c.actor.position.set(2000+point[0],180,point[2]+2);q.c.yaw=Math.PI;q.c.actor.rotation.y=Math.PI;
  q.input.attack=q.input.attackPressed=true;q.tick();q.input.attack=q.input.attackPressed=false;q.travel.soloNow+=160;q.tick();q.close();
  q.sounds.updateFireflyBuzz(q.travel.fireflyBuzz(q.c.actor.getWorldPosition(new q.T.Vector3())));
  return {hp:s.players.solo.hp,hit:!!s.lifeFirefly.hit,heartParent:q.visitor.heart.group.parent.name,buzz:q.travel.fireflyBuzz(q.c.actor.getWorldPosition(new q.T.Vector3())),cues:q.cues.filter(c=>c==='life-firefly-hit').length,bonus:document.querySelector('.knight-party-bonus').textContent};
 });
 assert.equal(hit.hp,6);assert(hit.hit);assert.equal(hit.buzz,0);assert.equal(hit.cues,1);assert.equal(hit.bonus,'+1 ♥');await page.screenshot({path:output+'heart-drop.png'});checks.push(hit);
 await page.evaluate(()=>{lifeQA.travel.soloNow+=350;lifeQA.tick();lifeQA.close();});await page.screenshot({path:output+'heart-drop-fall.png'});
 await page.setViewportSize({width:320,height:740});await page.evaluate(()=>{lifeQA.s.players.solo.hp=9;lifeQA.resize();});
 const mobile=await page.evaluate(()=>{const p=document.querySelector('#knight-party-hud').getBoundingClientRect();return {x:p.x,right:p.right,width:p.width,scroll:document.querySelector('#knight-party-hud').scrollWidth,bonus:document.querySelector('.knight-party-bonus').textContent};});assert(mobile.x>=0&&mobile.right<=320);assert(mobile.scroll<=mobile.width+1);assert.equal(mobile.bonus,'+4 ♥');await page.screenshot({path:output+'mobile-bonus.png'});checks.push(mobile);
 await page.evaluate(()=>{const q=lifeQA;q.travel.soloNow=q.s.lifeFirefly.hit.at+1200;q.tick();});assert(await page.evaluate(()=>!lifeQA.visitor.group.visible));
 await page.evaluate(()=>lifeQA.travel.leave());assert(await page.evaluate(()=>!document.querySelector('#knight-party-hud')));
 assert.deepEqual(errors,[]);await writeFile(output+'report.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({output,checks,errors}));
}finally{await browser.close();}
