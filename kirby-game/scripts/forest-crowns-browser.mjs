import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';

const url=process.env.GAME_URL??'http://127.0.0.1:5174/',output=process.env.TEMP+'/kirby-forest-crowns'+(process.env.STYLE_MOBILE==='1'?'-mobile':'');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage(process.env.STYLE_MOBILE==='1'?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/Game startup failed|THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('kirby-language-v1','ru'));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.crownScene={scene,camera,renderer,shadows,get c(){return character},set day(v){dayStart=Date.now();dayStartPhase=v}};'});});
 await page.goto(url);
 await Promise.race([page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000}),page.locator('#loading-retry').waitFor({state:'visible',timeout:120000}).then(()=>{throw Error('Scene startup failed: '+errors.join('\n'));})]);
 await page.locator('#player-name-input').fill('Кроны');await page.locator('#new-game').click();await page.locator('#start-game').click();
 await page.evaluate(()=>window.crownScene.day=.25);await page.waitForTimeout(250);
 await page.evaluate(()=>{window.crownScene.renderer.setAnimationLoop(null);document.querySelectorAll('body > :not(#game)').forEach(e=>e.style.display='none');});
 const audit=await page.evaluate(async()=>{
  const {LOD,Matrix4,Vector3,Frustum}=await import('/node_modules/.vite/deps/three.js'),{ACTOR_DISTANCE}=await import('/src/visibility.ts'),t=window.crownScene,forest=t.scene.getObjectByName('Four woodland biomes');
  forest.updateMatrixWorld(true);
  const lods=[],matrix=new Matrix4(),center=new Vector3(),edge=new Vector3(),frustum=new Frustum(),projection=new Matrix4();
  forest.traverse(o=>{if(o instanceof LOD&&/Decorative forest (leaves|birchLeaves|fruit)/.test(o.name))lods.push(o);});
  let approaches=0,rangeApproaches=0;
  for(const lod of lods){
   const full=lod.levels[0].object,r=full.boundingSphere.radius,c=lod.position;
   for(const side of [-1,1]){
    t.camera.position.copy(c).add(new Vector3(side*1000,0,0));t.camera.updateMatrixWorld();lod.update(t.camera);
    t.camera.position.copy(c).add(new Vector3(side*(r+ACTOR_DISTANCE-1),0,0));t.camera.lookAt(c);t.camera.updateMatrixWorld();lod.update(t.camera);
    if(lod.getCurrentLevel()!==0||!full.visible)throw Error('Crown or tree fruit did not return at the firefly range: '+lod.name);
    rangeApproaches++;
    // Start far away, then approach the most exposed crown in this batch.
    t.camera.position.copy(c).add(new Vector3(side*1000,0,0));t.camera.updateMatrixWorld();lod.update(t.camera);
    let best=-Infinity;
    for(let i=0;i<full.count;i++){
     full.getMatrixAt(i,matrix);center.setFromMatrixPosition(matrix);
     if(center.x*side>best){best=center.x*side;edge.copy(center);}
    }
    t.camera.position.copy(c).add(edge).add(new Vector3(side*3,0,0));
    t.camera.lookAt(c.x+edge.x,c.y+edge.y,c.z+edge.z);t.camera.updateMatrixWorld();
    lod.update(t.camera);
    if(lod.getCurrentLevel()!==0||!full.visible)throw Error('Full crown did not return near a tree: '+lod.name);
    projection.multiplyMatrices(t.camera.projectionMatrix,t.camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);
    if(!frustum.intersectsObject(full))throw Error('A nearby visible crown was incorrectly culled');
    approaches++;
   }
  }
  // Also verify the actual renderer updates each LOD, not just direct calls.
  t.camera.position.copy(lods[0].position).add(new Vector3(900,50,900));t.camera.lookAt(lods[0].position);t.renderer.render(t.scene,t.camera);
  t.camera.position.copy(lods[0].position).add(new Vector3(0,0,3));t.camera.lookAt(lods[0].position);t.renderer.render(t.scene,t.camera);
  if(lods[0].getCurrentLevel()!==0)throw Error('Renderer did not restore the close level');
  return {batches:lods.length,fruitBatches:lods.filter(l=>l.name==='Decorative forest fruit').length,approaches,rangeApproaches};
 });
 const rows=[];
 for(const [name,x,z] of [['spruce',-112,-136],['birch',115,-125],['orchard',115,145],['autumn',-155,165]]){
  const row=await page.evaluate(async({name,x,z})=>{
   const t=window.crownScene,gl=t.renderer.getContext(),forest=t.scene.getObjectByName('Four woodland biomes'),lods=[];
   forest.traverse(o=>{if(o.isLOD){o.autoUpdate=false;lods.push(o);}});
   t.c.actor.position.set(x,0,z);t.camera.position.set(x,4.8,z+12);t.camera.lookAt(x,1,z-32);t.camera.updateMatrixWorld();t.shadows.update();
   const sample=async old=>{
    // Replay the previous 6m/65m surface-distance LOD in the same frozen world.
    for(const lod of lods){if(old){
     const distance=Math.max(0,t.camera.position.distanceTo(lod.position)-lod.radius)/t.camera.zoom;
     let current=0;
     for(let i=1;i<lod.levels.length;i++){if(distance<(i===1?6:65)*(lod.levels[i].object.visible?.85:1))break;current=i;}
     lod.levels.forEach((l,i)=>l.object.visible=i===current);
    }else lod.update(t.camera);}
    const times=[];let counts;for(let i=0;i<26;i++){await new Promise(requestAnimationFrame);t.renderer.info.reset();const at=performance.now();t.renderer.render(t.scene,t.camera);gl.finish();if(i>=10)times.push(performance.now()-at);counts={...t.renderer.info.render};}times.sort((a,b)=>a-b);return {ms:times[Math.floor(times.length/2)],calls:counts.calls,triangles:counts.triangles};
   };
   const before=await sample(true),after=await sample(false),control=await sample(true);await sample(false);lods.forEach(l=>l.autoUpdate=true);
   return {name,before,after,control};
  },{name,x,z});rows.push(row);await page.screenshot({path:output+'-'+name+'.png'});
 }
 await page.reload();await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.locator('#player-name-input').fill('Кроны');await page.locator('#new-game').click();await page.locator('#start-game').click();
 await page.evaluate(()=>window.crownScene.day=.75);await page.waitForTimeout(250);
 await page.evaluate(()=>{const t=window.crownScene;t.renderer.setAnimationLoop(null);document.querySelectorAll('body > :not(#game)').forEach(e=>e.style.display='none');t.c.actor.position.set(-112,0,-136);t.camera.position.set(-112,4.8,-124);t.camera.lookAt(-112,1,-168);t.camera.updateMatrixWorld();t.shadows.update();t.renderer.render(t.scene,t.camera);});
 await page.screenshot({path:output+'-night.png'});
 await writeFile(output+'.json',JSON.stringify({audit,rows,errors},null,2));console.log(JSON.stringify({output,audit,rows,errors},null,2));if(errors.length)throw Error('Scene errors');
}finally{await browser.close();}
