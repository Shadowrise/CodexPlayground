import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const url=process.env.GAME_URL??'http://127.0.0.1:5187/',out=fileURLToPath(new URL('../node_modules/.cache/platform-approaches/',import.meta.url));await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.sceneryQA={THREE,scene,camera,renderer,shadows,preparedShadows,celestialLighting,updateTreeShadows,updateSky,setupShadowMaterials,get c(){return character}};'});});
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});await page.click('#new-game');await page.fill('#player-name-input','Перрон');await page.click('#start-game');await page.waitForFunction(()=>window.sceneryQA?.c);
 await page.evaluate(async()=>{
  const q=sceneryQA;q.renderer.setAnimationLoop(null);const {daylight}=await import('/src/day-cycle.ts');q.day=daylight(.28);q.celestialLighting.update(q.day);q.updateTreeShadows(q.day);q.renderer.toneMappingExposure=1+q.day.day*.2;
 });
 await page.addStyleTag({content:'body > :not(#game){visibility:hidden!important}'});
 const prepare=async(eye,target)=>page.evaluate(({eye,target})=>{const q=sceneryQA;q.camera.position.fromArray(eye);q.camera.lookAt(...target);q.camera.updateMatrixWorld();q.c.actor.position.set(eye[0],0,eye[2]);q.shadows.update();q.updateSky(0,q.camera,q.day);q.preparedShadows.update(q.day,q.camera.position);},{eye,target});
 const render=async()=>page.evaluate(()=>{const q=sceneryQA;for(let i=0;i<3;i++)q.renderer.render(q.scene,q.camera);});

 const report=await page.evaluate(()=>{
  const q=sceneryQA,T=q.THREE,depot=q.scene.getObjectByName('Handcrafted coaster depot'),tree=q.scene.getObjectByName('Oak treehouse, lookout, swing and leaf pile'),mill=q.scene.getObjectByName('Interactive watermill'),ray=new T.Raycaster();
  q.scene.updateMatrixWorld(true);const clear=[];
  for(const side of [-1,1])for(let i=0;i<6;i++){
   ray.set(new T.Vector3(side*14,.2,224-4.15+i*1.63+.11),new T.Vector3(-side,0,0));const hits=ray.intersectObject(depot,true);clear.push(hits.filter(h=>Math.abs(h.distance-hits[0].distance)<.005).length===1);
  }
  const probe=(root,x,z)=>{ray.set(new T.Vector3(x,.3,z),new T.Vector3(0,-1,0));ray.far=.27;const hits=ray.intersectObject(root,true);ray.far=Infinity;return !hits.some(h=>h.point.y>.03);};
  return {platformSidesClear:clear.every(Boolean),treeApproachClear:probe(tree,131,60.1),millApproachClear:probe(mill,49,45.76)};
 });
 assert(report.platformSidesClear);assert(report.treeApproachClear);assert(report.millApproachClear);
 for(const [name,eye,target] of [
  ['platform-left',[-15,1.3,220],[-11.9,.24,224]],
  ['platform-right',[15,1.3,220],[11.9,.24,224]],
  ['depot-in-game',[22,10,203],[0,3,224]],
  ['tree-approach',[137,3,66],[131,1.8,56]],
  ['mill-approach',[54,4.2,53],[49,1.5,41]]
 ]){await prepare(eye,target);await render();await page.screenshot({path:out+name+'.png'});}
 assert.deepEqual(errors,[]);await writeFile(out+'checks.json',JSON.stringify({...report,errors},null,2));console.log(JSON.stringify({...report,errors}));
}finally{await browser.close();}
