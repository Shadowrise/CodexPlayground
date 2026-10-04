import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:860}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.millTest={watermill,followCamera,get character(){return character;}};'});});
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5174/');await page.waitForSelector('#startup-loader',{state:'hidden',timeout:120000});
 await page.click('#new-game');await page.fill('#player-name-input','Мельник');await page.click('#start-game');
 await page.waitForFunction(()=>window.millTest?.character);
 const move=async(x,z,yaw=Math.PI)=>{await page.evaluate(({x,z,yaw})=>{const c=window.millTest.character;c.actor.position.set(x,0,z);c.yaw=yaw;c.actor.rotation.set(0,yaw,0);window.millTest.followCamera.reset(yaw);}, {x,z,yaw});await page.waitForTimeout(120);};
 await move(49,42);await page.keyboard.press('e');await page.waitForFunction(()=>window.millTest.watermill.quest.stage==='clear');
 for(let i=0;i<3;i++){await move(42.8,32.5+i*3,0);await page.keyboard.press('q');await page.waitForFunction(i=>window.millTest.watermill.quest.branches[i]>0,i);await page.waitForTimeout(250);}
 await move(49,42);await page.keyboard.press('e');await page.waitForFunction(()=>window.millTest.watermill.quest.gate===2);await page.waitForTimeout(200);await page.keyboard.press('e');await page.waitForFunction(()=>window.millTest.watermill.quest.stage==='bags');
 await page.waitForSelector('#mill-quest-hud:not([hidden])');assert.equal(await page.locator('.mill-bag-order span').count(),3);
 await page.screenshot({path:process.env.TEMP+'/kirby-mill-quest-game.png'});
 const order=await page.evaluate(()=>window.millTest.watermill.quest.order),places=[[68,54],[53,65],[76,69]];
 const wrong=(order[0]+1)%3;await move(...places[wrong]);await page.waitForFunction(i=>window.millTest.watermill.quest.carried===i,wrong);await move(56.5,41);await page.keyboard.press('e');await page.waitForFunction(i=>window.millTest.watermill.quest.rejected===i&&window.millTest.watermill.quest.carried===-1,wrong);
 assert.equal(await page.evaluate(()=>window.millTest.watermill.quest.delivered),0);await page.waitForTimeout(1300);
 for(let n=0;n<3;n++){const i=order[n];await move(...places[i]);await page.waitForFunction(i=>window.millTest.watermill.quest.carried===i,i);await move(56.5,41);await page.keyboard.press('e');await page.waitForFunction(n=>window.millTest.watermill.quest.delivered===n+1,n);}
 await page.waitForFunction(()=>window.millTest.character.achievements.has('millQuest'));
 const result=await page.evaluate(async()=>{const {scoreOf}=await import('/src/score.ts');return {stage:window.millTest.watermill.quest.stage,points:scoreOf(window.millTest.character)};});assert(result.points>=6);
 await page.waitForTimeout(900);
 await page.screenshot({path:process.env.TEMP+'/kirby-mill-quest-finish.png'});
 await page.setViewportSize({width:844,height:390});await page.evaluate(()=>document.body.classList.add('touch-ui'));await page.screenshot({path:process.env.TEMP+'/kirby-mill-hud-mobile.png'});await page.evaluate(()=>document.body.classList.remove('touch-ui'));await page.setViewportSize({width:1280,height:860});
 const budget=await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js'),{Watermill}=await import('/src/watermill.ts');
  const scene=new T.Scene();scene.background=new T.Color('#bddce5');const m=new Watermill();scene.add(m.group);
  const q={...window.millTest.watermill.quest,stage:'bags',carried:-1,delivered:0};m.setQuest(q,Date.now());m.update(.1);
  scene.add(new T.HemisphereLight('#ffffff','#789356',2));const light=new T.DirectionalLight('#fff0d3',3);light.position.set(30,40,60);scene.add(light);
  const floor=new T.Mesh(new T.PlaneGeometry(300,300),new T.MeshStandardMaterial({color:'#63834b'}));floor.rotation.x=-Math.PI/2;floor.position.y=-.6;scene.add(floor);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1280,860);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.domElement.style.cssText='position:fixed;inset:0;z-index:99999';document.body.append(renderer.domElement);
  const camera=new T.PerspectiveCamera(43,1280/860,.1,200);camera.position.set(73,26,73);camera.lookAt(48,3,40);renderer.render(scene,camera);window.millView={scene,m,renderer,camera};return renderer.info.render;
 });
 await page.screenshot({path:process.env.TEMP+'/kirby-mill-quest-model.png'});
 await page.evaluate(()=>{const {scene,m,renderer,camera}=window.millView,c=window.millTest.character,owner=c.actor.clone(true);owner.position.set(58,0,41);owner.rotation.set(0,.2,0);scene.add(owner);m.setQuest({...m.quest,carried:1,deliveredAt:0},Date.now());m.update(.1,owner);camera.position.set(65,8,52);camera.lookAt(58,1.5,39);renderer.render(scene,camera);});
 await page.screenshot({path:process.env.TEMP+'/kirby-mill-carry.png'});
 await page.evaluate(()=>{const {m,renderer,scene,camera}=window.millView;m.setQuest({...m.quest,stage:'clear',carried:-1,branches:[0,0,0]},Date.now());m.update(.1);camera.position.set(27,12,49);camera.lookAt(43,2,35);renderer.render(scene,camera);});
 await page.screenshot({path:process.env.TEMP+'/kirby-mill-channel.png'});
 await page.evaluate(()=>{const {m,renderer,scene,camera}=window.millView;m.setQuest({...m.quest,stage:'running',runningUntil:Date.now()+60000},Date.now());m.update(.1);camera.position.set(74,29,72);camera.lookAt(49,8,36);renderer.render(scene,camera);});
 await page.screenshot({path:process.env.TEMP+'/kirby-mill-bubbles.png'});
 console.log(JSON.stringify({budget}));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({result,errors}));
}finally{await browser.close();}

