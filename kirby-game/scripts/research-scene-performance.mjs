import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';

const url=process.env.GAME_URL??'http://127.0.0.1:5183/';
const optimizing=process.env.PERF_RESEARCH_MODE==='optimizations';
const out=new URL(optimizing?'../artifacts/scene-optimizations-2026-10-23/':'../artifacts/scene-performance-2026-10-23/',import.meta.url);await mkdir(out,{recursive:true});
const checkpoints=new URL('../node_modules/.cache/scene-research-checkpoints/',import.meta.url);await mkdir(checkpoints,{recursive:true});
const runId=Date.now();let checkpoint=0;
const focused=optimizing||process.env.PERF_RESEARCH_MODE==='focused';
const gpuTelemetry=[];
const gpuMonitor=spawn('nvidia-smi',['--query-gpu=timestamp,pstate,utilization.gpu,clocks.current.graphics,clocks.current.memory,power.draw,temperature.gpu','--format=csv,noheader,nounits','--loop-ms=1000'],{windowsHide:true});
gpuMonitor.stdout.on('data',chunk=>gpuTelemetry.push(chunk.toString()));gpuMonitor.on('error',()=>{});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={method:{browser:'Isolated Chrome, hardware renderer recorded below; Vite serves existing prepared world, HMR/network rooms disabled.',ab:'Fixed scene and camera. 12 warmup + 20 measured render/gl.finish frames per sample. Paired baseline before/after each toggle. Effects overlap, savings must not be added.',live:'Actual game loop, real swing activity and camera rotation; CPU update/render submission and asynchronous EXT_disjoint_timer_query_webgl2 GPU time. This is separate from forced gl.finish A/B tests.'},metadata:{},live:[],angleTime:[],ab:[],inventory:[],errors:[]};
const save=()=>writeFile(new URL(`${runId}-${++checkpoint}.json`,checkpoints),JSON.stringify(report,null,2));
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),cdp=await page.context().newCDPSession(page);
 page.setDefaultTimeout(180000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))report.errors.push(m.text());});
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));
 await page.addInitScript(()=>{
  localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');localStorage.setItem('kirby-view-distance-v1','360');
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
  q.applyCamera=(camera,time)=>{const angle=(q.view.angle+(q.view.rotate?(time-q.view.start)*.018:0))*Math.PI/180;camera.position.set(q.focus.x+18*Math.sin(angle),q.focus.y+7,q.focus.z+18*Math.cos(angle));camera.lookAt(q.focus);};
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
  api.c.actor.position.set(124,0,48);api.treehouse.interact(api.c);
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
 for(const name of ['main.ts','ground-shadow-pass.ts','prepared-shadows.ts','scenery-visibility.ts'])report.metadata[name]=createHash('sha256').update(await readFile(new URL('../src/'+name,import.meta.url))).digest('hex').slice(0,16);
 report.metadata.worldManifest=JSON.parse(await readFile(new URL('../public/world/environment.manifest.json',import.meta.url),'utf8'));
 report.metadata.counterMode='explicit-all-passes';
 console.log(JSON.stringify({metadata:report.metadata}));await save();
 // Warm all main camera directions before measuring gameplay. New shader/LOD
 // compilation should not be confused with sustained frame load.
 await page.evaluate(async()=>{const q=sceneResearch;q.profiler.busy=true;for(const angle of [0,45,90,135,180,225,270,315]){q.prepare(angle,8);await q.sample('prewarm',4,3);}q.profiler.busy=false;});
 if(!focused)for(const item of [
  {id:'swing-morning-fixed',hour:8,angle:45,rotate:false,ratio:1.25},
  {id:'swing-morning-rotate',hour:8,angle:0,rotate:true,ratio:1.25},
  {id:'swing-noon-rotate',hour:12,angle:0,rotate:true,ratio:1.25},
  {id:'swing-night-rotate',hour:0,angle:0,rotate:true,ratio:1.25},
  {id:'swing-morning-rotate-ratio1',hour:8,angle:0,rotate:true,ratio:1},
 ]){
  await page.evaluate(item=>{const q=sceneResearch;q.api.renderer.setPixelRatio(item.ratio);q.setHour(item.hour);q.view={angle:item.angle,rotate:item.rotate,start:performance.now()};q.live=null;q.profiler.busy=false;q.tag=item.id;},item);
  await page.waitForTimeout(2000);
  const metricsBefore=await cdp.send('Performance.getMetrics');
  await page.evaluate(()=>{const q=sceneResearch;q.costs={};q.live={start:performance.now(),frames:[]};});
  await page.waitForTimeout(12000);
  const live=await page.evaluate(()=>{const q=sceneResearch,live=q.live;q.live=null;q.poll();const gpu=new Map(q.gpu.map(r=>[r.id,r.ms]));live.frames.forEach(f=>f.gpuMs=gpu.get(f.id)??null);live.end=performance.now();live.longTasks=window.__researchLongTasks.filter(t=>t.start>=live.start&&t.start<live.end);return live;});
  const metricsAfter=await cdp.send('Performance.getMetrics');
  report.live.push({...item,...live,metricsBefore:metricsBefore.metrics,metricsAfter:metricsAfter.metrics});await save();
  const frames=live.frames,intervals=frames.slice(1).map((f,i)=>f.raf-frames[i].raf).sort((a,b)=>a-b),med=a=>a[Math.floor(a.length/2)];
  console.log(JSON.stringify({live:item.id,frames:frames.length,fps:1000*(frames.length-1)/(frames.at(-1).raf-frames[0].raf),intervalMs:med(intervals),p95:intervals[Math.floor(intervals.length*.95)],updateMs:med(frames.map(f=>f.updateMs).sort((a,b)=>a-b)),renderCpuMs:med(frames.map(f=>f.renderMs).sort((a,b)=>a-b)),gpuMs:med(frames.map(f=>f.gpuMs).filter(v=>v!==null).sort((a,b)=>a-b)),longTasks:live.longTasks.length}));
 }
 await page.evaluate(()=>{const q=sceneResearch;q.live=null;q.profiler.busy=true;q.api.renderer.setPixelRatio(1.25);});
 if(!focused)for(const hour of [6,7,8,10,12,16,18,20,0])for(const angle of [0,45,90,135,180,225,270,315]){
  const sample=await page.evaluate(async({hour,angle})=>{const q=sceneResearch;q.prepare(angle,hour);return q.sample('angle-time',12,6);},{hour,angle});
  report.angleTime.push({hour,angle,...sample});
  if(angle===315){await save();console.log(JSON.stringify({timeSweep:hour,minMs:Math.min(...report.angleTime.filter(r=>r.hour===hour).map(r=>r.ms)),maxMs:Math.max(...report.angleTime.filter(r=>r.hour===hour).map(r=>r.ms))}));}
 }
 // Select a slow morning direction from this run; use it for paired toggles.
 const slow=focused?{angle:Number(process.env.PERF_ANGLE??45)}:report.angleTime.filter(r=>r.hour===8).sort((a,b)=>b.ms-a.ms)[0];report.metadata.abView={hour:8,angle:slow.angle};report.metadata.mode=focused?'focused-randomized':'survey';
 const inventory=await page.evaluate(async({angle})=>{
  const q=sceneResearch,{api}=q;q.prepare(angle,8);await q.sample('inventory-warm',3,3);
  const groups=new Map(),restore=[];let kind='colour';
  const category=o=>{for(let p=o;p&&p!==api.scene;p=p.parent){if(p.name==='Soft patterned tree shadows')return 'Тени деревьев';if(p.name==='Prepared grass shadows')return 'Тени травы';if(p===api.preparedShadows.group)return 'Подготовленные тени предметов';}let p=o;while(p.parent&&p.parent!==api.scene)p=p.parent;return p.name||p.type;};
  for(const o of (()=>{const a=[];api.scene.traverse(o=>{if(o.isMesh||o.isPoints||o.isLine||o.isSprite)a.push(o);});return a;})())for(const [beforeKey,afterKey,pass] of [['onBeforeRender','onAfterRender','colour'],['onBeforeShadow','onAfterShadow','shadow']]){
   const before=o[beforeKey],after=o[afterKey],stack=[];
   o[beforeKey]=function(...args){before.apply(this,args);stack.push({calls:api.renderer.info.render.calls,triangles:api.renderer.info.render.triangles});};
   o[afterKey]=function(...args){const at=stack.pop();if(at){const name=category(this),key=name+'|'+pass,row=groups.get(key)??{name,pass,calls:0,triangles:0};row.calls+=api.renderer.info.render.calls-at.calls;row.triangles+=api.renderer.info.render.triangles-at.triangles;groups.set(key,row);}return after.apply(this,args);};
   restore.push(()=>{o[beforeKey]=before;o[afterKey]=after;});
  }
  try{api.renderer.render(api.scene,api.camera);}finally{restore.forEach(fn=>fn());}
  return {totals:{...api.renderer.info.render},groups:[...groups.values()].sort((a,b)=>b.triangles-a.triangles),roots:api.scene.children.map(o=>({name:o.name,type:o.type,children:o.children.length}))};
 },slow);report.inventory=inventory;await save();console.log(JSON.stringify({inventory:inventory.groups.slice(0,10)}));
 const caseNames=await page.evaluate(()=>{
  const q=sceneResearch,{api}=q,T=api.THREE,all=[];api.scene.traverse(o=>all.push(o));
  const cases=[];
  if(api.characterShadows){
   cases.push({id:'legacy-shadows',name:'Исходные тени персонажей и полный обход',apply:()=>{api.characterShadows.enabled=false;return ()=>api.characterShadows.enabled=true;}});
   cases.push({id:'legacy-shadow-geometry',name:'Исходная геометрия теней при сокращённом обходе',apply:()=>{api.characterShadows.simplify=false;return ()=>api.characterShadows.simplify=true;}});
   cases.push({id:'legacy-fireflies',name:'Исходные отдельные светлячки',apply:()=>{api.fireflies.instances.enabled=false;api.fireflies.syncInstances(api.camera);return ()=>{api.fireflies.instances.enabled=true;api.fireflies.syncInstances(api.camera);};}});
   cases.push({id:'legacy-forest',name:'Исходные расстояния детализации леса',apply:()=>{api.forestDetail.setEnabled(false);return ()=>api.forestDetail.setEnabled(true);}});
   cases.push({id:'legacy-all',name:'Все прежние настройки при том же разрешении и дальности',apply:()=>{
    api.characterShadows.enabled=false;api.fireflies.instances.enabled=false;api.forestDetail.setEnabled(false);api.fireflies.syncInstances(api.camera);
    return ()=>{api.characterShadows.enabled=true;api.fireflies.instances.enabled=true;api.forestDetail.setEnabled(true);api.fireflies.syncInstances(api.camera);};
   }});
  }
  const hide=(id,name,objects)=>{if(objects.length)cases.push({id,name,apply:()=>{const states=objects.map(o=>[o,o.visible]);states.forEach(([o])=>o.visible=false);return ()=>states.forEach(([o,v])=>o.visible=v);}});};
  const forest=api.scene.getObjectByName('Four woodland biomes');
  hide('forest','Лес: стволы и кроны',forest.children.filter(o=>o.name!=='Biome ground'&&o.name!=='Soft patterned tree shadows'));
  hide('broadleaf','Лиственные кроны',all.filter(o=>/^Decorative forest (leaves|birchLeaves)/.test(o.name)));
  hide('needles','Хвоя елей',all.filter(o=>o.name==='Decorative forest needles'));
  hide('mountain-woodland','Лес на горных склонах',all.filter(o=>o.name==='Mountain slope woodland'));
  const mountains=api.scene.getObjectByName('Continuous square mountain range');
  cases.push({id:'mountains',name:'Геометрия гор без деревьев',apply:()=>{const m=mountains.material,v=m.visible;m.visible=false;return ()=>m.visible=v;}});
  hide('meadow-decor','Растительность поляны',all.filter(o=>o.name==='Biome meadow details'));
  hide('grass','Трава (модели)',all.filter(o=>o.name==='Meadow grass'));
  hide('all-prepared-shadows','Все подготовленные тени',all.filter(o=>o.name==='Soft patterned tree shadows').concat(api.preparedShadows.group));
  hide('tree-shadows','Подготовленные тени деревьев',all.filter(o=>o.name==='Soft patterned tree shadows'));
  hide('grass-shadows','Подготовленные тени травы',[api.preparedShadows.grass]);
  hide('object-shadows','Подготовленные тени предметов',[api.preparedShadows.group]);
  cases.push({id:'coverage-pass',name:'Обход MAX-прохода теней (меняет смешивание)',apply:()=>{q.bypassCoverage=true;return ()=>q.bypassCoverage=false;}});
  cases.push({id:'csm-update',name:'Обновление динамических карт теней',apply:()=>{const v=api.renderer.shadowMap.autoUpdate;api.renderer.shadowMap.autoUpdate=false;return ()=>api.renderer.shadowMap.autoUpdate=v;}});
  cases.push({id:'csm-all',name:'Динамические тени: карты и фильтрация',apply:()=>{const v=api.renderer.shadowMap.enabled;api.renderer.shadowMap.enabled=false;return ()=>api.renderer.shadowMap.enabled=v;}});
  cases.push({id:'pixel-ratio-1',name:'Разрешение рендера 1.0 вместо 1.25',apply:()=>{const v=api.renderer.getPixelRatio();api.renderer.setPixelRatio(1);return ()=>api.renderer.setPixelRatio(v);}});
  cases.push({id:'pixel-ratio-075',name:'Разрешение рендера 0.75 вместо 1.25',apply:()=>{const v=api.renderer.getPixelRatio();api.renderer.setPixelRatio(.75);return ()=>api.renderer.setPixelRatio(v);}});
  hide('clouds','Облака',all.filter(o=>o.name==='Drifting clouds'));
  hide('sun-rays','Солнечные лучи и ореол',all.filter(o=>o.name==='Soft sun rays'||o.name==='Soft sunlight halo'));
  hide('backdrop','Панорама дальнего леса',all.filter(o=>/panorama|backdrop/i.test(o.name)));
  hide('npcs','Персонажи NPC',api.npcs.map(n=>n.actor));
  hide('fireflies','Светлячки: модели и ореолы',api.fireflies?[api.fireflies.group]:[]);
  hide('point-lights','Точечные источники света',all.filter(o=>o instanceof T.PointLight));
  cases.push({id:'player-shadow',name:'Только динамическая тень игрока',apply:()=>{const states=[];api.c.actor.traverse(o=>{if(o.castShadow){states.push(o);o.castShadow=false;}});return ()=>states.forEach(o=>o.castShadow=true);}});
  cases.push({id:'all-actor-shadows',name:'Только динамические тени персонажей',apply:()=>{const states=all.filter(o=>o.castShadow);states.forEach(o=>o.castShadow=false);return ()=>states.forEach(o=>o.castShadow=true);}});
  for(const hour of [6,12,18,0])cases.push({id:'hour-'+hour,name:'Время суток '+hour+':00 вместо 8:00',apply:()=>{q.prepare(q.view.angle,hour);return ()=>q.prepare(q.view.angle,8);}});
  for(const [id,name] of [['oak','Oak treehouse, lookout, swing and leaf pile'],['coaster','Mountain circuit roller coaster'],['maze','Stone maze and golden star'],['mill','Interactive watermill'],['landmarks','Ponds, flowers, mushrooms, rocks, picnics and ruins'],['sky-trail','Небесная тропа'],['water','Swimmable lakes']])hide(id,name,api.scene.children.filter(o=>o.name===name||id==='sky-trail'&&o.name.startsWith(name)));
  q.cases=cases;return cases.map(({id,name})=>({id,name}));
 });
 if(focused){
  const ids=process.env.PERF_CASES?.split(',')??['forest','npcs','fireflies','all-prepared-shadows','tree-shadows','grass-shadows','coverage-pass','csm-update','csm-all','all-actor-shadows','pixel-ratio-1','hour-6','hour-12','hour-18','hour-0'];
  const targets=caseNames.filter(c=>ids.includes(c.id));report.focused=[];
  // Short paired blocks, deterministic shuffled order, four independent rounds.
  // This reduces confounding by user activity, GPU clocks and thermal drift.
  const angles=process.env.PERF_ANGLES?.split(',').map(Number)??[slow.angle];report.metadata.focusAngles=angles;
  for(const angle of angles)for(let round=0;round<Number(process.env.PERF_ROUNDS??4);round++){
   const ordered=[...targets].sort((a,b)=>Math.sin((ids.indexOf(a.id)+1)*(round+2)*17.13)-Math.sin((ids.indexOf(b.id)+1)*(round+2)*17.13));
   for(const item of ordered){
    const row=await page.evaluate(async({id,angle})=>{const q=sceneResearch;q.prepare(angle,8);const baseline=await q.sample('focus-base',10,5),restore=q.cases.find(c=>c.id===id).apply();let variant;try{variant=await q.sample('focus-var',10,5);}finally{restore();}const control=await q.sample('focus-control',10,5),reference=(baseline.ms+control.ms)*.5;return {baseline,variant,control,referenceMs:reference,savedMs:reference-variant.ms,gain:(reference-variant.ms)/reference*100,stable:Math.abs(baseline.ms-control.ms)/reference<.15,glError:q.gl.getError()};},{id:item.id,angle});
    report.focused.push({...item,angle,round,...row});await save();console.log(JSON.stringify({angle,round,case:item.id,savedMs:row.savedMs,stable:row.stable,glError:row.glError}));
   }
  }
  report.pipeline=await page.evaluate(async({angle})=>{
   const q=sceneResearch,{api}=q;q.prepare(angle,8);const original=api.groundShadowPass.original,cpu=[];let collecting=false;
   api.groundShadowPass.original=(root,camera)=>{const at=performance.now();try{return original(root,camera);}finally{if(collecting)cpu.push({id:q.serial,part:root===api.scene?'main-scene-and-CSM':root.name||'composite',ms:performance.now()-at});}};
   try{await q.sample('pipeline-warm',3,5);collecting=true;const total=await q.sample('pipeline',20,0);return {total,parts:[...new Set(cpu.map(r=>r.part))].map(part=>({part,cpuMs:q.quant(cpu.filter(r=>r.part===part).map(r=>r.ms),.5)})),frames:cpu};}finally{api.groundShadowPass.original=original;}
  },slow);
 }else for(const item of caseNames){
  const row=await page.evaluate(async({id,angle})=>{
   const q=sceneResearch;q.prepare(angle,8);const baseline=await q.sample(id+'-baseline'),restore=q.cases.find(c=>c.id===id).apply();let variant;
   try{variant=await q.sample(id+'-variant');}finally{restore();}
   const control=await q.sample(id+'-control'),reference=(baseline.ms+control.ms)*.5,stable=Math.abs(baseline.ms-control.ms)/reference<=.15;
   return {baseline,variant,control,referenceMs:reference,savedMs:reference-variant.ms,gain:(reference-variant.ms)/reference*100,stable};
  },{id:item.id,angle:slow.angle});report.ab.push({...item,...row});await save();console.log(JSON.stringify({case:item.id,savedMs:row.savedMs,gain:row.gain,stable:row.stable,calls:row.variant.calls,gpuMs:row.variant.gpuMs}));
 }
 // Repeat the largest measured effects in reverse order to expose drift.
 const verify=report.ab.filter(r=>r.stable).sort((a,b)=>b.savedMs-a.savedMs).slice(0,6).reverse();
 report.recheck=[];
 for(const item of verify){const row=await page.evaluate(async({id,angle})=>{const q=sceneResearch;q.prepare(angle,8);const baseline=await q.sample('verify-base'),restore=q.cases.find(c=>c.id===id).apply();let variant;try{variant=await q.sample('verify-var');}finally{restore();}const control=await q.sample('verify-control');return {baseline,variant,control,savedMs:(baseline.ms+control.ms)*.5-variant.ms};},{id:item.id,angle:slow.angle});report.recheck.push({id:item.id,...row});await save();console.log(JSON.stringify({recheck:item.id,savedMs:row.savedMs}));}
 await page.evaluate(({angle})=>{sceneResearch.prepare(angle,8);sceneResearch.api.renderer.render(sceneResearch.api.scene,sceneResearch.api.camera);},slow);
 await page.screenshot({path:fileURLToPath(new URL('swing-morning.png',out))});
 report.metadata.finalGlError=await page.evaluate(()=>sceneResearch.gl.getError());
 report.gpuTelemetry=gpuTelemetry.join('');
 await save();
 const finalFile=new URL(`report-${runId}.json`,out);await writeFile(finalFile,JSON.stringify(report,null,2));
 console.log(JSON.stringify({output:fileURLToPath(finalFile),errors:report.errors}));
}finally{gpuMonitor.kill();await browser.close();}
