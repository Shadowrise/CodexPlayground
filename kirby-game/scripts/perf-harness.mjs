// Performance harness: starts a solo game in hardware Chrome and runs one snippet inside the page.
//
//   npm run dev -- --port 5184 --strictPort          (in another terminal)
//   node scripts/perf-harness.mjs scripts/perf/meadow-frame.js
//   node scripts/perf-harness.mjs scripts/perf/meadow-programs.js --three
//
// The snippet is the body of an async function and returns a string or JSON value.
// GAME_URL overrides the address, CHROME_PATH the browser, SHOT=<file.png> saves a
// final screenshot. --three (development server only) counts in window.__gp why
// Three re-resolves material programs. Helpers available to snippets:
//   __api {THREE,scene,camera,renderer,worldMatrices,mountainLedges,skyTrail,cosmicArena,c,fireflies,npcs}
//   __view(view), __VIEWS, __hour(h), __sleep(ms), __live(ms), __inventory(), __pixels(), __diff(a,b)
//   __profStart() / __profStop(top)  — CPU profile summary;  window.__freeze=true stops the game loop
// Headless Chrome picks the integrated GPU on hybrid laptops: the harness forces the
// discrete one. Compare variants inside one run; absolute numbers drift between runs.
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
const url=process.env.GAME_URL??'http://127.0.0.1:5184/';
const snippet=await readFile(process.argv[2],'utf8'),three=process.argv.includes('--three');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--force_high_performance_gpu']});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}});page.setDefaultTimeout(240000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');localStorage.setItem('kirby-view-distance-v1','750');localStorage.setItem('kirby-render-scale-v1','1.25');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 if(three)await page.route('**/node_modules/.vite/deps/chunk-*.js*',async route=>{
  const response=await route.fetch();let body=await response.text();
  if(body.includes('program = getProgram(material, scene, object);')){
   body=body.replace(/needsProgramChange = true;\s*materialProperties\.__version = material\.version;/,m=>'window.__gpVer=true;'+m);
   body=body.replace('program = getProgram(material, scene, object);',`{const mp=materialProperties;const reason=window.__gpVer?'version':(mp.needsLights&&mp.lightsStateVersion!==lights.state.version)?'lights':(!!object.isInstancedMesh!==mp.instancing)?'instancing':(!!object.isSkinnedMesh!==mp.skinning)?'skinning':(object.isInstancedMesh&&mp.instancingColor!==(object.instanceColor!==null))?'instancingColor':(!!object.isBatchedMesh!==mp.batching)?'batching':(material.fog===true&&mp.fog!==fog)?'fog':(mp.envMap!==envMap)?'envMap':(mp.vertexAlphas!==vertexAlphas)?'vertexAlphas':(mp.vertexTangents!==vertexTangents)?'tangents':(mp.morphTargets!==morphTargets)?'morph':(mp.toneMapping!==toneMapping)?'toneMapping':'other';window.__gpVer=false;if(window.__gp){let top=object;while(top.parent&&top.parent.parent)top=top.parent;const k=reason+' | '+material.type+' "'+(material.name||'')+'" | '+object.type+' "'+(object.name||'').slice(0,36)+'" | root "'+(top.name||top.type).slice(0,30)+'"';window.__gp.set(k,(window.__gp.get(k)??0)+1);}}program = getProgram(material, scene, object);`);
  }
  await route.fulfill({response,body});
 });
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch();let body=await response.text();
  body=body.replace(/renderer\.setAnimationLoop\(\(time\)\s*=>\s*\{/,m=>m+'if(window.__freeze)return;window.__frames=(window.__frames??0)+1;const __t0=performance.now();');
  body=body.replace('camera.lookAt(cameraTarget);','camera.lookAt(cameraTarget);if(window.__fixed){camera.position.fromArray(window.__fixed.position);camera.lookAt(new THREE.Vector3().fromArray(window.__fixed.target));}');
  body=body.replace(/const lightTime\s*=\s*daylight\(currentDayPhase\(\)\);/,'const lightTime=daylight(window.__phase??currentDayPhase());');
  body=body.replace(/renderer\.render\(scene,\s*camera\);/,m=>'const __t1=performance.now();'+m+'if(window.__times)window.__times.push([__t1-__t0,performance.now()-__t1,renderer.info.render.calls,time,renderer.info.render.triangles]);');
  body+='\nwindow.__api={THREE,scene,camera,renderer,worldMatrices,mountainLedges,skyTrail,cosmicArena,get c(){return character},get fireflies(){return fireflies},get npcs(){return npcs}};';
  await route.fulfill({response,body});
 });
 const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:500});
 await page.exposeFunction('__profStart',async()=>{await cdp.send('Profiler.start');});
 await page.exposeFunction('__profStop',async(top=40)=>{const {profile}=await cdp.send('Profiler.stop');const byId=new Map(profile.nodes.map(n=>[n.id,n])),self=new Map();
  for(let i=0;i<profile.samples.length;i++)self.set(profile.samples[i],(self.get(profile.samples[i])??0)+(profile.timeDeltas[i]??0));
  const label=n=>{const f=n.callFrame;return (f.functionName||'(anon)')+' @'+(f.url||'').split('/').pop().split('?')[0]+':'+(f.lineNumber+1);};
  const selfBy=new Map(),incl=new Map();for(const [id,us] of self){const k=label(byId.get(id));selfBy.set(k,(selfBy.get(k)??0)+us/1000);}
  const walk=(n,stack)=>{const k=label(n),fresh=!stack.has(k);if(fresh)stack.add(k);let sum=(self.get(n.id)??0)/1000;for(const c of n.children??[])sum+=walk(byId.get(c),stack);if(fresh){incl.set(k,(incl.get(k)??0)+sum);stack.delete(k);}return sum;};walk(profile.nodes[0],new Set());
  const list=m=>[...m].sort((a,b)=>b[1]-a[1]).slice(0,top).map(([k,v])=>v.toFixed(0).padStart(6)+' ms  '+k);
  const NL=String.fromCharCode(10);return 'SELF'+NL+list(selfBy).join(NL)+NL+'INCLUSIVE'+NL+list(incl).join(NL);});
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:240000});
 await page.click('#new-game');await page.fill('#player-name-input','Harness');await page.click('#start-game');
 await page.waitForFunction(()=>window.__api?.c,null,{timeout:240000});
 await page.evaluate(async()=>{
  const {phaseAtHour}=await import('/src/day-cycle.ts');window.__hour=h=>{window.__phase=phaseAtHour(h);};window.__hour(8);
  window.__sleep=ms=>new Promise(r=>setTimeout(r,ms));
  window.__view=async(v,settle=2500)=>{window.__fixed=v.fixed??null;if(v.hour!==undefined)window.__hour(v.hour);if(v.player)__api.c.actor.position.set(...v.player);await window.__sleep(settle);};
  window.__VIEWS={spawn:{},nw:{fixed:{position:[-230,10,-230],target:[0,3,0]},player:[-230,0,-230]},ne:{fixed:{position:[230,10,-230],target:[0,3,0]},player:[230,0,-230]},se:{fixed:{position:[230,10,230],target:[0,3,0]},player:[230,0,230]},sw:{fixed:{position:[-230,10,230],target:[0,3,0]},player:[-230,0,230]}};
  const med=a=>{a=[...a].sort((x,y)=>x-y);return a[Math.floor(a.length/2)];};
  window.__live=async(ms=3000)=>{window.__times=[];await window.__sleep(ms);const t=window.__times;window.__times=null;return {fps:+((t.length-1)*1000/(t.at(-1)[3]-t[0][3])).toFixed(1),updateMs:+med(t.map(x=>x[0])).toFixed(2),renderMs:+med(t.map(x=>x[1])).toFixed(2),calls:med(t.map(x=>x[2])),tris:med(t.map(x=>x[4]))};};
  // draw calls/triangles by top-level root and pass for one frozen frame
  window.__inventory=()=>{const {scene,renderer,camera}=__api,groups=new Map(),restore=[];
   const cat=o=>{let p=o;while(p.parent&&p.parent!==scene)p=p.parent;return (p.name||p.type).replace(/^NPC \d+ · .*/,'NPC (all)').replace(/^Дик.*/,'Wild pigeons');};
   scene.traverse(o=>{if(!o.isMesh&&!o.isPoints&&!o.isLine&&!o.isSprite)return;for(const [bk,ak,pass] of [['onBeforeRender','onAfterRender','colour'],['onBeforeShadow','onAfterShadow','shadow']]){const before=o[bk],after=o[ak],stack=[];o[bk]=function(...a){before.apply(this,a);stack.push([renderer.info.render.calls,renderer.info.render.triangles]);};o[ak]=function(...a){const at=stack.pop();if(at){const k=cat(this)+'|'+pass,row=groups.get(k)??{name:cat(this),pass,calls:0,triangles:0};row.calls+=renderer.info.render.calls-at[0];row.triangles+=renderer.info.render.triangles-at[1];groups.set(k,row);}return after.apply(this,a);};restore.push(()=>{o[bk]=before;o[ak]=after;});}});
   const reset=renderer.info.autoReset;renderer.info.autoReset=false;renderer.info.reset();try{renderer.render(scene,camera);return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,groups:[...groups.values()].sort((a,b)=>b.calls-a.calls)};}finally{restore.forEach(f=>f());renderer.info.autoReset=reset;}};
  window.__pixels=()=>{const {renderer,scene,camera}=__api,gl=renderer.getContext();renderer.render(scene,camera);gl.finish();const data=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);return data;};
  window.__diff=(x,y)=>{let changed=0,over2=0,max=0;for(let i=0;i<x.length;i+=4){let d=0;for(let k=0;k<3;k++)d=Math.max(d,Math.abs(x[i+k]-y[i+k]));if(d)changed++;if(d>2)over2++;if(d>max)max=d;}return {changed,over2,max};};
 });
  const result=await page.evaluate(`(async()=>{${snippet}\n})()`);
 console.log(typeof result==='string'?result:JSON.stringify(result,null,1));
 if(process.env.SHOT)await page.screenshot({path:process.env.SHOT});
 if(errors.length)console.log('ERRORS',JSON.stringify(errors.slice(0,8)));
}finally{await browser.close();}
