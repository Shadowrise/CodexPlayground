// Isolated, read-only A/B comparison against a Git revision. Never changes the
// user's browser profile, current game or files in the reference checkout.
import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import {writeFile,readFile} from 'node:fs/promises';
import ts from 'typescript';

const ref=process.env.PERF_BASELINE_REF??'aec96c4',url=process.env.PERF_URL??'http://127.0.0.1:5174/';
const output=process.env.TEMP+'/'+(process.env.PERF_OUTPUT??'kirby-batching-performance');
const changed=(process.env.PERF_MODULES??'forest,forest-lod,fruits,night-fireflies,fountain,balloons,watermill').split(',');
const originals=new Map(await Promise.all(changed.map(async name=>[name,ts.transpileModule(process.env.PERF_BASELINE_DIR?await readFile(process.env.PERF_BASELINE_DIR+'/'+name+'.ts','utf8'):execFileSync('git',['-c','safe.directory=C:/repos/codex-playground','show',`${ref}:kirby-game/src/${name}.ts`],{encoding:'utf8'}),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText])));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const reports=[];
let cartState,sceneryState;
try{
 for(const baseline of [true,false]){
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.log('Page error: '+e.message);});page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text())){errors.push(m.text());console.log('Renderer error: '+m.text());}});
  await page.addInitScript(()=>{let seed=123456789;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};localStorage.setItem('kirby-language-v1','ru');});
  if(process.env.PERF_NO_MULTI_DRAW)await page.addInitScript(()=>{const old=WebGL2RenderingContext.prototype.getExtension;WebGL2RenderingContext.prototype.getExtension=function(name){return name==='WEBGL_multi_draw'?null:old.call(this,name);};});
  await page.route('**/src/*.ts*',async route=>{
   const path=new URL(route.request().url()).pathname,name=path.slice('/src/'.length,-3);
   if(name!=='main'&&!(baseline&&originals.has(name)))return route.continue();
   const response=await route.fetch(),current=await response.text();let body=current;
   if(baseline&&name==='main')body=body.replace('new StaticWorldMatrices(scene)','new StaticWorldMatrices(scene, false)').replace('skipShadowOnlyColourPass(object);','');
   if(baseline&&originals.has(name)){
    const imports=[...current.matchAll(/from\s*["']([^"']+)["']/g)].map(m=>m[1]);
    body=originals.get(name).replace(/(from\s*["'])([^"']+)(["'])/g,(_,a,s,b)=>{
     if(s.startsWith('./'))return a+'/src/'+s.slice(2).replace(/\.ts$/,'')+'.ts'+b;
     if(s==='three')return a+imports.find(p=>/\/three\.js(?:\?|$)/.test(p))+b;
     if(s==='three/addons/utils/BufferGeometryUtils.js')return a+imports.find(p=>p.includes('BufferGeometryUtils'))+b;
     if(s.startsWith('three/addons/'))return a+imports.find(p=>p.includes(s.split('/').at(-1).replace(/\.js$/,'')))+b;
     return a+s+b;
    });
   }
   if(name==='main')body+='\nwindow.batchPreview={scene,camera,renderer,shadows,celestialLighting,updateSky,fruits,coaster,balloons,watermill,fountain,get fireflies(){return fireflies},get character(){return character},get npcs(){return npcs}};';
   await route.fulfill({response,body});
  });
  console.log(baseline?'Loading baseline…':'Loading optimized scene…');
  await page.goto(url+'?perf=1');await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
  await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Performance comparison');await page.locator('#start-game').click();
  await page.waitForFunction(()=>window.batchPreview?.character&&window.batchPreview.fireflies,undefined,{timeout:120000});
  cartState=await page.evaluate(async savedCarts=>{
   const t=window.batchPreview,T=await import('/node_modules/.vite/deps/three.js'),{daylight}=await import('/src/day-cycle.ts'),{updateVisibility,FRUIT_DISTANCE}=await import('/src/visibility.ts');
   t.renderer.setAnimationLoop(null);t.renderer.info.autoReset=false;document.querySelectorAll('body > :not(#game)').forEach(e=>e.style.display='none');
   t.character.setActivity('Idle');t.character.flight.reset();t.character.cloud.visible=false;t.character.mixer.setTime(.3);
   t.character.actor.position.set(-205,0,-205);t.character.actor.scale.setScalar(1);t.character.yaw=Math.PI/4;
   t.npcs.forEach((n,i)=>{n.networkAnimate('Idle',0);n.mixer.setTime(.3);n.flight.reset();n.cloud.visible=false;n.actor.position.set((i%4-1.5)*90,0,(Math.floor(i/4)-1.5)*90);n.actor.scale.setScalar(1);});
   t.fruits.restore(t.fruits.fruits.map(()=>false),0);
   t.fireflies.time=0;t.fireflies.npcRiders.clear();t.fireflies.bugs.forEach(b=>b.firefly.object.scale.setScalar(.65));
   const carts=savedCarts??t.coaster.networkState();t.coaster.networkApply(carts);t.coaster.update(0);
   t.setupView=(eye,look,phase)=>{
    t.camera.position.fromArray(eye);t.camera.lookAt(...look);t.camera.updateMatrixWorld();
    const time=daylight(phase);t.celestialLighting.update(time);t.renderer.toneMappingExposure=1+time.day*.2;
    t.scene.fog.color.set('#d8e9eb').lerp(new T.Color('#182b4b'),time.night).lerp(new T.Color('#ffc392'),time.twilight*.7);
    t.updateSky(0,t.camera,time);t.fireflies.update(0,time.night,t.camera.position);
    t.fireflies.bugs.forEach(b=>b.firefly.mixer.setTime(.3));
    t.npcs.forEach(n=>updateVisibility(n.actor,t.camera.position));
    t.fruits.fruits.forEach(f=>updateVisibility(f.object,t.camera.position,!f.eaten,false,FRUIT_DISTANCE));t.fruits.syncInstances();
    t.scene.traverse(o=>{if(o.isLOD)o.levels.forEach(l=>l.object.visible=false);});t.shadows.update();
   };
   t.sample=async()=>{
    const total=[],cpu=[],gl=t.renderer.getContext();let render;
    for(let i=0;i<32;i++){await new Promise(r=>requestAnimationFrame(r));t.renderer.info.reset();const start=performance.now();t.renderer.render(t.scene,t.camera);const submit=performance.now()-start;gl.finish();if(i>=12){total.push(performance.now()-start);cpu.push(submit);}render={...t.renderer.info.render};}
    const median=v=>v.sort((a,b)=>a-b)[Math.floor(v.length/2)];return {ms:median(total),cpuMs:median(cpu),...render};
   };
   t.groupStats=()=>{
    const result={},restore=[];
    t.scene.traverse(o=>{if(!o.isMesh)return;let root=o;while(root.parent&&root.parent!==t.scene)root=root.parent;
     for(const [key,pass] of [['onBeforeRender','main'],['onBeforeShadow','shadow']]){
      const original=o[key];restore.push(()=>o[key]=original);
      o[key]=function(...args){const returned=original.apply(this,args);if(o.geometry.drawRange.count===0)return returned;const name=root.name||root.type;if(!result[name])result[name]={main:{calls:0,triangles:0},shadow:{calls:0,triangles:0}};const row=result[name][pass];row.calls++;row.triangles+=o.isBatchedMesh?o._multiDrawCounts.slice(0,o._multiDrawCount).reduce((a,b)=>a+b,0)/3:(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);return returned;};
     }
    });
    t.renderer.render(t.scene,t.camera);restore.forEach(f=>f());return result;
   };
   // Freeze animated attractions as well as their simulation. Pose-dependent
   // skinned bounds and particle counts otherwise differ with asset load time.
   t.sceneryNames=['Colourful river boats','Rainbow wishing fountain',...t.coaster.carts.flatMap(c=>c.group.children.filter(o=>o.name.startsWith('Permanent Kirby passenger ')||o.name==='Luigi · permanent passenger').map(o=>o.name))];
   t.captureScenery=()=>t.sceneryNames.map(name=>{
    const rows=[];t.scene.getObjectByName(name).traverse(o=>rows.push({name:o.name,p:o.position.toArray(),q:o.quaternion.toArray(),s:o.scale.toArray(),matrix:o.matrix.toArray(),visible:o.visible,bounds:o.boundingSphere?[...o.boundingSphere.center.toArray(),o.boundingSphere.radius]:null,count:o.isInstancedMesh?o.count:null,instances:o.isInstancedMesh?Array.from(o.instanceMatrix.array):null}));return {name,rows};
   });
   t.restoreScenery=state=>state.forEach(({name,rows})=>{
    let i=0;t.scene.getObjectByName(name).traverse(o=>{const row=rows[i++];if(!row||row.name!==o.name)throw Error('Scenery topology differs: '+name);
     o.position.fromArray(row.p);o.quaternion.fromArray(row.q);o.scale.fromArray(row.s);o.matrix.fromArray(row.matrix);o.matrixWorldNeedsUpdate=true;o.visible=row.visible;
     if('boundingSphere' in o)o.boundingSphere=row.bounds?new T.Sphere(new T.Vector3(...row.bounds.slice(0,3)),row.bounds[3]):null;
     if(o.isInstancedMesh){o.count=row.count;o.instanceMatrix.array.set(row.instances);o.instanceMatrix.needsUpdate=true;}
    });if(i!==rows.length)throw Error('Scenery node count differs: '+name);
   });
   return carts;
  },cartState);
  if(sceneryState)await page.evaluate(state=>window.batchPreview.restoreScenery(state),sceneryState);
  const views=[['corner-day',[-205,8,-205],[205,8,205],.25],['corner-night',[-205,8,-205],[205,8,205],.75],['spruce-near',[-112,6,-108],[-118,3,-139],.25]];
  if(process.env.PERF_MODULES)views.push(['maze-near',[-91,3.2,135],[-94,2.5,119],.25],['maze-overview',[-45,35,148],[-94,2,94],.25],['maze-far',[45,20,235],[-94,2,94],.25]);
  if(process.env.PERF_VIEW){const keep=process.env.PERF_VIEW.split(',');for(let i=views.length-1;i>=0;i--)if(!keep.includes(views[i][0]))views.splice(i,1);}
  const rows=[];
  for(const [name,eye,look,phase] of views){
   await page.evaluate(({eye,look,phase})=>window.batchPreview.setupView(eye,look,phase),{eye,look,phase});
   const samples=[];for(let i=0;i<3;i++)samples.push(await page.evaluate(()=>window.batchPreview.sample()));
   if(baseline&&!sceneryState)sceneryState=await page.evaluate(()=>window.batchPreview.captureScenery());
   const groups=await page.evaluate(()=>window.batchPreview.groupStats());
   await page.screenshot({path:output+'-'+name+(baseline?'-before':'-after')+'.png'});rows.push({name,samples,groups});console.log(JSON.stringify({baseline,name,samples}));
  }
  for(const name of ['fountain','watermill','balloon','firefly']){
   await page.evaluate(async name=>{
    const t=window.batchPreview,T=await import('/node_modules/.vite/deps/three.js');
    const root=name==='balloon'?t.balloons.balloons[0].group:name==='firefly'?t.fireflies.bugs[0].carrier:t[name].group;
    const centre=root.getWorldPosition(new T.Vector3());
    const aim=centre.clone().add(new T.Vector3(...(name==='watermill'?[10,4,0]:name==='balloon'?[0,2,0]:name==='firefly'?[0,.6,0]:[0,2,0])));
    const eye=aim.clone().add(new T.Vector3(...(name==='firefly'?[2,.5,3]:name==='balloon'?[6,2,9]:[18,10,23])));
    t.setupView(eye.toArray(),aim.toArray(),.25);t.renderer.render(t.scene,t.camera);
   },name);
   await page.screenshot({path:output+'-'+name+(baseline?'-before':'-after')+'.png'});
  }
  if(process.env.PERF_DETAIL_VIEWS)for(const [name,rootName,offset,delta] of [
   ['home','Kirby home and bed',[0,3,0],[12,8,15]],
   ['cart','Rounded coaster cart 1',[0,1.2,0],[5,3,6]],
   ['treehouse','Oak treehouse, lookout, swing and leaf pile',[0,13,0],[27,10,28]],
   ['trampoline','Star reward trampoline and soft leaves',[0,.5,0],[0,18,.1]],
  ]){
   if(process.env.PERF_DETAIL_VIEWS!=='1'&&!process.env.PERF_DETAIL_VIEWS.split(',').includes(name))continue;
   await page.evaluate(async({rootName,offset,delta})=>{const t=window.batchPreview,T=await import('/node_modules/.vite/deps/three.js');let root=t.scene.getObjectByName(rootName);if(rootName.startsWith('Star reward'))root=root.children[0];const aim=root.getWorldPosition(new T.Vector3()).add(new T.Vector3(...offset)),eye=aim.clone().add(new T.Vector3(...delta));t.setupView(eye.toArray(),aim.toArray(),.25);t.renderer.render(t.scene,t.camera);},{rootName,offset,delta});
   await page.screenshot({path:output+'-'+name+(baseline?'-before':'-after')+'.png'});
  }
  const inventory=await page.evaluate(()=>{
   const t=window.batchPreview,count=root=>{let meshes=0,triangles=0;root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});return {meshes,triangles};};
   const buffers=new Set();let bytes=0,batched=0;t.scene.traverse(o=>{if(!o.isMesh)return;if(o.isBatchedMesh){batched++;for(const name of ['_matricesTexture','_indirectTexture','_colorsTexture']){const data=o[name]?.image?.data;if(data){buffers.add(data.buffer);}}}for(const a of [...Object.values(o.geometry.attributes),o.geometry.index,o.instanceMatrix,o.instanceColor])if(a)buffers.add(a.array.buffer);});for(const b of buffers)bytes+=b.byteLength;
   return {firefly:count(t.fireflies.bugs[0].firefly.object),balloons:count(t.balloons.group),fountain:count(t.fountain.group),watermill:count(t.watermill.group),coaster:count(t.coaster.group),home:count(t.scene.getObjectByName('Kirby home and bed')),treeCount:t.scene.getObjectByName('Four woodland biomes').userData.treePositions.length,shadowMaps:t.shadows.lights.map(l=>l.shadow.mapSize.toArray()),pixelRatio:t.renderer.getPixelRatio(),batched,automaticWorldUpdates:t.scene.matrixWorldAutoUpdate,geometryAndInstanceMB:Math.round(bytes/1048576*10)/10};
  });
  reports.push({baseline,rows,inventory,errors});await context.close();
 }
 await writeFile(output+'.json',JSON.stringify({ref,changed,reports},null,2));console.log(JSON.stringify({output,inventory:reports.map(r=>r.inventory),errors:reports.map(r=>r.errors)}));
 if(reports.some(r=>r.errors.length))throw Error('Browser/WebGL errors: '+JSON.stringify(reports.map(r=>r.errors)));
}finally{await browser.close();}
