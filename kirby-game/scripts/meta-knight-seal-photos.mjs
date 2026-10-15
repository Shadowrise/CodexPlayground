import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const url=process.env.GAME_URL??'http://127.0.0.1:5184/';
const output=resolve(process.env.SEAL_PHOTO_OUTPUT??fileURLToPath(new URL('../node_modules/.cache/meta-knight-seal-photos/',import.meta.url)));
const only=process.argv.find(argument=>argument.startsWith('--only='))?.slice(7);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={source:'Screenshots of the actual game, with a test-only camera, hidden HUD, captions and location markers.',photos:[],errors:[]};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 await context.addInitScript(()=>{try{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');}catch{}});
 await context.route('http://127.0.0.1:8787/**',route=>route.fulfill({json:{count:0,occupiedVariants:[],capacity:19,ok:true}}));
 await context.route('**/src/main.ts*',async route=>{
  const response=await route.fetch(),source=await response.text();
  const cameraBlock=/camera\.position\.set\(\s*cameraTarget\.x[\s\S]*?camera\.updateMatrixWorld\(\);/;
  assert(cameraBlock.test(source),'the photo route must locate the real follow-camera block');
  const dayPhase=/const currentDayPhase\s*=\s*\(\)\s*=>[^;]+;/;assert(dayPhase.test(source),'the photo route must hold daylight constant');
  const instrumented=source.replace(cameraBlock,block=>`if(!window.sealPhotoTest?.cameraOverride){${block}}else{camera.updateMatrixWorld();}`).replace(dayPhase,'const currentDayPhase=()=>.25;');
  assert.notEqual(instrumented,source);
  await route.fulfill({response,body:instrumented+`
   window.sealPhotoTest={cameraOverride:true,seals,sites:META_KNIGHT_SEAL_SITES,camera,renderer,scene,treehouse,
    async metadata(){const layout=await import('/src/mountain-ledges-layout.ts');const maze=await import('/src/maze-layout.ts');const tree=await import('/src/treehouse.ts');const bread=layout.mountainWorld(layout.MOUNTAIN_SUMMIT.tangent,layout.MOUNTAIN_SUMMIT.radial);return {sites:META_KNIGHT_SEAL_SITES,maze:maze.MAZE_SITE,tree:tree.TREEHOUSE_SITE.toArray(),peak:layout.MOUNTAIN_PEAK,bread:{...bread,y:layout.MOUNTAIN_SUMMIT.y},steps:layout.MOUNTAIN_STEPS};},
    frame(position,target,fov=55){camera.position.fromArray(position);camera.lookAt(...target);camera.fov=fov;camera.updateProjectionMatrix();camera.updateMatrixWorld();},
    project(id){const site=META_KNIGHT_SEAL_SITES.find(site=>site.id===id),p=new THREE.Vector3(site.x,site.y,site.z).project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2,z:p.z};},
    projectPoint(point){const p=new THREE.Vector3(...point).project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2,z:p.z};},
    inspect(id){const index=META_KNIGHT_SEAL_SITES.findIndex(site=>site.id===id),seal=seals[index];return {active:seal.active,visible:seal.group.visible,position:seal.group.position.toArray(),camera:camera.position.toArray(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};}
   };
  `});
 });
 const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});await page.waitForFunction(()=>window.sealPhotoTest&&!document.querySelector('#start-game')?.disabled,null,{timeout:120000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Обзор печатей');await page.locator('#start-game').click();await page.locator('#startup-menu').waitFor({state:'hidden'});
 const metadata=await page.evaluate(()=>sealPhotoTest.metadata());assert.deepEqual(metadata.sites.map(site=>site.id),['maze','mountain','treehouse'],'photograph the final three locations');
 await page.addStyleTag({content:'.hud-corner,#settings-toggle,#fps-counter,#meadow-chat,#navigation-hud,#combat-message,.touch-root{visibility:hidden!important}.seal-photo-caption{position:fixed;left:24px;bottom:24px;z-index:9999;color:#fff7e5;background:#19271fe8;border:1px solid #c4b784;border-radius:12px;padding:13px 17px;font:600 19px/1.35 system-ui;max-width:760px;box-shadow:0 3px 12px #0005;pointer-events:none}.seal-photo-caption small{display:block;color:#e0d8bf;font-size:14px;font-weight:400;margin-top:3px}.seal-photo-marker{position:fixed;z-index:9998;transform:translate(-50%,-100%);padding:5px 9px;border:1px solid #f2da92;border-radius:8px;background:#302841ec;color:#fff3b8;font:600 15px system-ui;pointer-events:none}.seal-photo-marker:after{content:"";position:absolute;left:50%;top:100%;height:17px;border-left:2px solid #f2da92}'});
 await page.evaluate(()=>{const caption=document.createElement('div');caption.className='seal-photo-caption';caption.id='seal-photo-caption';document.body.append(caption);for(const id of ['seal-photo-marker','seal-photo-landmark']){const marker=document.createElement('div');marker.className='seal-photo-marker';marker.id=id;marker.textContent='Печать ↓';marker.hidden=true;document.body.append(marker);}});
 const shots=makeShots(metadata);
 for(const shot of shots){
  if(only&&shot.location!==only)continue;
  await page.evaluate(shot=>{sealPhotoTest.frame(shot.position,shot.target,shot.fov);const caption=document.querySelector('#seal-photo-caption');caption.textContent=shot.title;const detail=document.createElement('small');detail.textContent=shot.detail;caption.append(detail);document.querySelector('#seal-photo-marker').hidden=!shot.marker;document.querySelector('#seal-photo-landmark').hidden=!shot.landmark;},shot);
  await page.waitForTimeout(600);
  const projected=await page.evaluate(id=>sealPhotoTest.project(id),shot.id);assert(projected.z>=-1&&projected.z<=1&&projected.x>0&&projected.x<1440&&projected.y>0&&projected.y<1000,`${shot.name}: the seal must be in the camera frame`);
  await page.evaluate(point=>{const marker=document.querySelector('#seal-photo-marker');marker.style.left=point.x+'px';marker.style.top=(point.y-19)+'px';},projected);
  if(shot.landmark)await page.evaluate(landmark=>{const point=sealPhotoTest.projectPoint(landmark.position),marker=document.querySelector('#seal-photo-landmark');marker.textContent=landmark.text;marker.style.left=point.x+'px';marker.style.top=(point.y-19)+'px';},shot.landmark);
  const observed=await page.evaluate(id=>sealPhotoTest.inspect(id),shot.id);assert(observed.active&&observed.visible,`${shot.name}: the real seal must be rendered`);
  const path=resolve(output,shot.name+'.png');await page.screenshot({path});report.photos.push({...shot,path,projected,observed});
 }
 if(process.argv.includes('--bank-check')){
  await page.evaluate(()=>{sealPhotoTest.frame([252,14,-136],[238,1,-154],55);document.querySelector('#seal-photo-marker').hidden=true;document.querySelector('#seal-photo-landmark').hidden=true;document.querySelector('#seal-photo-caption').textContent='Проверка восстановления берега · прежнее место грота';});await page.waitForTimeout(600);
  report.restoredBank={path:resolve(output,'qa-restored-bank.png')};await page.screenshot({path:report.restoredBank.path});
 }
 assert.deepEqual(report.errors,[]);assert.equal(report.photos.length,only?3:9);await writeFile(resolve(output,only?`report-${only}.json`:'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,photos:report.photos.map(({name,path})=>({name,path})),errors:report.errors}));await context.close();
}finally{await browser.close();}

function makeShots(metadata){
 const byId=Object.fromEntries(metadata.sites.map(site=>[site.id,site]));
 const shot=(id,location,angle,position,target,title,detail,marker=false,fov=55)=>({id,location,name:`${location}-${angle}`,position,target,title,detail,marker,fov});
 const close=(id,location,title,detail)=>{const s=byId[id];return shot(id,location,'close',[s.x+Math.sin(s.yaw)*3.4,s.y+.55,s.z+Math.cos(s.yaw)*3.4],[s.x,s.y,s.z],title,detail,false,52);};
 const maze=byId.maze,tree=byId.treehouse,peak=byId.mountain,bread=metadata.bread,cx=(peak.x+bread.x)/2,cy=(peak.surfaceY+bread.y)/2,cz=(peak.z+bread.z)/2;
 // The final treehouse and peak poses are checked against their real scene captures.
 return [
  shot('maze','maze','wide',[metadata.maze.x-8,65,metadata.maze.z+84],[metadata.maze.x,0,metadata.maze.z+4],'Лабиринт · общий вид','Вход — под вывеской с южной стороны. Печать отмечена над тупиком.',true,57),
  shot('maze','maze','approach',[maze.x-5.8,5,maze.z-2.5],[maze.x,1.7,maze.z],'Лабиринт · подход к тупику','Ищите фиолетовую печать внутри лабиринта.',false,55),
  close('maze','maze','Лабиринт · печать вблизи','Серебряная маска и сиреневый туман в настоящем игровом окружении.'),
  shot('treehouse','treehouse','wide',[metadata.tree[0]+29,30,metadata.tree[2]+45],[metadata.tree[0],12,metadata.tree[2]+2],'Домик на дереве · общий вид','Поднимитесь по лестнице. Печать — на балконе, у прыжка в листья.',true,55),
  shot('treehouse','treehouse','approach',[tree.x-12,tree.surfaceY+6,tree.z+16],[tree.x-1,tree.surfaceY+1,tree.z-2],'Домик на дереве · балкон','Подход к печати с деревянной площадки.',true,55),
  close('treehouse','treehouse','Домик на дереве · печать вблизи','Печать находится у края балкона перед прыжком в листья.'),
  {...shot('mountain','peak','wide',[cx-78,cy+35,cz-84],[cx,cy,cz],'Гора · путь к настоящей вершине','От площадки с хлебом продолжайте подниматься по новым ступеням.',true,58),landmark:{text:'Площадка с хлебом ↓',position:[bread.x,bread.y+1,bread.z]}},
  shot('mountain','peak','approach',[peak.x-16,peak.surfaceY+7,peak.z-18],[peak.x,peak.surfaceY-2,peak.z],'Гора · последние ступени','Выше хлеба, на верхней площадке с безопасным краем.',true,55),
  close('mountain','peak','Гора · печать на вершине','Высшая точка маршрута над площадкой с хлебом.'),
 ];
}
