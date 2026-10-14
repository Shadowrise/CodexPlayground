import {chromium} from '../../../node_modules/playwright/index.mjs';
import {fileURLToPath} from 'node:url';
const out=fileURLToPath(new URL('.',import.meta.url));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1600,height:1040}});
 await page.goto('http://127.0.0.1:5184/meta-knight-preview.html?revision=4&time=.4',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.__metaKnightPreview);
 await page.evaluate(()=>{const t=window.__metaKnightPreview;t.renderer.setAnimationLoop(null);t.controls.enableDamping=false;t.sample('Idle',.4);t.selectView('three');document.querySelectorAll('#stage > :not(canvas)').forEach(e=>e.style.visibility='hidden');});
 for(const factor of [1.5,2.5]) {
  await page.evaluate(factor=>{const t=window.__metaKnightPreview;t.model.traverse(o=>{if(o.isMesh&&/Galaxia.*gold/.test(o.material.name))o.material.envMapIntensity=factor;});t.renderer.render(t.scene,t.camera);},factor);
  await page.locator('#stage canvas').screenshot({path:out+`probe-env-${factor}.png`});
 }
 await page.evaluate(()=>{
  const t=window.__metaKnightPreview;
  t.model.traverse(o=>{if(!o.isMesh||o.material.name!=='Galaxia · brilliant gold face')return;
   const p=o.geometry.attributes.position,n=o.geometry.attributes.normal;
   for(let i=0;i<p.count;i++)if(Math.abs(p.getZ(i))>.03799){p.setZ(i,Math.sign(p.getZ(i))*(.038+(Math.abs(p.getZ(i))-.038)*3));const v=t.controls.target.clone().set(n.getX(i)*3,n.getY(i)*3,n.getZ(i)).normalize();n.setXYZ(i,v.x,v.y,v.z);}
   p.needsUpdate=n.needsUpdate=true;o.material.envMapIntensity=1.5;
  });t.renderer.render(t.scene,t.camera);
 });
 await page.locator('#stage canvas').screenshot({path:out+'probe-ground3-env1.5.png'});
}finally{await browser.close();}
