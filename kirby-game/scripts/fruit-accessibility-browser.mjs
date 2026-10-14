import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[],renderErrors=[];
 page.on('console',message=>{if(message.type()==='error'&&renderErrors.length<5)renderErrors.push(message.text().slice(0,2400));});
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 await page.route('**/room',route=>route.fulfill({json:{players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/history/solo',route=>route.fulfill({json:{ok:true}}));
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch(),body=await response.text();
  assert(body.includes('renderer.setAnimationLoop('));
  await route.fulfill({response,body:body.replace('renderer.setAnimationLoop(','window.fruitFrame=(')+`
window.fruitCheck={fruits,scene,renderer,camera,npcs,THREE,fruitObstacles,get c(){return character},step(seconds){for(let i=0;i<Math.round(seconds*20);i++)window.fruitFrame(previousTime+50)}};
`});
 });
 await page.goto(process.env.KIRBY_URL??'http://127.0.0.1:5174/');
 await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Проверка фруктов');await page.locator('#start-game').click();
 await page.waitForFunction(()=>!!window.fruitCheck?.c);
 const result=await page.evaluate(()=>{
  const m=window.fruitCheck,c=m.c;
  const render=m.renderer.render.bind(m.renderer);render(m.scene,m.camera);m.renderer.render=()=>{};
  for(const npc of m.npcs){npc.update=()=>{};npc.actor.position.set(0,0,0);}
  c.resizeTo(1,true);
  const positions=m.fruits.fruits.map(f=>f.object.position.clone());
  const failures=[];
  for(const [i,p] of positions.entries()){
   c.setActivity('Idle');c.swimming=false;c.surfaceY=0;c.actor.position.copy(p).setY(0);
   m.step(.6);
   if(!m.fruits.fruits[i].eaten)failures.push({index:i,type:m.fruits.fruits[i].type,position:p.toArray(),player:c.actor.position.toArray(),state:c.state,swimming:c.swimming,visible:m.fruits.fruits[i].object.visible});
  }
  const collection={failures,remaining:m.fruits.onMap,eaten:c.fruitsEaten,hud:document.querySelector('#remaining-fruits').textContent};
  // Test rendered models separately from their glow and pickup trigger. Each
  // fruit is the last one on the map, exercising the compacted instance buffers.
  c.actor.visible=false;for(const npc of m.npcs)npc.actor.visible=false;
  m.renderer.setPixelRatio(1);m.renderer.setSize(160,160,false);m.renderer.shadowMap.autoUpdate=false;m.renderer.setScissorTest(false);
  const camera=new m.THREE.PerspectiveCamera(45,1,.1,100),target=new m.THREE.WebGLRenderTarget(160,160);
  m.renderer.setRenderTarget(target);
  const pixels=()=>{const data=new Uint8Array(160*160*4);m.renderer.readRenderTargetPixels(target,0,0,160,160,data);return data;};
  const visibility=[];
  for(const [i,p] of positions.entries()){
   const eaten=positions.map(()=>true);eaten[i]=false;m.fruits.restore(eaten,0);
   m.fruits.fruits[i].object.traverse(o=>{if(o.name==='Fruit colored mist')o.visible=false;});
   camera.position.set(p.x+3,6,p.z+4);camera.lookAt(p.x,1,p.z);camera.updateMatrixWorld();
   render(m.scene,camera);const shown=pixels();
   m.fruits.fruits[i].eaten=true;m.fruits.syncInstances();render(m.scene,camera);const hidden=pixels();
   let changed=0;for(let j=0;j<shown.length;j+=4)if(Math.max(Math.abs(shown[j]-hidden[j]),Math.abs(shown[j+1]-hidden[j+1]),Math.abs(shown[j+2]-hidden[j+2]))>8)changed++;
   visibility.push({index:i,type:m.fruits.fruits[i].type,pixels:changed,position:p.toArray()});
  }
  const gl=m.renderer.getContext();m.renderer.setRenderTarget(null);target.dispose();
  return {...collection,visibility:visibility.sort((a,b)=>a.pixels-b.pixels),glError:gl.getError(),contextLost:gl.isContextLost()};
 });
 console.log(JSON.stringify({...result,visibility:result.visibility.slice(0,3),renderErrors},null,2));
 assert.deepEqual(result.failures,[]);
 assert.equal(result.remaining,0);assert.equal(result.eaten,70);
 assert(result.visibility.every(f=>f.pixels>100),'every isolated fruit model must remain visible above the scenery');
 assert.deepEqual(errors,[]);
 console.log('PASS: all 70 fruit locations remain collectible through the real game loop and the counter reaches zero');
} finally {await browser.close();}
