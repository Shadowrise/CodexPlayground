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
   let min=Infinity,max=-Infinity;model.updateWorldMatrix(true,true);
   model.traverse(mesh=>{if(!mesh.isMesh)return;mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
     const p=new T.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld).project(window.menuRecording.camera);min=Math.min(min,p.x);max=Math.max(max,p.x);
    }
   });return {min,max};
  };
  let centralGapPixels=Infinity,noseAlignment=1,glowOffset=0;
  for(let i=0;i<72;i++){
   const time=i/6;draw(time-.001);const before=flight.position.clone();draw(time+.001);const velocity=flight.position.clone().sub(before).setY(0).normalize();draw(time);
   const nose=firefly.object.getObjectByName('Head').getWorldPosition(new T.Vector3()).sub(glowMesh.getWorldPosition(new T.Vector3())).setY(0).normalize();
   noseAlignment=Math.min(noseAlignment,nose.dot(velocity));
   const left=bounds(models[4]),right=bounds(models[5]);centralGapPixels=Math.min(centralGapPixels,(right.min-left.max)*640);
   glowOffset=Math.max(glowOffset,halo.getWorldPosition(new T.Vector3()).distanceTo(glowMesh.getWorldPosition(new T.Vector3())));
  }
  draw(0);const start=flight.position.clone(),orientation=flight.quaternion.clone();draw(12);
  const loopError=flight.position.distanceTo(start)+flight.quaternion.angleTo(orientation);draw(0);
  return {centralGapPixels,noseAlignment,glowOffset,loopError,glowColor:glowMesh.material.emissive.getHexString(),haloColor:halo.material.color.getHexString()};
 });
 console.log(JSON.stringify({recordingChecks:checks}));
 assert(checks.centralGapPixels>4,'central Kirby silhouettes need a visible gap throughout their idle animations');
 assert(checks.noseAlignment>.999,'the actual head must lead the abdomen around the entire circle');
 assert(checks.glowOffset<.00001&&checks.loopError<.00001);assert.equal(checks.glowColor,'58ff76');assert.equal(checks.haloColor,'58ff76');
 await mkdir('public/backgrounds',{recursive:true});await page.screenshot({path:'public/backgrounds/meadow-menu-poster.jpg',type:'jpeg',quality:78});
 await mkdir('design/menu-backdrop',{recursive:true});
 await writeFile('design/menu-backdrop/composition.json',JSON.stringify(await page.evaluate(()=>({width:1280,height:720,characterCenters:window.menuRecording.characterCenters})),null,2)+'\n');
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
}finally{await browser.close();await server.close();}
