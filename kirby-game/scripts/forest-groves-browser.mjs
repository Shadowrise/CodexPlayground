import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
const url=process.env.GAME_URL??'http://127.0.0.1:5174/',output=process.env.TEMP+'/kirby-forest-groves'+(process.env.STYLE_MOBILE==='1'?'-mobile':'');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage(process.env.STYLE_MOBILE==='1'?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.log('Page error: '+e.message);});page.on('console',m=>{if(m.type()==='error'&&/Game startup failed|THREE|WebGL|shader/i.test(m.text())){errors.push(m.text());console.log(m.text());}});
 await page.addInitScript(()=>localStorage.setItem('kirby-language-v1','ru'));
 for(const module of ['forest','decor'])await page.route(`**/src/${module}-groves-before.ts`,async route=>route.fulfill({contentType:'application/javascript',body:await readFile(process.env.TEMP+`/kirby-${module}-groves-before.js`,'utf8')}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.groveScene={scene,camera,renderer,shadows,get c(){return character},set day(v){dayStart=Date.now();dayStartPhase=v}};'});});
 await page.goto(url);console.log('Page loaded');await Promise.race([page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000}),page.locator('#loading-retry').waitFor({state:'visible',timeout:120000}).then(()=>{throw Error('Scene startup failed: '+errors.join('\n'));})]);console.log('Scene ready');
 await page.locator('#player-name-input').fill('Рощица');await page.locator('#new-game').click();await page.locator('#start-game').click();
 await page.evaluate(()=>window.groveScene.day=.25);await page.waitForTimeout(250);
 await page.evaluate(()=>{window.groveScene.renderer.setAnimationLoop(null);document.querySelectorAll('body > :not(#game)').forEach(e=>e.style.display='none');});
 const inventory=await page.evaluate(async()=>{
  const t=window.groveScene,{createForest}=await import('/src/forest-groves-before.ts'),{createMeadowDecor}=await import('/src/decor-groves-before.ts'),{prepareSurfaceTextures}=await import('/src/texture-filtering.ts');
  t.afterForest=t.scene.getObjectByName('Four woodland biomes');t.afterDecor=t.scene.getObjectByName('Biome meadow details');t.beforeForest=createForest();t.beforeDecor=createMeadowDecor(t.beforeForest.userData.treePositions,t.beforeForest.userData.meadowLayout);
  const prepared=new Set();
  for(const root of [t.beforeForest,t.beforeDecor])root.traverse(o=>{if(!o.isMesh)return;for(const material of Array.isArray(o.material)?o.material:[o.material]){
   if(prepared.has(material))continue;prepared.add(material);prepareSurfaceTextures(material,t.renderer.capabilities.getMaxAnisotropy());if(!material.isMeshStandardMaterial&&!material.isMeshLambertMaterial)return;
   const surface=material.onBeforeCompile;t.shadows.setupMaterial(material);const shadow=material.onBeforeCompile;material.onBeforeCompile=(s,r)=>{shadow.call(material,s,r);surface.call(material,s,r);};
  }});
  t.beforeForest.visible=t.beforeDecor.visible=false;t.scene.add(t.beforeForest,t.beforeDecor);
  const trees=t.afterForest.userData.treePositions,base=t.beforeForest.userData.treePositions,layout=t.afterForest.userData.meadowLayout;
  if(JSON.stringify(trees.slice(0,base.length))!==JSON.stringify(base))throw Error('Established tree anchors moved');
  if(trees.slice(base.length).some(p=>!layout.clearOfTrails(p.x,p.z,p.crownRadius+.5)))throw Error('A grove obstructs a path');
  const sites=t.afterDecor.userData.sites;
  if(sites.some(p=>!layout.clearOfTrails(p.x,p.z,p.radius)))throw Error('A shrub obstructs a path');
  return {trees:trees.length,before:base.length,groves:t.afterForest.userData.groves.length,trailGroves:t.afterForest.userData.trailGroves,trailBushes:t.afterDecor.userData.trailBushes,plantTriangles:t.afterDecor.userData.plantTriangles,grassBlades:t.afterDecor.userData.grassBlades};
 });
 console.log(JSON.stringify(inventory));
 const views=await page.evaluate(()=>{
  const layout=window.groveScene.afterForest.userData.meadowLayout,trees=window.groveScene.beforeForest.userData.treePositions;
  return [[-100,-120],[90,-100],[100,120],[-100,130]].map(([x,z],j)=>{
   let nearest,best=Infinity;for(const path of layout.paths)for(let i=12;i<path.points.length-12;i++){
    const p=path.points[i],eye=path.points[i+12],dx=eye.x-p.x,dz=eye.z-p.z,len=dx*dx+dz*dz,d=(p.x-x)**2+(p.z-z)**2;if(d>=best)continue;
    // Use a clear stretch for a representative view, rather than placing the
    // diagnostic camera inside one of the established wide birch crowns.
    if(trees.some(tree=>{const f=len?Math.max(0,Math.min(1,((tree.x-p.x)*dx+(tree.z-p.z)*dz)/len)):0;return Math.hypot(tree.x-p.x-f*dx,tree.z-p.z-f*dz)<tree.crownRadius+1;}))continue;
    best=d;nearest={path,i,p};
   }
   const {path,i,p}=nearest,eye=path.points[i+12];
   return {name:['spruce','birch','orchard','autumn'][j],x:p.x,z:p.z,eye:[eye.x,6,eye.z],look:[p.x,1,p.z]};
  }).concat({name:'overview',x:0,z:0,eye:[0,650,80],look:[0,0,0]});
 });
 const rows=[];
 for(const view of views){
  await page.evaluate(({x,z,eye,look,name})=>{const t=window.groveScene;t.c.actor.position.set(x,0,z);t.camera.position.fromArray(eye);t.camera.lookAt(...look);t.camera.updateMatrixWorld();t.shadows.update();if(name==='overview')t.scene.fog=null;},view);
  const row=await page.evaluate(async name=>{
   const t=window.groveScene,gl=t.renderer.getContext();
   const change=old=>{t.beforeForest.visible=t.beforeDecor.visible=old;t.afterForest.visible=t.afterDecor.visible=!old;};
   const sample=async()=>{const times=[];let info;for(let i=0;i<26;i++){await new Promise(requestAnimationFrame);t.renderer.info.reset();const at=performance.now();t.renderer.render(t.scene,t.camera);gl.finish();if(i>=10)times.push(performance.now()-at);info={...t.renderer.info.render};}times.sort((a,b)=>a-b);return {ms:times[Math.floor(times.length/2)],calls:info.calls,triangles:info.triangles};};
   change(true);const before=await sample();change(false);const after=await sample();change(true);const control=await sample();change(false);t.renderer.render(t.scene,t.camera);
   return {name,...after,before,control,stable:Math.abs(before.ms-control.ms)/((before.ms+control.ms)/2)<.15};
  },view.name);rows.push(row);await page.screenshot({path:output+'-'+view.name+'.png'});
 }
 await writeFile(output+'.json',JSON.stringify({inventory,rows,errors},null,2));console.log(JSON.stringify({output,inventory,rows,errors},null,2));if(errors.length)throw Error('Scene errors');
}finally{await browser.close();}
