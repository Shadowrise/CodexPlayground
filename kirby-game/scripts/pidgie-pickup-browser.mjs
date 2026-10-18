import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const game=fileURLToPath(new URL('../',import.meta.url));
const base=process.env.GAME_URL??'http://127.0.0.1:5200';
let vite,browser;
try{
 if(!process.env.GAME_URL)vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5200','--strictPort'],{cwd:game,stdio:'ignore',windowsHide:true});
 for(let attempt=0;;attempt++){
  try{if((await fetch(base)).ok)break;}catch{}
  if(attempt>300)throw Error('Vite did not start');
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 for(const size of [1,7]){
  const page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
  await page.route('**/room',route=>route.fulfill({json:{players:0,occupiedVariants:[],capacity:16}}));
  await page.route('**/history/solo',route=>route.fulfill({json:{ok:true}}));
  await page.route('**/src/main.ts*',async route=>{
   const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`
window.pickupQA={bread,renderer,camera,cameraTarget,followCamera,pidgieSafeGround,pidgieSafeWalk,resolveInteraction,sendBread,
 get c(){return character},get bird(){return pidgieNpc},
 give(){bread.state=grantBread(bread.state,breadActor(character),Date.now());},
 canPick(){return canPickBread(bread.state,breadActor(character),Date.now(),pidgieNpc?.networkState());}};
`});
  });
  await page.goto(base);
  await page.waitForFunction(()=>window.pickupQA&&!document.querySelector('#start-game').disabled,undefined,{timeout:120000});
  await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Пекарь');await page.locator('#start-game').click();
  await page.waitForFunction(()=>window.pickupQA?.c&&pickupQA.bird);
  await page.evaluate(size=>{
   const w=pickupQA,c=w.c,b=w.bird;let site;
   for(let z=-140;z<=140&&!site;z+=20)for(let x=-140;x<=140&&!site;x+=20){
    if(Array.from({length:25},(_,i)=>w.pidgieSafeGround(x,z-3+i*.5)&&w.pidgieSafeWalk(x,z-3+i*.5)).every(Boolean))site=[x,z];
   }
   if(!site)throw Error('No clear feeding site');
   c.setActivity('Idle');c.resizeTo(size,true);c.actor.position.set(site[0],0,site[1]);c.surfaceY=0;c.yaw=0;c.actor.rotation.set(0,0,0);
   const snapshot=b.networkState();w.before=snapshot;
   b.applyNetworkState({...snapshot,phase:'wander',p:[site[0],0,site[1]+8],elapsed:0,refuge:[site[0],site[1]+8],target:[site[0],site[1]+8],clip:'Idle',clipTime:0,pause:30,cooldown:30,followId:undefined,followSpeed:undefined},true);
   w.cameraTarget.copy(c.actor.position);w.cameraTarget.y+=.9*size;w.followCamera.reset(0);w.give();
  },size);
  await page.waitForFunction(()=>pickupQA.resolveInteraction(pickupQA.c)?.text==='E — Угостить дикого Пиджи');
  await page.keyboard.press('e');await page.waitForFunction(()=>pickupQA.bird.phase==='toBread');
  const running=await page.evaluate(()=>{
   const w=pickupQA,food=w.bread.state.offering.bread;
   w.c.actor.position.fromArray(food);w.c.surfaceY=food[1];
   const before=w.bird.networkState();
   w.hiddenAccepted=w.bird.applyNetworkState({...w.before,phase:'hidden'},true);
   w.marker=w.bread.state.offering;delete w.bread.state.offering;
   const reserved=!w.canPick();w.sendBread({kind:'pick'});
   return {phase:before.phase,clip:before.clip,owner:w.bread.state.owner,reserved,hiddenAccepted:w.hiddenAccepted};
  });
  assert.deepEqual(running,{phase:'toBread',clip:'Run',owner:'',reserved:true,hiddenAccepted:false});
  // Leave the character in automatic pickup range through the complete run.
  await page.waitForFunction(()=>pickupQA.bird.phase==='feast');
  await page.waitForTimeout(2400);
  const result=await page.evaluate(async()=>{
   const w=pickupQA,T=await import('/node_modules/.vite/deps/three.js');
   const bounds=new T.Box3().setFromObject(w.bird.model);
   w.bread.state.offering=w.marker;
   return {owner:w.bread.state.owner,phase:w.bird.phase,visible:w.bird.actor.visible,canPick:w.canPick(),finite:bounds.min.toArray().concat(bounds.max.toArray()).every(Number.isFinite),height:bounds.max.y-bounds.min.y};
  });
  assert.equal(result.owner,'');assert.equal(result.phase,'feast');assert(result.visible&&!result.canPick&&result.finite&&result.height>.1);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({size,running,result,errors}));await page.close();
 }
}finally{await browser?.close();vite?.kill();}
