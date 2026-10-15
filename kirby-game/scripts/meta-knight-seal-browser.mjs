import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const url=process.env.KIRBY_URL??'http://127.0.0.1:5184/meta-knight-seal-preview.html';
const output=resolve(process.env.META_KNIGHT_SEAL_OUTPUT??fileURLToPath(new URL('../node_modules/.cache/meta-knight-seal/',import.meta.url)));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[],report={url,measures:{},errors};
async function prepare(page){
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 // The diagnostic is attached only to the development response, never the source.
 await page.route('**/src/meta-knight-seal-preview.ts*',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`
window.sealCheck={renderer,scene,camera,controls,seals,renderFrame,get elapsed(){return elapsed},get count(){return count},get paused(){return paused},get spinning(){return spinning}};
`});
 });
 await page.goto(url);await page.locator('#seal-loading').waitFor({state:'hidden',timeout:120000});
 await page.waitForFunction(()=>window.sealCheck&&document.querySelector('#seal-calls').textContent!=='—');
}
async function measure(page,count,mist,model=true){
 await page.locator(`[data-count="${count}"]`).click();await page.locator('#seal-mist').setChecked(mist);await page.locator('#seal-model').setChecked(model);
 return page.evaluate(()=>{
  const q=sealCheck;q.renderFrame();const info=q.renderer.info;
  const solids=q.seals.map(seal=>seal.model.children.filter(child=>child.isMesh));
  return {calls:info.render.calls,triangles:info.render.triangles,geometries:info.memory.geometries,pixelRatio:q.renderer.getPixelRatio(),active:q.seals.filter(seal=>seal.group.visible).length,shared:solids[0].length===3&&solids.slice(1).every(meshes=>meshes.every((mesh,index)=>mesh.geometry===solids[0][index].geometry&&mesh.material===solids[0][index].material)),lights:q.scene.children.filter(object=>object.isLight).length};
 });
}
async function capture(page,name){await page.screenshot({path:resolve(output,name+'.png'),animations:'disabled'});}
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});await prepare(page);
 await page.locator('#seal-pause').click();assert.equal(await page.locator('#seal-pause').getAttribute('aria-pressed'),'true');
 const frozen=await page.evaluate(()=>sealCheck.elapsed);await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>sealCheck.elapsed),frozen);
 for(const view of ['three','front','side','back']){
  await page.locator(`[data-view="${view}"]`).click();await page.waitForTimeout(120);await capture(page,`seal-${view}`);
 }
 for(const count of [1,3])for(const mist of [false,true])report.measures[`${count}-${mist?'mist':'solid'}`]=await measure(page,count,mist);
 const one=report.measures['1-solid'],three=report.measures['3-solid'],oneMist=report.measures['1-mist'],threeMist=report.measures['3-mist'];
 assert.equal(one.calls,3);assert(one.triangles>0&&one.triangles<=3000);assert.equal(three.calls,9);assert.equal(three.triangles,one.triangles*3);
 assert.equal(oneMist.calls,4);assert.equal(threeMist.calls,12);assert.equal(threeMist.triangles,oneMist.triangles*3);
 assert(oneMist.triangles>one.triangles);assert.equal(oneMist.geometries,threeMist.geometries,'three seals reuse uploaded geometry');
 for(const measure of Object.values(report.measures)){assert(measure.shared);assert(measure.pixelRatio<=1.5);assert.equal(measure.lights,0);}
 await page.locator('[data-view="front"]').click();await capture(page,'seal-three-instances-mist');
 await page.locator('#seal-mist').uncheck();await capture(page,'seal-three-instances-solid');
 report.measures['3-mist-only']=await measure(page,3,true,false);assert.equal(report.measures['3-mist-only'].calls,3);
 report.measures['3-hidden']=await measure(page,3,false,false);assert.equal(report.measures['3-hidden'].calls,0);assert.equal(report.measures['3-hidden'].triangles,0);
 await measure(page,1,true);await page.locator('[data-view="three"]').click();
 await page.locator('#seal-spin').click();await page.locator('#seal-pause').click();
 const rotation=await page.evaluate(()=>sealCheck.seals[0].model.rotation.y);await page.waitForTimeout(350);
 assert(Math.abs(await page.evaluate(()=>sealCheck.seals[0].model.rotation.y)-rotation)>.02,'automatic rotation runs');
 await page.locator('#seal-pause').click();await page.locator('#seal-spin').click();
 const canvas=page.locator('#seal-stage canvas'),box=await canvas.boundingBox();
 const cameraBefore=await page.evaluate(()=>sealCheck.camera.position.toArray());
 await page.mouse.move(box.x+box.width*.55,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.53,{steps:8});await page.mouse.up();await page.waitForTimeout(200);
 assert(await page.evaluate(before=>sealCheck.camera.position.toArray().some((value,index)=>Math.abs(value-before[index])>.1),cameraBefore),'orbit controls rotate the real 3D view');
 const download=await page.request.get(new URL('/models/meta-knight-seal.glb',url).href);assert(download.ok());const bytes=await download.body();assert.equal(bytes.subarray(0,4).toString(),'glTF');report.glbBytes=bytes.length;
 await page.close();
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:3}),phone=await context.newPage();await prepare(phone);
  await phone.locator('#seal-pause').click();await phone.locator('[data-view="front"]').tap();
  assert(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert(await phone.evaluate(()=>sealCheck.renderer.getPixelRatio()<=1.5));
  const stage=await phone.locator('#seal-stage').boundingBox();assert(stage.width>0&&stage.height>250);
  await capture(phone,`seal-phone-${viewport.width}`);await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
