// Compare coplanar crown flicker on the GPU, then check the actual game's sky.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const url=process.env.GAME_URL??'http://127.0.0.1:5174/';
const out=fileURLToPath(new URL('../node_modules/.cache/forest-backdrop/',import.meta.url));
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:960,height:600}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.route('**/forest-backdrop-check',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
 await page.goto(url+'forest-backdrop-check');
 const comparison=await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js'),{createSky}=await import('/src/sky.ts'),{daylight}=await import('/src/day-cycle.ts');
  const width=960,height=600,scene=new T.Scene(),camera=new T.PerspectiveCamera(48,width/height,.75,1200),update=createSky(scene);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(width,height);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;document.body.append(renderer.domElement);
  const forest=scene.getObjectByName('Distant forest panorama'),material=forest.material;
  const original={transparent:material.transparent,depthWrite:material.depthWrite},renderOrder=forest.renderOrder;
  const gl=renderer.getContext(),pixels=new Uint8Array(width*height*4),rows=[];
  camera.position.set(0,90,0);
  for(const before of [true,false]){
   Object.assign(material,before?{transparent:false,depthWrite:true}:original);forest.renderOrder=before?0:renderOrder;material.needsUpdate=true;
   for(const angle of [0,.8,2.2]){
    let previous,delta=0,changed=0,peak=0;
    for(let frame=0;frame<24;frame++){
     const a=angle+(frame-12)*.000002;
     camera.lookAt(Math.sin(a)*800,60,Math.cos(a)*800);camera.updateMatrixWorld();update(0,camera,daylight(.25));renderer.render(scene,camera);
     gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
     if(previous)for(let i=0;i<pixels.length;i+=4){
      const d=Math.max(Math.abs(pixels[i]-previous[i]),Math.abs(pixels[i+1]-previous[i+1]),Math.abs(pixels[i+2]-previous[i+2]));
      delta+=d;if(d>3)changed++;peak=Math.max(peak,d);
     }
     previous=pixels.slice();
    }
    rows.push({before,angle,delta,changed,peak,calls:renderer.info.render.calls});
   }
  }
  Object.assign(material,original);forest.renderOrder=renderOrder;material.needsUpdate=true;
  Object.assign(window,{backdropCheck:{scene,camera,renderer,update,daylight}});
  return rows;
 });
 for(const row of comparison.filter(r=>!r.before)){
  const old=comparison.find(r=>r.before&&r.angle===row.angle);
  assert(row.changed<old.changed*.25,`crown flicker must fall at angle ${row.angle}: ${old.changed} -> ${row.changed}`);
 }
 for(const [name,phase] of [['day',.25],['sunrise',.02],['night',.75]]){
  await page.evaluate(phase=>{const t=window.backdropCheck;t.camera.lookAt(0,65,800);t.update(0,t.camera,t.daylight(phase));t.renderer.render(t.scene,t.camera);},phase);
  await page.screenshot({path:out+'/'+name+'.png'});
 }
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 await page.route('**/src/main.ts*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text())+'\nwindow.backdropGame={scene,camera,renderer,shadows,celestialLighting,updateTreeShadows,updateSky,get character(){return character}};'});});
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Горизонт');await page.locator('#start-game').click();
 await page.evaluate(()=>{const t=window.backdropGame;t.renderer.setAnimationLoop(null);document.querySelectorAll('body > :not(#game)').forEach(e=>e.style.display='none');});
 for(const [name,phase,eye,look] of [
  ['summit-day',.25,[4,92,-342],[4,82,-800]],
  ['summit-sun',.06,[4,92,-342],[800,100,400]],
  ['summit-night',.75,[4,92,-342],[4,82,-800]],
  ['meadow-day',.25,[0,7,0],[0,50,800]],
 ]){
  await page.evaluate(async({phase,eye,look})=>{
   const t=window.backdropGame,{daylight}=await import('/src/day-cycle.ts'),time=daylight(phase);
   t.camera.position.fromArray(eye);t.camera.lookAt(...look);t.camera.updateMatrixWorld();t.updateSky(0,t.camera,time);t.celestialLighting.update(time);t.updateTreeShadows(time);t.shadows.update();
   t.scene.fog.color.set(time.night>.5?'#182b4b':'#d8e9eb');t.renderer.toneMappingExposure=1+time.day*.2;t.renderer.render(t.scene,t.camera);
  },{phase,eye,look});
  await page.screenshot({path:out+'/'+name+'.png'});
 }
 assert.deepEqual(errors,[]);
 const report={comparison,errors};await writeFile(out+'/checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
