// Actual game: shared ground silhouettes and no forest shadow-map draws.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.env.GAME_URL??'http://127.0.0.1:5174/';
const out=new URL('../node_modules/.cache/',import.meta.url);await mkdir(out,{recursive:true});
const prefix=new URL('painted-tree-shadows',out).pathname.replace(/^\/([A-Za-z]:)/,'$1');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 const source=await (await page.request.get(url+'src/tree-shadows.ts')).text(),three=[...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>m[1]).find(s=>s.includes('/three.js'));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nwindow.treeView={scene,camera,renderer,shadows,celestialLighting,updateTreeShadows,updateSky,setupShadowMaterials,get c(){return character}};'});});
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Тени');await page.locator('#start-game').click();await page.waitForTimeout(200);
 const inventory=await page.evaluate(()=>{
  const t=window.treeView;t.renderer.setAnimationLoop(null);document.querySelectorAll('body > :not(#game)').forEach(el=>el.style.display='none');
  const forest=t.scene.getObjectByName('Four woodland biomes');let casters=0,instances=0,batches=0;
  forest.traverse(o=>{if(o.isMesh&&o.castShadow)casters++;});
  t.scene.traverse(o=>{if(o.name==='Soft patterned tree shadows')o.traverse(m=>{if(m.isInstancedMesh){instances+=m.count;batches++;}});});
  return {trees:forest.userData.treePositions.length,forestDepthCasters:casters,paintedInstances:instances,paintedBatches:batches};
 });
 assert.equal(inventory.forestDepthCasters,0);assert.equal(inventory.paintedInstances,inventory.trees+1);
 const rows=[];
 for(const [name,eye,look,phase] of [
  ['birch',[115,7,-113],[115,0,-153],.22],['diagonal',[-205,8,-205],[205,8,205],.22],
  ['oak',[156,12,78],[135,0,39],.22],['night',[115,7,-113],[115,0,-153],.75],
  ['spruce',[-116,14,-107],[-120,0,-135],.22],['spruce-night',[-116,14,-107],[-120,0,-135],.75],
 ]){
  const row=await page.evaluate(async({eye,look,phase})=>{
   const t=window.treeView,{daylight}=await import('/src/day-cycle.ts'),day=daylight(phase);
   t.camera.position.fromArray(eye);t.camera.lookAt(...look);t.camera.updateMatrixWorld();t.c.actor.position.set(eye[0],0,eye[2]);
   t.celestialLighting.update(day);t.updateTreeShadows(day);t.updateSky(0,t.camera,day);t.shadows.update();
   t.renderer.toneMappingExposure=1+day.day*.2;
   const gl=t.renderer.getContext(),times=[];let counts;
   for(let i=0;i<42;i++){await new Promise(requestAnimationFrame);t.renderer.info.reset();const at=performance.now();t.renderer.render(t.scene,t.camera);gl.finish();if(i>=12)times.push(performance.now()-at);counts={...t.renderer.info.render};}
   return {ms:times.sort((a,b)=>a-b)[Math.floor(times.length/2)],calls:counts.calls,triangles:counts.triangles};
  },{eye,look,phase});rows.push({name,...row});await page.screenshot({path:prefix+'-'+name+'.png'});
 }
 // The same frozen camera/time must produce identical shadow pixels; animation
 // is paused and there is no random frame-dependent shadow sampling.
 const first=await page.screenshot();await page.evaluate(()=>{const t=window.treeView;for(let i=0;i<10;i++)t.renderer.render(t.scene,t.camera);});
 const repeated=await page.screenshot();assert(first.equals(repeated),'Stationary shadows must not alternate between frames');
 const density=await page.evaluate(async three=>{
  const T=await import(three),{daylight}=await import('/src/day-cycle.ts'),t=window.treeView;
  // Reuse the live game's material/uniforms, avoiding a second Vite module instance.
  const source=t.scene.getObjectByName('Soft patterned tree shadows').children[0];
  for(const o of t.scene.children)if(!o.isLight)o.visible=false;
  t.scene.fog=null;
  const plane=new T.Mesh(new T.PlaneGeometry(80,80).rotateX(-Math.PI/2),new T.MeshLambertMaterial({color:'#66874b'}));plane.position.y=-.012;plane.receiveShadow=true;
  const cube=new T.Mesh(new T.BoxGeometry(2,4,2),new T.MeshLambertMaterial({color:'#aaaaaa'}));cube.position.set(-5,2,0);cube.castShadow=true;
  const tile=new T.Group(),mesh=new T.InstancedMesh(source.geometry,source.material,1);tile.add(mesh);
  mesh.setMatrixAt(0,new T.Matrix4().compose(new T.Vector3(10,.018,0),new T.Quaternion(),new T.Vector3(3.65,1,3.65)));
  mesh.setColorAt(0,new T.Color(0,source.material.map.userData.projections[0].aspect,0));
  t.scene.add(plane,cube,tile);t.setupShadowMaterials();
  const mat=tile.children[0].material,map=mat.map,w=map.userData.atlas.size,{padding,tile:stride}=map.userData.atlas;
  const crop=kind=>{const pixels=new Uint8Array(w*w*4);for(let y=0;y<w;y++)pixels.set(map.image.data.subarray(((y+padding)*map.image.width+kind*stride+padding)*4,((y+padding)*map.image.width+kind*stride+padding+w)*4),y*w*4);return pixels;},data=crop(0);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=w;const ctx=canvas.getContext('2d'),img=ctx.createImageData(w,w);img.data.set(data);ctx.putImageData(img,0,0);
  ctx.globalCompositeOperation='destination-over';ctx.fillStyle='white';ctx.fillRect(0,0,w,w);t.maskPNG=canvas.toDataURL('image/png');
  ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,w,w);img.data.set(crop(1));ctx.putImageData(img,0,0);ctx.globalCompositeOperation='destination-over';ctx.fillStyle='white';ctx.fillRect(0,0,w,w);t.spruceMaskPNG=canvas.toDataURL('image/png');
  const shader={uniforms:{},vertexShader:'',fragmentShader:''};mat.onBeforeCompile(shader,t.renderer);
  let index=0,distance=Infinity;
  for(let i=3;i<data.length;i+=4)if(data[i]>=250){const p=(i-3)/4,x=p%w,y=Math.floor(p/w),d=Math.hypot(x/w-.5,y/w-.72);if(d<distance){distance=d;index=p;}}
  const u=(index%w+.5)/w,v=(Math.floor(index/w)+.5)/w;
  t.camera.position.set(5,25,35);t.camera.lookAt(5,0,0);t.camera.updateMatrixWorld();
  const gl=t.renderer.getContext(),size=t.renderer.getDrawingBufferSize(new T.Vector2()),pixel=new Uint8Array(4);
  const read=point=>{const q=point.clone().project(t.camera);gl.readPixels(Math.floor((q.x*.5+.5)*size.x),Math.floor((q.y*.5+.5)*size.y),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return [...pixel.slice(0,3)];};
  const luma=rgb=>.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2],result=[];
  for(const phase of [.25,.75]){
   const day=daylight(phase);t.celestialLighting.update(day);t.updateTreeShadows(day);t.renderer.toneMappingExposure=1+day.day*.2;t.shadows.update();
   for(let i=0;i<3;i++)t.renderer.render(t.scene,t.camera);gl.finish();
   const d=shader.uniforms.treeShadowDirection.value,s=shader.uniforms.treeShadowStretch.value,lx=(u*2-1)*3.65,lz=v*2*3.65*s*map.userData.projections[0].aspect;
   const painted=read(new T.Vector3(10+d.y*lx+d.x*lz,0,-d.x*lx+d.y*lz));
   const ordinary=read(new T.Vector3(-5+day.shadowDirection[0]*2/-day.shadowDirection[1],0,day.shadowDirection[2]*2/-day.shadowDirection[1]));
   const lit=read(new T.Vector3(0,0,12));result.push({phase,opacity:mat.opacity,lit,ordinary,painted,ordinaryDarkening:1-luma(ordinary)/luma(lit),paintedDarkening:1-luma(painted)/luma(lit)});
  }
  return {sources:map.userData.projections,samples:result};
 },three);
 for(const sample of density.samples){
  assert(sample.paintedDarkening<sample.ordinaryDarkening*.85,'Tree shadows should reflect the reduced intensity');
  assert(sample.paintedDarkening>sample.ordinaryDarkening*.70,'Tree shadows should still read clearly');
 }
 await writeFile(prefix+'-mask.png',Buffer.from((await page.evaluate(()=>window.treeView.maskPNG)).split(',')[1],'base64'));
 await writeFile(prefix+'-spruce-mask.png',Buffer.from((await page.evaluate(()=>window.treeView.spruceMaskPNG)).split(',')[1],'base64'));
 assert.deepEqual(errors,[]);const result={inventory,rows,stationaryPixelsIdentical:true,density,errors};
 await writeFile(prefix+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
