import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const output=new URL('../node_modules/.cache/mountain-woodland/',import.meta.url);
await mkdir(output,{recursive:true});
const dev=await createServer({server:{host:'127.0.0.1',port:5186,strictPort:true,hmr:false}});
await dev.listen();
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch();
  await route.fulfill({response,body:await response.text()+'\nwindow.woodlandView={scene,camera,renderer,shadows,celestialLighting,updateTreeShadows,updateSky,get c(){return character}};'});
 });
 await page.goto('http://127.0.0.1:5186/');
 await page.waitForFunction(()=>document.querySelector('#start-game')?.disabled===false,undefined,{timeout:180000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Ёлочки');await page.locator('#start-game').click();
 await page.waitForFunction(()=>!document.body.classList.contains('choosing'),undefined,{timeout:30000});
 const inventory=await page.evaluate(async()=>{
  const t=window.woodlandView;t.renderer.setAnimationLoop(null);
  document.querySelectorAll('body > :not(#game)').forEach(el=>el.style.display='none');
  t.woodland=t.scene.getObjectByName('Mountain slope woodland');
  t.crowns=t.woodland.getObjectByName('Mountain evergreen crowns');
  const trees=t.woodland.userData.treePositions;
  t.target=trees.filter(p=>p.x>255&&p.z>120&&p.z<210&&p.y<12).sort((a,b)=>a.x-b.x)[3];
  if(!t.target)throw Error('No foothill spruce found');
  const {daylight}=await import('/src/day-cycle.ts');t.daylight=daylight;
  return {trees:trees.length,cells:t.crowns.children.length,target:t.target};
 });
 const views=[];
 for(const mode of ['close','meadow','summit','night','mobile']){
  if(mode==='mobile')await page.setViewportSize({width:844,height:390});
  const view=await page.evaluate(async mode=>{
   const t=window.woodlandView,p=t.target,day=t.daylight(mode==='night'?.75:.25);
   t.celestialLighting.update(day);t.updateTreeShadows(day);
   const eye=mode==='meadow'?[p.x-28,5,p.z-16]:mode==='summit'?[p.x-12,p.y+38,p.z-18]:[p.x-4,p.y+3.2,p.z-5];
   t.camera.position.set(...eye);t.camera.lookAt(p.x,p.y+2,p.z);t.camera.updateMatrixWorld();
   t.c.actor.position.set(...eye);t.shadows.update();t.updateSky(0,t.camera,day);
   const render=()=>t.renderer.render(t.scene,t.camera);render();
   const gl=t.renderer.getContext(),times=[];
   for(let i=0;i<12;i++){await new Promise(requestAnimationFrame);const start=performance.now();render();gl.finish();if(i>=4)times.push(performance.now()-start);}
   const levels=[0,0,0];t.crowns.children.forEach(lod=>levels[lod.getCurrentLevel()]++);
   const near=t.crowns.children.find(lod=>lod.getCurrentLevel()===0);
   if(!near)throw Error('No nearby detailed spruce');
   const mesh=near.levels[0].object;
   return {mode,levels,texture:mesh.material.map.name,nearVertices:mesh.geometry.attributes.position.count,farVertices:near.levels[2].object.geometry.attributes.position.count,triangles:t.renderer.info.render.triangles,calls:t.renderer.info.render.calls,medianRenderMs:times.sort((a,b)=>a-b)[Math.floor(times.length/2)]};
  },mode);
  views.push(view);await page.screenshot({path:fileURLToPath(new URL(mode+'.png',output))});
 }
 assert.equal(inventory.trees,5676);assert.deepEqual(errors,[]);
 assert(views.every(v=>v.texture==='Detailed spruce foliage'&&v.nearVertices>v.farVertices*10));
 const report={inventory,views,errors};await writeFile(new URL('checks.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await dev.close();}
