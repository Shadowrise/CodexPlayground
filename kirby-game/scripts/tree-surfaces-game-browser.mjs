import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import assert from 'node:assert/strict';
const url=process.env.GAME_URL??'http://127.0.0.1:5187/',out=fileURLToPath(new URL('../node_modules/.cache/tree-surfaces/',import.meta.url));await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 const oldFiles=['forest','broadleaf-tree','spruce-shape','foliage-texture','mountain-woodland'];
 for(const file of oldFiles){
  const source=execFileSync('git',['show','HEAD:kirby-game/src/'+file+'.ts'],{encoding:'utf8'}),body=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from\s+(['"])([^'"]+)\1/g,(_,q,spec)=>'from '+JSON.stringify(spec==='three'?'/node_modules/.vite/deps/three.js':spec.startsWith('three/addons/')?'/node_modules/three/examples/jsm/'+spec.slice(13):'/src/'+(oldFiles.includes(spec.slice(2))?'tree-surface-before-':'')+spec.slice(2)+'.ts'));
  await page.route('**/src/tree-surface-before-'+file+'.ts',r=>r.fulfill({contentType:'application/javascript',body}));
 }
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.forestView={THREE,scene,camera,renderer,shadows,preparedShadows,celestialLighting,updateTreeShadows,updateSky,setupShadowMaterials,get c(){return character}};'});});
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});await page.click('#new-game');await page.fill('#player-name-input','Лес');await page.click('#start-game');await page.waitForFunction(()=>window.forestView?.c);
 await page.evaluate(async()=>{
  const q=forestView;q.renderer.setAnimationLoop(null);const {daylight}=await import('/src/day-cycle.ts');q.day=daylight(.28);q.celestialLighting.update(q.day);q.updateTreeShadows(q.day);q.renderer.toneMappingExposure=1+q.day.day*.2;q.after=q.scene.getObjectByName('Four woodland biomes');q.afterMountain=q.scene.getObjectByName('Mountain slope woodland');
  const {createForest}=await import('/src/tree-surface-before-forest.ts'),{createMountainWoodland}=await import('/src/tree-surface-before-mountain-woodland.ts');q.before=createForest();q.beforeMountain=createMountainWoodland();q.before.visible=q.beforeMountain.visible=false;
  const a=q.before.userData.treePositions,b=q.after.userData.treePositions;const mismatch=a.findIndex((p,i)=>!b[i]||Math.hypot(p.x-b[i].x,p.z-b[i].z)>1e-6||Math.abs(p.crownRadius-b[i].crownRadius)>1e-6);if(a.length!==b.length||mismatch>=0)throw Error('Established forest plantings changed '+JSON.stringify({counts:[a.length,b.length],mismatch,before:a[mismatch],after:b[mismatch]}));const ma=q.beforeMountain.userData.treePositions,mb=q.afterMountain.userData.treePositions;if(ma.length!==mb.length||ma.some((p,i)=>Math.hypot(p.x-mb[i].x,p.y-mb[i].y,p.z-mb[i].z)>1e-6||Math.abs(p.radius-mb[i].radius)>1e-6))throw Error('Mountain plantings changed');
  q.scene.attach(q.after.getObjectByName('Biome ground'));q.before.getObjectByName('Biome ground').removeFromParent();q.before.getObjectByName('Soft patterned tree shadows')?.removeFromParent();q.scene.add(q.before,q.beforeMountain);q.setupShadowMaterials(q.before);q.setupShadowMaterials(q.beforeMountain);q.inventory={forest:q.after.userData.treePositions.length,mountain:q.afterMountain.userData.treePositions.length,placementUnchanged:true};
 });
 await page.addStyleTag({content:'body > :not(#game){visibility:hidden!important}'});
 const prepare=async(eye,target)=>page.evaluate(({eye,target})=>{const q=forestView;q.camera.position.fromArray(eye);q.camera.lookAt(...target);q.camera.updateMatrixWorld();q.c.actor.position.set(eye[0],0,eye[2]);q.shadows.update();q.updateSky(0,q.camera,q.day);q.preparedShadows.update(q.day,q.camera.position);},{eye,target});
 const render=async()=>page.evaluate(()=>{const q=forestView;q.before.visible=q.beforeMountain.visible=false;q.after.visible=q.afterMountain.visible=true;q.renderer.render(q.scene,q.camera);});
 const report={views:{},errors};
 for(const [name,eye,target] of [['spruce',[-112,4.8,-124],[-112,3,-168]],['birch',[115,4.8,-113],[115,3,-157]],['orchard',[115,4.8,157],[115,3,113]],['autumn',[-155,4.8,177],[-155,3,133]],['mountain',[-202,14,-220],[-248,18,-246]]]){
  await prepare(eye,target);report.views[name]=await page.evaluate(async()=>{const q=forestView,gl=q.renderer.getContext();q.renderer.info.autoReset=false;
   const sample=async old=>{q.before.visible=q.beforeMountain.visible=old;q.after.visible=q.afterMountain.visible=!old;const times=[];let counts;for(let i=0;i<32;i++){await new Promise(requestAnimationFrame);q.renderer.info.reset();const start=performance.now();q.renderer.render(q.scene,q.camera);gl.finish();if(i>=12)times.push(performance.now()-start);counts={calls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles};}times.sort((a,b)=>a-b);return {...counts,medianMs:times[10],p90Ms:times[18]};};
   const before=await sample(true),after=await sample(false),control=await sample(true);return {before,after,control};
  });await render();await page.screenshot({path:out+name+'-in-game.png'});
 }
 for(const kind of ['spruce','birch','orchard','autumn']){
  const target=await page.evaluate(async kind=>{const q=forestView,{biomeAt}=await import('/src/forest.ts'),trees=q.after.userData.treePositions;const anchor=kind==='spruce'?[-100,-110]:kind==='birch'?[100,-100]:kind==='orchard'?[95,120]:[-110,140],candidates=trees.filter(p=>biomeAt(p.x,p.z)===kind).sort((a,b)=>(a.x-anchor[0])**2+(a.z-anchor[1])**2-(b.x-anchor[0])**2-(b.z-anchor[1])**2);return candidates.find(p=>!trees.some(t=>t!==p&&Math.hypot(t.x-p.x-8,t.z-p.z-11)<t.crownRadius+2))??candidates[0];},kind),s=kind==='spruce'?target.crownRadius/2.2:kind==='birch'?target.crownRadius/6.4:target.crownRadius/4.2;
  await prepare([target.x+8*s,5.5*s,target.z+11*s],[target.x,4.3*s,target.z]);await render();await page.screenshot({path:out+kind+'-close-in-game.png'});
  await prepare([target.x+2.1*s,1.6*s,target.z+2.4*s],[target.x,1.4*s,target.z]);await render();await page.screenshot({path:out+kind+'-trunk-in-game.png'});
 }
 await page.setViewportSize({width:844,height:390});await page.evaluate(()=>{forestView.camera.aspect=844/390;forestView.camera.updateProjectionMatrix();});await prepare([-112,4.8,-124],[-112,3,-168]);await render();await page.screenshot({path:out+'spruce-mobile.png'});
 await page.evaluate(async()=>{const q=forestView,{daylight}=await import('/src/day-cycle.ts');q.day=daylight(.75);q.celestialLighting.update(q.day);q.updateTreeShadows(q.day);q.renderer.toneMappingExposure=1+q.day.day*.2;});await prepare([-112,4.8,-124],[-112,3,-168]);await render();await page.screenshot({path:out+'spruce-night.png'});
 report.inventory=await page.evaluate(()=>forestView.inventory);await writeFile(out+'game-checks.json',JSON.stringify(report,null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{await browser.close();}
