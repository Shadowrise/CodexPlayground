import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5174/?perf=1');await page.waitForSelector('#startup-loader',{state:'hidden',timeout:120000});await page.waitForFunction(()=>window.kirbyPerformance);
 const report=await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js');const {scene,camera,renderer,shadows}=window.kirbyPerformance;renderer.setAnimationLoop(null);
  document.querySelectorAll('body > :not(#game)').forEach(e=>{e.style.display='none'});
  scene.background=new T.Color('#aac8d6');const sky=scene.getObjectByName('Daylight sky gradient');sky.material.uniforms.top.value.set('#93c8ed');sky.material.uniforms.horizon.value.set('#d8e9eb');scene.getObjectByName('Drifting clouds').material.color.set('#fffaf0');if(scene.fog){scene.fog.color.set('#aac8d6');scene.fog.near=180;scene.fog.far=650;}
  scene.traverse(o=>{if(o.isHemisphereLight)o.intensity=2.2;});shadows.lights.forEach(l=>{l.intensity=2.3;l.color.set('#fff1d5')});shadows.lightDirection.set(-.5,-1,-.3).normalize();
  camera.position.set(207,62,40);camera.lookAt(140,0,-45);camera.updateMatrixWorld();shadows.update();
  const roaming=scene.getObjectByName('Топотушка — прогулка по арене');if(!roaming)throw Error('Missing roaming centipede');roaming.visible=true;
  const arena=scene.getObjectByName('Арена Топотушки');let meshes=0,triangles=0;arena.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
  renderer.render(scene,camera);const withArena=renderer.info.render.calls;arena.visible=false;renderer.render(scene,camera);const withoutArena=renderer.info.render.calls;arena.visible=true;renderer.render(scene,camera);
  const trees=scene.getObjectByName('Four woodland biomes').userData.treePositions;const overlaps=trees.filter(p=>Math.hypot(p.x-140,p.z+45)<46+p.crownRadius);
  return {meshes,triangles,withArena,withoutArena,treeOverlaps:overlaps.length};
 });
 await page.screenshot({path:fileURLToPath(new URL('../public/models/boss-arena-overview.png',import.meta.url))});
 await page.evaluate(()=>{const {scene,camera,renderer,shadows}=window.kirbyPerformance;camera.position.set(140,6.5,20);camera.lookAt(140,5,-20);camera.updateMatrixWorld();shadows.update();renderer.render(scene,camera);});await page.screenshot({path:fileURLToPath(new URL('../public/models/boss-arena-entry.png',import.meta.url))});
 await page.evaluate(()=>{const {scene,camera,renderer,shadows}=window.kirbyPerformance;const boss=scene.getObjectByName('Топотушка — прогулка по арене');boss.updateMatrixWorld(true);const p=boss.getObjectByName('Segment_5').getWorldPosition(camera.position.clone());camera.position.copy(p).add({x:19,y:13,z:23});camera.lookAt(p.x,2,p.z);camera.updateMatrixWorld();shadows.update();renderer.render(scene,camera);});
 await page.screenshot({path:fileURLToPath(new URL('../public/models/topotushka-on-arena.png',import.meta.url))});
 if(report.meshes>5||report.triangles>45000||report.withArena-report.withoutArena>5||report.treeOverlaps)throw Error('Arena budget/clearance regression');
 console.log(JSON.stringify({report,errors}));if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
