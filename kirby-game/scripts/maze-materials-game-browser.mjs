import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const url=process.env.GAME_URL??'http://127.0.0.1:5187/',out=fileURLToPath(new URL('../node_modules/.cache/maze-materials/',import.meta.url));await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.mazeGame={THREE,scene,camera,renderer,maze,shadows,preparedShadows,celestialLighting,updateTreeShadows,updateSky,setupShadowMaterials,get c(){return character}};'});});
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});await page.click('#new-game');await page.fill('#player-name-input','Лабиринт');await page.click('#start-game');await page.waitForFunction(()=>window.mazeGame?.c);
 await page.evaluate(async()=>{const q=mazeGame;q.renderer.setAnimationLoop(null);q.setupShadowMaterials();const {daylight}=await import('/src/day-cycle.ts');q.day=daylight(.28);q.celestialLighting.update(q.day);q.updateTreeShadows(q.day);q.renderer.toneMappingExposure=1+q.day.day*.2;q.c.actor.position.copy(q.maze.group.position).add(new q.THREE.Vector3(0,0,40));});
 await page.addStyleTag({content:'body > :not(#game){visibility:hidden!important}'});
 const photo=async(name,eye,target)=>{
  await page.evaluate(({eye,target})=>{const q=mazeGame,T=q.THREE,b=q.maze.group.position;q.camera.position.copy(b).add(new T.Vector3(...eye));q.camera.lookAt(b.clone().add(new T.Vector3(...target)));q.camera.updateMatrixWorld();q.shadows.update();q.updateSky(0,q.camera,q.day);q.preparedShadows.update(q.day,q.camera.position);q.renderer.render(q.scene,q.camera);},{eye,target});await page.screenshot({path:out+name+'.png'});
 };
 await photo('entrance-in-game',[16,7.5,56],[0,3,35]);await photo('overview-in-game',[62,64,76],[0,1,0]);
 await photo('coping-in-game',[15,8.2,43],[10,5.1,35]);
 const end=await page.evaluate(()=>{
  const endpoints=new Map();for(const w of mazeGame.maze.walls){const horizontal=w.hx>w.hz;for(const sign of [-1,1]){const x=w.x+(horizontal?sign*w.hx:0),z=w.z+(horizontal?0:sign*w.hz),key=x+','+z,point=endpoints.get(key)??{x,z,dx:horizontal?sign:0,dz:horizontal?0:sign,count:0};point.count++;endpoints.set(key,point);}}
  return [...endpoints.values()].filter(p=>p.count===1).sort((a,b)=>(a.x*a.x+(a.z-30)**2)-(b.x*b.x+(b.z-30)**2))[0];
 });
 await photo('rounded-end-in-game',[end.x+end.dx*5-end.dz*4,6.8,end.z+end.dz*5+end.dx*4],[end.x,3.7,end.z]);
 await page.evaluate(()=>{const q=mazeGame;q.c.actor.position.copy(q.maze.group.position).add(new q.THREE.Vector3(-2,0,30));});
 await photo('corridor-in-game',[2,3.2,30],[-8,2.1,30]);await photo('floor-in-game',[3.7,2.6,30],[0,.1,27]);
 const star=await page.evaluate(()=>{const q=mazeGame,p=q.maze.rewardPosition;q.c.actor.position.copy(q.maze.group.position).add(p).add(new q.THREE.Vector3(-2,0,2));return p.toArray();});
 await photo('reward-in-game',[star[0]+2.5,4.2,star[2]+2.5],[star[0],2,star[2]]);
 const pickup=await page.evaluate(()=>{const q=mazeGame;q.c.actor.position.copy(q.maze.rewardPosition).add(q.maze.group.position);return q.maze.update(1/60,q.c)&&!q.maze.star.visible&&q.c.achievements.has('star');});assert(pickup);
 await page.setViewportSize({width:844,height:390});await page.evaluate(()=>{mazeGame.camera.aspect=844/390;mazeGame.camera.updateProjectionMatrix();mazeGame.c.actor.position.copy(mazeGame.maze.group.position).add(new mazeGame.THREE.Vector3(0,0,40));});
 await photo('entrance-mobile',[16,7.5,56],[0,3,35]);
 await page.evaluate(async()=>{const q=mazeGame,{daylight}=await import('/src/day-cycle.ts');q.day=daylight(.75);q.celestialLighting.update(q.day);q.updateTreeShadows(q.day);q.renderer.toneMappingExposure=1+q.day.day*.2;});await photo('entrance-night',[16,7.5,56],[0,3,35]);
 const report={pickup,errors};await writeFile(out+'game-checks.json',JSON.stringify(report,null,2)+'\n');assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{await browser.close();}
