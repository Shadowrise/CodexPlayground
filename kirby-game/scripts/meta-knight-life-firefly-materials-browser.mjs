import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from 'playwright';

// Exercise real startup: meadow shadow preparation modifies some cached GLTF
// materials. Loading the firefly directly into an isolated arena misses this.
const root=fileURLToPath(new URL('../',import.meta.url)),publicDir=resolve(root,'public'),output=resolve(root,'.cache/life-firefly-materials');
await mkdir(output,{recursive:true});
const compiled=await build({root,configFile:false,logLevel:'error',plugins:[{
 name:'life-firefly-materials-probe',transform(source,id){
  if(!id.replaceAll('\\','/').endsWith('/src/main.ts'))return;
  return source+`
window.fireflyQA={T:THREE,renderer,travel:cosmicArena,get c(){return character},get asset(){return loadedFirefly},
 input:{forward:false,left:false,right:false},
 get visitor(){return this.travel.battleView.lifeFirefly},
 tick(){this.travel.update(0,this.travel.soloNow/1000,this.c,this.input,0,0,false,false)},
 async enter(){renderer.setAnimationLoop(null);await this.travel.enter(this.c);if(!this.travel.active)throw Error('Arena did not open');this.c.actor.position.set(2000,0,-2);this.travel.soloNow=1000000;this.travel.startBattle();this.travel.toggleGodMode()},
 prepare(phase){this.c.actor.position.set(2000,0,-2);this.travel.setPhase(phase,phase===4?2:undefined);let guard=0;while(this.travel.battle.lifeFirefly?.phase!==phase&&guard++<100){this.travel.soloNow=this.travel.battle.until;this.tick()}if(guard>=100)throw Error('No heart carrier');this.travel.soloNow=this.travel.battle.lifeFirefly.at+6500;this.tick()},
 close(side=1){const p=this.visitor.carrier.getWorldPosition(new THREE.Vector3()),yaw=this.visitor.carrier.rotation.y+side*1.1;this.travel.camera.position.copy(p).add(new THREE.Vector3(Math.sin(yaw)*6,2.6,Math.cos(yaw)*6));this.travel.camera.lookAt(p.clone().add(new THREE.Vector3(0,.5,0)));this.travel.camera.updateMatrixWorld();this.travel.render()},
};`;
 },
}],build:{write:false,minify:false,target:'es2022',rollupOptions:{input:resolve(root,'index.html')}}});
const files=new Map(compiled.output.map(item=>['/'+item.fileName,Buffer.from(item.type==='chunk'?item.code:item.source)]));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
 '.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}}),errors=[],checks=[];
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!=='http://127.0.0.1:5197')return route.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}});
  if(url.pathname.endsWith('.mp4'))return route.fulfill({status:204});
  const name=url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname);let body=files.get(name);
  if(!body){
   const path=resolve(publicDir,'.'+name);if(!path.startsWith(publicDir+sep))return route.abort();
   try{body=await readFile(path);}catch(error){if(error.code==='ENOENT')return route.fulfill({status:404});throw error;}
  }
  await route.fulfill({contentType:types[extname(name)]??'application/octet-stream',body});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.stack));
 page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 await page.goto('http://127.0.0.1:5197/',{waitUntil:'commit'});
 await page.locator('#new-game').waitFor({state:'visible',timeout:120000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Светлячок');await page.locator('#start-game').click();
 await page.waitForFunction(()=>!!window.fireflyQA?.c&&!document.body.classList.contains('choosing'),null,{timeout:180000});
 assert(await page.evaluate(()=>fireflyQA.asset.scene.getObjectByName('Face').material.defines.USE_CSM===1),'the fixture must run actual meadow shadow preparation');
 console.log('Real meadow startup complete.');
 for(let trip=1;trip<=2;trip++){
  await page.evaluate(()=>fireflyQA.enter());
  for(const phase of [1,2,3,4]){
   await page.evaluate(phase=>{fireflyQA.prepare(phase);fireflyQA.close()},phase);
   const materials=await page.evaluate(()=>{
    const q=fireflyQA,T=q.T,parts=[];
    q.asset.scene.traverse(source=>{if(!(source instanceof T.Mesh))return;const mesh=q.visitor.firefly.object.getObjectByName(source.name),m=mesh.material;
     parts.push({name:source.name,independent:m!==source.material,sharedGeometry:mesh.geometry===source.geometry,clean:m.defines?.USE_CSM===undefined&&m.onBeforeCompile===T.Material.prototype.onBeforeCompile&&m.envMap===null});
    });return {visible:q.visitor.group.visible,parts};
   });
   assert(materials.visible);assert.equal(materials.parts.length,57);assert(materials.parts.every(p=>p.independent&&p.sharedGeometry&&p.clean));
   await page.screenshot({path:resolve(output,`trip-${trip}-phase-${phase}.png`)});
   const pixels={};
   if(trip===1&&(phase===1||phase===4))for(const side of [-1,1]){
    const changes=await page.evaluate(side=>{
     const q=fireflyQA,gl=q.renderer.getContext(),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,base=new Uint8Array(width*height*4),hidden=new Uint8Array(base.length),changes={};
     q.close(side);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,base);
     const names=['Face',...Array.from({length:3},(_,i)=>(side<0?'Left':'Right')+'_Leg_shape_'+i)];
     for(const name of names){const mesh=q.visitor.firefly.object.getObjectByName(name);mesh.visible=false;q.travel.render();gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,hidden);mesh.visible=true;
      let count=0;for(let i=0;i<base.length;i+=4)if(Math.max(Math.abs(base[i]-hidden[i]),Math.abs(base[i+1]-hidden[i+1]),Math.abs(base[i+2]-hidden[i+2]))>3)count++;changes[name]=count;
     }q.travel.render();return changes;
    },side);
    for(const [name,count] of Object.entries(changes)){assert(count>10,`${name} must contribute visible pixels in phase ${phase}: ${count}`);pixels[name]=Math.max(pixels[name]??0,count);}
   }
   checks.push({trip,phase,parts:materials.parts.length,pixels});console.log(`PASS trip ${trip}, phase ${phase}: complete carrier with independent arena materials.`);
  }
  const hit=await page.evaluate(()=>{
   const q=fireflyQA,s=q.travel.battle,bug=s.lifeFirefly,point=q.visitor.carrier.position.toArray();
   bug.hit={at:q.travel.soloNow,point,yaw:q.visitor.carrier.rotation.y,by:'solo'};q.tick();q.close();
   return {heartReleased:q.visitor.heart.group.parent===q.visitor.group,buzz:q.travel.fireflyBuzz(q.c.actor.getWorldPosition(new q.T.Vector3()))};
  });assert(hit.heartReleased);assert.equal(hit.buzz,0);
  await page.evaluate(()=>fireflyQA.travel.leave());
  assert(await page.evaluate(()=>fireflyQA.asset.scene.getObjectByName('Face').material.defines.USE_CSM===1),'returning must keep meadow shadow materials intact');
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify({checks,errors},null,2));
 console.log(JSON.stringify({output,checks,errors}));
}finally{await browser.close();}
