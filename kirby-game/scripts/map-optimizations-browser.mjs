// Verify runtime scenery aggregation and distant cart models in hardware Chrome.
// GAME_URL=http://127.0.0.1:5184/ MAP_BASELINE=1 node scripts/map-optimizations-browser.mjs
// Run again without MAP_BASELINE for images and measurements of the new scene.
// MAP_VISUAL_ONLY=1 repeats camera approaches and isolated cart captures only.
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';

const url=process.env.GAME_URL??'http://127.0.0.1:5183/';
const out=new URL('../.cache/map-optimizations/'+(process.env.MAP_BASELINE==='1'?'baseline/':'current/'),import.meta.url);await mkdir(out,{recursive:true});
const checkpoints=new URL('../node_modules/.cache/scene-research-checkpoints/',import.meta.url);await mkdir(checkpoints,{recursive:true});
const runId=Date.now();let checkpoint=0;
const gpuTelemetry=[];
const gpuMonitor=spawn('nvidia-smi',['--query-gpu=timestamp,pstate,utilization.gpu,clocks.current.graphics,clocks.current.memory,power.draw,temperature.gpu','--format=csv,noheader,nounits','--loop-ms=1000'],{windowsHide:true});
gpuMonitor.stdout.on('data',chunk=>gpuTelemetry.push(chunk.toString()));gpuMonitor.on('error',()=>{});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={method:{browser:'Isolated Chrome, hardware renderer recorded below; Vite serves existing prepared world, HMR/network rooms disabled.',ab:'Fixed scene and camera. 12 warmup + 20 measured render/gl.finish frames per sample. Paired baseline before/after each toggle. Effects overlap, savings must not be added.',live:'Actual game loop at four fixed map-corner cameras; CPU update/render submission and asynchronous EXT_disjoint_timer_query_webgl2 GPU time. Separate from forced gl.finish A/B tests.'},metadata:{},live:[],angleTime:[],ab:[],inventory:[],errors:[]};
const save=()=>writeFile(new URL(`${runId}-${++checkpoint}.json`,checkpoints),JSON.stringify(report,null,2));
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),cdp=await page.context().newCDPSession(page);
 page.setDefaultTimeout(180000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))report.errors.push(m.text());});
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));
 await page.addInitScript(()=>{
  localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');localStorage.setItem('kirby-view-distance-v1','750');localStorage.setItem('kirby-render-scale-v1','1.25');
  window.__researchLongTasks=[];new PerformanceObserver(list=>window.__researchLongTasks.push(...list.getEntries().map(e=>({start:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});
 });
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/scene-profiler.ts*',async route=>{
  const response=await route.fetch();let body=await response.text();
  body=body.replace(/constructor\([^)]*\)\s*\{/,match=>match+'window.__researchProfiler=this;');
  body+=`\nconst __researchFrame=SceneProfiler.prototype.frame;SceneProfiler.prototype.frame=function(updateMs,renderMs){window.sceneResearch?.frame(updateMs,renderMs);return __researchFrame.call(this,updateMs,renderMs);};`;
  await route.fulfill({response,body});
 });
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch();let body=await response.text();
  body=body.replace(/renderer\.setAnimationLoop\(\(time\)\s*=>\s*\{/,m=>m+'window.__researchRaf=time;');
  body=body.replace('camera.lookAt(cameraTarget);','camera.lookAt(cameraTarget);window.sceneResearch?.applyCamera(camera,time);');
  body=body.replace(/const lightTime\s*=\s*daylight\(currentDayPhase\(\)\);/,'const lightTime=daylight(window.__researchPhase??currentDayPhase());');
  body+='\nwindow.__researchApi={THREE,scene,camera,renderer,shadows,preparedShadows,groundShadowPass,sceneryVisibility,characterShadows,forestDetail,celestialLighting,updateTreeShadows,updateSky,fruits,treehouse,coaster,boats,ponds,fountain,watermill,home,numberGarden,musicalFlowers,chat,wayfinder,sounds,sealLocations,centipedeView,numberGameView,get npcs(){return npcs},get c(){return character},get fireflies(){return fireflies}};';
  await route.fulfill({response,body});
 });
 if(process.env.MAP_BASELINE==='1')await page.route('**/src/prepared-environment.ts*',async route=>{const response=await route.fetch();const body=(await response.text()).replace('combineCells = true','combineCells = false');await route.fulfill({response,body});});
 await page.goto(url+'?perf=1');await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.click('#new-game');await page.fill('#player-name-input','Профиль сцены');await page.click('#start-game');
 await page.waitForFunction(()=>window.__researchApi?.c&&window.__researchProfiler,null,{timeout:180000});
 await cdp.send('Performance.enable');
 report.metadata=await page.evaluate(async()=>{
  const api=__researchApi,T=api.THREE,gl=api.renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),debug=gl.getExtension('WEBGL_debug_renderer_info');
  const q=window.sceneResearch={api,profiler:__researchProfiler,ext,gl,serial:0,pending:[],gpu:[],live:null,costs:{},view:{angle:45,rotate:false},focus:new T.Vector3(124,3,48),tag:'warmup',bypassCoverage:false};
  q.applyCamera=(camera,time)=>{if(q.fixed){camera.position.fromArray(q.fixed.position);camera.lookAt(new T.Vector3().fromArray(q.fixed.target));return;}const angle=(q.view.angle+(q.view.rotate?(time-q.view.start)*.018:0))*Math.PI/180;camera.position.set(q.focus.x+18*Math.sin(angle),q.focus.y+7,q.focus.z+18*Math.cos(angle));camera.lookAt(q.focus);};
  q.poll=()=>{
   if(!ext)return;const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT);
   q.pending=q.pending.filter(item=>{if(!gl.getQueryParameter(item.query,gl.QUERY_RESULT_AVAILABLE))return true;const ns=gl.getQueryParameter(item.query,gl.QUERY_RESULT);if(!disjoint)q.gpu.push({id:item.id,tag:item.tag,ms:ns/1e6});gl.deleteQuery(item.query);return false;});
  };
  const original=api.renderer.render.bind(api.renderer);
  api.renderer.render=(root,camera)=>{
   if(root!==api.scene)return original(root,camera);
   q.poll();const id=++q.serial,query=ext&&q.pending.length<40?gl.createQuery():null;
   if(query)gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
   try{return q.bypassCoverage?api.groundShadowPass.original(root,camera):original(root,camera);}
   finally{if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);q.pending.push({id,tag:q.tag,query});}}
  };
  q.frame=(updateMs,renderMs)=>{if(q.live){q.live.frames.push({id:q.serial,raf:window.__researchRaf,at:performance.now(),updateMs,renderMs,calls:api.renderer.info.render.calls,triangles:api.renderer.info.render.triangles,costs:q.costs});}q.costs={};};
  const wrap=(name,object,method)=>{if(!object||typeof object[method]!=='function')return;const before=object[method];object[method]=function(...args){const at=performance.now();try{return before.apply(this,args);}finally{if(q.live)q.costs[name]=(q.costs[name]??0)+performance.now()-at;}};};
  for(const name of ['fruits','fountain','ponds','coaster','boats','watermill','treehouse','home','numberGarden','musicalFlowers','wayfinder','sounds','sealLocations','centipedeView','numberGameView'])wrap(name,api[name],'update');
  wrap('fruits.instanceUpload',api.fruits,'syncInstances');wrap('sceneryCulling',api.sceneryVisibility,'update');wrap('preparedShadows',api.preparedShadows,'update');wrap('CSM fitting',api.shadows,'update');wrap('lighting',api.celestialLighting,'update');wrap('chat DOM',api.chat,'render');
  for(const npc of api.npcs)wrap('NPC simulation',npc,'update');
  api.c.actor.position.set(225,0,225);
  document.querySelectorAll('body > :not(#game)').forEach(el=>{if(!el.contains(document.querySelector('#game')))el.style.visibility='hidden';});
  const {daylight,phaseAtHour}=await import('/src/day-cycle.ts');q.daylight=daylight;q.phaseAtHour=phaseAtHour;
  q.setHour=hour=>{window.__researchPhase=phaseAtHour(hour);};q.setHour(8);
  q.prepare=(angle,hour)=>{
   q.view={angle,rotate:false};q.setHour(hour);q.applyCamera(api.camera,performance.now());api.camera.updateMatrixWorld();
   const light=daylight(window.__researchPhase);api.celestialLighting.update(light);api.updateTreeShadows(light);api.updateSky(0,api.camera,light);api.shadows.update();api.preparedShadows.update(light,api.camera.position);api.sceneryVisibility.update(api.camera,api.scene.fog.far);api.fireflies?.syncInstances(api.camera);
   api.scene.fog.color.set('#d8e9eb').lerp(new T.Color('#182b4b'),light.night).lerp(new T.Color('#ffc392'),light.twilight*.7);api.scene.background.set('#b3d9ef').lerp(new T.Color('#0b1428'),light.night).lerp(new T.Color('#dd8b9b'),light.twilight*.65);api.renderer.toneMappingExposure=1+light.day*.2;
  };
  q.quant=(values,p)=>{if(!values.length)return null;const a=[...values].sort((a,b)=>a-b);return a[Math.min(a.length-1,Math.floor((a.length-1)*p))];};
  q.sample=async(tag,measured=20,warmup=12)=>{
   q.tag=tag;const rows=[],autoReset=api.renderer.info.autoReset;api.renderer.info.autoReset=false;
   try{
    // Three normally resets counters after its shadow pass. Keep one explicit
    // reset even when a diagnostic bypasses GroundShadowPass entirely.
    for(let i=0;i<warmup+measured;i++){await new Promise(requestAnimationFrame);api.renderer.info.reset();const at=performance.now();api.renderer.render(api.scene,api.camera);const cpuMs=performance.now()-at;gl.finish();if(i>=warmup)rows.push({id:q.serial,ms:performance.now()-at,cpuMs});}
    q.poll();const ids=new Set(rows.map(r=>r.id)),gpu=q.gpu.filter(r=>ids.has(r.id));
    return {ms:q.quant(rows.map(r=>r.ms),.5),p90Ms:q.quant(rows.map(r=>r.ms),.9),cpuMs:q.quant(rows.map(r=>r.cpuMs),.5),gpuMs:q.quant(gpu.map(r=>r.ms),.5),gpuSamples:gpu.length,calls:api.renderer.info.render.calls,triangles:api.renderer.info.render.triangles};
   }finally{api.renderer.info.autoReset=autoReset;}
  };
  return {date:new Date().toISOString(),userAgent:navigator.userAgent,browserVisibility:document.visibilityState,pixelRatio:api.renderer.getPixelRatio(),viewDistance:api.scene.fog.far,viewport:[innerWidth,innerHeight],drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),gpuTimer:!!ext,treehouseActive:api.treehouse.active,npcs:api.npcs.length,startupGlError:gl.getError(),shadowCascades:api.shadows.lights.length,shadowMapSize:api.shadows.lights.map(l=>l.shadow.mapSize.toArray()),objects:(()=>{let n=0;api.scene.traverse(()=>n++);return n;})()};
 });
 const baseline=process.env.MAP_BASELINE==='1';report.mode=baseline?'baseline':'current';report.samples=[];report.pairs=[];report.visual=[];
 if(baseline)await page.evaluate(()=>__researchApi.coaster.detailEnabled=false);
 report.metadata.batches=await page.evaluate(()=>{const a=[];__researchApi.scene.traverse(o=>{if(o.name==='Combined scenery instances')a.push(o.name);});return a.length;});
 if(baseline&&report.metadata.batches)throw Error('Baseline route did not disable combined instance cells');
 await page.evaluate(()=>{
  const q=sceneResearch;q.profiler.busy=true;
  q.setView=(position,target,hour=8)=>{q.fixed={position,target};q.prepare(0,hour);q.api.coaster.updateDetail(q.api.camera.position);};
  q.fullStates=q.api.scene.children.map(o=>[o,o.visible]);
  q.staticOnly=()=>{for(const [o]of q.fullStates)o.visible=o.isLight||['Four woodland biomes','Ponds, flowers, mushrooms, rocks, picnics and ruins','Continuous square mountain range'].includes(o.name);};
  q.restore=()=>{for(const [o,v]of q.fullStates)o.visible=v;};
  q.pixels=()=>{q.api.renderer.render(q.api.scene,q.api.camera);q.gl.finish();};
 });
 const views=[
  {id:'south-east',p:[230,10,230],t:[0,3,0]},
  {id:'south-west',p:[-230,10,230],t:[0,3,0]},
  {id:'north-east',p:[230,10,-230],t:[0,3,0]},
  {id:'north-west',p:[-230,10,-230],t:[0,3,0]},
 ];
 const comparison=baseline?null:JSON.parse(await readFile(new URL('../.cache/map-optimizations/baseline/report.json',import.meta.url),'utf8'));
 if(!process.env.MAP_VISUAL_ONLY)for(const view of views){
  const sample=await page.evaluate(async view=>{const q=sceneResearch;q.restore();q.setView(view.p,view.t);return q.sample('full-'+view.id,18,18);},view);
  report.samples.push({id:view.id,kind:'full',sample});console.log(JSON.stringify({mode:report.mode,view:view.id,...sample}));
 }
 if(!process.env.MAP_VISUAL_ONLY)for(const view of [...views,{id:'north-west-night',p:[-230,10,-230],t:[0,3,0],hour:0},{id:'orchard-close',p:[90,12,95],t:[80,3,75]}]){
  const sample=await page.evaluate(async view=>{const q=sceneResearch;q.staticOnly();q.setView(view.p,view.t,view.hour??8);return q.sample('static-'+view.id,16,12);},view);
  report.samples.push({id:view.id,kind:'static',sample});await page.evaluate(()=>sceneResearch.pixels());
  const current=await page.screenshot({path:fileURLToPath(new URL(view.id+'.png',out))});
  if(!baseline){
   const previous=await readFile(new URL('../.cache/map-optimizations/baseline/'+view.id+'.png',import.meta.url));
   const diff=await page.evaluate(async images=>{
    const read=async data=>{const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};
    const a=await read(images[0]),b=await read(images[1]);let changed=0,over2=0,max=0,total=0;for(let i=0;i<a.length;i+=4){let d=0;for(let c=0;c<3;c++){const value=Math.abs(a[i+c]-b[i+c]);d=Math.max(d,value);total+=value;}if(d)changed++;if(d>2)over2++;max=Math.max(max,d);}return {pixels:a.length/4,changed,over2,max,meanChannel:total/(a.length/4*3)};
   },[previous.toString('base64'),current.toString('base64')]);report.visual.push({id:view.id,...diff});console.log(JSON.stringify({visual:view.id,...diff}));
  }
  console.log(JSON.stringify({mode:report.mode,static:view.id,...sample}));
 }
 if(!baseline){
  await page.evaluate(async()=>{
   const {scenerySources}=await import('/src/scenery-batch.ts');
   const q=sceneResearch;q.restore();q.setView([230,10,-230],[0,3,0]);
   q.approaches=[];const camera=q.api.camera,T=q.api.THREE;
   for(const name of ['Mountain evergreen crowns','Decorative forest wood','Weathered meadow rocks']){
    const candidates=[];q.api.scene.traverse(o=>{if(o instanceof T.LOD&&o.name.startsWith(name))candidates.push(o);});
    for(const lod of candidates.slice(0,6)){
     const center=lod.getWorldPosition(new T.Vector3());camera.position.copy(center).add(new T.Vector3(0,3,6));camera.lookAt(center);camera.updateMatrixWorld();q.api.sceneryVisibility.update(camera,750);q.api.renderer.render(q.api.scene,camera);
     const records=[];q.api.scene.traverse(o=>{if(o instanceof T.Mesh)records.push(...scenerySources(o).filter(s=>s.visibility===lod.levels[0].object));});
     q.approaches.push({name:lod.name,level:lod.getCurrentLevel(),visible:lod.visible,active:lod.levels.filter(l=>l.object.visible).length,submitted:records.every(s=>s.shown)});
    }
   }
  });
  report.approaches=await page.evaluate(()=>sceneResearch.approaches);if(report.approaches.some(x=>!x.visible||x.level!==0||x.active!==1||!x.submitted))throw Error('An approached scenery cell did not restore its full geometry');
  // Same-frame A/B for the moving-cart detail only, against original carts.
  if(!process.env.MAP_VISUAL_ONLY)for(const view of views.slice(2))for(let round=0;round<3;round++){
   const row=await page.evaluate(async view=>{
    const q=sceneResearch,api=q.api;q.restore();q.setView(view.p,view.t);api.coaster.detailEnabled=false;api.coaster.updateDetail(api.camera.position);
    const before=await q.sample('cart-before',16,10);api.coaster.detailEnabled=true;api.coaster.updateDetail(api.camera.position);const after=await q.sample('cart-after',16,10);api.coaster.detailEnabled=false;api.coaster.updateDetail(api.camera.position);const control=await q.sample('cart-control',16,10);api.coaster.detailEnabled=true;api.coaster.updateDetail(api.camera.position);const reference=(before.ms+control.ms)/2;return {before,after,control,savedMs:reference-after.ms,stable:Math.abs(before.ms-control.ms)/reference<=.15};
   },view);report.pairs.push({view:view.id,round,...row});console.log(JSON.stringify({cart:view.id,round,savedMs:row.savedMs,stable:row.stable,calls:[row.before.calls,row.after.calls],triangles:[row.before.triangles,row.after.triangles]}));
  }
  // Inspect the same cart across the hysteresis range, without moving physics.
  await page.evaluate(()=>{const q=sceneResearch;q.restore();q.cart=q.api.coaster.group.getObjectByName('Rounded coaster cart 2');for(const [o]of q.fullStates)o.visible=o.isLight||o===q.api.coaster.group;for(const child of q.api.coaster.group.children)child.visible=child===q.cart;q.cart.position.set(0,15,0);q.cart.quaternion.identity();});
  for(const distance of [12,90,100,115,145,90]){
   const state=await page.evaluate(distance=>{const q=sceneResearch,T=q.api.THREE,center=q.cart.getWorldPosition(new T.Vector3());q.setView(center.clone().add(new T.Vector3(0,3,distance)).toArray(),center.clone().add(new T.Vector3(0,2,0)).toArray());q.pixels();const far=q.cart.getObjectByName('Distant coaster cart and passengers');return {distance,far:far.visible,triangles:far.geometry.attributes.position.count/3};},distance);
   report.visual.push({cart:state});await page.screenshot({path:fileURLToPath(new URL('cart-'+distance+'.png',out))});
  }
  await page.evaluate(()=>{const q=sceneResearch,T=q.api.THREE;q.setView([0,18,12],[0,16,0]);q.api.coaster.updateDetail(new T.Vector3(0,18,140));q.pixels();});
  await page.screenshot({path:fileURLToPath(new URL('cart-far-close-inspect.png',out))});
 }
 report.metadata.finalGlError=await page.evaluate(()=>sceneResearch.gl.getError());report.gpuTelemetry=gpuTelemetry.join('');
 if(report.errors.length||report.metadata.finalGlError)throw Error(JSON.stringify({errors:report.errors,gl:report.metadata.finalGlError}));
 const path=new URL(process.env.MAP_VISUAL_ONLY?'visual-report.json':'report.json',out);await writeFile(path,JSON.stringify(report,null,2));console.log(JSON.stringify({output:fileURLToPath(path),batches:report.metadata.batches,errors:report.errors}));
}finally{gpuMonitor.kill();await browser.close();}
