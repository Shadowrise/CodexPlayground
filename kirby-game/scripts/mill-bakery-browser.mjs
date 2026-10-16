import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const output=fileURLToPath(new URL('../design/mill-bakery/',import.meta.url));await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 // Keep a parallel scenery bake or another editor's HMR from resetting this QA page.
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.bakeryQA={THREE,watermill,renderer,scene,camera,followCamera,get c(){return character},set day(v){dayStart=Date.now();dayStartPhase=v}};'});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5184/');await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.click('#new-game');await page.fill('#player-name-input','Пекарь');await page.click('#start-game');await page.waitForFunction(()=>bakeryQA.c);
 await page.evaluate(()=>{
  const q=bakeryQA;q.day=.3;q.c.setActivity('Idle');q.c.actor.position.set(61.5,0,45.8);q.c.yaw=Math.PI;q.c.actor.rotation.y=Math.PI;q.followCamera.reset(Math.PI);
 });
 await page.waitForTimeout(1200);
 const measurements=await page.evaluate(async()=>{
  const q=bakeryQA,T=q.THREE,b=q.watermill.bakery,{flatGround}=await import('/src/pond-layout.ts'),{MILL_BAKERY_TABLE:table,MILL_BAKERY_OVEN:oven}=await import('/src/mill-bakery-site.ts');b.group.updateWorldMatrix(true,true);
  const bounds=o=>{const box=new T.Box3().setFromObject(o);return {min:box.min.toArray(),max:box.max.toArray()};};
  let draws=0,triangles=0;b.group.traverse(o=>{if(o.isMesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
  const footprint=[b.table,b.oven].map(o=>{const box=new T.Box3().setFromObject(o);return [[box.min.x,box.min.z],[box.max.x,box.min.z],[box.min.x,box.max.z],[box.max.x,box.max.z]].every(([x,z])=>flatGround(x,z,.2));});
  const points=[[table.x,0,table.z],[oven.x,0,oven.z]],constraints=points.map(p=>{const v=new T.Vector3(...p);q.watermill.constrain(v,1);return v.toArray();});
  const approaches=[[61.5,0,44.1],[61.5,0,38],[56.5,0,41],[49,0,40.5]].map(p=>{const v=new T.Vector3(...p);q.watermill.constrain(v,1);return v.distanceTo(new T.Vector3(...p));});
  // A ray can enter the open oven and reach its recessed back, well behind the rim.
  const ray=new T.Raycaster(new T.Vector3(oven.x,2.6,oven.z+5),new T.Vector3(0,0,-1));
  const hit=ray.intersectObject(b.oven,true)[0];
  const collisionBoundaries=[];
  for(const size of [1,4,20])for(const p of points){const v=new T.Vector3(...p);q.watermill.constrain(v,size);collisionBoundaries.push({size,p:v.toArray(),moved:v.distanceTo(new T.Vector3(...p))>1});}
  q.photoCamera=q.camera.clone();q.originalRender=q.renderer.render;q.renderer.render=function(scene,camera){return q.originalRender.call(this,scene,scene===q.scene?q.photoCamera:camera);};
  document.body.classList.add('bakery-photo');
  const forest=q.scene.getObjectByName('Four woodland biomes'),trees=forest.userData.treePositions,layout=forest.userData.meadowLayout;
  const clearance=[table,oven].map(p=>({trunk:Math.min(...trees.map(t=>Math.hypot(t.x-p.x,t.z-p.z))),trail:layout?.trailDistance?.(p.x,p.z)}));
  return {draws,triangles,table:bounds(b.table),oven:bounds(b.oven),dry:footprint,constraints,approaches,ovenRay:hit?.point.toArray(),collisionBoundaries,clearance};
 });
 assert(measurements.dry.every(Boolean),'props stay on flat dry ground');assert(measurements.approaches.every(d=>d<1e-8),'work stations and existing quest stay approachable');assert(measurements.ovenRay[2]<34,'the oven opening reaches the recessed back');assert(measurements.collisionBoundaries.every(p=>p.moved));
 await page.addStyleTag({content:'body.bakery-photo > :not(#game){visibility:hidden!important}'});
 const photo=async(name,position,target)=>{
  await page.evaluate(({position,target})=>{const q=bakeryQA;q.photoCamera.position.fromArray(position);q.photoCamera.lookAt(...target);q.photoCamera.updateMatrixWorld();},{position,target});
  await page.waitForTimeout(300);await page.screenshot({path:output+name+'.png'});
 };
 await photo('mill-bakery-in-game',[77,17,62],[54.8,3.3,36.5]);
 await photo('oak-table-details',[67,5.6,48.8],[61.3,1.6,41.8]);
 await photo('bread-oven-details',[68.8,6.3,44.8],[61.5,2.7,34.7]);
 await page.evaluate(()=>{bakeryQA.day=.78;});await page.waitForTimeout(350);await photo('bakery-at-night',[69.5,6.8,47],[61,2.6,37]);
 await page.evaluate(()=>{bakeryQA.day=.3;bakeryQA.renderer.render=bakeryQA.originalRender;document.body.classList.remove('bakery-photo');});
 await page.setViewportSize({width:844,height:390});await page.evaluate(()=>{document.body.classList.add('touch-ui');bakeryQA.c.actor.position.set(61.5,0,46);bakeryQA.followCamera.reset(Math.PI);});await page.waitForTimeout(600);await page.screenshot({path:output+'bakery-mobile.png'});
 assert.deepEqual(errors,[]);await writeFile(output+'measurements.json',JSON.stringify({...measurements,errors},null,2)+'\n');console.log(JSON.stringify({...measurements,errors}));
}finally{await browser.close();}
