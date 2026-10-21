import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const baseline=process.env.STARS_BASELINE==='1',url=process.env.GAME_URL??'http://127.0.0.1:5187/';
const output=fileURLToPath(new URL('../node_modules/.cache/collectible-stars/',import.meta.url));await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.route('**/__collectible-stars',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
 await page.goto(url+'__collectible-stars');
 const setup=await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js'),{HedgeMaze}=await import('/src/maze.ts'),{SkyTrail}=await import('/src/sky-trail.ts'),{StarfallView}=await import('/src/starfall-view.ts');
  const {RoomEnvironment}=await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(1280,900);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
  document.body.append(renderer.domElement);const scene=new T.Scene();scene.background=new T.Color('#182732');
  const generator=new T.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=generator.fromScene(room,.04).texture;room.dispose();generator.dispose();
  const ambient=new T.HemisphereLight('#e3efff','#796351',.65),sun=new T.DirectionalLight('#fff2d5',3.1);sun.position.set(-4,7,6);scene.add(ambient,sun);
  const ground=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:'#263d42',roughness:.95}));ground.rotation.x=-Math.PI/2;ground.position.y=-.05;scene.add(ground);
  const maze=new HedgeMaze(),trail=new SkyTrail(),festival=new StarfallView(()=>{},()=>{},()=>{}),camera=new T.PerspectiveCamera(40,1280/900,.1,200);
  const objects=[maze.star.clone(),trail.star.clone()];festival.spawn(0,new T.Vector3(),[]);objects.push([...festival.stars.values()][0].group.clone());
  for(const object of objects){object.position.set(0,2.4,0);object.rotation.set(0,0,0);scene.add(object);object.visible=false;}
  const stats=o=>{let calls=0,triangles=0,sprites=0,lights=0;const geometries=new Set();o.traverse(n=>{if(n.isMesh){calls++;triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;geometries.add(n.geometry.uuid);}if(n.isSprite){sprites++;calls++;triangles+=2;}if(n.isLight)lights++;});return {calls,triangles,sprites,lights,geometries:geometries.size};};
  window.starQA={T,renderer,scene,camera,ambient,sun,ground,objects,festival,maze,trail,stats};
  return objects.map(stats);
 });
 const photo=async(name,index,eye=[5,4.4,7],target=[0,2.4,0],night=false)=>{
  await page.evaluate(({index,eye,target,night})=>{const q=starQA;q.objects.forEach((o,i)=>o.visible=i===index);q.festival.group.removeFromParent();q.ambient.intensity=night?.13:.65;q.sun.intensity=night?.22:3.1;q.camera.position.fromArray(eye);q.camera.lookAt(...target);q.camera.updateMatrixWorld();q.renderer.render(q.scene,q.camera);},{index,eye,target,night});
  await page.screenshot({path:output+(baseline?'before-':'')+name+'.png'});
 };
 await photo('maze-star',0);await photo('sky-star',1);await photo('falling-star',2);
 if(!baseline){
  await photo('star-side',0,[7,3.8,.15]);await photo('star-back',0,[4,4.4,-7]);await photo('star-at-night',0,[5,4.4,7],[0,2.4,0],true);
  await page.evaluate(()=>{
   const q=starQA,T=q.T;q.blocker=new T.Mesh(new T.BoxGeometry(.8,4,.7),new T.MeshStandardMaterial({color:'#54636b',roughness:.9}));q.blocker.position.set(.8,2,2);q.scene.add(q.blocker);
  });
  await photo('volume-occlusion',0,[0,3.4,7]);await page.evaluate(()=>starQA.blocker.removeFromParent());
 }
 const performanceReport=await page.evaluate(async()=>{
  const q=starQA,T=q.T;q.objects.forEach(o=>o.visible=false);q.scene.add(q.festival.group);q.ambient.intensity=.65;q.sun.intensity=3.1;
  for(let i=1;i<13;i++)q.festival.spawn(i,new T.Vector3(),[]);
  const stars=[...q.festival.stars.values()].map(s=>s.group);stars.forEach((g,i)=>{g.position.set((i%5-2)*3,1.9,-Math.floor(i/5)*3);g.scale.setScalar(.72);});
  q.camera.position.set(10,11,18);q.camera.lookAt(0,1,-3);q.camera.updateMatrixWorld();const gl=q.renderer.getContext(),times=[];
  for(let frame=0;frame<76;frame++){
   await new Promise(requestAnimationFrame);stars.forEach((g,i)=>g.rotation.set(.12,frame*.015+i*.3,.1));
   const start=performance.now();q.renderer.render(q.scene,q.camera);gl.finish();if(frame>=20)times.push(performance.now()-start);
  }
  times.sort((a,b)=>a-b);return {stars:stars.length,calls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles,medianMs:times[Math.floor(times.length*.5)],p90Ms:times[Math.floor(times.length*.9)],geometries:q.renderer.info.memory.geometries,programs:q.renderer.info.programs.length};
 });
 await page.screenshot({path:output+(baseline?'before-':'')+'starfall-peak.png'});
 if(!baseline){assert.equal(setup[0].sprites,0);assert.equal(setup[1].sprites,0);assert.equal(setup[2].sprites,0);assert(setup.every(s=>s.lights===0&&s.triangles<4000));assert(performanceReport.calls<=28,'13 smooth stars use two draws each');}
 let game;
 if(!baseline&&process.env.STARS_GAME_QA==='1'){
  await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
  for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
  await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.starsGame={THREE,maze,skyTrail,festivalView,renderer,camera,scene,followCamera,get c(){return character},set day(v){dayStart=Date.now();dayStartPhase=v}};'});});
  await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
  await page.click('#new-game');await page.fill('#player-name-input','Звёздочка');await page.click('#start-game');await page.waitForFunction(()=>window.starsGame?.c);
  await page.evaluate(()=>{const q=starsGame;q.day=.3;q.photo=q.camera.clone();q.render=q.renderer.render;q.forcedStar=q.maze.star;q.renderer.render=function(scene,camera){if(scene===q.scene&&q.forcedStar)q.forcedStar.rotation.y=.25;return q.render.call(this,scene,scene===q.scene?q.photo:camera);};});
  await page.addStyleTag({content:'body > :not(#game){visibility:hidden!important}'});
  const gamePhoto=async(name,eye,target)=>{
   await page.evaluate(({eye,target})=>{const q=starsGame;q.photo.position.fromArray(eye);q.photo.lookAt(...target);q.photo.updateMatrixWorld();},{eye,target});await page.waitForTimeout(400);await page.screenshot({path:output+name+'.png'});
  };
  const maze=await page.evaluate(()=>{const q=starsGame,T=q.THREE,p=q.maze.rewardPosition.clone().add(q.maze.group.position);q.c.actor.position.copy(p).add(new T.Vector3(-2,0,2));q.c.yaw=Math.PI;q.c.actor.rotation.y=Math.PI;q.maze.clock=0;return p.toArray();});
  await gamePhoto('maze-in-game',[maze[0]+3.2,4.7,maze[2]+3.2],[maze[0],2.15,maze[2]]);
  await page.evaluate(()=>{starsGame.day=.76;});await gamePhoto('maze-in-game-night',[maze[0]+3.2,4.7,maze[2]+3.2],[maze[0],2.15,maze[2]]);
  await page.evaluate(()=>{const q=starsGame;q.day=.3;q.c.actor.position.copy(q.maze.rewardPosition).add(q.maze.group.position);});
  await page.waitForFunction(()=>starsGame.c.achievements.has('star')&&starsGame.c.starCooldown>100);
  const mazePickup=await page.evaluate(()=>{const q=starsGame,picked=!q.maze.star.visible&&q.c.starRemaining>0;q.c.actor.position.z+=4;q.maze.update(121,q.c,false);return picked&&q.maze.star.visible;});assert(mazePickup);
  const sky=await page.evaluate(()=>{const q=starsGame;q.forcedStar=q.skyTrail.star;q.c.actor.position.set(0,0,0);q.c.achievements.delete('skyStar');return q.skyTrail.star.getWorldPosition(new q.THREE.Vector3()).toArray();});
  await gamePhoto('sky-in-game',[sky[0]+4,sky[1]+2.5,sky[2]+6],sky);
  await page.evaluate(async()=>{const q=starsGame,{SKY_PLATFORMS}=await import('/src/sky-trail-layout.ts'),p=q.skyTrail.star.position;q.c.actor.position.copy(q.skyTrail.group.position).add(new q.THREE.Vector3(p.x,SKY_PLATFORMS.at(-1).y,p.z));q.c.surfaceY=q.c.actor.position.y;q.skyTrail.restorePosition(q.c);q.skyTrail.apply(q.c,q.c.actor.position.clone(),0);});
  await page.waitForFunction(()=>starsGame.c.achievements.has('skyStar')&&!starsGame.skyTrail.star.visible);
  const skyPickup=await page.evaluate(()=>starsGame.c.starRemaining>0);assert(skyPickup);
  await page.evaluate(async()=>{const q=starsGame,{createStarfall,PREPARE_MS}=await import('/src/starfall.ts');q.forcedStar=undefined;q.c.actor.position.set(0,0,0);q.c.surfaceY=0;q.c.starRemaining=0;q.maze.update(0,q.c,false);q.c.festival=createStarfall(Date.now()-PREPARE_MS-14000,'Звёздочка');});
  await page.waitForFunction(()=>starsGame.festivalView.stars.size>5);
  await gamePhoto('starfall-in-game',[24,17,32],[0,3,0]);
  const starfall=await page.evaluate(()=>{
   const q=starsGame,stars=[...q.festivalView.stars.entries()].filter(([,s])=>s.group.visible),g=stars[0];
   let sprites=0,lights=0;for(const [,star] of stars)star.group.traverse(o=>{if(o.isSprite)sprites++;if(o.isLight)lights++;});
   q.pickIndex=g[0];q.c.actor.position.copy(g[1].group.position).setY(0);return {visible:stars.length,sprites,lights};
  });
  await page.waitForFunction(()=>starsGame.c.festival.players.solo.collected.includes(starsGame.pickIndex));assert.equal(starfall.sprites,0);assert.equal(starfall.lights,0);
  await page.evaluate(()=>{const q=starsGame;q.forcedStar=q.maze.star;q.c.festival=undefined;q.festivalView.reset();q.skyTrail.cancel();q.c.flight.reset();q.c.setActivity('Idle');q.c.starCooldown=0;q.c.starRemaining=0;q.maze.reset();q.c.actor.position.copy(q.maze.rewardPosition).add(q.maze.group.position).add(new q.THREE.Vector3(-2,0,2));q.c.surfaceY=0;});
  await page.setViewportSize({width:844,height:390});await page.evaluate(()=>{const q=starsGame;q.photo.aspect=844/390;q.photo.updateProjectionMatrix();});
  await gamePhoto('star-mobile',[maze[0]+3.2,4.7,maze[2]+3.2],[maze[0],2.15,maze[2]]);
  assert(await page.evaluate(()=>starsGame.maze.star.visible),'mobile capture contains the available star');
  game={mazePickup,skyPickup,starfall};
 }
 assert.deepEqual(errors,[]);
 let before;try{before=JSON.parse(await readFile(output+'before-checks.json','utf8')).performance;}catch{}
 const report={models:setup,performance:performanceReport,...(!baseline&&before?{before}:{}),...(game?{game}:{}),errors};
 await writeFile(output+(baseline?'before-checks':'checks')+'.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
