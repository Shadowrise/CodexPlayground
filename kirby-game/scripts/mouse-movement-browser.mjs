import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 // Expose only this isolated test page's input and motion; no debug API ships to players.
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`
window.mouseCheck={get c(){return character},camera:followCamera,get held(){return [leftMouseHeld,rightMouseHeld]}};
const mouseUpdate=CharacterController.prototype.update;
CharacterController.prototype.update=function(dt,input){if(this===character)window.mouseCheck.input={...input};return mouseUpdate.call(this,dt,input)};
`});
 });
 await page.goto(process.env.KIRBY_URL??'http://127.0.0.1:5174/');
 await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.locator('#player-name-input').fill('Мышка');await page.locator('#new-game').click();await page.locator('#start-game').click();
 await page.waitForFunction(()=>window.mouseCheck.c);
 const input=()=>page.evaluate(()=>window.mouseCheck.input);
 const locked=()=>page.waitForFunction(()=>document.pointerLockElement?.tagName==='CANVAS');
 const stopped=()=>page.waitForFunction(()=>!window.mouseCheck.input.forward);
 const reset=async()=>{
  await page.evaluate(()=>{const t=window.mouseCheck;t.c.setActivity('Idle');t.c.actor.position.set(140,0,-18);t.c.yaw=0;t.camera.reset(0);});
  await page.mouse.move(600,450);await stopped();
 };
 await reset();
 // Left alone still orbits the camera, never moving or turning Kirby.
 const yaw=await page.evaluate(()=>window.mouseCheck.c.yaw);
 const azimuth=await page.evaluate(()=>window.mouseCheck.camera.azimuth);
 await page.mouse.down({button:'left'});await page.mouse.move(680,450,{steps:5});
 await page.waitForFunction(a=>Math.abs(window.mouseCheck.camera.azimuth-a)>.05,azimuth);
 assert.equal((await input()).forward,false);assert.equal(await page.evaluate(()=>window.mouseCheck.c.yaw),yaw);
 // Add right while left is already held: move and steer without a camera gesture.
 await page.mouse.down({button:'right'});await locked();
 await page.waitForFunction(()=>window.mouseCheck.input.forward&&window.mouseCheck.c.state==='Run');
 const before=await page.evaluate(()=>({x:window.mouseCheck.c.actor.position.x,z:window.mouseCheck.c.actor.position.z,yaw:window.mouseCheck.c.yaw}));
 await page.mouse.move(730,450,{steps:5});
 await page.waitForFunction(b=>Math.abs(window.mouseCheck.c.yaw-b.yaw)>.08&&Math.hypot(window.mouseCheck.c.actor.position.x-b.x,window.mouseCheck.c.actor.position.z-b.z)>.2,before);
 await page.keyboard.down('Shift');await page.waitForFunction(()=>window.mouseCheck.input.sprint);await page.keyboard.up('Shift');
 // Releasing left stops mouse-forward while right continues to turn.
 await page.mouse.up({button:'left'});await stopped();assert(await page.evaluate(()=>!!document.pointerLockElement));
 const turned=await page.evaluate(()=>window.mouseCheck.c.yaw);await page.mouse.move(780,450,{steps:5});
 await page.waitForFunction(y=>Math.abs(window.mouseCheck.c.yaw-y)>.08,turned);assert.equal((await input()).forward,false);
 // Keyboard W remains independent when a mouse button is released.
 await page.keyboard.down('w');await page.waitForFunction(()=>window.mouseCheck.input.forward);
 await page.mouse.down({button:'left'});await page.mouse.up({button:'left'});assert.equal((await input()).forward,true);
 await page.keyboard.up('w');await stopped();await page.mouse.up({button:'right'});
 await page.waitForFunction(()=>!document.pointerLockElement);
 await reset();
 // Reverse button order, and release right first.
 await page.mouse.down({button:'right'});await locked();assert.equal((await input()).forward,false);
 await page.mouse.down({button:'left'});await page.waitForFunction(()=>window.mouseCheck.input.forward);
 await page.mouse.up({button:'right'});await stopped();await page.waitForFunction(()=>!document.pointerLockElement);
 assert.deepEqual(await page.evaluate(()=>window.mouseCheck.held),[false,false]);await page.mouse.up({button:'left'});
 // Menus and focus loss must clear the chord rather than leave autorun behind.
 for(const interrupt of ['settings','chat','blur']){
  await reset();await page.mouse.down({button:'right'});await locked();await page.mouse.down({button:'left'});
  await page.waitForFunction(()=>window.mouseCheck.input.forward);
  if(interrupt==='settings')await page.evaluate(()=>document.querySelector('#settings-toggle').click());
  else if(interrupt==='chat')await page.keyboard.press('Enter');
  else await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await stopped();await page.waitForFunction(()=>!document.pointerLockElement);
  assert.deepEqual(await page.evaluate(()=>window.mouseCheck.held),[false,false]);
  await page.mouse.up({button:'left'});await page.mouse.up({button:'right'});
  if(interrupt==='settings')await page.locator('#settings-toggle').click();
  else if(interrupt==='chat')await page.keyboard.press('Escape');
  await stopped();
 }
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({bothButtonOrders:true,moveAndTurn:true,shiftSprint:true,releaseEitherStops:true,keyboardUnchanged:true,leftCameraUnchanged:true,clearsOnSettingsChatBlur:true,errors}));
}finally{await browser.close();}
