import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const pigeon=process.env.FRUIT_PLAYER==='pigeon';

const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');localStorage.setItem('kirby-pidgie-unlocked-v1','1');});
 await page.route('**/room',route=>route.fulfill({json:{players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/history/solo',route=>route.fulfill({json:{ok:true}}));
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch(),body=await response.text();
  assert(body.includes('renderer.setAnimationLoop('));
  // Drive the real game loop at a fixed cadence, including every attraction.
  await route.fulfill({response,body:body.replace('renderer.setAnimationLoop(','window.fruitFrame=(')+`
window.fruitCheck={fruits,bread,fountain,home,renderer,get c(){return character},step(seconds){for(let i=0;i<Math.round(seconds*20);i++)window.fruitFrame(previousTime+50)}};
`});
 });
 await page.goto(process.env.KIRBY_URL??'http://127.0.0.1:5174/');
 await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.locator('#new-game').click();if(pigeon)await page.locator('#variant-grid .pigeon-character').click();await page.locator('#player-name-input').fill('Фрукты');await page.locator('#start-game').click();
 await page.waitForFunction(()=>!!window.fruitCheck?.c);
 assert.equal(await page.evaluate(()=>window.fruitCheck.c.isPigeon),pigeon);
 const result=await page.evaluate(()=>{
  const m=window.fruitCheck,c=m.c;
  // Rendering is irrelevant to these accelerated gameplay and HUD checks.
  m.renderer.render=()=>{};
  m.fruits.fruits.forEach((fruit,i)=>fruit.object.position.set(500+i,0,500));
  c.resizeTo(1,true);
  const state=()=>({size:c.savedSize,speed:c.speed,bonus:c.fruitBoost.multiplier,remaining:c.fruitBoost.remaining,fruits:c.fruitsEaten});
  const collect=index=>{const fruit=m.fruits.fruits[index];fruit.object.position.copy(c.actor.position);for(let i=0;i<60&&!fruit.eaten;i++)m.step(.05);if(!fruit.eaten)throw Error('Fruit was not swallowed');return state();};
  const first=collect(0);m.step(10);const halfway=state();
  const second=collect(1);
  for(let i=2;i<=10;i++)collect(i);
  const capped=state();m.step(20);const expired=state(),hidden=document.querySelector('#fruit-speed').hidden;
  c.resizeTo(3,true);collect(11);const grown=state();
  c.actor.position.copy(m.fountain.group.position);c.actor.position.x+=6;c.surfaceY=0;
  m.step(1);const bath=state();m.step(14);const small=state();
  const smallFruit=collect(12),hud=document.querySelector('#fruit-speed').textContent;
  c.setActivity('Idle');c.swimming=false;c.surfaceY=0;c.actor.position.copy(m.home.entrance);
  const resting=m.home.start(c);m.step(20);
  return {first,halfway,second,capped,expired,hidden,grown,bath,small,smallFruit,hud,resting,afterRest:state(),homeActive:m.home.active};
 });
 assert.equal(result.first.size,1);assert.equal(result.first.bonus,1.2);
 assert(Math.abs(result.halfway.remaining-10)<1e-7);assert.equal(result.halfway.bonus,1.2);
 assert.equal(result.second.bonus,1.4);assert(result.second.remaining>19);
 assert.equal(result.capped.bonus,3);assert.equal(result.capped.fruits,11);
 assert.equal(result.expired.bonus,1);assert.equal(result.expired.speed,3.4);assert(result.hidden);
 assert.equal(result.grown.size,3);assert.equal(result.bath.speed,result.grown.speed);assert(result.bath.size<3);
 assert.equal(result.small.size,.3);assert.equal(result.small.speed,result.grown.speed);
 assert.equal(result.smallFruit.size,.3);assert.equal(result.smallFruit.bonus,1.4);assert.match(result.hud,/140%.*20 с/);
 assert(result.resting);assert(result.homeActive);assert.equal(result.afterRest.bonus,1);assert.equal(result.afterRest.size,.3);assert.equal(result.afterRest.speed,3.4*3);
 const beforeCarry=await page.evaluate(()=>{
  const m=window.fruitCheck,c=m.c;m.home.wake();m.step(2);c.setActivity('Idle');c.resizeTo(1,true);
  c.actor.position.set(49,0,42);c.surfaceY=0;c.swimming=false;c.yaw=0;c.actor.rotation.set(0,0,0);
  m.bread.reset({...m.bread.state,active:true,owner:'',p:c.actor.position.toArray(),pickupAt:0,drop:undefined,offering:undefined});
  m.step(.05);
  const fruit=m.fruits.fruits[13];fruit.object.position.copy(c.actor.position);fruit.object.position.z+=3;
  return {carrying:m.bread.holds('solo'),fruits:c.fruitsEaten,z:c.actor.position.z};
 });
 assert(beforeCarry.carrying,'the player automatically picks up bread before walking into fruit');
 await page.keyboard.down('w');
 const carriedFruit=await page.evaluate(()=>{
  const m=window.fruitCheck;m.step(1.1);
  return {carrying:m.bread.holds('solo'),eaten:m.fruits.fruits[13].eaten,visible:m.fruits.fruits[13].object.visible,fruits:m.c.fruitsEaten,bonus:m.c.fruitBoost.multiplier,z:m.c.actor.position.z};
 });
 await page.keyboard.up('w');
 assert(carriedFruit.z>beforeCarry.z,'the player walks forward while carrying bread');
 assert(carriedFruit.eaten);assert(!carriedFruit.visible);assert(carriedFruit.carrying);
 assert.equal(carriedFruit.fruits,beforeCarry.fruits+1);assert.equal(carriedFruit.bonus,1.2);
 await page.evaluate(()=>window.fruitCheck.step(.5));
 assert.equal(await page.evaluate(()=>window.fruitCheck.c.fruitsEaten),carriedFruit.fruits,'the fruit counts once');
 assert.deepEqual(errors,[]);
 console.log('PASS: live fruit pickup, shared timer refresh, 300% cap, expiry, HUD, admin speed, fountain, sleeping timer and walking through fruit while carrying bread');
} finally {await browser.close();}
