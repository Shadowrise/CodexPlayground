import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
const reference=process.env.PERF_REFERENCE?JSON.parse(await readFile(process.env.PERF_REFERENCE,'utf8')):undefined;
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:reference?.viewport[0]??1280,height:reference?.viewport[1]??800}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error'&&message.text().includes('THREE.WebGL'))errors.push(message.text());});
 await page.goto('http://127.0.0.1:5173/?perf=1');await page.waitForSelector('#startup-loader',{state:'hidden',timeout:120000});
 await page.click('#new-game');await page.fill('#player-name-input','Диагностика');await page.click('#start-game');
 await page.click('#settings-toggle');await page.click('#save-game');
 await page.evaluate(reference=>{const save=JSON.parse(localStorage.getItem('kirby-save-v1'));Object.assign(save.player,{x:reference?.camera.position[0]??50,z:reference?.camera.position[2]??-26,yaw:Math.PI,size:1});save.dayPhase=.25;localStorage.setItem('kirby-save-v1',JSON.stringify(save));},reference);
 await page.reload();await page.waitForSelector('#startup-loader',{state:'hidden',timeout:120000});await page.click('#load-game');
 await page.waitForFunction(()=>window.kirbyPerformance);await page.waitForTimeout(1500);
 const report=await page.evaluate(async ({mountain,reference,screenshot})=>{
  const api=window.kirbyPerformance;
  if(reference){api.camera.position.fromArray(reference.camera.position);api.camera.quaternion.fromArray(reference.camera.quaternion);}
  else{api.camera.position.set(50,8,-20);api.camera.lookAt(50,mountain?10:30,mountain?200:-60);}
  api.camera.updateMatrixWorld();
  const saved=[];api.scene.traverse(o=>saved.push([o,o.visible,o.castShadow,o.onBeforeShadow]));
  const ratio=api.renderer.getPixelRatio(),autoReset=api.renderer.info.autoReset,shadows=api.renderer.shadowMap.autoUpdate,shadowType=api.renderer.shadowMap.type;
  const report=await api.run();
  if(saved.some(([o,visible,cast,before])=>o.visible!==visible||o.castShadow!==cast||o.onBeforeShadow!==before)||ratio!==api.renderer.getPixelRatio()||autoReset!==api.renderer.info.autoReset||shadows!==api.renderer.shadowMap.autoUpdate||shadowType!==api.renderer.shadowMap.type)throw Error('Profiler failed to restore scene');
  if(screenshot)api.renderer.setAnimationLoop(null);
  return report;
 },{mountain:process.env.PERF_VIEW==='mountain',reference,screenshot:!!process.env.PERF_SCREENSHOT});
 if(process.env.PERF_SCREENSHOT)await page.screenshot({path:process.env.PERF_SCREENSHOT});
 const output=process.env.PERF_OUTPUT??process.env.TEMP+'/kirby-scene-profile.json';await writeFile(output,JSON.stringify({report,errors},null,2));
 console.log(JSON.stringify({output,before:report.before,after:report.after,rows:report.rows.filter(row=>row.name.includes('сравнение')).concat(report.rows.slice(0,6)),shadowCasters:report.shadowCasters,errors},null,2));
}finally{await browser.close();}
