import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const url=process.env.GAME_URL??'http://127.0.0.1:5182/',out=new URL('../node_modules/.cache/scenery-visibility/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.distanceView={THREE,scene,camera,renderer,shadows,preparedShadows,sceneryVisibility,celestialLighting,updateTreeShadows,updateSky,get c(){return character}};'});});
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.click('#new-game');await page.fill('#player-name-input','FPS');await page.click('#start-game');await page.waitForFunction(()=>window.distanceView?.c,null,{timeout:180000});
 await page.evaluate(()=>{distanceView.renderer.setAnimationLoop(null);document.querySelectorAll('body > :not(#game)').forEach(el=>el.style.display='none');});
 const rows=[];
 for(const [name,eye,look,phase] of [['meadow',[8,9,22],[0,0,0],.28],['oak',[156,18,78],[135,6,39],.28],['autumn',[-155,4.8,177],[-155,3,133],.28],['sky',[55,65,-25],[50,20,-60],.28],['oak-night',[156,18,78],[135,6,39],.75]]){
  const row=await page.evaluate(async({eye,look,phase})=>{
   const q=distanceView,{daylight}=await import('/src/day-cycle.ts'),light=daylight(phase);
   q.camera.position.fromArray(eye);q.camera.lookAt(...look);q.camera.updateMatrixWorld();q.celestialLighting.update(light);q.updateTreeShadows(light);q.updateSky(0,q.camera,light);q.shadows.update();q.renderer.toneMappingExposure=1+light.day*.2;
   q.scene.fog.color.set('#d8e9eb').lerp(new q.THREE.Color('#182b4b'),light.night).lerp(new q.THREE.Color('#ffc392'),light.twilight*.7);
   q.scene.background.set('#b3d9ef').lerp(new q.THREE.Color('#0b1428'),light.night).lerp(new q.THREE.Color('#dd8b9b'),light.twilight*.65);
   const gl=q.renderer.getContext(),select=document.querySelector('#view-distance'),startupGlError=gl.getError();
   const showScenery=()=>q.sceneryVisibility.cells.forEach(({object})=>object.visible=true);
   const prepare=(distance,optimized=true)=>{
    select.value=String(distance);select.dispatchEvent(new Event('change'));q.preparedShadows.update(light,q.camera.position);
    if(optimized)q.sceneryVisibility.update(q.camera,distance);
    else{
     showScenery();for(const {mesh} of q.preparedShadows.cullCells){
      if(mesh.name==='Prepared scenery cell')mesh.visible=true;
      else{const {center,radius}=mesh.boundingSphere;mesh.visible=Math.hypot(q.camera.position.x-center.x,q.camera.position.z-center.z)<52+radius;}
     }
    }
   };
   const sample=async(distance,optimized=true)=>{
    prepare(distance,optimized);const times=[];let info;
    for(let i=0;i<32;i++){await new Promise(requestAnimationFrame);const at=performance.now();q.renderer.render(q.scene,q.camera);gl.finish();if(i>=12)times.push(performance.now()-at);info={calls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles};}
    times.sort((a,b)=>a-b);return {medianMs:times[10],p90Ms:times[18],...info};
   };
   // Paired controls expose GPU clock/thermal drift. This is render time with
   // GPU completion, not end-to-end gameplay FPS.
   const before=await sample(750,false),medium=await sample(360),near=await sample(240),far=await sample(750),control=await sample(750,false);
   const stable=Math.abs(before.medianMs-control.medianMs)/Math.max(before.medianMs,control.medianMs)<=.15;
   // At identical fog/range, culling may alter a few already-fogged skyline
   // edges, but must preserve the local picture (under 0.1% of channels).
   prepare(360,false);for(let i=0;i<3;i++)q.renderer.render(q.scene,q.camera);
   const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,a=new Uint8Array(width*height*4),b=new Uint8Array(a.length);
   gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,a);
   prepare(360);for(let i=0;i<3;i++)q.renderer.render(q.scene,q.camera);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,b);
   let changed=0,maxDelta=0;for(let i=0;i<a.length;i++){const delta=Math.abs(a[i]-b[i]);if(delta>1)changed++;maxDelta=Math.max(maxDelta,delta);}
   return {before,medium,near,far,control,stable,cullingPixels:{changedChannelsOverOne:changed,maxDelta,totalChannels:a.length},startupGlError,glError:gl.getError()};
  },{eye,look,phase});rows.push({name,...row});console.log(JSON.stringify({name,...row}));
  assert.equal(row.glError,0);assert(row.cullingPixels.changedChannelsOverOne/row.cullingPixels.totalChannels<.001,'culling must preserve the local picture');
  await page.screenshot({path:new URL(name+'.png',out).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 }
 await page.evaluate(()=>{document.querySelectorAll('body > :not(#game)').forEach(el=>el.style.display='');document.querySelector('#settings-toggle').click();});
 await page.setViewportSize({width:390,height:844});
 await page.locator('#view-distance').selectOption('240');
 const settings=await page.evaluate(()=>({saved:localStorage.getItem('kirby-view-distance-v1'),fog:distanceView.scene.fog.far,options:[...document.querySelector('#view-distance').options].map(o=>o.text),fits:document.querySelector('#view-distance').getBoundingClientRect().right<=innerWidth}));
 assert.equal(settings.saved,'240');assert.equal(settings.fog,240);assert(settings.fits);
 await page.screenshot({path:new URL('settings-mobile.png',out).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 assert.deepEqual(errors,[]);await writeFile(new URL('report.json',out),JSON.stringify({method:'1280x800, pixel ratio 1.25, same frozen scene; medians of 20 render+gl.finish samples after 12 warmups. Before/control: original 750m fog and visibility. Paired baseline drift over 15% is flagged unstable. No shadows disabled.',rows,settings,errors},null,2));
}finally{await browser.close();}
