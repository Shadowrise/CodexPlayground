import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const base=process.env.BASE_URL??'http://127.0.0.1:5194';
const output=fileURLToPath(new URL('../node_modules/.cache/pigeon-leg-attachment/',import.meta.url));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[],results={};
try{
 for(const revision of ['before','after']){
  const page=await browser.newPage({viewport:{width:1280,height:960},deviceScaleFactor:1});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.route('**/models/pigeon-animated.glb*',route=>route.fulfill({path:revision==='before'?output+'before.glb':fileURLToPath(new URL('../public/models/pigeon-animated.glb',import.meta.url)),contentType:'model/gltf-binary'}));
  await page.goto(base+'/pigeon-preview.html?clip=Run&time=0&view=front');
  await page.waitForFunction(()=>window.pigeonPreview?.model);
  results[revision]=await page.evaluate(async()=>{
   const T=await import('/node_modules/.vite/deps/three.js'),q=window.pigeonPreview,samples=[];
   q.setGamePace(false);
   for(const name of ['Walk','Run','WalkBackward']){
    const duration=q.model.animations.find(clip=>clip.name===name).duration;
    for(let frame=0;frame<=180;frame++){
     q.sampleClip(name,duration*frame/180);q.model.updateMatrixWorld(true);
     const nodes=['Body','Head','Left_foot','Right_foot'].map(name=>q.model.getObjectByName(name));
     samples.push(nodes.flatMap(node=>[...node.getWorldPosition(new T.Vector3()).toArray(),...node.getWorldQuaternion(new T.Quaternion()).toArray()]));
    }
   }
   return {samples,clips:q.clips.length};
  });
  for(const [clip,time] of [['Run',.495],['Walk',.7875],['WalkBackward',.9],['Fly',.225],['Peck',.96]]){
   await page.evaluate(({clip,time})=>{
    const q=window.pigeonPreview;q.selectView('front');q.sampleClip(clip,time);
    q.controls.target.set(0,.58,-.06);q.camera.position.set(2.5,.9,3.1);q.controls.update();q.renderer.render(q.scene,q.camera);
   },{clip,time});
   await page.locator('#stage').screenshot({path:output+revision+'-'+clip+'.png'});
  }
  await page.close();
 }
 let maximumPoseDelta=0;
 for(let frame=0;frame<results.before.samples.length;frame++)for(let component=0;component<results.before.samples[frame].length;component++){
  maximumPoseDelta=Math.max(maximumPoseDelta,Math.abs(results.before.samples[frame][component]-results.after.samples[frame][component]));
 }
 assert(maximumPoseDelta<1e-6,'body, head and planted/swinging feet retain their original trajectories');
 assert.equal(results.before.clips,results.after.clips);
 assert.deepEqual(errors,[]);
 const checks={sampledPoses:results.after.samples.length,maximumPoseDelta,clips:results.after.clips,errors};
 await writeFile(output+'checks.json',JSON.stringify(checks,null,2));
 console.log(JSON.stringify(checks,null,2));
}finally{await browser.close();}
