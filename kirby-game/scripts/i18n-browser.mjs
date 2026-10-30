import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const url=process.env.GAME_URL||'http://127.0.0.1:5174/';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const context=await browser.newContext({locale:'bg-BG',viewport:{width:1280,height:850}}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/players',route=>route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{players:2}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.i18nTest={get character(){return character},watermill,scene,renderer,localLog,chat,travel:cosmicArena};'});});
 await page.addInitScript(()=>{
  localStorage.setItem('kirby-tutorial-completed-v1','1');
  window.signTexts=[];const fill=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.signTexts.push(text);return fill.call(this,text,...args);};
 });
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.waitForFunction(()=>!!window.i18nTest,null,{timeout:180000});
 // Procedural scene construction can outlast the API's five-second timeout in headless Chrome.
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await page.waitForFunction(()=>document.querySelector('#online-players')?.textContent==='2 играчи');
 assert.equal(await page.locator('html').getAttribute('lang'),'bg');
 const title=()=>page.locator('#startup-menu h2').textContent();
 assert.equal(await title(),'Кирби: Поляната на приятелите');
 assert.equal(await page.title(),'Кирби: Поляната на приятелите');
 assert.equal(await page.locator('.welcome-heading [data-language="bg"]').getAttribute('aria-checked'),'true');
 assert.equal(await page.locator('#online-players').innerText(),'2 играчи');
 assert(await page.evaluate(()=>window.signTexts.includes('НЕБЕСНА ПЪТЕКА')));
 const canvas=await page.locator('#game canvas').elementHandle();
 await page.locator('.welcome-heading [data-language="ru"]').click();assert.equal(await title(),'Кирби: Полянка друзей');
 await page.locator('.welcome-heading [data-language="en"]').click();assert.equal(await title(),'Kirby: Meadow of Friends');
 assert.equal(await page.title(),'Kirby: Meadow of Friends');
 assert.equal(await page.locator('#new-game').innerText(),'New game');
 assert.equal(await page.locator('#online-players').innerText(),'2 players');
 assert(await page.evaluate(()=>window.signTexts.includes('SKY TRAIL')));
 assert(await page.evaluate(old=>document.querySelector('#game canvas')===old,canvas));
 assert.equal(await page.evaluate(()=>localStorage.getItem('kirby-language-v1')),'en');
 await page.reload();await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.waitForFunction(()=>!!window.i18nTest,null,{timeout:180000});
 assert.equal(await page.locator('html').getAttribute('lang'),'en');
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Радуга');
 assert.equal(await page.locator('#select-title').innerText(),'Which Kirby are you?');
 await page.locator('.variant-button[aria-label="Rainbow"]').click();
 assert.equal(await page.locator('.variant-button[aria-label="Rainbow"]').getAttribute('aria-pressed'),'true');
 await page.locator('#start-game').click();await page.waitForFunction(()=>window.i18nTest.character);
 assert.equal(await page.locator('#player-name').innerText(),'Радуга');
 assert.equal(await page.locator('.npc-name').innerText(),'Other kirbies');
 assert((await page.locator('#task-list').innerText()).includes('Make friends with Topotushka'));
 await page.locator('#settings-toggle').click();assert.equal(await page.locator('#save-game').innerText(),'Save game');
 assert.equal(await page.locator('#audio-panel [data-language="en"]').getAttribute('aria-checked'),'true');
 assert.equal(await page.locator('#controls-panel [data-controls="keyboard"] .label').innerText(),'KEYBOARD AND MOUSE');
 assert((await page.locator('#music-track').innerText()).match(/[A-Za-z]/));
 await page.locator('#settings-toggle').click();await page.locator('#game canvas').click();await page.keyboard.press('Enter');
 assert.equal(await page.locator('#chat-input').getAttribute('placeholder'),'Say something kind…');
 await page.locator('#chat-input').fill('Новая игра');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.querySelector('.chat-text')?.textContent==='Новая игра');
 assert((await page.locator('.chat-messages').innerText()).includes('Радуга joined the meadow.'));
 // Use the actual wire shape: the server sends the author separately from text.
 await page.evaluate(()=>{
  const name='Радуга $& {1}',text='испёк хлебушек на мельнице — над поляной закружились мыльные пузыри!';
  window.i18nTest.localLog.push(
   {id:'i18n-mill',name,variant:0,text,chat:false},
   {id:'i18n-mill-embedded',name:'',variant:-1,text:`${name} ${text}`,chat:false},
   {id:'i18n-mail',name:'Новая игра',variant:0,text:'получил голубиную почту от Ветерка.',chat:false},
  );
 });
 const millEvent=()=>page.locator('.chat-messages [data-id="i18n-mill"]').innerText();
 const embeddedMillEvent=()=>page.locator('.chat-messages [data-id="i18n-mill-embedded"]').innerText();
 const mailEvent=()=>page.locator('.chat-messages [data-id="i18n-mail"]').innerText();
 await page.waitForFunction(()=>document.querySelector('[data-id="i18n-mill"]')?.textContent.includes('baked bread'));
 assert.equal(await millEvent(),'Радуга $& {1} baked bread at the mill — soap bubbles are dancing over the meadow!');
 assert.equal(await embeddedMillEvent(),await millEvent());
 assert.equal(await mailEvent(),'Новая игра received pigeon mail from Breezy.');
 await page.evaluate(()=>{const c=window.i18nTest.character;c.actor.position.set(49,0,42);c.yaw=Math.PI;});
 await page.waitForFunction(()=>document.querySelector('#action-hint')?.textContent.includes('start the mill adventure'));
 await page.keyboard.press('e');await page.waitForFunction(()=>window.i18nTest.watermill.quest.stage==='clear');
 assert((await page.locator('#mill-quest-hud').innerText()).includes('Go to the twigs in the stream'));
 // A live switch updates game prompts, task order and event HUD without resetting the quest.
 await page.locator('#settings-toggle').click();
 await page.locator('#audio-panel [data-language="bg"]').click();
 assert.equal(await page.locator('#save-game').innerText(),'Запази играта');
 assert.equal(await page.locator('.settings-language > span').innerText(),'Език');
 assert.equal(await page.locator('.welcome-heading [data-language="bg"]').getAttribute('aria-checked'),'true');
 assert.equal(await page.evaluate(()=>localStorage.getItem('kirby-language-v1')),'bg');
 await page.screenshot({path:(process.env.TEMP||'/tmp')+'/kirby-settings-language-desktop.png'});
 // Event HUDs are intentionally hidden in settings; their visible text refreshes on return.
 await page.locator('#settings-toggle').click();
 await page.waitForFunction(()=>document.querySelector('#mill-quest-hud')?.textContent.includes('Отиди до клонките'));
 assert.equal(await page.locator('#player-name').innerText(),'Радуга');
 assert.equal(await page.evaluate(()=>window.i18nTest.watermill.quest.stage),'clear');
 assert.equal(await millEvent(),'Радуга $& {1} изпече хлебче в мелницата — сапунени мехурчета се завъртяха над поляната!');
 assert.equal(await embeddedMillEvent(),await millEvent());
 assert.equal(await mailEvent(),'Новая игра получи гълъбова поща от Ветрец.');
 assert.equal(await page.locator('.chat-text').innerText(),'Новая игра');
 // Freeze the duel state: English and Bulgarian use the same boss name, so
 // locale itself must invalidate its HUD rather than only the translated name.
 await page.evaluate(async()=>{const q=window.i18nTest;await q.travel.enter(q.character);q.renderer.setAnimationLoop(null);});
 const duelText=()=>page.evaluate(()=>{const q=window.i18nTest,view=q.travel.battleView;view.update(undefined,'solo',1000,0,true,'Q',true);q.chat.render(q.localLog,false);return {hint:view.hud.querySelector('.knight-hint').textContent,label:view.hud.getAttribute('aria-label')};});
 await page.locator('#settings-toggle').click();
 for(const [language,hint,label] of [
  ['en','Start a duel: move, jump and attack','Meta Knight duel'],
  ['bg','Започни дуел: движение, скок и атака','Дуел с Meta Knight'],
  ['ru','Начни дуэль: движение, прыжок и обычная атака','Бой с Метакнайтом'],
 ]){
  await page.locator(`#audio-panel [data-language="${language}"]`).click();
  assert.deepEqual(await duelText(),{hint,label});
 }
 assert.equal(await millEvent(),'Радуга $& {1} испёк хлебушек на мельнице — над поляной закружились мыльные пузыри!');
 assert.equal(await page.locator('.chat-text').innerText(),'Новая игра');
 assert.deepEqual(errors,[]);
 await context.close();
 const fallback=await browser.newContext({locale:'fr-FR',viewport:{width:844,height:390},isMobile:true,hasTouch:true}),phone=await fallback.newPage();
 await fallback.addInitScript(()=>localStorage.setItem('kirby-tutorial-completed-v1','1'));
 phone.on('pageerror',error=>errors.push(error.message));
 await phone.route('**/players',route=>route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{players:0}}));
 await phone.goto(url);await phone.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 assert.equal(await phone.locator('html').getAttribute('lang'),'en');
 await phone.locator('.welcome-heading [data-language="bg"]').click();
 await phone.locator('#new-game').click();await phone.locator('#player-name-input').fill('Мила');await phone.locator('#start-game').click();
 await phone.waitForFunction(()=>!document.body.classList.contains('choosing')&&!document.querySelector('#startup-loader')?.checkVisibility(),null,{timeout:180000});
 assert.equal(await phone.locator('#touch-chat').innerText(),'Чат');
 await phone.locator('#touch-chat').tap();assert.equal(await phone.locator('#chat-input').getAttribute('placeholder'),'Напиши нещо мило…');
 await phone.screenshot({path:(process.env.TEMP||'/tmp')+'/kirby-i18n-mobile.png'});
 await phone.locator('#chat-composer button[type="button"]').tap();
 await phone.locator('#settings-toggle').tap();
 await phone.locator('#audio-panel [data-language="ru"]').tap();
 assert.equal(await phone.locator('.settings-language > span').innerText(),'Язык');
 assert.equal(await phone.locator('#save-game').innerText(),'Сохранить игру');
 await phone.locator('#audio-panel [data-language="ru"]').press('ArrowRight');
 assert.equal(await phone.locator('#audio-panel [data-language="en"]').getAttribute('aria-checked'),'true');
 assert.equal(await phone.locator('#save-game').innerText(),'Save game');
 assert.equal(await phone.locator('.welcome-heading [data-language="en"]').getAttribute('aria-checked'),'true');
 assert.equal(await phone.evaluate(()=>localStorage.getItem('kirby-language-v1')),'en');
 await phone.screenshot({path:(process.env.TEMP||'/tmp')+'/kirby-settings-language-mobile.png'});
 assert.deepEqual(errors,[]);
 await fallback.close();
 console.log('PASS browser language, English fallback, persistent synchronized flags, live signs/settings/duel HUD, localized mill/mail events and history, unchanged names/chat, mill interaction and mobile switching');
}finally{await browser.close();}
