import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

const output=new URL('../node_modules/.cache/fruit-eating/',import.meta.url);
await mkdir(output,{recursive:true});
const server=process.env.GAME_URL?undefined:await createServer({configFile:false,server:{host:'127.0.0.1',port:0}});
await server?.listen();
const base=(process.env.GAME_URL??server.resolvedUrls.local[0]).replace(/\/$/,'');
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1100,height:780}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/fruit-eating-preview',route=>route.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
 await page.goto(base+'/fruit-eating-preview');
 await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js');
  const {GLTFLoader}=await import('/node_modules/.vite/deps/three_addons_loaders_GLTFLoader__js.js');
  const {CharacterController}=await import('/src/controller.ts'),{FruitWorld}=await import('/src/fruits.ts');
  const {createPlayerModel}=await import('/src/player-model.ts'),{KIRBY_VARIANTS}=await import('/src/variants.ts');
  const loader=new GLTFLoader(),kirby=await loader.loadAsync('/models/kirby-animated.glb'),pigeon=await loader.loadAsync('/models/pigeon-animated.glb');
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1100,780);renderer.setPixelRatio(1);
  renderer.setClearColor('#dce8dc');renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
  window.eating={T,renderer,kirby,pigeon,CharacterController,FruitWorld,createPlayerModel,KIRBY_VARIANTS};
 });
 for(const variant of ['Классический','Пиджи']){
  await page.evaluate(variant=>{
   const m=window.eating,{T}=m,model=m.createPlayerModel(m.kirby,m.KIRBY_VARIANTS.find(v=>v[0]===variant),m.pigeon);
   const c=new m.CharacterController(model.model,model.clips),world=new m.FruitWorld(),scene=new T.Scene();
   scene.add(c.actor,world.group,new T.HemisphereLight('#eff8ff','#799066',2));
   const light=new T.DirectionalLight('#fff1dc',3.2);light.position.set(-4,8,5);light.castShadow=true;light.shadow.mapSize.set(2048,2048);scene.add(light);
   const floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshLambertMaterial({color:'#91ac78'}));floor.rotation.x=-Math.PI/2;floor.position.y=-.03;floor.receiveShadow=true;scene.add(floor);
   world.fruits.forEach((f,i)=>{f.object.visible=i===0;f.eaten=i!==0;});world.fruits[0].object.position.set(.15,0,3.4);world.syncInstances();
   const camera=new T.PerspectiveCamera(36,1100/780,.1,200);camera.position.set(6,3.5,7);camera.lookAt(0,1.1,1.15);
   m.c=c;m.world=world;m.scene=scene;m.camera=camera;m.elapsed=0;
   world.update(0,c,[]);m.renderer.render(scene,camera);
  },variant);
  const frames=[];
  for(const time of [0,.22,.44,.64,.79,.92,1.18,1.4]){
   const frame=await page.evaluate(time=>{
    const m=window.eating,idle={forward:false,left:false,right:false};
    while(m.elapsed<time-1e-6){const dt=Math.min(1/120,time-m.elapsed);m.c.update(dt,idle);m.world.update(dt,m.c,[]);m.elapsed+=dt;}
    m.world.syncInstances();m.renderer.render(m.scene,m.camera);
    const f=m.world.fruits[0],mouth=m.c.fruitEating.mouthPosition(new m.T.Vector3());
    return {time,eaten:f.eaten,visible:f.object.visible,position:f.object.position.toArray(),scale:f.object.scale.toArray(),mouth:mouth.toArray(),score:m.c.fruitsEaten};
   },time);
   frames.push(frame);
   await page.screenshot({path:fileURLToPath(new URL(`${variant==='Пиджи'?'pigeon':'kirby'}-${Math.round(time*1000)}.png`,output))});
  }
  assert(frames[2].visible&&!frames[2].eaten);assert.equal(frames.at(-1).score,1);assert(!frames.at(-1).visible);
  console.log(JSON.stringify({variant,frames}));
 }
 assert.deepEqual(errors,[]);
 if(process.argv.includes('--game')){
  for(const FRUIT_PLAYER of ['kirby','pigeon']){
   const result=await promisify(execFile)(process.execPath,['scripts/fruit-speed-browser.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,KIRBY_URL:base+'/',FRUIT_PLAYER},windowsHide:true,timeout:180000});
   console.log(FRUIT_PLAYER+': '+result.stdout);if(result.stderr)console.error(result.stderr);
  }
 }
}finally{await browser.close();await server?.close();}
