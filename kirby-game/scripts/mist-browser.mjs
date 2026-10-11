import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import ts from 'typescript';
import assert from 'node:assert/strict';

const base=process.env.KIRBY_URL??'http://127.0.0.1:5174/';
const out=new URL('../node_modules/.cache/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/i.test(m.text()))errors.push(m.text());});
 await page.route('**/mist-preview',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0;background:#243e32"></body>'}));
 for(const file of ['fruits','flight','night-fireflies']){
  const source=execFileSync('git',['show',`HEAD:kirby-game/src/${file}.ts`],{cwd:'..',encoding:'utf8'});
  const body=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from\s+(['"])([^'"]+)\1/g,(_,q,s)=>s==='three'?"from '/node_modules/.vite/deps/three.js'":`from '/src/${s.slice(2)}.ts'`);
  await page.route(`**/src/${file}-mist-before.ts`,r=>r.fulfill({contentType:'application/javascript',body}));
 }
 await page.goto(base+'mist-preview');
 const budget=await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js'),{FruitWorld}=await import('/src/fruits.ts'),{FruitWorld:BeforeWorld}=await import('/src/fruits-mist-before.ts');
  const {flightCloud,updateFlightCloud,Flight}=await import('/src/flight.ts'),{flightCloud:beforeCloud,updateFlightCloud:beforeUpdate}=await import('/src/flight-mist-before.ts');
  const scene=new T.Scene();scene.background=new T.Color('#839777');
  const ground=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshLambertMaterial({color:'#718663'}));ground.rotation.x=-Math.PI/2;ground.position.y=-.04;scene.add(ground);
  const sun=new T.DirectionalLight('#fff1dc',3);sun.position.set(-5,8,5);scene.add(sun,new T.HemisphereLight('#dae6ee','#738055',1));
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,900);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.setScissorTest(true);document.body.append(renderer.domElement);
  const camera=new T.PerspectiveCamera(38,600/300,.1,150),before=new BeforeWorld(),after=new FruitWorld();
  for(const world of [before,after]){
   world.fruits.forEach(f=>f.object.visible=false);world.syncInstances();const f=world.fruits[5];f.object.visible=true;f.object.position.set(0,0,0);f.object.rotation.y=0;world.syncInstances();scene.add(world.group);world.group.visible=false;
  }
  const cloud=flightCloud(),oldCloud=beforeCloud(),flight=new Flight();flight.press();flight.press();flight.update(.5);updateFlightCloud(cloud,flight);beforeUpdate(oldCloud,flight);
  const {GLTFLoader}=await import('/node_modules/.vite/deps/three_addons_loaders_GLTFLoader__js.js');
  const {CharacterController}=await import('/src/controller.ts'),{cloneVariant,KIRBY_VARIANTS}=await import('/src/variants.ts');
  const gltf=await new GLTFLoader().loadAsync('/models/kirby-animated.glb'),c=new CharacterController(cloneVariant(gltf.scene,KIRBY_VARIANTS[0],false),gltf.animations);
  c.actor.remove(c.cloud);c.actor.position.y=3;scene.add(c.actor);c.actor.add(cloud,oldCloud);c.actor.visible=false;
  const bugGltf=await new GLTFLoader().loadAsync('/models/firefly-animated.glb'),{NightFireflies}=await import('/src/night-fireflies.ts'),{NightFireflies:BeforeBugs}=await import('/src/night-fireflies-mist-before.ts');
  const bugs=new NightFireflies(bugGltf),oldBugs=new BeforeBugs(bugGltf);
  for(const world of [bugs,oldBugs]){world.update(.1,true,new T.Vector3());world.bugs.forEach((b,i)=>{b.carrier.visible=i===6;b.halo.visible=true;});const b=world.bugs[6];b.firefly.object.visible=true;b.carrier.position.set(0,1,0);b.carrier.rotation.y=0;scene.add(world.group);world.group.visible=false;}
  window.mistPreview={T,scene,renderer,camera,before,after,cloud,oldCloud,c,sun,bugs,oldBugs};
  const count=root=>{let calls=0,triangles=0;root.traverse(o=>{if(o.isSprite){calls++;triangles+=2;}else if(o.isMesh&&!o.isInstancedMesh){calls++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});return {calls,triangles};};
  return {fruitBefore:count(before.fruits[5].object),fruitAfter:count(after.fruits[5].object),cloudBefore:count(oldCloud),cloudAfter:count(cloud),bugBefore:count(oldBugs.bugs[6].halo),bugAfter:count(bugs.bugs[6].halo)};
 });
 for(const kind of ['fruit','cloud','bug']){
  const views=kind==='fruit'?[[0,2,9],[8,2,0],[0,8,.1]]:kind==='cloud'?[[0,5,11],[10,5,0],[0,10,3]]:[[0,2,5],[5,2,0],[0,5,.1]];
  await page.evaluate(({kind,views})=>{
   const t=window.mistPreview;t.c.actor.visible=kind==='cloud';t.scene.background.set(kind==='bug'?'#16253a':'#839777');t.sun.intensity=kind==='bug'?.3:3;
   t.renderer.info.autoReset=false;t.renderer.info.reset();
   for(let row=0;row<3;row++)for(let column=0;column<2;column++){
    t.before.group.visible=kind==='fruit'&&column===0;t.after.group.visible=kind==='fruit'&&column===1;
    t.cloud.visible=kind==='cloud'&&column===1;t.oldCloud.visible=kind==='cloud'&&column===0;
    t.bugs.group.visible=kind==='bug'&&column===1;t.oldBugs.group.visible=kind==='bug'&&column===0;
    t.renderer.setViewport(column*600,(2-row)*300,600,300);t.renderer.setScissor(column*600,(2-row)*300,600,300);
    t.camera.position.fromArray(views[row]);t.camera.lookAt(0,kind==='fruit'?.8:kind==='cloud'?3:1.3,0);t.renderer.render(t.scene,t.camera);
   }
  },{kind,views});
  await page.screenshot({path:new URL(`mist-${kind}-comparison.png`,out).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 }
 // Opaque surroundings must still hide mist: it cannot glow through a wall.
 const occlusion=await page.evaluate(()=>{
  const t=window.mistPreview,T=t.T;t.c.actor.visible=false;t.bugs.group.visible=t.oldBugs.group.visible=false;t.before.group.visible=false;t.after.group.visible=true;
  t.renderer.setViewport(0,0,1200,900);t.renderer.setScissor(0,0,1200,900);t.camera.aspect=1200/900;t.camera.updateProjectionMatrix();t.camera.position.set(0,2,9);t.camera.lookAt(0,.8,0);
  const wall=new T.Mesh(new T.BoxGeometry(6,5,.4),new T.MeshBasicMaterial({color:'#496557'}));wall.position.set(0,1.5,4);t.scene.add(wall);
  const read=()=>{t.renderer.render(t.scene,t.camera);const pixel=new Uint8Array(4);t.renderer.getContext().readPixels(600,450,1,1,t.renderer.getContext().RGBA,t.renderer.getContext().UNSIGNED_BYTE,pixel);return [...pixel];};
  const shown=read();t.after.fruits[5].object.getObjectByName('Fruit colored mist').visible=false;const hidden=read();return {shown,hidden};
 });
 assert.deepEqual(occlusion.shown,occlusion.hidden);assert.deepEqual(errors,[]);
 assert.equal(budget.fruitAfter.calls,budget.fruitBefore.calls);assert.equal(budget.cloudAfter.calls,budget.cloudBefore.calls);
 assert.equal(budget.bugAfter.calls,budget.bugBefore.calls);
 // Check the production scene too: its fog/shadow setup must preserve the shader.
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.gameMist={get c(){return character},get bugs(){return fireflies},fruits,scene,renderer,camera};'});});
 await page.goto(base);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.locator('#player-name-input').fill('Облачко');await page.locator('#new-game').click();await page.locator('#start-game').click();await page.waitForFunction(()=>window.gameMist.c);
 await page.keyboard.press('Space');await page.waitForFunction(()=>window.gameMist.c.cloud.visible&&window.gameMist.c.cloud.children[0].material.opacity>.2);
 const integrated=await page.evaluate(()=>{
  const t=window.gameMist;t.renderer.setAnimationLoop(null);
  t.scene.updateMatrixWorld(true);t.camera.position.copy(t.c.actor.position).add({x:3,y:2,z:7});t.camera.lookAt(t.c.actor.position);t.renderer.render(t.scene,t.camera);
  return {fruitVolumes:t.fruits.fruits.filter(f=>f.object.getObjectByName('Fruit colored mist').isMesh).length,bugVolumes:t.bugs.bugs.filter(b=>b.halo.isMesh).length,cloudPuffs:t.c.cloud.children.length};
 });
 assert.deepEqual(integrated,{fruitVolumes:70,bugVolumes:40,cloudPuffs:7});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({budget,occlusionPreserved:true,integrated,shaderErrors:errors}));
}finally{await browser.close();}
