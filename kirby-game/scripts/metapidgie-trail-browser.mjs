import {chromium} from 'playwright';
import {createServer,transformWithEsbuild} from 'vite';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

// Isolated, real-WebGL visual regression using the game's model and FX modules.
const root=fileURLToPath(new URL('../',import.meta.url));
const output=fileURLToPath(new URL('../node_modules/.cache/metapidgie-trail/',import.meta.url));
await mkdir(output,{recursive:true});
const server=await createServer({configFile:false,root,server:{host:'127.0.0.1',port:0}});
await server.listen();
const base=server.resolvedUrls.local[0];
const baselineRef=process.env.TRAIL_BASELINE_REF??'HEAD';
const old=execFileSync('git',['show',baselineRef+':kirby-game/src/metapidgie-flight-trail.ts'],{cwd:root,encoding:'utf8'});
const compare=old.replace(/\r\n/g,'\n')!==(await readFile(new URL('../src/metapidgie-flight-trail.ts',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
const baseline=(await transformWithEsbuild(old,'metapidgie-flight-trail.ts',{loader:'ts',target:'es2022'})).code.replace(/from ['"]three['"]/g,'from "/node_modules/three/build/three.module.js"');
let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));
 page.on('console',m=>{if(m.type()==='error'&&/WebGL|shader|THREE/i.test(m.text()))errors.push(m.text());});
 await page.route('**/trail-qa',r=>r.fulfill({contentType:'text/html',body:'<html><body style="margin:0"></body></html>'}));
 await page.route('**/src/trail-before.js',r=>r.fulfill({contentType:'text/javascript',body:baseline}));
 await page.goto(base+'trail-qa');
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const {CharacterController}=await import('/src/controller.ts');
  const {clonePigeon}=await import('/src/pigeon-appearance.ts');
  const {MetapidgiePlayerDashFx}=await import('/src/metapidgie-player-dash-fx.ts');
  const {MetapidgieFlightTrail:Before}=await import('/src/trail-before.js');
  const model=await new GLTFLoader().loadAsync('/models/metapidgie-animated.glb');
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(1440,900);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#263b59');scene.add(new T.HemisphereLight('#f4f7ff','#596070',2.5));
  const light=new T.DirectionalLight('#fff3dd',3.4);light.position.set(3,7,5);scene.add(light);
  const c=new CharacterController(clonePigeon(model.scene),model.animations);scene.add(c.actor);c.setActivity('Fly');
  const current=new MetapidgiePlayerDashFx(c.actor),before=new Before();scene.add(before.group);
  const camera=new T.PerspectiveCamera(35,1440/900,.1,2000);
  window.trailQA={T,renderer,scene,c,current,before,camera,prepare(scale=1){
   current.trail.clear();before.clear();c.actor.scale.setScalar(scale);c.actor.rotation.y=Math.PI/2;
   camera.position.set(2*scale,8*scale,23*scale);camera.lookAt(-4.5*scale,4*scale,0);camera.updateMatrixWorld();
   for(let i=0;i<35;i++){c.actor.position.set((i-34)*.36*scale,2*scale,0);c.mixer.update(.02);current.update(true,.02,camera);const tail=c.actor.getObjectByName('Tail').getWorldPosition(new T.Vector3());before.updateDash(true,20+i*20,tail,camera,scale/3.3);}
  },render(which='after',background='#263b59',rear=false){
   scene.background.set(background);c.actor.visible=true;before.group.visible=which==='before';current.trail.group.visible=which==='after';
   if(rear){const s=c.actor.scale.x;camera.position.set(-17*s,7*s,6*s);camera.lookAt(0,4*s,0);camera.updateMatrixWorld();}
   renderer.render(scene,camera);
  },pixels(which){
   c.actor.visible=false;before.group.visible=which==='before';current.trail.group.visible=which==='after';scene.background.set('#080e1c');
   const target=new T.WebGLRenderTarget(720,450),pixels=new Uint8Array(720*450*4);renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,720,450,pixels);renderer.setRenderTarget(null);target.dispose();return [...pixels];
  }};
  trailQA.prepare();trailQA.render();
 });
 const metrics=await page.evaluate(()=>{
  const q=trailQA,summarize=p=>{let energy=0,min=450,max=-1,count=0;const bg=p.slice(0,3);for(let i=0;i<p.length;i+=4){const d=Math.max(0,p[i]-bg[0])+Math.max(0,p[i+1]-bg[1])+Math.max(0,p[i+2]-bg[2]);energy+=d;if(d>12){const y=Math.floor(i/4/720);min=Math.min(min,y);max=Math.max(max,y);count++;}}return {energy,height:max-min+1,pixels:count};};
  const before=summarize(q.pixels('before')),after=summarize(q.pixels('after')),a=q.pixels('after');
  for(const node of q.current.trail.group.children)node.material.uniforms.uTime.value+=.4;
  const b=q.pixels('after');let changed=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>6)changed++;
  const glError=q.renderer.getContext().getError();return {before,after,shimmerChangedPixels:changed,glError};
 });
 if(compare){assert(metrics.after.energy>metrics.before.energy*1.3,JSON.stringify(metrics));assert(metrics.after.height>metrics.before.height*1.3,JSON.stringify(metrics));}
 assert(metrics.shimmerChangedPixels>100,JSON.stringify(metrics));assert.equal(metrics.glError,0);
 for(const [name,which,background,rear,scale] of [
  ['before','before','#263b59',false,1],['after','after','#263b59',false,1],
  ['day','after','#9bc6e3',false,1],['rear','after','#263b59',true,1],['boss','after','#263b59',false,3.3],
 ]){
  await page.evaluate(({which,background,rear,scale})=>{trailQA.prepare(scale);trailQA.render(which,background,rear);},{which,background,rear,scale});
  await page.screenshot({path:output+name+'.png'});
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{const q=trailQA;q.prepare();q.renderer.setSize(390,844);q.camera.aspect=390/844;const focus=new q.T.Vector3(-5,4,0);q.camera.position.copy(focus).add(new q.T.Vector3(5,4,23).multiplyScalar(2.7));q.camera.lookAt(focus);q.camera.updateProjectionMatrix();q.camera.updateMatrixWorld();q.render();});
 await page.screenshot({path:output+'mobile.png'});
 assert.deepEqual(errors,[]);await writeFile(output+'report.json',JSON.stringify({metrics,errors},null,2));console.log(JSON.stringify({output,metrics,errors},null,2));
}finally{await browser?.close();await server.close();}
