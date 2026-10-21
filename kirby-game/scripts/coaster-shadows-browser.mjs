import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.env.GAME_URL??'http://127.0.0.1:5181/',out=new URL('../node_modules/.cache/coaster-shadows/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text())){errors.push(m.text());console.error(m.text());}});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nwindow.shadowView={T:THREE,scene,camera,renderer,shadows,celestialLighting,preparedShadows,coaster,updateTreeShadows,updateSky,get c(){return character}};'});});
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Утренние тени');await page.locator('#start-game').click({timeout:180000});await page.waitForFunction(()=>window.shadowView?.c,null,{timeout:180000});
 const arch=await page.evaluate(async()=>{
  const t=window.shadowView;t.renderer.setAnimationLoop(null);document.querySelectorAll('body > :not(#game)').forEach(el=>el.style.display='none');
  const {LANDMARKS}=await import('/src/landmark-sites.ts');return LANDMARKS[11];
 });
 const rows=[];
 for(const [name,eye,look] of [
  ['arch-09',[arch.x-16,18,arch.z-24],[arch.x,2,arch.z]],
  ['oak-09',[112,28,1],[135,7,45]],['home-09',[114,15,106],[135,2,135]],
 ]){
  const row=await page.evaluate(async({eye,look})=>{
   const t=window.shadowView,{daylight,phaseAtHour}=await import('/src/day-cycle.ts'),light=daylight(phaseAtHour(9));
   t.camera.position.fromArray(eye);t.camera.lookAt(...look);t.camera.updateMatrixWorld();t.celestialLighting.update(light);t.updateTreeShadows(light);t.updateSky(0,t.camera,light);t.shadows.update();t.preparedShadows.update(light,t.camera.position);t.renderer.toneMappingExposure=1+light.day*.2;
   const gl=t.renderer.getContext(),times=[];for(let i=0;i<30;i++){await new Promise(requestAnimationFrame);const start=performance.now();t.renderer.render(t.scene,t.camera);gl.finish();if(i>=10)times.push(performance.now()-start);}
   return {ms:times.sort((a,b)=>a-b)[Math.floor(times.length/2)],...t.renderer.info.render};
  },{eye,look});rows.push({name,...row});await page.screenshot({path:new URL(name+'.png',out).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 }
 const singleSource=await page.evaluate(async()=>{
  const t=window.shadowView,T=t.T,{PreparedShadows,groundShadowProjection}=await import('/src/prepared-shadows.ts'),{daylight,phaseAtHour}=await import('/src/day-cycle.ts');
  const scene=new T.Scene();scene.background=new T.Color('white');
  const shadow=new PreparedShadows();scene.add(shadow.group);
  const geometry=new T.BoxGeometry(.6,8,.6).translate(0,4,0);shadow.add(shadow.geometryProfile(geometry),new T.Matrix4());shadow.commit();
  const camera=new T.OrthographicCamera(-14,14,14,-14,.1,60);camera.position.set(0,40,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const size=512,target=new T.WebGLRenderTarget(size,size),pixels=new Uint8Array(size*size*4),rows=[];
  for(let i=0;i<16;i++){
   const angle=i*Math.PI/8,dx=Math.sin(angle),dz=Math.cos(angle),light={...daylight(phaseAtHour(9)),shadowDirection:[dx,-1,dz]};
   shadow.update(light,camera.position);t.renderer.setRenderTarget(target);t.renderer.render(scene,camera);t.renderer.readRenderTargetPixels(target,0,0,size,size,pixels);t.renderer.setRenderTarget(null);
   let runs=0,inside=false,width=0,min=255;
   for(let p=0;p<pixels.length;p+=4)min=Math.min(min,pixels[p]);
   const along=groundShadowProjection(light).length()*8*.65;
   for(let across=-7;across<=7;across+=.04){
    const point=new T.Vector3(dx*along+dz*across,.018,dz*along-dx*across).project(camera),x=Math.min(size-1,Math.max(0,Math.floor((point.x+1)*size/2))),y=Math.min(size-1,Math.max(0,Math.floor((point.y+1)*size/2)));
    const filled=pixels[(y*size+x)*4]<230;if(filled&&!inside)runs++;inside=filled;if(filled)width+=.04;
   }
   rows.push({angle,runs,width,density:(255-min)/255});
  }
  target.dispose();geometry.dispose();return rows;
 });
 assert(singleSource.every(row=>row.runs===1&&row.width<1.4),'one light must cast one narrow post shadow between baked directions');
 assert(singleSource.every(row=>Math.abs(row.density-.512)<.02),'solid silhouettes must retain the established tree shadow density');
 const archContinuity=await page.evaluate(async()=>{
  const t=window.shadowView,T=t.T,{ProjectedStructureShadows,connectedArchShadowGeometry}=await import('/src/projected-structure-shadows.ts'),{daylight,phaseAtHour}=await import('/src/day-cycle.ts'),{groundShadowProjection,projectGroundShadow}=await import('/src/prepared-shadows.ts');
  const scene=new T.Scene();scene.background=new T.Color('white');const shadow=new ProjectedStructureShadows();scene.add(shadow.group);
  // Test the silhouette itself in a target. Union density is checked by the
  // real canvas compositor in ground-shadow-pass-browser.mjs.
  shadow.add(connectedArchShadowGeometry(),new T.Matrix4());shadow.commit();
  const size=768,target=new T.WebGLRenderTarget(size,size),pixels=new Uint8Array(size*size*4),rows=[];
  const camera=new T.PerspectiveCamera(48,1,.75,150);camera.position.set(-16,34,-23);camera.lookAt(0,0,3);camera.updateMatrixWorld();
  const points=[];for(const x of [-3,3])for(let y=.15;y<=4.3;y+=.15)points.push(new T.Vector3(x,y,0));
  for(let i=0;i<=64;i++){const a=i*Math.PI/64;points.push(new T.Vector3(3*Math.cos(a),4.3+3*Math.sin(a),0));}
  for(const hour of [7,9,12,15,17,21]){
   const light=daylight(phaseAtHour(hour)),projection=groundShadowProjection(light);shadow.update(light,camera.position);
   t.renderer.setRenderTarget(target);t.renderer.render(scene,camera);t.renderer.readRenderTargetPixels(target,0,0,size,size,pixels);t.renderer.setRenderTarget(null);
   let min=255,covered=0;for(let i=0;i<pixels.length;i+=4)min=Math.min(min,pixels[i]);
   for(const p of points){const q=projectGroundShadow(p,projection);q.y=.022;q.project(camera);const x=Math.floor((q.x+1)*size/2),y=Math.floor((q.y+1)*size/2);if(x>=0&&x<size&&y>=0&&y<size&&pixels[(y*size+x)*4]<235)covered++;}
   rows.push({hour,coverage:covered/points.length,density:(255-min)/255});
  }
  target.dispose();return rows;
 });
 assert(archContinuity.every(row=>row.coverage>.99),'both piers and every part of the arch crown must cast a continuous shadow');
 const track=await page.evaluate(async()=>{
  const t=window.shadowView,{daylight,phaseAtHour}=await import('/src/day-cycle.ts'),{groundShadowProjection,projectGroundShadow}=await import('/src/prepared-shadows.ts');
  const light=daylight(phaseAtHour(9)),projection=groundShadowProjection(light),railway=t.preparedShadows.group.getObjectByName('Prepared continuous railway shadows');
  const sources=t.coaster.group.children.filter(o=>o.name.startsWith('Rounded coaster cart ')||o.name==='Meta Knight coaster cart');sources.forEach((o,i)=>o.visible=i===0);
  let distance=0;for(let i=0;i<2400;i++){const d=i/2400*t.coaster.length,p=t.coaster.pose(d).p;if(p.x>215&&p.z>35&&p.z<120&&p.y>20){distance=d;break;}}
  t.trackTest={light,projection,railway,source:sources[0],distance};
  const anchor=projectGroundShadow(t.coaster.pose(distance).p,projection);
  t.camera.position.set(anchor.x+22,42,anchor.z+28);t.camera.lookAt(anchor.x,0,anchor.z);t.camera.updateMatrixWorld();
  for(const o of t.scene.children)o.visible=o===t.preparedShadows.group;
  for(const o of t.preparedShadows.group.children)o.visible=o===railway;
  t.scene.background.set('#ffffff');t.scene.fog=null;
  let cells=0,triangles=0;railway.traverse(o=>{if(o.isMesh&&o.name==='Continuous railway shadow cell'){cells++;triangles+=o.geometry.index.count/3;}});
  return {cells,triangles,carts:railway.getObjectByName('Cart shadows on railway').count};
 });
 const alignments=[];
 for(let frame=0;frame<5;frame++){
  const alignment=await page.evaluate(async frame=>{
   const t=window.shadowView,{projectGroundShadow}=await import('/src/prepared-shadows.ts'),{light,projection,source,distance}=t.trackTest,pose=t.coaster.pose(distance+frame*2);
   source.position.copy(pose.p);source.quaternion.copy(pose.q);t.preparedShadows.update(light,t.camera.position);
   const cart=projectGroundShadow(source.position,projection),left=projectGroundShadow(pose.p.clone().add(pose.p.clone().set(-1.2,0,0).applyQuaternion(pose.q)),projection),right=projectGroundShadow(pose.p.clone().add(pose.p.clone().set(1.2,0,0).applyQuaternion(pose.q)),projection);
   for(let i=0;i<3;i++)t.renderer.render(t.scene,t.camera);
   return cart.distanceTo(left.add(right).multiplyScalar(.5));
  },frame);alignments.push(alignment);await page.screenshot({path:new URL('track-09-'+frame+'.png',out).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 }
 assert.equal(track.carts,13);assert(track.cells>10&&track.triangles<20000);assert(alignments.every(d=>d<1e-5));assert.deepEqual(errors,[]);
 const result={hour:9,rows,singleSource,archContinuity,track,alignments,errors};await writeFile(new URL('report.json',out),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
