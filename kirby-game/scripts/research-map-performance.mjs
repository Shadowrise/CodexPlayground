// Isolated hardware Chrome; no production changes or multiplayer connections.
// GAME_URL=http://127.0.0.1:5184/ node scripts/research-map-performance.mjs
// PERF_VERIFY=1 PERF_CASES=mountain-batched,distance-360 PERF_ROUNDS=3
// The batching prototype freezes the visible cells; runtime culling/LOD updates
// are deliberately outside its scope. It measures a possible render saving.
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';

const url=process.env.GAME_URL??'http://127.0.0.1:5183/';
const out=new URL('../.cache/map-performance/',import.meta.url);await mkdir(out,{recursive:true});
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
 report.method.ab='Frozen scene; paired baseline/variant/control, each 6 warmup + 12 measured render/gl.finish frames. GPU timers independent. Savings overlap and are not additive; not live FPS.';
 report.metadata.multiDraw=await page.evaluate(()=>__researchApi.renderer.extensions.has('WEBGL_multi_draw'));
 report.metadata.worldManifest=JSON.parse(await readFile(new URL('../public/world/environment.manifest.json',import.meta.url),'utf8'));
 await page.evaluate(()=>{
  const q=sceneResearch;q.setView=view=>{q.fixed=view;q.api.c.actor.position.set(view.position[0],0,view.position[2]);q.prepare(0,8);};
  q.inventory=()=>{
   const {api}=q,groups=new Map(),restore=[];
   const category=o=>{for(let p=o;p&&p!==api.scene;p=p.parent){if(p.name==='Soft patterned tree shadows')return 'Tree shadows';if(p.name==='Prepared grass shadows')return 'Grass shadows';if(p===api.preparedShadows.group)return 'Prepared object shadows';}let p=o;while(p.parent&&p.parent!==api.scene)p=p.parent;return p.name||p.type;};
   api.scene.traverse(o=>{if(!o.isMesh&&!o.isPoints&&!o.isLine&&!o.isSprite)return;for(const [bk,ak,pass] of [['onBeforeRender','onAfterRender','colour'],['onBeforeShadow','onAfterShadow','shadow']]){
    const before=o[bk],after=o[ak],stack=[];o[bk]=function(...args){before.apply(this,args);stack.push({calls:api.renderer.info.render.calls,triangles:api.renderer.info.render.triangles});};
    o[ak]=function(...args){const at=stack.pop();if(at){const name=category(this),key=name+'|'+pass,row=groups.get(key)??{name,pass,calls:0,triangles:0};row.calls+=api.renderer.info.render.calls-at.calls;row.triangles+=api.renderer.info.render.triangles-at.triangles;groups.set(key,row);}return after.apply(this,args);};restore.push(()=>{o[bk]=before;o[ak]=after;});
   }});
   const reset=api.renderer.info.autoReset;api.renderer.info.autoReset=false;api.renderer.info.reset();try{api.renderer.render(api.scene,api.camera);return {totals:{...api.renderer.info.render},groups:[...groups.values()].sort((a,b)=>b.triangles-a.triangles)};}finally{restore.forEach(f=>f());api.renderer.info.autoReset=reset;}
  };
 });
 const views=[
  {id:'south-east',position:[230,10,230],target:[0,3,0]},
  {id:'south-west',position:[-230,10,230],target:[0,3,0]},
  {id:'north-east',position:[230,10,-230],target:[0,3,0]},
  {id:'north-west',position:[-230,10,-230],target:[0,3,0]},
 ];
 report.views=[];report.pairs=[];report.survey=[];
 console.log(JSON.stringify({metadata:report.metadata}));
 for(const view of views){
  await page.evaluate(view=>{const q=sceneResearch;q.profiler.busy=false;q.setView(view);},view);
  await page.waitForTimeout(1800);
  await page.evaluate(()=>{const q=sceneResearch;q.live={start:performance.now(),frames:[]};});
  await page.waitForTimeout(3500);
  const live=await page.evaluate(()=>{const q=sceneResearch,l=q.live;q.live=null;q.poll();q.profiler.busy=true;const gpu=new Map(q.gpu.map(r=>[r.id,r.ms]));l.frames.forEach(f=>f.gpuMs=gpu.get(f.id)??null);return l;});
  const sample=await page.evaluate(()=>sceneResearch.sample('survey',16,10));
  const inventory=await page.evaluate(()=>sceneResearch.inventory());
  report.views.push({...view,live,sample,inventory});
  await page.screenshot({path:fileURLToPath(new URL(view.id+'.png',out))});
  const f=live.frames,median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)];
  console.log(JSON.stringify({view:view.id,fps:1000*(f.length-1)/(f.at(-1).raf-f[0].raf),updateMs:median(f.map(x=>x.updateMs)),renderCpuMs:median(f.map(x=>x.renderMs)),gpuMs:median(f.map(x=>x.gpuMs).filter(x=>x!==null)),sample,groups:inventory.groups.slice(0,7)}));await save();
 }
 const caseNames=await page.evaluate(()=>{
  const q=sceneResearch,{api}=q,T=api.THREE,all=[];api.scene.traverse(o=>all.push(o));q.cases=[];
  const add=(id,name,apply)=>q.cases.push({id,name,apply});
  const hide=(id,name,objects)=>{if(objects.length)add(id,name,()=>{const s=objects.map(o=>[o,o.visible]);s.forEach(([o])=>o.visible=false);return ()=>s.forEach(([o,v])=>o.visible=v);});};
  const forest=api.scene.getObjectByName('Four woodland biomes');
  add('mountain-batched','Snapshot: merge visible mountain tree instances',()=>{
   const root=api.scene.getObjectByName('Mountain slope woodland'),wasVisible=root.visible,groups=new Map(),matrix=new T.Matrix4(),color=new T.Color();
   root.traverseVisible(o=>{if(!(o instanceof T.InstancedMesh)||Array.isArray(o.material))return;const key=[o.geometry.uuid,o.material.uuid,o.receiveShadow,o.castShadow,o.layers.mask,o.renderOrder].join('|');const list=groups.get(key)??[];list.push(o);groups.set(key,list);});
   const proxy=new T.Group();proxy.name='QA combined mountain instances';
   for(const list of groups.values()){
    const first=list[0],mesh=new T.InstancedMesh(first.geometry,first.material,list.reduce((n,o)=>n+o.count,0));mesh.receiveShadow=first.receiveShadow;mesh.castShadow=first.castShadow;mesh.layers.mask=first.layers.mask;mesh.renderOrder=first.renderOrder;
    let at=0;for(const original of list)for(let i=0;i<original.count;i++){original.getMatrixAt(i,matrix);matrix.premultiply(original.matrixWorld);mesh.setMatrixAt(at,matrix);color.set(0xffffff);if(original.instanceColor)original.getColorAt(i,color);mesh.setColorAt(at++,color);}
    mesh.computeBoundingSphere();proxy.add(mesh);
   }
   root.visible=false;api.scene.add(proxy);
   return ()=>{root.visible=wasVisible;proxy.removeFromParent();proxy.traverse(o=>{if(o instanceof T.InstancedMesh)o.dispose();});};
  });
  hide('forest','Forest geometry',forest.children.filter(o=>o.name!=='Biome ground'&&o.name!=='Soft patterned tree shadows'));
  hide('forest-leaves','Deciduous leaves',all.filter(o=>o instanceof T.LOD&&/^Decorative forest (leaves|birchLeaves)/.test(o.name)));
  hide('forest-wood','Tree trunks and branches',all.filter(o=>o instanceof T.LOD&&/^Decorative forest wood/.test(o.name)));
  hide('needles','Conifer needles',all.filter(o=>o.name==='Decorative forest needles'));
  hide('mountain-woodland','Mountain woodland',all.filter(o=>o.name==='Mountain slope woodland'));
  hide('meadow-decor','Meadow details',all.filter(o=>o.name==='Biome meadow details'));
  hide('grass','Meadow grass',all.filter(o=>o.name==='Meadow grass'));
  hide('shrubs','Meadow shrubs',all.filter(o=>/shrub/i.test(o.name)&&o instanceof T.LOD));
  hide('tree-shadows','Prepared tree shadows',all.filter(o=>o.name==='Soft patterned tree shadows'));
  hide('object-shadows','Prepared object shadows',[api.preparedShadows.group]);
  hide('all-prepared-shadows','All prepared shadows',all.filter(o=>o.name==='Soft patterned tree shadows').concat(api.preparedShadows.group));
  hide('fireflies','Firefly models and halos',[api.fireflies.group]);
  hide('npcs','All NPCs',api.npcs.map(n=>n.actor));
  hide('water','Water surfaces',all.filter(o=>o instanceof T.Mesh&&(Array.isArray(o.material)?o.material:[o.material]).some(m=>m.userData.waterPhase)));
  hide('clouds','Clouds',all.filter(o=>o.name==='Drifting clouds'));
  for(const [id,name] of [['oak','Oak treehouse, lookout, swing and leaf pile'],['coaster','Mountain circuit roller coaster'],['maze','Stone maze and golden star'],['mill','Interactive watermill'],['landmarks','Ponds, flowers, mushrooms, rocks, picnics and ruins']])hide(id,name,api.scene.children.filter(o=>o.name===name));
  add('coverage-pass','Bypass prepared shadow pass',()=>{q.bypassCoverage=true;return ()=>q.bypassCoverage=false;});
  add('csm-update','Freeze dynamic shadow maps',()=>{const v=api.renderer.shadowMap.autoUpdate;api.renderer.shadowMap.autoUpdate=false;return ()=>api.renderer.shadowMap.autoUpdate=v;});
  add('shadow-filter','Disable stable shadow filtering',()=>{api.shadows.filterEnabled.value=false;return ()=>api.shadows.filterEnabled.value=true;});
  add('pixel-ratio-1','Render scale 100%',()=>{const v=api.renderer.getPixelRatio();api.renderer.setPixelRatio(1);return ()=>api.renderer.setPixelRatio(v);});
  for(const distance of [360,240])add('distance-'+distance,'View distance '+distance+'m',()=>{const s=document.querySelector('#view-distance'),old=s.value;s.value=String(distance);s.dispatchEvent(new Event('change'));api.sceneryVisibility.update(api.camera,distance);return ()=>{s.value=old;s.dispatchEvent(new Event('change'));api.sceneryVisibility.update(api.camera,Number(old));};});
  add('far-forest-lod','Coarsest distant forest LOD beyond 160m',()=>{const states=all.filter(o=>o instanceof T.LOD&&/^Decorative forest (wood|leaves|birchLeaves)/.test(o.name)).map(o=>[o,o.levels.map(l=>l.distance)]);for(const [o] of states)if(o.levels[2])o.levels[2].distance=Math.min(o.levels[2].distance,160);return ()=>{for(const [o,ds]of states)o.levels.forEach((l,i)=>l.distance=ds[i]);};});
  add('forest-lod1','Force lowest existing forest detail',()=>{const states=all.filter(o=>o instanceof T.LOD&&/^Decorative forest (wood|leaves|birchLeaves)/.test(o.name)).map(o=>[o,o.levels.map(l=>l.distance)]);for(const [o]of states)o.levels.forEach((l,i)=>{if(i>0)l.distance=i;});return ()=>{for(const [o,ds]of states)o.levels.forEach((l,i)=>l.distance=ds[i]);};});
  return q.cases.map(({id,name})=>({id,name}));
 });
 const ranked=[...report.views].sort((a,b)=>b.sample.ms-a.sample.ms),targets=ranked.slice(0,Number(process.env.PERF_VIEW_COUNT??2));
 if(process.env.PERF_VERIFY==='1'){
  report.visual=[];report.liveVariants=[];
  for(const view of targets){
   await page.evaluate(view=>sceneResearch.setView(view),view);
   const check=await page.evaluate(async()=>{
    const q=sceneResearch,{api,gl}=q;const pixels=()=>{api.renderer.render(api.scene,api.camera);gl.finish();const data=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);return data;};
    await q.sample('visual-before',2,6);const before=pixels(),restore=q.cases.find(c=>c.id==='mountain-batched').apply();
    try{await q.sample('visual-after',2,6);const after=pixels();let changedPixels=0,maxDelta=0,total=0,over2=0;for(let i=0;i<before.length;i+=4){let changed=false,big=false;for(let c=0;c<3;c++){const d=Math.abs(before[i+c]-after[i+c]);if(d)changed=true;if(d>2)big=true;maxDelta=Math.max(maxDelta,d);total+=d;}if(changed)changedPixels++;if(big)over2++;}return {pixels:before.length/4,changedPixels,over2,maxDelta,meanChannelDelta:total/(before.length/4*3),glError:gl.getError()};}finally{restore();}
   });report.visual.push({view:view.id,...check});console.log(JSON.stringify({visual:view.id,...check}));
   for(const distance of [750,360]){
    await page.selectOption('#view-distance',String(distance),{force:true});
    await page.evaluate(()=>{sceneResearch.profiler.busy=false;sceneResearch.live=null;});await page.waitForTimeout(1200);
    await page.evaluate(()=>{sceneResearch.live={start:performance.now(),frames:[]};});await page.waitForTimeout(4500);
    const live=await page.evaluate(()=>{const q=sceneResearch,l=q.live;q.live=null;q.profiler.busy=true;return l;});report.liveVariants.push({view:view.id,distance,...live});
    const f=live.frames;console.log(JSON.stringify({live:view.id,distance,fps:1000*(f.length-1)/(f.at(-1).raf-f[0].raf)}));
   }
   await page.selectOption('#view-distance','750',{force:true});
  }
 }
 const filter=process.env.PERF_CASES?.split(',');const targetsCases=filter?caseNames.filter(c=>filter.includes(c.id)):caseNames;
 for(const view of targets)for(let round=0;round<Number(process.env.PERF_ROUNDS??2);round++){
  await page.evaluate(view=>sceneResearch.setView(view),view);
  const ordered=[...targetsCases].sort((a,b)=>Math.sin((caseNames.indexOf(a)+1)*(round+2)*17.13)-Math.sin((caseNames.indexOf(b)+1)*(round+2)*17.13));
  for(const item of ordered){
   const row=await page.evaluate(async id=>{const q=sceneResearch;const baseline=await q.sample('base',12,6),restore=q.cases.find(c=>c.id===id).apply();let variant;try{variant=await q.sample('variant',12,6);}finally{restore();}const control=await q.sample('control',12,6),reference=(baseline.ms+control.ms)/2;return {baseline,variant,control,referenceMs:reference,savedMs:reference-variant.ms,gain:(reference-variant.ms)/reference*100,stable:Math.abs(baseline.ms-control.ms)/reference<=.15,glError:q.gl.getError()};},item.id);
   report.pairs.push({view:view.id,round,...item,...row});console.log(JSON.stringify({view:view.id,round,id:item.id,savedMs:row.savedMs,gain:row.gain,stable:row.stable,calls:row.variant.calls,triangles:row.variant.triangles}));await save();
  }
 }
 report.gpuTelemetry=gpuTelemetry.join('');report.metadata.finalGlError=await page.evaluate(()=>sceneResearch.gl.getError());
 const finalFile=new URL(`report-${runId}.json`,out);await writeFile(finalFile,JSON.stringify(report,null,2));console.log(JSON.stringify({output:fileURLToPath(finalFile),errors:report.errors}));
}finally{gpuMonitor.kill();await browser.close();}
