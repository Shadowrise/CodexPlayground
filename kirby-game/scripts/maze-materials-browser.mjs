import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import ts from 'typescript';
const baseline=process.env.MAZE_BASELINE==='1',url=process.env.GAME_URL??'http://127.0.0.1:5187/';
const out=fileURLToPath(new URL('../node_modules/.cache/maze-materials/',import.meta.url));await mkdir(out,{recursive:true});
if(baseline)await writeFile(out+'maze-before.ts',await readFile(new URL('../src/maze.ts',import.meta.url),'utf8'));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.route('**/__maze-materials',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto(url+'__maze-materials');
 if(!baseline){const current=await(await page.request.get(url+'src/maze.ts')).text(),imports=[...current.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>m[1]);
  const source=await readFile(out+'maze-before.ts','utf8'),body=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from\s+(['"])([^'"]+)\1/g,(_,q,spec)=>{const key=spec.startsWith('./')?'/src/'+spec.slice(2)+'.ts':spec==='three'?'/three.js':spec.split('/').at(-1).replace('.js','__js');return 'from '+JSON.stringify(imports.find(p=>p.includes(key))??key);});await page.route('**/src/maze-materials-before.ts',r=>r.fulfill({contentType:'application/javascript',body}));
 }
 await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js'),{HedgeMaze}=await import('/src/maze.ts'),{RoomEnvironment}=await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(1400,1000);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#b7d2d7');scene.add(new T.HemisphereLight('#e0eeff','#7b8561',.8));const sun=new T.DirectionalLight('#fff1d8',2.7);sun.position.set(-40,80,50);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-52,right:52,top:52,bottom:-52,near:1,far:180});sun.shadow.normalBias=.02;scene.add(sun);
  const generator=new T.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=generator.fromScene(room,.04).texture;room.dispose();generator.dispose();
  const floor=new T.Mesh(new T.PlaneGeometry(250,250),new T.MeshStandardMaterial({color:'#83935c',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.04;floor.receiveShadow=true;scene.add(floor);
  const maze=new HedgeMaze();maze.group.position.set(0,0,0);scene.add(maze.group);const camera=new T.PerspectiveCamera(46,1.4,.1,300);window.mazeMaterials={T,renderer,scene,camera,maze};
 });
 if(!baseline)await page.evaluate(async()=>{const {HedgeMaze}=await import('/src/maze-materials-before.ts');const q=mazeMaterials;q.old=new HedgeMaze();q.old.group.position.set(0,0,0);q.old.group.visible=false;q.scene.add(q.old.group);});
 const views=[['overview',[65,65,78],[0,1,0]],['entrance',[16,8,57],[0,3,36]],['corridor',[2,3.7,31],[2,2,20]],['masonry',[7,4,42],[4,2.4,35]],['floor',[3,3.5,30],[1,.1,27]]],report={views:{},errors};
 for(const [name,eye,target] of views){
  report.views[name]=await page.evaluate(async({eye,target,baseline})=>{
   const q=mazeMaterials;q.camera.position.fromArray(eye);q.camera.lookAt(...target);q.camera.updateMatrixWorld();
   const sample=async old=>{if(q.old)q.old.group.visible=old;q.maze.group.visible=!old;const times=[],gl=q.renderer.getContext();q.renderer.info.autoReset=false;
    for(let i=0;i<42;i++){await new Promise(requestAnimationFrame);q.renderer.info.reset();const t=performance.now();q.renderer.render(q.scene,q.camera);gl.finish();if(i>=14)times.push(performance.now()-t);}times.sort((a,b)=>a-b);return {calls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles,medianMs:times[14],p90Ms:times[25]};};
   if(baseline)return sample(false);const before=await sample(true),after=await sample(false),control=await sample(true);q.old.group.visible=false;q.maze.group.visible=true;q.renderer.render(q.scene,q.camera);return {before,after,control};
  },{eye,target,baseline});await page.screenshot({path:out+(baseline?'before-':'')+name+'.png'});
 }
 assert.deepEqual(errors,[]);await writeFile(out+(baseline?'before-checks':'checks')+'.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
