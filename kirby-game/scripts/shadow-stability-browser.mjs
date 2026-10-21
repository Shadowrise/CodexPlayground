import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.env.GAME_URL??'http://127.0.0.1:5181/',out=new URL('../node_modules/.cache/shadow-stability/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:960,height:600}});await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text())){errors.push(m.text());console.error(m.text());}});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.shadowQA={T:THREE,scene,camera,renderer,shadows,celestialLighting,preparedShadows,groundShadowPass,skyTrail,home,watermill,updateTreeShadows,updateSky,get c(){return character}};'});});
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Проверка теней');await page.locator('#start-game').click({timeout:180000});await page.waitForFunction(()=>window.shadowQA?.c,null,{timeout:180000});
 const points=await page.evaluate(async()=>{
  const q=shadowQA;q.renderer.setAnimationLoop(null);q.startupGlError=q.renderer.getContext().getError();q.renderer.setPixelRatio(1);q.renderer.setSize(960,600);document.querySelectorAll('body > :not(#game)').forEach(el=>el.style.display='none');
  const {LANDMARKS}=await import('/src/landmark-sites.ts'),{SKY_PLATFORMS,SKY_TRAIL_SITE}=await import('/src/sky-trail-layout.ts');return {arch:LANDMARKS[11],first:{x:SKY_TRAIL_SITE.x+SKY_PLATFORMS[0].x,z:SKY_TRAIL_SITE.z+SKY_PLATFORMS[0].z}};
 });
 const rows=[];
 for(const [name,eye,look] of [
  ['home',[114,15,106],[135,2,135]],['oven',[55,15,45],[62.5,2,35]],
  ['arch',[points.arch.x-16,18,points.arch.z-24],[points.arch.x,2,points.arch.z]],
  ['meadow',[8,9,22],[0,0,0]],['oak',[112,28,1],[135,7,45]],
  ['sky-first',[points.first.x-7,9,points.first.z-12],[points.first.x,.5,points.first.z]],
  ['sky-all',[-10,105,-155],[43,0,-100]],['rails',[228,18,65],[222,5,30]],
 ].filter(([name])=>!process.env.SHADOW_VIEWS||process.env.SHADOW_VIEWS.split(',').includes(name))){
  const row=await page.evaluate(async({name,eye,look})=>{
   const q=shadowQA,T=q.T,{daylight,phaseAtHour}=await import('/src/day-cycle.ts'),time=daylight(phaseAtHour(9)),r=q.renderer,c=q.camera,gl=r.getContext(),width=960,height=600;
   const light=t=>{q.celestialLighting.update(t);q.updateTreeShadows(t);q.updateSky(0,c,t);q.shadows.update();q.preparedShadows.update(t,c.position);r.toneMappingExposure=1+t.day*.2;};
   const read=()=>{const pixels=new Uint8Array(width*height*4);r.setRenderTarget(q.groundShadowPass.mask);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);r.setRenderTarget(null);return pixels;};
   c.position.fromArray(eye);c.lookAt(...look);c.updateMatrixWorld();light(time);for(let i=0;i<3;i++)r.render(q.scene,c);const baseline=read(),samples=[];
   for(let y=8;y<height-8;y+=8)for(let x=8;x<width-8;x+=8){
    const at=(y*width+x)*4,value=baseline[at];if(value<20)continue;let flat=true;
    for(let dy=-4;dy<=4&&flat;dy++)for(let dx=-4;dx<=4;dx++)if(Math.abs(baseline[((y+dy)*width+x+dx)*4]-value)>1){flat=false;break;}
    if(!flat)continue;const ray=new T.Vector3((x+.5)/width*2-1,(y+.5)/height*2-1,.5).unproject(c).sub(c.position).normalize();if(ray.y>=-.05)continue;
    const world=c.position.clone().addScaledVector(ray,(.02-c.position.y)/ray.y);samples.push({world,value});
   }
   const tracked=samples.filter((_,i)=>i%Math.max(1,Math.floor(samples.length/300))===0);let maxDelta=0,jumps=0,comparisons=0;
   for(let i=0;i<24;i++){
    c.position.set(eye[0]+Math.sin(i*.7)*.025,eye[1]+Math.sin(i*.4)*.01,eye[2]+Math.cos(i*.7)*.025);c.lookAt(...look);c.updateMatrixWorld();light(['home','oven'].includes(name)?daylight(time.phase+i/36000):time);r.render(q.scene,c);const pixels=read();
    for(const s of tracked){const p=s.world.clone().project(c),x=Math.floor((p.x+1)*width/2),y=Math.floor((p.y+1)*height/2);if(x<0||x>=width||y<0||y>=height)continue;const delta=Math.abs(pixels[(y*width+x)*4]-s.value);maxDelta=Math.max(maxDelta,delta);if(delta>8)jumps++;comparisons++;}
   }
   c.position.fromArray(eye);c.lookAt(...look);c.updateMatrixWorld();light(time);r.render(q.scene,c);
   let forbidden=0;q.scene.traverse(o=>{if(o.isMesh&&o.castShadow){let character=false;for(let p=o;p;p=p.parent)if(p.userData.characterShadow)character=true;if(!character)forbidden++;}});
   return {name,samples:tracked.length,maxDelta,jumps,comparisons,forbidden,glError:gl.getError(),calls:r.info.render.calls,triangles:r.info.render.triangles};
  },{name,eye,look});
  rows.push(row);console.log(JSON.stringify(row));await page.screenshot({path:new URL(name+'-09.png',out).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 }
 assert(rows.every(r=>r.glError===0&&r.forbidden===0));assert(rows.filter(r=>['home','oven','arch','oak','sky-first','sky-all'].includes(r.name)).every(r=>r.samples>5));
 assert(rows.every(r=>r.comparisons===0||r.jumps/r.comparisons<.005),'stable ground points must not flash when the camera moves');
 assert.deepEqual(errors,[]);await writeFile(new URL('report.json',out),JSON.stringify({rows,errors},null,2));
}finally{await browser.close();}
