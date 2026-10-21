import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const before=process.env.PROPS_BASELINE==='1',url=process.env.GAME_URL??'http://127.0.0.1:5187/';
const out=fileURLToPath(new URL('../node_modules/.cache/clearing-props/',import.meta.url));await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.route('**/__clearing-props',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
 await page.goto(url+'__clearing-props');
 if(!before)for(const file of ['kirby-home','landmarks','maze','maze-layout']){
  const source=execFileSync('git',['show','HEAD:kirby-game/src/'+file+'.ts'],{encoding:'utf8'});
  const current=await(await page.request.get(url+'src/'+file+'.ts')).text(),imports=[...current.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>m[1]);
  const body=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from\s+(['"])([^'"]+)\1/g,(_,q,spec)=>{
   const key=spec.startsWith('./')?'/src/'+spec.slice(2)+'.ts':spec==='three'?'/three.js':spec.split('/').at(-1).replace('.js','__js');
   const path=file==='maze'&&spec==='./maze-layout'?'/src/maze-layout-props-before.ts':imports.find(p=>p.includes(key))??(spec.startsWith('./')?key:undefined);if(!path)throw Error('Unmapped baseline import '+spec);return 'from '+JSON.stringify(path);
  });
  await page.route('**/src/'+file+'-props-before.ts',r=>r.fulfill({contentType:'application/javascript',body}));
 }
 const sites=await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js'),{KirbyHome}=await import('/src/kirby-home.ts'),{HedgeMaze}=await import('/src/maze.ts'),{createLandmarks,LANDMARKS}=await import('/src/landmarks.ts'),{RoomEnvironment}=await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1400,1000);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#c0d9dc');const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();
  const sun=new T.DirectionalLight('#fff0d1',3);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.03;Object.assign(sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22,near:1,far:100});scene.add(sun,sun.target,new T.HemisphereLight('#dfedff','#7d9060',1.1));
  const ground=new T.Mesh(new T.PlaneGeometry(900,900),new T.MeshStandardMaterial({color:'#789052',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.04;ground.receiveShadow=true;scene.add(ground);
  const home=new KirbyHome(),maze=new HedgeMaze(),landmarks=createLandmarks();scene.add(home.group,maze.group,landmarks);const camera=new T.PerspectiveCamera(42,1.4,.1,100);
  window.propsQA={T,renderer,scene,camera,sun,home,maze,landmarks};
  return {home:home.group.position.toArray(),maze:maze.group.position.toArray(),ruin:LANDMARKS.find(s=>s.kind===5),picnic:LANDMARKS.find(s=>s.kind===4)};
 });
 if(!before)await page.evaluate(async()=>{
  const {KirbyHome}=await import('/src/kirby-home-props-before.ts'),{HedgeMaze}=await import('/src/maze-props-before.ts'),{createLandmarks}=await import('/src/landmarks-props-before.ts');
  const q=propsQA;q.old=[new KirbyHome().group,new HedgeMaze().group,createLandmarks()];q.old.forEach(o=>{o.visible=false;q.scene.add(o);});
 });
 const report={views:{},errors};
 const photo=async(name,base,eye,target)=>{
  const stats=await page.evaluate(async({base,eye,target})=>{
   const q=propsQA,b=new q.T.Vector3(...base);q.camera.position.copy(b).add(new q.T.Vector3(...eye));q.camera.lookAt(b.clone().add(new q.T.Vector3(...target)));q.camera.updateMatrixWorld();q.sun.position.copy(b).add(new q.T.Vector3(-12,24,15));q.sun.target.position.copy(b);q.sun.target.updateMatrixWorld();q.sun.shadow.needsUpdate=true;
   const samples=[],gl=q.renderer.getContext();for(let i=0;i<40;i++){await new Promise(requestAnimationFrame);const t=performance.now();q.renderer.render(q.scene,q.camera);gl.finish();if(i>=12)samples.push(performance.now()-t);}samples.sort((a,b)=>a-b);
   return {calls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles,medianMs:samples[14],p90Ms:samples[25]};
  },{base,eye,target});report.views[name]=stats;await page.screenshot({path:out+(before?'before-':'')+name+'.png'});
 };
 await photo('home',sites.home,[14,10,19],[0,2.7,0]);
 await photo('interior',sites.home,[6,4.7,10],[0,1.9,-1.5]);
 await photo('maze-entrance',sites.maze,[16,8,57],[0,2.4,38]);
 await photo('maze-stones',sites.maze,[11,2.7,44],[7, .3,39]);
 await photo('ruins',[sites.ruin.x,0,sites.ruin.z],[14,9,20],[0,2.6,1]);
 await photo('picnic',[sites.picnic.x,0,sites.picnic.z],[7,6,9],[0,.45,.3]);
 if(!before){
  report.paired={};
  for(const [name,base,eye,target] of [['home',sites.home,[14,10,19],[0,2.7,0]],['maze',sites.maze,[16,8,57],[0,2.4,38]],['ruins',[sites.ruin.x,0,sites.ruin.z],[14,9,20],[0,2.6,1]],['picnic',[sites.picnic.x,0,sites.picnic.z],[7,6,9],[0,.45,.3]]]){
   report.paired[name]=await page.evaluate(async({base,eye,target})=>{
    const q=propsQA,b=new q.T.Vector3(...base);q.camera.position.copy(b).add(new q.T.Vector3(...eye));q.camera.lookAt(b.clone().add(new q.T.Vector3(...target)));q.camera.updateMatrixWorld();q.sun.position.copy(b).add(new q.T.Vector3(-12,24,15));q.sun.target.position.copy(b);q.sun.target.updateMatrixWorld();
    const sample=async old=>{
     q.old.forEach(o=>o.visible=old);[q.home.group,q.maze.group,q.landmarks].forEach(o=>o.visible=!old);const times=[],gl=q.renderer.getContext();q.renderer.info.autoReset=false;
     for(let i=0;i<38;i++){await new Promise(requestAnimationFrame);q.renderer.info.reset();const t=performance.now();q.renderer.render(q.scene,q.camera);gl.finish();if(i>=12)times.push(performance.now()-t);}times.sort((a,b)=>a-b);
     return {medianMs:times[13],p90Ms:times[23],calls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles};
    };
    const before=await sample(true),after=await sample(false),control=await sample(true);q.old.forEach(o=>o.visible=false);[q.home.group,q.maze.group,q.landmarks].forEach(o=>o.visible=true);q.renderer.info.autoReset=true;return {before,after,control};
   },{base,eye,target});
  }
 }
 assert.deepEqual(errors,[]);
 if(!before){try{report.before=JSON.parse(await readFile(out+'before-checks.json','utf8')).views;}catch{}}
 await writeFile(out+(before?'before-checks':'checks')+'.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
