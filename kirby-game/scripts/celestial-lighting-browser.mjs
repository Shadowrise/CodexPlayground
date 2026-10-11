import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import ts from 'typescript';

const output=process.env.TEMP+'/kirby-celestial-lighting';
const baselineRef=process.env.LIGHTING_BASELINE_REF??'9513fcf';
const baseline=ts.transpileModule(execFileSync('git',['-c','safe.directory=C:/repos/codex-playground','show',`${baselineRef}:kirby-game/src/day-cycle.ts`],{encoding:'utf8'}),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('kirby-language-v1','ru'));
 await page.route('**/src/lighting-day-before.ts',r=>r.fulfill({contentType:'application/javascript',body:baseline}));
 await page.route('**/src/main.ts*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text())+'\nwindow.lightPreview={scene,camera,renderer,shadows,celestialLighting,updateSky,get character(){return character}};'});});
 await page.goto('http://127.0.0.1:5174/');await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.locator('#player-name-input').fill('Солнышко');await page.locator('#new-game').click();await page.locator('#start-game').click();await page.waitForTimeout(500);
 await page.evaluate(async()=>{
  const t=window.lightPreview;t.renderer.setAnimationLoop(null);document.querySelectorAll('body > :not(#game)').forEach(e=>e.style.display='none');
  const T=await import('/node_modules/.vite/deps/three.js'),{daylight,CELESTIAL_ORBIT_NORMAL}=await import('/src/day-cycle.ts'),old=await import('/src/lighting-day-before.ts');
  const fill=new T.HemisphereLight('#ffffff','#779455',2.4);t.scene.add(fill);
  const white=new T.Color('#ffffff'),moon=new T.Color('#9db5e0'),warm=new T.Color('#ffad70'),grass=new T.Color('#779455'),ground=new T.Color('#293850'),sun=new T.Color('#fff1d7');
  t.setLighting=(phase,before=false)=>{
   const time=(before?old.daylight:daylight)(phase);fill.visible=before;t.celestialLighting.reflected.visible=!before;
   t.shadows.orbitNormal.fromArray(before?[-.4,0,.85]:CELESTIAL_ORBIT_NORMAL).normalize();
   if(before){
    fill.color.copy(white).lerp(moon,time.night).lerp(warm,time.twilight*.25);fill.groundColor.copy(grass).lerp(ground,time.night);fill.intensity=.7+time.day*1.7;
    for(const light of t.shadows.lights){light.color.copy(sun).lerp(moon,time.night).lerp(warm,time.twilight*.75);light.intensity=(1.35+time.day*1.85)*time.shadowStrength;}
    t.shadows.lightDirection.fromArray(time.shadowDirection);
   }else t.celestialLighting.update(time);
   t.renderer.toneMappingExposure=1+time.day*.2;t.scene.fog.color.set('#d8e9eb').lerp(new T.Color('#182b4b'),time.night).lerp(new T.Color('#ffc392'),time.twilight*.7);
   t.updateSky(0,t.camera,time);
   t.scene.getObjectByName('Sun disc').scale.setScalar(before?15/19:1);
   if(before)t.scene.getObjectByName('Drifting clouds').material.emissiveIntensity=0;
   t.shadows.update();
  };
  t.render=()=>{t.renderer.info.reset();t.renderer.render(t.scene,t.camera);};
  t.sample=async()=>{
   const values=[],gl=t.renderer.getContext();let counts;
   for(let i=0;i<24;i++){await new Promise(r=>requestAnimationFrame(r));const at=performance.now();t.render();gl.finish();if(i>=8)values.push(performance.now()-at);counts={...t.renderer.info.render};}
   values.sort((a,b)=>a-b);return {ms:values[Math.floor(values.length/2)],calls:counts.calls,triangles:counts.triangles};
  };
 });
 const views=[
  ['orchard-day',.25,[147,7,166],[135,3,144],[140,0,154]],
  ['orchard-night',.75,[147,7,166],[135,3,144],[140,0,154]],
  ['spruce-day',.25,[-112,6,-108],[-118,2,-139],[-116,0,-122]],
  ['spruce-night',.75,[-112,6,-108],[-118,2,-139],[-116,0,-122]],
 ];
 const rows=[];
 for(const [name,phase,eye,look,actor] of views){
  await page.evaluate(({eye,look,actor})=>{const t=window.lightPreview;t.character.actor.position.fromArray(actor);t.camera.position.fromArray(eye);t.camera.lookAt(...look);t.camera.updateMatrixWorld();}, {eye,look,actor});
  await page.evaluate(phase=>{const t=window.lightPreview;t.setLighting(phase,true);t.render();},phase);
  const before=await page.evaluate(()=>window.lightPreview.sample());await page.screenshot({path:output+'-'+name+'-before.png'});
  await page.evaluate(phase=>{const t=window.lightPreview;t.setLighting(phase);t.render();},phase);
  const after=await page.evaluate(()=>window.lightPreview.sample());await page.screenshot({path:output+'-'+name+'.png'});
  await page.evaluate(phase=>window.lightPreview.setLighting(phase,true),phase);const control=await page.evaluate(()=>window.lightPreview.sample());
  rows.push({name,before,after,control});
 }
 for(const [name,phase] of [['sun',.12],['moon',.62],['sunset',.48],['sunrise',.02]]){
  await page.evaluate(async phase=>{
   const t=window.lightPreview,{daylight}=await import('/src/day-cycle.ts'),d=daylight(phase).sunDirection,sign=phase<.5?1:-1;
   t.camera.position.set(0,7,0);t.camera.lookAt(d[0]*sign*120,24,d[2]*sign*120);t.camera.updateMatrixWorld();t.setLighting(phase);t.render();
  },phase);
  await page.screenshot({path:output+'-'+name+'.png'});
 }
 const maps=await page.evaluate(()=>window.lightPreview.shadows.lights.map(l=>l.shadow.mapSize.toArray()));
 const result={rows,maps,errors};await writeFile(output+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
