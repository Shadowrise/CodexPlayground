import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const output=fileURLToPath(new URL('../node_modules/.cache/meta-knight-planet-rings/',import.meta.url));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:950}}),errors=[],frames=[];
 page.setDefaultTimeout(180000);
 page.on('pageerror',e=>errors.push(e.stack));
 page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.ringQA={THREE,travel:cosmicArena,renderer,get c(){return character}};'});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5173/');
 await page.locator('#startup-loader').waitFor({state:'hidden'});
 console.log('Game loaded');
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Кольца планет');await page.locator('#start-game').click();
 await page.waitForFunction(()=>!!window.ringQA?.c);
 await page.evaluate(async()=>{
  const q=ringQA;await q.travel.enter(q.c);q.renderer.setAnimationLoop(null);
  q.travel.render();q.initialGlErrors=[];for(let i=0;i<8;i++){const error=q.renderer.getContext().getError();if(!error)break;q.initialGlErrors.push(error);}
  q.worlds=(await import('/src/meta-knight-cosmic-world.ts')).COSMIC_WORLDS;
  q.rings=q.travel.current.cosmicSky.planets.filter(p=>p.getObjectByName('Three opaque connected ring bands'));
  q.originals=q.rings.flatMap(p=>p.getObjectByName('Three opaque connected ring bands').children.map(r=>({r,geometry:r.geometry,map:r.material.map})));
  q.disposed=0;for(const t of new Set(q.originals.map(o=>o.map)))t.addEventListener('dispose',()=>q.disposed++);
  q.render=(index,side=1)=>{
   const T=q.THREE,planet=q.rings[index],target=planet.getWorldPosition(new T.Vector3()),camera=q.travel.camera;
   camera.position.copy(target).add(new T.Vector3(.22,.28*side,side).normalize().multiplyScalar(q.worlds.find(w=>w.name===planet.name).extent*3.2));
   camera.lookAt(target);camera.fov=44;camera.updateProjectionMatrix();camera.updateMatrixWorld();q.travel.render();return q.renderer.getContext().getError();
  };
 });
 console.log('Arena loaded');
 const metrics=await page.evaluate(()=>{
  const q=ringQA,T=q.THREE;
  return q.rings.map(planet=>{
   const rings=planet.getObjectByName('Three opaque connected ring bands').children;
   let seam=0,roughness=0;
   for(let j=0;j<rings.length;j++){
    const g=rings[j].geometry,p=g.getAttribute('position'),count=g.parameters.thetaSegments+1;
    for(let i=0;i<count;i++)roughness=Math.max(roughness,Math.abs(Math.hypot(p.getX(i),p.getY(i))-g.parameters.innerRadius));
    if(j>0){const previous=rings[j-1].geometry.getAttribute('position');for(let i=0;i<count;i++)seam=Math.max(seam,new T.Vector3().fromBufferAttribute(p,i).distanceTo(new T.Vector3().fromBufferAttribute(previous,previous.count-count+i)));}
   }
   const canvas=rings[0].material.map.image,pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,shades=new Set();let opaque=true;
   for(let i=0;i<pixels.length;i+=4){shades.add(pixels[i]);opaque&&=pixels[i+3]===255;}
   return {name:planet.name,bands:rings.length,colors:rings.map(r=>r.material.color.getHexString()),opaque:opaque&&rings.every(r=>!r.material.transparent&&r.material.opacity===1&&r.material.depthWrite),seam,roughness,shades:shades.size,drawCalls:q.renderer.info.render.calls};
  });
 });
 assert.equal(metrics.length,2);
 for(const m of metrics){assert.equal(m.bands,3);assert.equal(new Set(m.colors).size,3);assert(m.opaque);assert(m.seam<.0001);assert(m.roughness>.2&&m.roughness<.5);assert(m.shades>100);}
 for(let index=0;index<2;index++)for(const smooth of [true,false]){
  const glError=await page.evaluate(({index,smooth})=>{
   const q=ringQA,T=q.THREE;for(const o of q.originals){if(o.r.geometry!==o.geometry)o.r.geometry.dispose();const p=o.geometry.parameters;o.r.geometry=smooth?new T.RingGeometry(p.innerRadius,p.outerRadius,160,1):o.geometry;o.r.material.map=smooth?null:o.map;o.r.material.needsUpdate=true;}return q.render(index);
  },{index,smooth});
  assert.equal(glError,0,`${index}/${smooth}: clean ring render`);
  const name=`${index===0?'copper':'rose'}-${smooth?'before':'after'}.png`;await page.screenshot({path:output+name});frames.push({name,label:`${index===0?'Медная планета':'Розовая планета'} · ${smooth?'было':'стало'}`});
 }
 const back=await page.evaluate(()=>{ringQA.render(0,-1);return ringQA.renderer.getContext().getError();});assert.equal(back,0);
 await page.screenshot({path:output+'copper-back.png'});
 await page.setViewportSize({width:844,height:390});await page.evaluate(()=>{ringQA.renderer.setSize(844,390);ringQA.travel.camera.aspect=844/390;ringQA.render(1);});
 await page.screenshot({path:output+'rose-mobile.png'});
 const clone=await page.evaluate(()=>{
  const q=ringQA,copy=q.rings[0].clone(true),rings=copy.getObjectByName('Three opaque connected ring bands').children;
  for(const ring of rings)ring.material=ring.material.clone();return rings.every(r=>r.material.map?.name==='Granular concentric planetary dust');
 });assert(clone,'captured planet material clones retain the granular rings');
 const cleanup=await page.evaluate(()=>{const q=ringQA,glError=q.renderer.getContext().getError();q.travel.leave();return {glError,disposed:q.disposed};});
 assert.equal(cleanup.glError,0);assert.equal(cleanup.disposed,2);assert.deepEqual(errors,[]);
 const sheet=await browser.newPage({viewport:{width:1440,height:1100}}),images=await Promise.all(frames.map(async f=>({...f,src:`data:image/png;base64,${(await readFile(output+f.name)).toString('base64')}`})));
 await sheet.setContent(`<style>body{margin:0;padding:20px;background:#080d20;color:#e8edff;font:18px system-ui}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}figure{margin:0}img{width:100%}figcaption{padding:6px}</style><div class="grid">${images.map(f=>`<figure><img src="${f.src}"><figcaption>${f.label}</figcaption></figure>`).join('')}</div>`);
 await sheet.screenshot({path:output+'comparison.png',fullPage:true});
 const initialGlErrors=await page.evaluate(()=>ringQA.initialGlErrors);
 await writeFile(output+'report.json',JSON.stringify({metrics,clone,cleanup,initialGlErrors,errors},null,2));
 console.log(JSON.stringify({output,metrics,clone,cleanup,initialGlErrors,errors}));
}finally{await browser.close();}
