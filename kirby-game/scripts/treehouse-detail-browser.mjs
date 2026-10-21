import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const baseline=process.env.TREEHOUSE_BASELINE==='1',url=process.env.GAME_URL??'http://127.0.0.1:5187/';
const out=fileURLToPath(new URL('../node_modules/.cache/treehouse-detail/',import.meta.url));await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGL|shader|THREE/i.test(m.text()))errors.push(m.text());});
 await page.route('**/__treehouse-detail',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto(url+'__treehouse-detail');
 if(!baseline){
  const source=execFileSync('git',['show','HEAD:kirby-game/src/treehouse.ts'],{encoding:'utf8'}),current=await(await page.request.get(url+'src/treehouse.ts')).text(),imports=[...current.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>m[1]);
  const body=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from\s+(['"])([^'"]+)\1/g,(_,q,spec)=>{
   const key=spec.startsWith('./')?'/src/'+spec.slice(2)+'.ts':spec==='three'?'/three.js':spec.split('/').at(-1).replace('.js','__js');return 'from '+JSON.stringify(imports.find(p=>p.includes(key))??key);
  });await page.route('**/src/treehouse-detail-before.ts',r=>r.fulfill({contentType:'application/javascript',body}));
 }
 const inventory=await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js'),{Treehouse}=await import('/src/treehouse.ts'),{RoomEnvironment}=await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1400,1000);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#b8d0d4');const generator=new T.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=generator.fromScene(room,.04).texture;room.dispose();generator.dispose();scene.add(new T.HemisphereLight('#e0ebff','#727451',.65));
  const sun=new T.DirectionalLight('#fff1d9',2.6);sun.position.set(-20,40,30);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-30,right:30,top:45,bottom:-20,near:1,far:110});sun.shadow.normalBias=.035;scene.add(sun);
  const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#778f59',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.04;floor.receiveShadow=true;scene.add(floor);
  const house=new Treehouse();house.group.position.set(0,0,0);scene.add(house.group);const camera=new T.PerspectiveCamera(43,1.4,.1,200);window.treeDetail={T,scene,renderer,camera,house};
  let calls=0,triangles=0,lights=0;house.group.traverse(o=>{if(o.isMesh){calls++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}if(o.isLight)lights++;});return {calls,triangles,lights};
 });
 if(!baseline)await page.evaluate(async()=>{const {Treehouse}=await import('/src/treehouse-detail-before.ts');const q=treeDetail;q.old=new Treehouse();q.old.group.position.set(0,0,0);q.old.group.visible=false;q.scene.add(q.old.group);});
 const views={};
 for(const [name,eye,target] of [['whole-tree',[-40,24,52],[-1,18,0]],['cabin',[18,27,28],[0,20,-.5]],['interior',[7,22.2,11],[0,19.8,-1]],['swing',[-21,10,17],[-10,5,1]],['branch',[-17,11,13],[-9,8,2]],['trunk',[7,6,9],[0,5,-6]]]){
  views[name]=await page.evaluate(async({eye,target})=>{const q=treeDetail;q.camera.position.fromArray(eye);q.camera.lookAt(...target);q.camera.updateMatrixWorld();const times=[],gl=q.renderer.getContext();for(let i=0;i<38;i++){await new Promise(requestAnimationFrame);const t=performance.now();q.renderer.render(q.scene,q.camera);gl.finish();if(i>11)times.push(performance.now()-t);}times.sort((a,b)=>a-b);return {calls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles,medianMs:times[13],p90Ms:times[23]};},{eye,target});
  await page.screenshot({path:out+(baseline?'before-':'')+name+'.png'});
 }
 const paired={};if(!baseline)for(const [name,eye,target] of [['whole-tree',[-40,24,52],[-1,18,0]],['cabin',[18,27,28],[0,20,-.5]],['branch',[-17,11,13],[-9,8,2]]]){
  paired[name]=await page.evaluate(async({eye,target})=>{
   const q=treeDetail;q.camera.position.fromArray(eye);q.camera.lookAt(...target);q.camera.updateMatrixWorld();
   const sample=async old=>{q.old.group.visible=old;q.house.group.visible=!old;const times=[],gl=q.renderer.getContext();q.renderer.info.autoReset=false;
    for(let i=0;i<42;i++){await new Promise(requestAnimationFrame);q.renderer.info.reset();const t=performance.now();q.renderer.render(q.scene,q.camera);gl.finish();if(i>=14)times.push(performance.now()-t);}times.sort((a,b)=>a-b);return {medianMs:times[14],p90Ms:times[25],calls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles};};
   const before=await sample(true),after=await sample(false),control=await sample(true);q.old.group.visible=false;q.house.group.visible=true;q.renderer.info.autoReset=true;return {before,after,control};
  },{eye,target});
 }
 assert.deepEqual(errors,[]);const report={inventory,views,paired,errors};await writeFile(out+(baseline?'before-checks':'checks')+'.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
