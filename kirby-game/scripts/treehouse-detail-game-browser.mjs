import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const url=process.env.GAME_URL??'http://127.0.0.1:5187/',out=fileURLToPath(new URL('../node_modules/.cache/treehouse-detail/',import.meta.url));await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.treeGame={THREE,scene,camera,renderer,treehouse,maze,shadows,celestialLighting,updateTreeShadows,updateSky,setupShadowMaterials,get c(){return character}};'});});
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});await page.click('#new-game');await page.fill('#player-name-input','Дуб');await page.click('#start-game');await page.waitForFunction(()=>window.treeGame?.c);
 const sites=await page.evaluate(async()=>{const q=treeGame;q.renderer.setAnimationLoop(null);q.setupShadowMaterials();const {daylight}=await import('/src/day-cycle.ts');q.day=daylight(.28);q.celestialLighting.update(q.day);q.updateTreeShadows(q.day);q.renderer.toneMappingExposure=1+q.day.day*.2;q.c.actor.position.copy(q.treehouse.group.position).add(new q.THREE.Vector3(-11,0,7));return {tree:q.treehouse.group.position.toArray(),maze:q.maze.group.position.toArray()};});
 await page.addStyleTag({content:'body > :not(#game){visibility:hidden!important}'});
 const photo=async(name,base,eye,target)=>{
  await page.evaluate(({base,eye,target})=>{const q=treeGame,T=q.THREE,b=new T.Vector3(...base);q.camera.position.copy(b).add(new T.Vector3(...eye));q.camera.lookAt(b.clone().add(new T.Vector3(...target)));q.camera.updateMatrixWorld();q.shadows.update();q.updateSky(0,q.camera,q.day);q.renderer.render(q.scene,q.camera);},{base,eye,target});await page.screenshot({path:out+name+'.png'});
 };
 await photo('tree-in-game',sites.tree,[-36,23,44],[-1,18,0]);
 await photo('bough-in-game',sites.tree,[-23,11,18],[-7.5,7,0]);
 await photo('cabin-in-game',sites.tree,[17,26,25],[0,20,0]);
 const swing=await page.evaluate(()=>{const q=treeGame;q.c.actor.position.copy(q.treehouse.group.position).add(new q.THREE.Vector3(-11,0,3));q.treehouse.interact(q.c);for(let i=0;i<120;i++)q.treehouse.update(1/60);return q.c.state==='Swing'&&q.c.achievements.has('swing');});assert(swing);
 await photo('swing-in-game',sites.tree,[-22,7,18],[-9,4,1]);
 await page.evaluate(()=>{const q=treeGame;q.treehouse.interact(q.c);q.c.actor.position.copy(q.treehouse.group.position).add(new q.THREE.Vector3(-4,0,11));q.treehouse.interact(q.c);for(let i=0;i<320;i++)q.treehouse.update(1/60);});
 assert(await page.evaluate(()=>treeGame.treehouse.onBalcony(treeGame.c)&&treeGame.c.actor.position.y===18));
 await photo('balcony-in-game',sites.tree,[14,24,20],[0,19.8,1]);
 await photo('cabin-interior-in-game',sites.tree,[5,20.3,9],[0,19.3,-1]);
 const jump=await page.evaluate(()=>{const q=treeGame;q.treehouse.update(1/60,undefined,true);for(let i=0;i<180;i++)q.treehouse.update(1/60);return !q.treehouse.active&&q.c.actor.position.y===0&&q.c.achievements.has('leaves');});assert(jump);
 await photo('clear-maze-entrance',sites.maze,[15,6,56],[0,2.2,38]);
 assert(!await page.evaluate(()=>treeGame.maze.group.getObjectByName('Rounded mineral stones at maze entrance')));
 await page.setViewportSize({width:844,height:390});await page.evaluate(()=>{treeGame.camera.aspect=844/390;treeGame.camera.updateProjectionMatrix();});
 await photo('tree-mobile',sites.tree,[-36,23,44],[-1,18,0]);
 assert.deepEqual(errors,[]);const report={swing,climb:true,leafJump:jump,mazeStonesRemoved:true,errors};await writeFile(out+'game-checks.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
