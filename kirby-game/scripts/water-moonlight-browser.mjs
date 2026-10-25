import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import ts from 'typescript';

// Isolate DIRECT moonlight, which a sky-probe-only regression cannot exercise.
// Optional WATER_COMPARE_SOURCE is an exact pre-change water-surface.ts snapshot.
const out=fileURLToPath(new URL('../node_modules/.cache/water-moonlight/',import.meta.url));await mkdir(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:5195,strictPort:true}});await server.listen();
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/__water-moon-test',r=>r.fulfill({contentType:'text/html',body:'<html><head><link rel="icon" href="data:,"></head><body style="margin:0;overflow:hidden"></body></html>'}));
 if(process.env.WATER_COMPARE_SOURCE){
  const source=await readFile(process.env.WATER_COMPARE_SOURCE,'utf8'),body=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("from 'three'","from '/node_modules/.vite/deps/three.js'");
  await page.route('**/water-moon-baseline.js',r=>r.fulfill({contentType:'application/javascript',body}));
 }
 await page.goto('http://127.0.0.1:5195/__water-moon-test');
 await page.evaluate(async compare=>{
  const water=await import('/src/water-surface.ts'),T=await import('/node_modules/.vite/deps/three.js'),day=await import('/src/day-cycle.ts');
  const renderer=new T.WebGLRenderer({antialias:false});renderer.toneMapping=T.NoToneMapping;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(55,1.5,.05,300),probe=new T.LightProbe(),moon=new T.DirectionalLight('#bdd1f1',2.2);scene.add(probe,moon);
  const geometry=water.waterPlanarUVs(new T.PlaneGeometry(160,160)),mesh=new T.Mesh(geometry);mesh.rotation.x=-Math.PI/2;scene.add(mesh);
  const target=new T.WebGLRenderTarget(432,288),variants={},factories={current:water.createWaterSurface};
  if(compare)factories.legacy=(await import('/water-moon-baseline.js')).createWaterSurface;
  for(const [name,factory] of Object.entries(factories)){
   const variant=variants[name]=factory();
   const compile=variant.material.onBeforeCompile,key=variant.material.customProgramCacheKey();
   variant.material.onBeforeCompile=(shader,r)=>{compile.call(variant.material,shader,r);shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight=reflectedLight.directSpecular;\n #include <opaque_fragment>');};
   variant.material.customProgramCacheKey=()=>key+'|direct-moon-check';
  }
  window.moonQA={T,day,renderer,scene,camera,probe,moon,mesh,target,variants};
 },!!process.env.WATER_COMPARE_SOURCE);
 const render=async(variant,phase,angle,yaw=0,wavePhase=7)=>page.evaluate(({variant,phase,angle,yaw,wavePhase})=>{
  const q=moonQA,T=q.T,time=q.day.daylight(phase),light=new T.Vector3(...time.sunDirection).multiplyScalar(-1),horizontal=light.clone().setY(0).normalize(),side=new T.Vector3().crossVectors(new T.Vector3(0,1,0),horizontal);
  q.moon.position.copy(light).multiplyScalar(100);q.moon.intensity=2.2*(.72+.28*Math.abs(light.y)/q.day.CELESTIAL_MAX_HEIGHT)*time.shadowStrength;
  const sky=new T.Color('#8ea9d4').multiplyScalar(.65),ground=new T.Color('#37465f').multiplyScalar(.24);
  q.probe.sh.coefficients[0].copy(sky).add(ground).multiplyScalar(.5/.886227);q.probe.sh.coefficients[1].copy(sky).sub(ground).multiplyScalar(.5/1.023328);
  const view=horizontal.clone().multiplyScalar(Math.cos(yaw)).addScaledVector(side,Math.sin(yaw));
  q.camera.position.copy(horizontal).multiplyScalar(-18);q.camera.position.y=1.6;q.camera.lookAt(q.camera.position.clone().addScaledVector(view,1.6/Math.tan(angle*Math.PI/180)).setY(0));q.camera.updateMatrixWorld();
  const water=q.variants[variant];water.phase.value=wavePhase;q.mesh.material=water.material;
  q.scene.background=null;q.renderer.setClearColor(0,0);q.renderer.setRenderTarget(q.target);q.renderer.render(q.scene,q.camera);
  const gl=q.renderer.getContext(),bytes=new Uint8Array(432*288*4);q.renderer.readRenderTargetPixels(q.target,0,0,432,288,bytes);
  const columns=new Float64Array(432),values=[];let energy=0,bright=0,glowing=0,peak=0,offLane=0;
  for(let i=0;i<432*288;i++)if(bytes[i*4+3]){
   const value=(bytes[i*4]*.2126+bytes[i*4+1]*.7152+bytes[i*4+2]*.0722)/255,x=i%432;
   values.push(value);energy+=value;columns[x]+=value;peak=Math.max(peak,value);if(value>.025)bright++;if(value>.1)glowing++;if(Math.abs(x-215.5)>432*.15)offLane+=value;
  }
  let total=0,left=0,right=431;for(let x=0;x<432;x++){total+=columns[x];if(total<energy*.05)left=x;if(total<energy*.95)right=x;}
  const row={calls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles,mean:energy/values.length,peak,litFraction:bright/values.length,glowingFraction:glowing/values.length,trailWidth90:(right-left)/432,offLaneFraction:offLane/Math.max(energy,.000001),glError:gl.getError()};
  return {row,values};
 },{variant,phase,angle,yaw,wavePhase});
 const report={views:[],errors};
 for(const [phase,angle] of [[.55,3],[.55,9],[.65,3],[.65,9],[.75,3],[.75,9],[.9,3],[.9,9]]){
  const entry={phase,angle};
  for(const variant of process.env.WATER_COMPARE_SOURCE?['legacy','current']:['current']){
   const result=await render(variant,phase,angle);entry[variant]=result.row;assert.equal(result.row.glError,0);
  }
  if(entry.legacy){assert.equal(entry.current.calls,entry.legacy.calls);assert.equal(entry.current.triangles,entry.legacy.triangles);}
  assert(entry.current.trailWidth90<.28,'moon reflection should form a narrow trail');
  assert(entry.current.glowingFraction<.06,'moonlight must not illuminate a large sheet of water');report.views.push(entry);
 }
 const aligned=await render('current',.55,3),offAxis=await render('current',.55,3,Math.PI/3),moving=await render('current',.55,3,0,10);
 let change=0,energy=0;for(let i=0;i<aligned.values.length;i++){change+=Math.abs(aligned.values[i]-moving.values[i]);energy+=aligned.values[i]+moving.values[i];}
 report.motion={relativeChange:change/energy,offAxisRatio:offAxis.row.mean/aligned.row.mean};assert(report.motion.relativeChange>.1,'wave motion should break up and move the moon glints');assert(report.motion.offAxisRatio<.15,'the trail must follow the moon instead of the camera');
 assert.deepEqual(errors,[]);await writeFile(out+'checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify({out,...report}));
}finally{await browser.close();await server.close();}
