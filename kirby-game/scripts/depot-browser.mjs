import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const baseline=process.env.DEPOT_BASELINE==='1';
const output=fileURLToPath(new URL('../node_modules/.cache/depot/',import.meta.url));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.depotQA={THREE,coaster,benches,seats:BENCH_SEATS,treehouse,resolveInteraction,renderer,scene,camera,followCamera,ponds,get c(){return character},set day(v){dayStart=Date.now();dayStartPhase=v}};'});
 });
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5186/');
 await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.click('#new-game');await page.fill('#player-name-input','Путешественник');await page.click('#start-game');
 await page.waitForFunction(()=>window.depotQA?.c);
 await page.evaluate(()=>{
  const q=depotQA;q.day=.3;q.c.actor.position.set(0,0,214);q.c.yaw=0;q.c.actor.rotation.y=0;q.followCamera.reset(0);
  q.photoCamera=q.camera.clone();q.originalRender=q.renderer.render;
  q.renderer.render=function(scene,camera){return q.originalRender.call(this,scene,scene===q.scene?q.photoCamera:camera);};
 });
 await page.addStyleTag({content:'body > :not(#game){visibility:hidden!important}'});
 const photo=async(name,position,target)=>{
  await page.evaluate(({position,target})=>{const q=depotQA;q.photoCamera.position.fromArray(position);q.photoCamera.lookAt(...target);q.photoCamera.updateMatrixWorld();},{position,target});
  await page.waitForTimeout(500);await page.screenshot({path:output+name+'.png'});
 };
 await photo(baseline?'before':'depot-day',[28,19,193],[0,4.4,225]);
 if(!baseline){
  await photo('depot-in-game',[21,13,202],[0,4.2,225]);
  await photo('depot-front',[-3,9,207],[0,4.2,226]);
  await photo('depot-bench',[-16,5.5,215],[-7.6,1.8,222.8]);
  await photo('depot-worktable',[15,5.5,217],[7.7,1.6,223.4]);
  await photo('depot-boarding',[7,6.5,239],[0,1.5,225]);
  await page.evaluate(()=>{depotQA.day=.76;});
  await photo('depot-night',[24,13,199],[0,4.2,225]);
  await page.evaluate(()=>{depotQA.day=.3;});
  const report=await page.evaluate(async()=>{
   const q=depotQA,T=q.THREE,depot=q.coaster.group.getObjectByName('Handcrafted coaster depot');
   if(!depot)throw new Error('Missing detailed depot');
   depot.updateWorldMatrix(true,true);
   let draws=0,triangles=0,mapped=0,lights=0;const maps=new Set();
   depot.traverse(o=>{if(o.isLight)lights++;if(o.isMesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;if(o.material.map){mapped++;maps.add(o.material.map.uuid);}}});
   const bounds=new T.Box3().setFromObject(depot),{depotFloorHeight}=await import('/src/depot-floor.ts');
   const walking=[];for(let z=216;z<229;z+=.1){const previous=q.c.actor.position.clone();q.c.actor.position.set(0,previous.y,z);q.ponds.apply(q.c,previous);walking.push(Math.abs(q.c.actor.position.y-depotFloorHeight(0,z))<1e-6);}
   const ray=new T.Raycaster();
   const laneClear=[];for(const z of [219.5,222,225,227.5]){ray.set(new T.Vector3(-2.9,2.2,z),new T.Vector3(1,0,0));laneClear.push(!ray.intersectObject(depot,true).some(hit=>hit.distance<5.8));}
   q.c.actor.position.set(0,.7,224);q.coaster.carts[0].distance=0;q.coaster.carts[0].wait=5;q.coaster.carts[0].speed=0;
   const boarded=q.coaster.board(q.c);q.coaster.update(0);const rider=q.c.actor.getWorldPosition(new T.Vector3()).toArray();q.coaster.disembark();
   return {draws,triangles,mapped,maps:maps.size,lights,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},walking:walking.every(Boolean),laneClear:laneClear.every(Boolean),boarded,rider,exit:q.c.actor.position.toArray()};
  });
  assert(report.walking,'steps and platform keep their walkable heights');assert(report.laneClear,'central approach stays open');assert(report.boarded,'coaster boarding works');assert.deepEqual(report.exit,[0,0,214]);
  assert(report.draws<95,'station detail keeps a bounded draw budget');assert(report.mapped>0&&report.maps>=3,'different materials use real texture maps');assert.equal(report.lights,0,'lanterns add no shadow lights');
  const seating=[];
  for(const [index,seatKind] of [[0,'depot'],[1,'depot'],[0,'picnic'],[0,'treehouse']]){
   const initial=await page.evaluate(({index,seatKind})=>{
    const q=depotQA,T=q.THREE,seat=q.seats.filter(s=>s.kind===seatKind)[index];
    q.benches.cancel();q.treehouse.cancel();q.c.setActivity('Idle');
    if(seatKind==='treehouse'){
     q.c.actor.position.copy(q.treehouse.group.position).add(new T.Vector3(-4,0,11));q.treehouse.interact(q.c);q.treehouse.update(5.3);
    }
    q.c.actor.position.copy(seat.position);q.c.actor.position.y=seat.floor;
    q.c.actor.position.x+=Math.sin(seat.yaw)*1.7;q.c.actor.position.z+=Math.cos(seat.yaw)*1.7;q.c.yaw=seat.yaw;q.c.actor.rotation.y=seat.yaw;
    const action=q.resolveInteraction(q.c);return {prompt:action?.text,outline:action?.target?.root.name,start:q.c.actor.position.toArray(),seat:seat.position.toArray(),floor:seat.floor,yaw:seat.yaw};
   },{index,seatKind});
   assert.equal(initial.prompt,'E — сесть на лавочку');
   if(seatKind==='depot')assert.match(initial.outline,/oak waiting bench/,'depot bench outline selects the bench, not the treehouse');
   await page.keyboard.press('KeyE');await page.waitForFunction(()=>depotQA.benches.active);await page.waitForTimeout(650);
   const sat=await page.evaluate(()=>({state:depotQA.c.state,p:depotQA.c.actor.position.toArray(),yaw:depotQA.c.yaw,prompt:depotQA.resolveInteraction(depotQA.c)?.text}));
   assert.equal(sat.state,'Sitting');assert.equal(sat.prompt,'E — встать с лавочки');assert(Math.cos(sat.yaw-initial.yaw)>.999);
   assert(Math.abs(sat.p[1]-(initial.seat[1]-.18))<1e-5);
   const [x,,z]=initial.seat;
   if(seatKind==='depot')await photo('depot-sitting-'+index,[x+(index?-4:4),5,230],[x,2.1,z]);
   if(seatKind==='picnic')await photo('picnic-bench',[x+5,4.5,z-7],[x,1.7,z]);
   if(seatKind==='treehouse')await photo('lookout-bench',[x+5,23,z+8],[x,19.4,z]);
   await page.keyboard.press('KeyE');await page.waitForFunction(()=>!depotQA.benches.active);
   const stood=await page.evaluate(()=>({state:depotQA.c.state,p:depotQA.c.actor.position.toArray()}));
   assert.equal(stood.state,seatKind==='treehouse'?'Lookout':'Idle');assert(Math.abs(stood.p[1]-initial.floor)<1e-5);
   seating.push({seatKind,index,initial,sat,stood});
  }
  await page.evaluate(()=>{const q=depotQA;q.treehouse.cancel();q.c.setActivity('Idle');q.c.actor.position.set(0,0,214);});
  await page.setViewportSize({width:844,height:390});
  await page.evaluate(()=>{const q=depotQA;q.photoCamera.aspect=844/390;q.photoCamera.updateProjectionMatrix();});
  await photo('depot-mobile',[28,19,193],[0,4,225]);
  assert.deepEqual(errors,[]);await writeFile(output+'checks.json',JSON.stringify({...report,seating,errors},null,2)+'\n');console.log(JSON.stringify({...report,seating,errors}));
 }else console.log('Baseline saved: '+output+'before.png');
}finally{await browser.close();}
