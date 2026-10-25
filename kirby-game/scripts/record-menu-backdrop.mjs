import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
const server=await createServer({server:{host:'127.0.0.1',port:5299,strictPort:true}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',error=>console.error(error.message));
 await page.route('**/record-menu',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><script type="module" src="/scripts/menu-backdrop-recording.ts"></script>'}));
 await page.goto('http://127.0.0.1:5299/record-menu',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.menuRecording,null,{timeout:120000});
 const checks=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {draw,models,flight,firefly,glowMesh,halo}=window.menuRecording;
  const bounds=model=>{
   let min=Infinity,max=-Infinity,minY=1,maxY=0;model.updateWorldMatrix(true,true);
   model.traverse(mesh=>{if(!mesh.isMesh)return;mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
     const p=new T.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld).project(window.menuRecording.camera);min=Math.min(min,p.x);max=Math.max(max,p.x);minY=Math.min(minY,(1-p.y)/2);maxY=Math.max(maxY,(1-p.y)/2);
    }
   });return {min,max,minY,maxY};
  };
  let centralGapPixels=Infinity,noseAlignment=1,glowOffset=0;
  const characterBounds=models.map(()=>({minX:1,maxX:0,minY:1,maxY:0}));
  for(let i=0;i<72;i++){
   const time=i/6;draw(time-.001);const before=flight.position.clone();draw(time+.001);const velocity=flight.position.clone().sub(before).setY(0).normalize();draw(time);
   const nose=firefly.object.getObjectByName('Head').getWorldPosition(new T.Vector3()).sub(glowMesh.getWorldPosition(new T.Vector3())).setY(0).normalize();
   noseAlignment=Math.min(noseAlignment,nose.dot(velocity));
   const boxes=models.map(bounds),left=boxes[4],right=boxes[5];centralGapPixels=Math.min(centralGapPixels,(right.min-left.max)*640);
   boxes.forEach((box,index)=>{const out=characterBounds[index];out.minX=Math.min(out.minX,(box.min+1)/2);out.maxX=Math.max(out.maxX,(box.max+1)/2);out.minY=Math.min(out.minY,box.minY);out.maxY=Math.max(out.maxY,box.maxY);});
   glowOffset=Math.max(glowOffset,halo.getWorldPosition(new T.Vector3()).distanceTo(glowMesh.getWorldPosition(new T.Vector3())));
  }
  draw(0);const start=flight.position.clone(),orientation=flight.quaternion.clone();draw(12);
  const loopError=flight.position.distanceTo(start)+flight.quaternion.angleTo(orientation);draw(0);
  return {centralGapPixels,noseAlignment,glowOffset,loopError,characterBounds,glowColor:glowMesh.material.emissive.getHexString(),haloColor:halo.material.color.getHexString()};
 });
 console.log(JSON.stringify({recordingChecks:checks}));
 assert(checks.centralGapPixels>4,'central Kirby silhouettes need a visible gap throughout their idle animations');
 assert([1,4,5].every(index=>{const box=checks.characterBounds[index];return box.minY>.26&&box.maxY<.74;}),'the three moved Kirby models must fit vertically');
 assert(checks.noseAlignment>.999,'the actual head must lead the abdomen around the entire circle');
 assert(checks.glowOffset<.00001&&checks.loopError<.00001);assert.equal(checks.glowColor,'58ff76');assert.equal(checks.haloColor,'58ff76');
 const placement=await page.evaluate(()=>{
  const {models,flight,groundClearance,referenceScales,referencePositions,previousPositions,characterCenters,camera,flowerSites,foregroundFlowers,orchardShrubs,orchardGrass,plantingCoverage}=window.menuRecording;
  let flowerGap=Infinity;
  for(let i=0;i<flowerSites.length;i++)for(let j=i+1;j<flowerSites.length;j++){
   const a=flowerSites[i],b=flowerSites[j];flowerGap=Math.min(flowerGap,Math.hypot(a.x-b.x,a.z-b.z)-a.radius-b.radius);
  }
  return {referenceScales:models.every((model,index)=>model.scale.x===referenceScales[index]&&model.scale.y===referenceScales[index]&&model.scale.z===referenceScales[index]),unchangedOtherKirbys:[0,2,3].every(index=>models[index].position.distanceTo(referencePositions[index])<1e-8),groundClearance:[1,4,5].map(index=>groundClearance(models[index])),closer:[4,5].every(index=>models[index].position.distanceTo(camera.position)<previousPositions[index].distanceTo(camera.position)),movedRows:[1,4,5].map(index=>characterCenters[index].y),camera:camera.position.toArray(),fireflyScale:flight.scale.x,foregroundFlowers,flowers:flowerSites.length,flowerGap,orchardShrubs:orchardShrubs.count,orchardGrass:orchardGrass.count,plantingCoverage};
 });
 console.log(JSON.stringify({placement}));
 assert(placement.referenceScales&&placement.unchangedOtherKirbys&&placement.closer);assert.equal(placement.fireflyScale,1.5);
 assert(placement.groundClearance.every(clearance=>clearance>=.5),'the complete Kirby foot envelopes need at least half a metre of dry bank');
 assert.equal(placement.foregroundFlowers,262);assert(placement.flowers>placement.foregroundFlowers+100&&placement.flowerGap>=.3-1e-8,'keep the sparse foreground; add separate, spaced flowers under the trees');
 assert(placement.orchardShrubs>200&&placement.orchardGrass>10000);
 assert(placement.plantingCoverage.leftGrass>1000&&placement.plantingCoverage.backGrass>5000&&placement.plantingCoverage.leftShrubs>40&&placement.plantingCoverage.backShrubs>80&&placement.plantingCoverage.leftFlowers>30&&placement.plantingCoverage.backFlowers>80,'fill both the left edge and the back groves');
 assert.deepEqual(placement.camera,[26,15,48]);assert(Math.abs(placement.movedRows[0]-(508+18)/936)<.003&&placement.movedRows.slice(1).every(y=>Math.abs(y-.58)<.003));
 if(process.argv.includes('--preview')){
  await mkdir('node_modules/.cache/menu-backdrop-preview',{recursive:true});
  const poster=await page.screenshot({path:'node_modules/.cache/menu-backdrop-preview/meadow-filled-groves-scene.png'});
  const menu=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce',ignoreHTTPSErrors:true});
  await menu.addInitScript(()=>localStorage.setItem('kirby-language-v1','ru'));
  await menu.route('**/backgrounds/*.jpg*',route=>route.fulfill({body:poster,contentType:'image/png'}));
  await menu.route('**/world/environment.bin.gz*',()=>{});await menu.route('**/models/**',()=>{});
  await menu.goto('http://127.0.0.1:5299/',{waitUntil:'domcontentloaded'});
  await menu.locator('#startup-menu').waitFor({state:'visible',timeout:60000});await menu.locator('#startup-loader').waitFor({state:'hidden'});
  await menu.addStyleTag({url:'https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Manrope:wght@400;500;600;700;800&display=swap'});
  const fonts=await menu.evaluate(async()=>{await Promise.allSettled([document.fonts.load('700 32px Comfortaa'),document.fonts.load('400 16px Manrope'),document.fonts.load('700 16px Manrope')]);await document.fonts.ready;return [...new Set([...document.fonts].filter(font=>font.status==='loaded').map(font=>font.family))];});
  assert(fonts.includes('Comfortaa')&&fonts.includes('Manrope'));
  const button=await menu.locator('#load-game').boundingBox();assert(Math.abs(button.y+button.height/2-508)<3,'use the exact menu layout shown in the reference');
  await menu.screenshot({path:'node_modules/.cache/menu-backdrop-preview/meadow-filled-groves-menu.png'});
  console.log(JSON.stringify({preview:'node_modules/.cache/menu-backdrop-preview/meadow-filled-groves-menu.png',loadButtonCenter:button.y+button.height/2,fonts}));
 }else{
 await mkdir('public/backgrounds',{recursive:true});await page.screenshot({path:'public/backgrounds/meadow-menu-poster.jpg',type:'jpeg',quality:78});
 await mkdir('design/menu-backdrop',{recursive:true});
 await writeFile('design/menu-backdrop/composition.json',JSON.stringify({...await page.evaluate(()=>({width:1280,height:720,characterCenters:window.menuRecording.characterCenters})),characterBounds:checks.characterBounds},null,2)+'\n');
 if(process.argv.includes('--poster-only')){console.log('PASS real game presets rendered to public/backgrounds/meadow-menu-poster.jpg');}
 else{
  const encoded=await page.evaluate(async()=>{
   const {renderer,draw,loopSeconds}=window.menuRecording,stream=renderer.domElement.captureStream(24),chunks=[];
   const recorder=new MediaRecorder(stream,{mimeType:'video/mp4;codecs=avc1.42E01E',videoBitsPerSecond:1100000});
   const ready=new Promise(resolve=>{recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};recorder.onstop=resolve;});
   let started;renderer.setAnimationLoop(time=>{started??=time;draw((time-started)/1000);});recorder.start();
   await new Promise(resolve=>setTimeout(resolve,loopSeconds*1000));recorder.stop();await ready;renderer.setAnimationLoop(null);stream.getTracks().forEach(track=>track.stop());
   const blob=new Blob(chunks,{type:'video/mp4'});return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});
  });
  const bytes=Buffer.from(encoded.split(',')[1],'base64');await writeFile('public/backgrounds/meadow-menu.mp4',bytes);console.log(JSON.stringify({path:'public/backgrounds/meadow-menu.mp4',bytes:bytes.length,seconds:12}));
 }
 }
}finally{await browser.close();await server.close();}
