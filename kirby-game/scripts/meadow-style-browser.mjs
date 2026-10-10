import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const stage=process.env.STYLE_STAGE??'after',mobile=process.env.STYLE_MOBILE==='1',output=process.env.TEMP+'/kirby-meadow-'+stage+(mobile?'-mobile':''),baseline=process.env.STYLE_BASELINE;
const compare=process.env.STYLE_COMPARE==='1';
const water=process.env.STYLE_WATER==='1';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage(mobile?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('kirby-language-v1','ru'));
 if(baseline)await page.route('**/src/ground-style-before.ts',async route=>route.fulfill({contentType:'application/javascript',body:await readFile(baseline,'utf8')}));
 if(compare)for(const [module,file] of [['ground-style-before','ground-texture'],['decor-style-before','meadow-decor']]){
  const source=execFileSync('git',['-c','safe.directory=C:/repos/codex-playground','show',`HEAD:kirby-game/src/${file}.ts`],{encoding:'utf8'});
  const current=await (await page.request.get((process.env.GAME_URL??'http://127.0.0.1:5174')+`/src/${file}.ts`)).text();
  const imports=[...current.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>m[1]);
  const body=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from\s+(['"])([^'"]+)\1/g,(_,q,spec)=>{
   const key=spec.startsWith('./')?'/src/'+spec.slice(2)+'.ts':spec==='three'?'/three.js':spec.split('/').at(-1).replace('.js','__js');
   const url=imports.find(p=>p.includes(key));if(!url)throw Error('Unmapped baseline import '+spec);return 'from '+JSON.stringify(url);
  });
  await page.route(`**/src/${module}.ts`,route=>route.fulfill({contentType:'application/javascript',body}));
 }
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.meadowStyle={scene,camera,renderer,shadows,get c(){return character},set day(v){dayStart=Date.now();dayStartPhase=v}};'});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5174/');await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 if(stage==='before')await writeFile(output+'-ground.js',await (await page.request.get((process.env.GAME_URL??'http://127.0.0.1:5174')+'/src/ground-texture.ts')).text());
 await page.locator('#player-name-input').fill('Полянка');await page.locator('#new-game').click();await page.locator('#start-game').click();
 await page.evaluate(water=>{window.meadowStyle.day=water?.12:.25;},water);await page.waitForTimeout(250);
 await page.evaluate(()=>{const t=window.meadowStyle;t.renderer.setAnimationLoop(null);document.querySelectorAll('body > :not(#game)').forEach(e=>e.style.display='none');});
 const placement=await page.evaluate(()=>{
  const scene=window.meadowStyle.scene,layout=scene.getObjectByName('Four woodland biomes').userData.meadowLayout;
  const sites=scene.getObjectByName('Ponds, flowers, mushrooms, rocks, picnics and ruins').userData.scenerySites??[];
  const plants=scene.getObjectByName('Biome meadow details').userData.sites;
  const blocked=[...sites,...plants].filter(p=>!layout.clearOfTrails(p.x,p.z,p.radius));
  if(blocked.length)throw Error('Decoration on a path: '+JSON.stringify(blocked.slice(0,3)));
  return {landmarkDecor:sites.length,moved:sites.filter(p=>p.moved).length,plants:plants.length,blocked:blocked.length};
 });
 if(water)await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js'),{prepareSurfaceTextures}=await import('/src/texture-filtering.ts'),t=window.meadowStyle,data=new Uint8Array(128*128*4);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
   const wave=Math.sin(x/128*Math.PI*8+Math.sin(y/128*Math.PI*4)*2)*Math.sin(y/128*Math.PI*6+x/128*Math.PI*4),v=Math.max(0,wave-.45)*50;
   data.set([44+v,148+v,174+v,255],(y*128+x)*4);
  }
  const texture=new T.DataTexture(data,128,128);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(.18,.18);texture.needsUpdate=true;
  t.water=t.scene.getObjectByName('Lake and river water');t.currentWater=t.water.material;texture.offset.copy(t.currentWater.map.offset);
  t.beforeWater=new T.MeshStandardMaterial({map:texture,roughness:.2,metalness:.22});prepareSurfaceTextures(t.beforeWater,t.renderer.capabilities.getMaxAnisotropy());t.shadows.setupMaterial(t.beforeWater);
 });
 if(baseline||compare)await page.evaluate(async()=>{
  const t=window.meadowStyle,{createGroundMaterial}=await import('/src/ground-style-before.ts'),{MEADOW_HALF_SIZE}=await import('/src/world-bounds.ts'),{prepareSurfaceTextures}=await import('/src/texture-filtering.ts');
  const material=createGroundMaterial(MEADOW_HALF_SIZE,t.scene.getObjectByName('Four woodland biomes').userData.meadowLayout);prepareSurfaceTextures(material,t.renderer.capabilities.getMaxAnisotropy());
  const surface=material.onBeforeCompile;t.shadows.setupMaterial(material);const shadow=material.onBeforeCompile;
  material.onBeforeCompile=(shader,renderer)=>{shadow.call(material,shader,renderer);surface.call(material,shader,renderer);};
  t.beforeGround=material;
 });
 if(compare)await page.evaluate(async()=>{
  const t=window.meadowStyle,{createMeadowDecor}=await import('/src/decor-style-before.ts');
  t.afterDecor=t.scene.getObjectByName('Biome meadow details');t.beforeDecor=createMeadowDecor(t.scene.getObjectByName('Four woodland biomes').userData.treePositions);
  const materials=new Set();t.beforeDecor.traverse(o=>{if(o.isMesh)materials.add(o.material);});
  for(const m of materials){const surface=m.onBeforeCompile;t.shadows.setupMaterial(m);const shadow=m.onBeforeCompile;m.onBeforeCompile=(s,r)=>{shadow.call(m,s,r);surface.call(m,s,r);};}
  t.beforeDecor.visible=false;t.scene.add(t.beforeDecor);
  const triangles=root=>{let count=0;root.traverse(o=>{if(o.isMesh)count+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);});return count;};
  t.decorBudget={before:triangles(t.beforeDecor),after:triangles(t.afterDecor)};
 });
 const pathViews=process.env.STYLE_PATHS==='1'?await page.evaluate(()=>{
  const layout=window.meadowStyle.scene.getObjectByName('Four woodland biomes').userData.meadowLayout;
  return [[0,150],[130,90],[-70,-100]].map(([x,z],j)=>{
   let nearest,best=Infinity;
   for(const path of layout.paths)for(let i=6;i<path.points.length-6;i++){
    const p=path.points[i],d=(p.x-x)**2+(p.z-z)**2;if(d<best){best=d;nearest={path,i,p};}
   }
   const {path,i,p}=nearest,a=path.points[i-4],b=path.points[i+4],len=Math.hypot(b.x-a.x,b.z-a.z),dx=(b.x-a.x)/len,dz=(b.z-a.z)/len;
   return ['path-'+j,p.x,p.z,[p.x+dx*12-dz*5,5,p.z+dz*12+dx*5],[p.x,0,p.z]];
  });
 }):null;
 const rows=[],views=water?[
  ['lake',46,42,[43,5,53],[27,-.42,30]],
  ['close-water',26,44,[26,2.4,44],[27,-.42,31]],
  ['river-bend',200,235,[217,5,246],[208,-.42,235]],
  ['bridge',34,50,[17,8,63],[34,-.42,47]],
 ]:pathViews??(process.env.STYLE_LAYOUT==='1'?[
  ['home',135,141,[152,13,165],[135,1.5,138]],
  ['mill',49,41.5,[75,19,80],[46,1,40]],
  ['river-bend',200,235,[217,13,250],[199,0,233]],
  ['bridge',34,50,[17,13,67],[34,1,50]],
  ['trails',0,0,[0,660,45],[0,0,0]],
 ]:[['spruce',-112,-136],['birch',115,-125],['orchard',115,145],['autumn',-155,165]]);
 for(const [name,x,z,eye,look] of views){
  const row=await page.evaluate(async({name,x,z,eye,look})=>{
   const t=window.meadowStyle;t.c.actor.position.set(x,0,z);t.camera.position.fromArray(eye??[x,4.8,z+12]);t.camera.lookAt(...(look??[x,1,z-32]));t.camera.updateMatrixWorld();t.shadows.update();
   const fog=t.scene.fog;if(name==='trails')t.scene.fog=null;else t.scene.fog=t.savedFog??fog;t.savedFog??=fog;
   const gl=t.renderer.getContext(),floor=t.beforeWater?t.water:t.scene.getObjectByName('Biome ground'),current=floor.material;
   const sample=async()=>{
    const times=[];let counts;
    for(let i=0;i<22;i++){await new Promise(resolve=>requestAnimationFrame(resolve));t.renderer.info.reset();const at=performance.now();t.renderer.render(t.scene,t.camera);gl.finish();if(i>=6)times.push(performance.now()-at);counts={...t.renderer.info.render};}
    times.sort((a,b)=>a-b);return {ms:times[Math.floor(times.length/2)],calls:counts.calls,triangles:counts.triangles};
   };
   if(!t.beforeGround&&!t.beforeWater)return {name,...await sample()};
   // Compare shaders in one frozen scene, bracketed by both old-material controls.
   const change=old=>{floor.material=old?(t.beforeWater??t.beforeGround):current;if(t.beforeDecor){t.beforeDecor.visible=old;t.afterDecor.visible=!old;}};
   change(true);const before=await sample();change(false);const after=await sample();change(true);const control=await sample();
   change(false);t.renderer.render(t.scene,t.camera);
   if(!t.beforeDecor&&(before.calls!==after.calls||before.triangles!==after.triangles))throw Error('Surface render budget changed');
   return {name,...after,before,control,decorBudget:t.decorBudget,stable:Math.abs(before.ms-control.ms)/((before.ms+control.ms)/2)<.15};
  },{name,x,z,eye,look});rows.push(row);await page.screenshot({path:output+'-'+name+'.png'});
  if(water){
   await page.evaluate(()=>{const t=window.meadowStyle;t.water.material=t.beforeWater;t.renderer.render(t.scene,t.camera);});await page.screenshot({path:output+'-'+name+'-before.png'});
   await page.evaluate(()=>{const t=window.meadowStyle;t.water.material=t.currentWater;t.renderer.render(t.scene,t.camera);});
  }
 }
 // Reuse the actual lighting update before freezing again for a night view.
 await page.reload();await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.locator('#player-name-input').fill('Полянка');await page.locator('#new-game').click();await page.locator('#start-game').click();
 await page.evaluate(()=>{window.meadowStyle.day=.75;});await page.waitForTimeout(250);
 await page.evaluate(water=>{const t=window.meadowStyle;t.renderer.setAnimationLoop(null);document.querySelectorAll('body > :not(#game)').forEach(e=>e.style.display='none');t.c.actor.position.set(...(water?[46,0,42]:[115,0,145]));t.camera.position.set(...(water?[43,5,53]:[115,4.8,157]));t.camera.lookAt(...(water?[27,-.42,30]:[115,1,113]));t.camera.updateMatrixWorld();t.shadows.update();t.renderer.render(t.scene,t.camera);},water);
 await page.screenshot({path:output+'-night.png'});
 await writeFile(output+'.json',JSON.stringify({stage,placement,rows,errors},null,2));
 console.log(JSON.stringify({output,placement,rows,errors},null,2));if(errors.length)throw Error('Scene errors');
}finally{await browser.close();}
