import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

// Run against the dev server on 5184; the gamepad goes through the actual frame loop.
const base=process.env.GAME_URL??'http://127.0.0.1:5184',output='.cache/save-confirmation';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--force_high_performance_gpu']});
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:850}});
  const page=await context.newPage(),errors=[],nativeDialogs=[];page.setDefaultTimeout(180000);
  page.on('pageerror',error=>errors.push(error.message));page.on('dialog',async dialog=>{nativeDialogs.push(dialog.message());await dialog.dismiss();});
  for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,route=>route.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
  await page.addInitScript(()=>{
   localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');
   window.qaPad={id:'Confirmation QA',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0}))};
   Object.defineProperty(navigator,'getGamepads',{value:()=>[qaPad]});
  });
  await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.confirmationQA={get c(){return character},get playing(){return playing},saveConfirmation,fruits};'});});
  await page.goto(base);await page.locator('#startup-loader').waitFor({state:'hidden'});
  const press=selector=>mobile?page.locator(selector).tap():page.locator(selector).click();
  await press('#new-game');await page.fill('#player-name-input','Подтверждение');await press('#start-game');await page.waitForFunction(()=>window.confirmationQA?.playing&&confirmationQA.c);
  // Random spawn must not add fruit while the save assertions are running.
  await page.evaluate(()=>confirmationQA.fruits.restore(Array(70).fill(true),0));
  const dialog=page.locator('#save-confirmation'),cancel='#save-confirmation button:first-child',confirm='#save-confirmation .confirmation-primary';
  const readSave=()=>page.evaluate(()=>localStorage.getItem('kirby-save-v1'));
  const setProgress=count=>page.evaluate(count=>confirmationQA.c.fruitsEaten=count,count);
  const focus=selector=>page.waitForFunction(selector=>document.activeElement===document.querySelector(selector),selector);
  const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const neutral=async()=>{await page.evaluate(()=>{qaPad.buttons=qaPad.buttons.map(()=>({pressed:false,touched:false,value:0}));qaPad.axes=[0,0,0,0];});await settle();};
  const padButton=async index=>{await neutral();await page.evaluate(index=>qaPad.buttons[index]={pressed:true,touched:true,value:1},index);await settle();};
  const padStick=async(x,y)=>{await neutral();await page.evaluate(([x,y])=>{qaPad.axes[0]=x;qaPad.axes[1]=y;},[x,y]);await settle();};
  const show=async()=>{await press('#save-game');await dialog.waitFor({state:'visible'});await focus(cancel);};
  const closed=async()=>{await dialog.waitFor({state:'hidden'});await focus('#save-game');assert(await page.locator('#audio-panel').isVisible(),'closing the dialog keeps settings open');};
  await press('#settings-toggle');await setProgress(3);await press('#save-game');const original=await readSave();assert(original);assert.equal(JSON.parse(original).player.fruitsEaten,3);assert(await dialog.isHidden(),'first save needs no overwrite confirmation');
  await setProgress(7);await show();assert.equal(await readSave(),original,'opening the dialog never writes');
  assert(await dialog.evaluate(el=>el.matches(':modal')),'the rest of the page is inert');
  await page.keyboard.press('Tab');await focus(confirm);await page.keyboard.press('Tab');await focus(cancel);await page.keyboard.press('Shift+Tab');await focus(confirm);
  await page.keyboard.press('Escape');await closed();assert.equal(await readSave(),original);
  await show();await press(cancel);await closed();assert.equal(await readSave(),original);
  await show();await page.keyboard.press('Enter');await closed();assert.equal(await readSave(),original,'default Enter cancels');

  await page.locator('#save-game').focus();await padButton(0);await dialog.waitFor({state:'visible'});await focus(cancel);
  await settle();assert(await dialog.isVisible(),'the A press opening the dialog cannot confirm it');assert.equal(await readSave(),original);
  await neutral();await padStick(1,0);await focus(confirm);await neutral();
  assert.equal(await page.locator(confirm).evaluate(el=>getComputedStyle(el).outlineWidth),'3px');
  await page.screenshot({path:output+(mobile?'/mobile-gamepad.png':'/desktop-gamepad.png')});
  await padButton(1);await closed();assert.equal(await readSave(),original,'B cancels without closing settings');
  await padButton(0);await dialog.waitFor({state:'visible'});await padButton(9);await closed();assert.equal(await readSave(),original,'Start only dismisses the dialog');
  await padButton(0);await dialog.waitFor({state:'visible'});await focus(cancel);
  await padButton(15);await focus(confirm);await padButton(14);await focus(cancel);await padStick(0,1);await focus(confirm);await padStick(0,-1);await focus(cancel);
  await neutral();await page.keyboard.press('ArrowRight');await focus(confirm);assert.equal(await page.locator('#audio-panel .input-device select').first().inputValue(),'keyboard');
  await page.keyboard.press('Escape');await closed();assert.equal(await readSave(),original);
  await padButton(0);await dialog.waitFor({state:'visible'});await padButton(15);await focus(confirm);await padButton(0);await closed();
  const overwritten=await readSave();assert.notEqual(overwritten,original);assert.equal(JSON.parse(overwritten).player.fruitsEaten,7);
  await neutral();await setProgress(9);await show();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await closed();assert.equal(JSON.parse(await readSave()).player.fruitsEaten,9);
  await setProgress(11);await show();await press(confirm);await closed();assert.equal(JSON.parse(await readSave()).player.fruitsEaten,11);

  for(const [locale,title,label] of [['en','Overwrite saved game?','Overwrite'],['bg','Да презапишем ли играта?','Презапиши'],['ru','Перезаписать сохранение?','Перезаписать']]){
   await page.evaluate(async locale=>{const {setLocale}=await import('/src/i18n.ts');setLocale(locale);},locale);
   await show();assert.equal(await dialog.locator('h2').textContent(),title);assert.equal(await page.locator(confirm).textContent(),label);await press(cancel);await closed();
  }
  await show();const bounds=await dialog.boundingBox();assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=(mobile?390:1280)&&bounds.y+bounds.height<=(mobile?844:850));
  await page.screenshot({path:output+(mobile?'/mobile.png':'/desktop.png')});await press(cancel);await closed();
  await page.evaluate(()=>{window.qaStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='kirby-save-v1')throw new DOMException('Full','QuotaExceededError');return qaStorageSet.call(this,key,value);};});
  await show();await press(confirm);await closed();assert.match(await page.locator('#audio-panel > p[role="status"]').textContent(),/Не удалось сохранить/);
  await page.evaluate(()=>Storage.prototype.setItem=qaStorageSet);
  assert.deepEqual(nativeDialogs,[]);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({mobile,firstSave:true,cancelPreservesSave:true,overwrite:true,gamepad:true,keyboard:true,focusRestored:true,modal:true,localized:true,storageFailure:true,errors}));
  await context.close();
 }
}finally{await browser.close();}
