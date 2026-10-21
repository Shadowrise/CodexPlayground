import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const url=process.env.GAME_URL??'http://127.0.0.1:5187/',out=fileURLToPath(new URL('../node_modules/.cache/clearing-props/',import.meta.url));await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.clearingGame={THREE,scene,camera,renderer,home,maze,benches,shadows,celestialLighting,updateTreeShadows,updateSky,setupShadowMaterials,get c(){return character}};'});});
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});await page.click('#new-game');await page.fill('#player-name-input','Домик');await page.click('#start-game');await page.waitForFunction(()=>window.clearingGame?.c);
 await page.evaluate(async()=>{
  const q=clearingGame;q.renderer.setAnimationLoop(null);q.setupShadowMaterials();const {daylight}=await import('/src/day-cycle.ts');q.day=daylight(.28);q.celestialLighting.update(q.day);q.updateTreeShadows(q.day);q.renderer.toneMappingExposure=1+q.day.day*.2;
 });
 await page.addStyleTag({content:'body > :not(#game){visibility:hidden!important}'});
 const sites=await page.evaluate(async()=>{const {LANDMARKS}=await import('/src/landmark-sites.ts');return {home:clearingGame.home.group.position.toArray(),maze:clearingGame.maze.group.position.toArray(),ruins:LANDMARKS.filter(s=>s.kind===5),picnics:LANDMARKS.filter(s=>s.kind===4)};});
 const photo=async(name,base,eye,target)=>{
  await page.evaluate(({base,eye,target})=>{const q=clearingGame,T=q.THREE,b=new T.Vector3(...base);q.c.actor.position.copy(b).add(new T.Vector3(0,0,6));q.camera.position.copy(b).add(new T.Vector3(...eye));q.camera.lookAt(b.clone().add(new T.Vector3(...target)));q.camera.updateMatrixWorld();q.shadows.update();q.updateSky(0,q.camera,q.day);q.renderer.render(q.scene,q.camera);},{base,eye,target});await page.screenshot({path:out+name+'.png'});
 };
 await photo('home-in-game',sites.home,[14,8.2,18],[0,2.8,0]);
 await photo('interior-in-game',sites.home,[4.9,3.7,8.7],[0,1.9,-1.25]);
 await photo('maze-in-game',sites.maze,[15,7,57],[0,2.5,38]);
 await photo('stones-in-game',sites.maze,[10,2.2,43],[7,.3,39]);
 for(const [i,s] of sites.ruins.entries())await photo('ruins-in-game-'+i,[s.x,0,s.z],[13,7.5,18],[0,2.8,1]);
 for(const [i,s] of sites.picnics.entries())await photo('picnic-in-game-'+i,[s.x,0,s.z],[5.7,4.4,7.8],[0,.65,0]);
 const sleep=await page.evaluate(()=>{
  const q=clearingGame;q.c.actor.position.copy(q.home.entrance);const started=q.home.start(q.c);for(let i=0;i<120;i++)q.home.update(1/60);const covered=q.home.active&&q.c.state==='Sleep';q.home.wake();for(let i=0;i<90;i++)q.home.update(1/60);return {started,covered,woke:!q.home.active&&q.c.actor.position.distanceTo(q.home.entrance)<.01};
 });assert(sleep.started&&sleep.covered&&sleep.woke);
 await page.setViewportSize({width:844,height:390});await page.evaluate(()=>{clearingGame.camera.aspect=844/390;clearingGame.camera.updateProjectionMatrix();});
 await photo('home-mobile',sites.home,[14,8.2,18],[0,2.8,0]);
 await page.evaluate(async()=>{const q=clearingGame,{daylight}=await import('/src/day-cycle.ts');q.day=daylight(.75);q.celestialLighting.update(q.day);q.updateTreeShadows(q.day);q.renderer.toneMappingExposure=1+q.day.day*.2;q.home.nightAmount=1;q.home.update(0);});
 await photo('home-night',sites.home,[12,7,16],[0,2.5,0]);
 assert.deepEqual(errors,[]);const report={sleep,ruins:sites.ruins.length,picnics:sites.picnics.length,errors};await writeFile(out+'game-checks.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
