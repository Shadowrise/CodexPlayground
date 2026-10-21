import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const output=fileURLToPath(new URL('../node_modules/.cache/treehouse-network/',import.meta.url));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const contexts=[],pages=[],report={checks:[],errors:[]};
try{
 async function enter(name){
  const context=await browser.newContext({viewport:{width:1200,height:850}});contexts.push(context);
  await context.routeWebSocket(/ws:\/\/127\.0\.0\.1:5173\//,socket=>socket.onMessage(()=>{}));
  await context.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
  await context.route('**/src/main.ts*',async route=>{
   const response=await route.fetch();
   await route.fulfill({response,body:(await response.text())+`
   window.treehouseQA={treehouse,benches,resolveInteraction,resourceKey,scene,camera,followCamera,
     get c(){return character},get network(){return network},get held(){return heldResource},get playing(){return playing},
     move(kind){const c=character;c.setActivity('Idle');c.swimming=false;c.resizeTo(1,true);c.surfaceY=0;c.actor.position.set(...(kind==='ladder'?[131,0,56]:[124,0,48]));c.yaw=kind==='ladder'?Math.PI:0;c.actor.rotation.set(0,c.yaw,0);followCamera.reset(c.yaw);},
     snapshot(){return {id:network.id,held:heldResource,acquiring,playing,state:character.state,roll:character.roll.active,flight:character.flight.active,prompt:resolveInteraction(character)?.text,key:resourceKey(character),position:character.actor.position.toArray(),angle:treehouse.swing.rotation.x,locks:{...network.room.locks},achievements:[...character.achievements],rides:Array.from(network.actors,([id,a])=>({id,state:a.state,ride:a.ride}))};}
    };
   `});
  });
  const page=await context.newPage();pages.push(page);page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&/THREE|WebGL|shader/i.test(message.text()))report.errors.push(message.text());});
  await page.goto(process.env.GAME_URL??'http://127.0.0.1:5173/');
  await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
  await page.locator('#network-join').click();await page.locator('#player-name-input').fill(name);
  await page.locator('#start-game:not([disabled])').waitFor({timeout:30000});await page.locator('#start-game').click();
  await page.waitForFunction(()=>window.treehouseQA?.c&&treehouseQA.playing&&treehouseQA.network);
  console.log('Joined '+name);return page;
 }
 const climber=await enter('Лестница'),swinger=await enter('Качели');
 await climber.waitForFunction(()=>treehouseQA.network.actors.size===1);
 async function move(page,kind){await page.evaluate(kind=>treehouseQA.move(kind),kind);await page.waitForTimeout(250);}
 async function start(page,key,state){
  await page.keyboard.press('KeyE');
  await page.waitForFunction(({key,state})=>treehouseQA.held===key&&treehouseQA.c.state===state,{key,state},{timeout:15000});
 }
 async function shared(climbing,swinging,label){
  for(const page of [climbing,swinging])await page.waitForFunction(()=>treehouseQA.network.room.locks['tree:0']&&treehouseQA.network.room.locks['swing:0']);
  const a=await climbing.evaluate(()=>treehouseQA.snapshot()),b=await swinging.evaluate(()=>treehouseQA.snapshot());
  assert.equal(a.held,'tree:0');assert.equal(b.held,'swing:0');assert.notEqual(a.id,b.id);
  assert.equal(a.locks['tree:0'],a.id);assert.equal(a.locks['swing:0'],b.id);
  report.checks.push({label,climber:a,swinger:b});console.log(label);
 }
 await move(climber,'ladder');await start(climber,'tree:0','Climb');
 await move(swinger,'swing');await start(swinger,'swing:0','Swing');
 await shared(climber,swinger,'swing mounts during the other player’s climb');
 await climber.waitForFunction(()=>treehouseQA.treehouse.canSit,null,{timeout:15000});
 await swinger.waitForFunction(()=>treehouseQA.c.achievements.has('swing'));
 await shared(climber,swinger,'balcony and swing stay occupied independently');
 const angles=[];
 for(let sample=0;sample<8;sample++){
  angles.push(await climber.evaluate(()=>{const q=treehouseQA,remote=Array.from(q.network.actors.values()).find(a=>a.ride?.key==='swing:0');return {local:q.treehouse.swing.rotation.x,remote:remote?.ride.data[0]};}));
  await climber.waitForTimeout(130);
 }
 report.angles=angles;await writeFile(output+'checks.json',JSON.stringify(report,null,2));
 assert(angles.every(a=>typeof a.remote==='number'&&Math.abs(a.local-a.remote)<.08),`the player on the balcony sees the passenger’s actual swing angle: ${JSON.stringify(angles)}`);
 assert(Math.max(...angles.map(a=>a.local))-Math.min(...angles.map(a=>a.local))>.08,'the remote swing visibly rocks');report.angles=angles;
 await climber.screenshot({path:output+'balcony-with-occupied-swing.png'});await swinger.screenshot({path:output+'swing-with-occupied-balcony.png'});
 await climber.keyboard.press('KeyE');await climber.waitForFunction(()=>treehouseQA.c.state==='LeafDive');
 await shared(climber,swinger,'leaf dive leaves the swing occupied');
 await climber.waitForFunction(()=>!treehouseQA.treehouse.active&&!treehouseQA.held);
 assert.equal(await swinger.evaluate(()=>treehouseQA.held),'swing:0');
 await move(climber,'swing');
 await climber.keyboard.press('KeyE');await climber.waitForTimeout(750);
 assert.equal(await climber.evaluate(()=>treehouseQA.treehouse.active),false,'an occupied swing still excludes another passenger');
 assert.equal(await swinger.evaluate(()=>treehouseQA.c.state),'Swing');
 await swinger.keyboard.press('KeyE');await swinger.waitForFunction(()=>!treehouseQA.held&&!treehouseQA.treehouse.active);
 await climber.waitForFunction(()=>!treehouseQA.network.room.locks['swing:0']);
 await start(climber,'swing:0','Swing');
 await move(swinger,'ladder');await start(swinger,'tree:0','Climb');
 await shared(swinger,climber,'ladder starts while the other player is already swinging');
 await swinger.waitForFunction(()=>treehouseQA.treehouse.canSit,null,{timeout:15000});
 await shared(swinger,climber,'both activities also work with reversed players');
 await climber.keyboard.press('KeyE');await climber.waitForFunction(()=>!treehouseQA.held&&!treehouseQA.treehouse.active);
 assert.equal(await swinger.evaluate(()=>treehouseQA.treehouse.canSit),true,'leaving the swing does not end the balcony visit');
 await swinger.keyboard.press('KeyE');await swinger.waitForFunction(()=>!treehouseQA.held&&!treehouseQA.treehouse.active);
 for(const page of [climber,swinger])await page.waitForFunction(()=>!treehouseQA.network.room.locks['tree:0']&&!treehouseQA.network.room.locks['swing:0']);
 report.released=true;assert.deepEqual(report.errors,[]);
 await writeFile(output+'checks.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({output,checks:report.checks.map(c=>c.label),remoteSwingSamples:angles.length,released:report.released,errors:report.errors}));
}catch(error){
 report.failure=String(error);report.final=await Promise.all(pages.map(page=>page.evaluate(()=>window.treehouseQA?.snapshot()).catch(error=>String(error))));
 await writeFile(output+'checks.json',JSON.stringify(report,null,2));console.error(JSON.stringify(report.final));throw error;
}finally{await Promise.all(contexts.map(context=>context.close()));await browser.close();}
