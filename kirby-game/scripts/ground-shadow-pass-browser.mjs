import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.env.GAME_URL??'http://127.0.0.1:5181/',out=new URL('../node_modules/.cache/ground-shadow-pass/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:960,height:600}});
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text());}});
 const source=await (await page.request.get(url+'src/prepared-shadows.ts')).text(),three=[...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>m[1]).find(s=>s.includes('/three.js'));
 assert(three,'resolve the same Three module as the game');
 await page.route('**/__ground-shadow-test',route=>route.fulfill({contentType:'text/html',body:`<html><body style="margin:0"><script type="module">import * as T from ${JSON.stringify(three)};import {GroundShadowPass} from '/src/ground-shadow-pass.ts';import {ProjectedStructureShadows,connectedArchShadowGeometry} from '/src/projected-structure-shadows.ts';import {SkyTrailShadows} from '/src/sky-trail-shadows.ts';import {PreparedShadows} from '/src/prepared-shadows.ts';import {daylight,phaseAtHour} from '/src/day-cycle.ts';window.qa={T,GroundShadowPass,PreparedShadows,daylight,phaseAtHour,ProjectedStructureShadows,connectedArchShadowGeometry,SkyTrailShadows};</script></body></html>`}));
 await page.goto(url+'__ground-shadow-test');await page.waitForFunction(()=>window.qa);
 const union=await page.evaluate(()=>{
  const {T,GroundShadowPass}=qa,r=new T.WebGLRenderer({antialias:true,stencil:true});r.setSize(960,600);document.body.append(r.domElement);
  const scene=new T.Scene();scene.background=new T.Color('white');const camera=new T.OrthographicCamera(-14,14,8.75,-8.75,.75,100);camera.position.set(0,30,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);
  const ground=new T.Mesh(new T.PlaneGeometry(80,80).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:'white',toneMapped:false}));ground.position.y=-.012;scene.add(ground);
  const shadows=new T.Group();shadows.userData.preparedShadow=true;scene.add(shadows);
  const solid=new T.MeshBasicMaterial({color:'black',transparent:true,opacity:.512,depthWrite:false,toneMapped:false}),glass=solid.clone();glass.opacity=.512*.32;
  const geometry=new T.PlaneGeometry(6,6).rotateX(-Math.PI/2);
  for(const [x,m] of [[-2,solid],[2,solid],[8,glass],[0,glass],...Array.from({length:12},()=>[-2,solid])]){const mesh=new T.Mesh(geometry,m);mesh.position.set(x,.018,0);shadows.add(mesh);}
  const occluder=new T.Mesh(new T.BoxGeometry(1,2,1),new T.MeshBasicMaterial({color:'white',toneMapped:false}));occluder.position.set(-4,1,0);scene.add(occluder);
  const pass=new GroundShadowPass(r,scene),gl=r.getContext(),pixel=new Uint8Array(4),sample=(x,z)=>{const p=new T.Vector3(x,.018,z).project(camera);gl.readPixels(Math.floor((p.x+1)*480),Math.floor((p.y+1)*300),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return pixel[0];};
  const rows=[];for(let i=0;i<20;i++){camera.position.set(Math.sin(i)*.025,30,Math.cos(i)*.025);camera.lookAt(0,0,0);r.render(scene,camera);rows.push({solid:sample(-4,2),overlap:sample(0,0),glass:sample(8,0),occluded:sample(-4,0)});}
  qa.renderer=r;qa.scene=scene;qa.camera=camera;qa.pass=pass;return {rows,glError:gl.getError(),depthBits:gl.getParameter(gl.DEPTH_BITS),bytes:pass.mask.width*pass.mask.height*5};
 });
 console.log(JSON.stringify({union}));assert.equal(union.glError,0);assert(union.rows.every(r=>Math.abs(r.solid-125)<=1&&Math.abs(r.overlap-r.solid)<=1&&Math.abs(r.glass-213)<=1&&r.occluded===255));
 await page.screenshot({path:new URL('maximum-coverage.png',out).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 const atlasBoundary=await page.evaluate(()=>{
  const {T,GroundShadowPass,PreparedShadows,daylight,phaseAtHour}=qa,r=qa.renderer,scene=new T.Scene();scene.background=new T.Color('white');
  const ground=new T.Mesh(new T.PlaneGeometry(80,80).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:'white',toneMapped:false}));ground.position.y=-.012;scene.add(ground);
  const shadows=new PreparedShadows();scene.add(shadows.group);let selected;
  // Eight profiles use two atlas columns. ID 6 is exactly on a row boundary,
  // which used to round down under perspective interpolation and visibly flash.
  for(let i=0;i<8;i++){const geometry=new T.BoxGeometry(6,2,6).translate(0,1,0),p=shadows.geometryProfile(geometry);if(i===6)selected=p;}
  shadows.add(selected,new T.Matrix4());shadows.commit();new GroundShadowPass(r,scene);
  const camera=new T.PerspectiveCamera(48,1.6,.75,200),gl=r.getContext(),pixel=new Uint8Array(4);let min=255,max=0,samples=0;
  for(let i=0;i<24;i++){
   camera.position.set(14+Math.sin(i*.4)*2,13,16+Math.cos(i*.4)*2);camera.lookAt(0,0,0);camera.updateMatrixWorld();shadows.update(daylight(phaseAtHour(9)),camera.position);r.render(scene,camera);
   for(let x=-1.5;x<=1.5;x+=.375)for(let z=-1.5;z<=1.5;z+=.375){const p=new T.Vector3(x,.018,z).project(camera);gl.readPixels(Math.floor((p.x+1)*480),Math.floor((p.y+1)*300),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);min=Math.min(min,pixel[0]);max=Math.max(max,pixel[0]);samples++;}
  }
  return {min,max,samples,glError:gl.getError()};
 });
 console.log(JSON.stringify({atlasBoundary}));assert.equal(atlasBoundary.glError,0);assert(atlasBoundary.min>=123&&atlasBoundary.max<=126&&atlasBoundary.max-atlasBoundary.min<=1,'an atlas row ID must not flicker under perspective camera motion');
 const sky=await page.evaluate(()=>{
  const {T,GroundShadowPass,SkyTrailShadows,daylight,phaseAtHour}=qa,r=qa.renderer,scene=new T.Scene();scene.background=new T.Color('white');
  const ground=new T.Mesh(new T.PlaneGeometry(400,400).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:'white',toneMapped:false}));ground.position.y=-.012;scene.add(ground);
  const shadows=new SkyTrailShadows(new T.Matrix4().makeTranslation(50,0,-60));scene.add(shadows.group);new GroundShadowPass(r,scene);
  const camera=new T.PerspectiveCamera(48,1.6,.75,600);camera.position.set(-10,105,-155);camera.lookAt(43,0,-100);camera.updateMatrixWorld();shadows.update(daylight(phaseAtHour(9)),camera.position);r.render(scene,camera);
  const gl=r.getContext(),pixels=new Uint8Array(960*600*4),read=()=>{gl.readPixels(0,0,960,600,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let covered=0,min=255;for(let i=0;i<pixels.length;i+=4){if(pixels[i]<245)covered++;min=Math.min(min,pixels[i]);}return {covered,min};};
  const regular=read();shadows.group.traverse(o=>o.frustumCulled=false);r.render(scene,camera);const unbounded=read();shadows.material.depthTest=false;r.render(scene,camera);const noDepth=read();shadows.material.depthTest=true;
  return {...regular,unbounded,noDepth,glError:gl.getError()};
 });
 console.log(JSON.stringify({sky}));assert.equal(sky.glError,0);assert(sky.covered>500&&sky.min>=211&&sky.min<=215,'high platforms must cast visible, translucent volume silhouettes');
 await page.screenshot({path:new URL('sky-silhouettes.png',out).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 assert.deepEqual(errors,[]);await writeFile(new URL('report.json',out),JSON.stringify({union,atlasBoundary,sky,errors},null,2));
}finally{await browser.close();}
