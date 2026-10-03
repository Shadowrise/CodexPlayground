import {chromium} from 'playwright';
import assert from 'node:assert/strict';

// Isolate the attraction from the rest of the meadow so before/after costs are comparable.
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page=await browser.newPage({viewport:{width:960,height:640}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.route('**/__sky-trail-benchmark',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0"></body></html>'}));
 await page.goto('http://127.0.0.1:5173/__sky-trail-benchmark');
 const report=await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js');
  const {SkyTrail}=await import('/src/sky-trail.ts');
  const {CSM}=await import('/node_modules/three/examples/jsm/csm/CSM.js');
  const scene=new T.Scene();scene.background=new T.Color('#9dbbd3');
  const trail=new SkyTrail();trail.group.position.set(0,0,0);scene.add(trail.group);
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(1);renderer.setSize(960,640);renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;document.body.append(renderer.domElement);
  const camera=new T.PerspectiveCamera(48,1.5,.75,1200);
  scene.add(new T.HemisphereLight('#e6f3ff','#69934d',2.2));
  const shadows=new CSM({camera,parent:scene,cascades:2,maxFar:300,mode:'practical',shadowMapSize:1024,lightDirection:new T.Vector3(-1,-2,-1).normalize(),lightIntensity:3.2,lightNear:1,lightFar:1400,lightMargin:250});
  shadows.fade=true;shadows.updateFrustums();
  const materials=new Set();trail.group.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.isMeshStandardMaterial&&!materials.has(m)){materials.add(m);shadows.setupMaterial(m);}});
  const samples=[];
  for(const [name,position,target] of [
   ['overview',[65,34,72],[0,23,0]],
   ['under-platforms',[1,2,25],[0,24,0]],
   ['rainbow',[6,27,30],[0,25,0]],
  ]){
   camera.position.fromArray(position);camera.lookAt(...target);camera.updateMatrixWorld();shadows.update();
   for(let i=0;i<15;i++){trail.update(1/60);renderer.render(scene,camera);}
   const times=[];
   for(let i=0;i<40;i++){
    await new Promise(requestAnimationFrame);
    const start=performance.now();trail.update(1/60);renderer.render(scene,camera);renderer.getContext().finish();times.push(performance.now()-start);
   }
   times.sort((a,b)=>a-b);samples.push({name,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,medianMs:times[20],p90Ms:times[36]});
  }
  camera.position.set(65,34,72);camera.lookAt(0,23,0);camera.updateMatrixWorld();shadows.update();renderer.render(scene,camera);
  return {samples,geometries:renderer.info.memory.geometries,programs:renderer.info.programs.length};
 });
 if(process.env.SKY_SCREENSHOT)await page.screenshot({path:process.env.SKY_SCREENSHOT});
 assert(report.samples[0].calls<110,'Overview should remain below 110 draw calls');
 assert.deepEqual(errors,[]);console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
