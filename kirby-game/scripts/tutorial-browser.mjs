import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const base=process.env.KIRBY_URL??'http://127.0.0.1:5174/';
const out=new URL('../node_modules/.cache/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const reports=[];
try{
 for(const [name,width,height,mobile] of [['desktop',1280,800,false],['portrait',390,844,true],['landscape',844,390,true],['small-landscape',640,360,true]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:mobile}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/tutorial-test',r=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><link rel="stylesheet" href="/src/touch-controls.css"><style>body{margin:0;background:linear-gradient(150deg,#6e9286,#364f54);height:100dvh}#game{position:fixed;inset:0}</style><main id="game" tabindex="-1"></main>'}));
  await page.goto(base+'tutorial-test');
  await page.evaluate(async mobile=>{
   const html=await fetch('/').then(r=>r.text()),source=new DOMParser().parseFromString(html,'text/html');
   document.body.classList.toggle('touch-ui',mobile);
   document.body.append(source.querySelector('.hud-corner').cloneNode(true),source.querySelector('#settings-toggle').cloneNode(true));
   document.querySelector('#player-name').textContent='Саша';
   const {MeadowTutorial}=await import('/src/tutorial.ts'),{TaskList}=await import('/src/tasks.ts');
   window.worldInputs=0;window.addEventListener('click',()=>window.worldInputs++);window.addEventListener('keydown',()=>window.worldInputs++);
   new TaskList(document.querySelector('#task-list'),document.querySelector('#task-count'),document.querySelector('#tasks-toggle'));
   if(mobile)document.querySelector('#tasks-toggle').click();window.worldInputs=0;
   const route=document.createElement('div');route.className='panel route-panel';route.innerHTML='<label>Куда пойдём?<select id="destination-select"><option>Выбрать место…</option></select></label>';document.querySelector('.tasks-panel').before(route);
   window.tour=new MeadowTutorial({scheme:mobile?'touch':'keyboard',storage:localStorage,adventures:document.querySelector('.tasks-panel'),route,onOpen(){},onClose(){}});window.tour.open();
  },mobile);
  await page.locator('#tutorial-heading').getByText('Привет, я Ветерок!').waitFor();
  const advance=()=>mobile?page.touchscreen.tap(4,height/2):page.mouse.click(4,height/2);
  await advance();await page.keyboard.press('e');assert.equal(await page.locator('#meadow-tutorial').getAttribute('data-step'),'interact');
  assert.equal(await page.locator('.tutorial-action b').innerText(),mobile?'Действие':'E');
  await page.evaluate(()=>{window.tour.setScheme('gamepad');});assert.equal(await page.locator('.tutorial-action b').innerText(),'Y');
  await page.evaluate(mobile=>window.tour.setScheme(mobile?'touch':'keyboard'),mobile);
  await advance();
  for(const step of ['adventures','route']){
   await page.waitForFunction(step=>document.querySelector('#meadow-tutorial').dataset.step===step&&document.querySelector('.tutorial-spotlight').offsetWidth>0,step);
   const boxes=await page.evaluate(()=>{
    const box=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};return {card:box(document.querySelector('.tutorial-card')),target:box(document.querySelector('.tutorial-spotlight'))};
   });
   const {card,target}=boxes;
   assert(card.x>=0&&card.y>=0&&card.x+card.w<=width+1&&card.y+card.h<=height+1,`${name}/${step}: card outside screen`);
   assert(card.x+card.w<=target.x||target.x+target.w<=card.x||card.y+card.h<=target.y||target.y+target.h<=card.y,`${name}/${step}: card covers highlighted UI ${JSON.stringify(boxes)}`);
   if(step==='adventures')assert.equal(await page.locator('#task-list').isVisible(),true);
   await page.screenshot({path:new URL(`tutorial-${name}-${step}.png`,out).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
   await advance();
  }
  assert.equal(await page.locator('#meadow-tutorial').getAttribute('data-step'),'chat');
  assert.equal(await page.locator('#tutorial-heading').innerText(),'Общение с друзьями');
  assert((await page.locator('#tutorial-message').innerText()).includes(mobile?'«Отмена»':'Enter'));
  await page.screenshot({path:new URL(`tutorial-${name}-chat.png`,out).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
  await page.evaluate(()=>window.tour.setScheme('gamepad'));
  assert((await page.locator('#tutorial-message').innerText()).includes(mobile?'«Сенсорный экран»':'«Клавиатура и мышь»'));
  await page.evaluate(mobile=>window.tour.setScheme(mobile?'touch':'keyboard'),mobile);
  await advance();await advance();assert.equal(await page.locator('#meadow-tutorial').isVisible(),false);
  assert.equal(await page.evaluate(()=>localStorage.getItem('kirby-tutorial-completed-v1')),'1');
  assert.equal(await page.evaluate(()=>window.worldInputs),0,'tour click/key leaked into game');
  if(mobile)assert.equal(await page.locator('#tasks-toggle').getAttribute('aria-expanded'),'false');
  await page.evaluate(()=>window.tour.open());assert.equal(await page.locator('#meadow-tutorial').isVisible(),false);
  await page.evaluate(()=>window.tour.open(true));assert.equal(await page.locator('#meadow-tutorial').getAttribute('data-step'),'welcome');
  await page.evaluate(async()=>{
   // Match Vite's current HMR dependency URL rather than creating a second locale module.
   const source=await fetch('/src/tutorial.ts').then(r=>r.text()),url=source.match(/from\s+["']([^"']*\/i18n\.ts[^"']*)["']/)[1];
   const {setLocale}=await import(url);setLocale('bg');window.tour.gamepad(new Set([3]));
  });
  assert.equal(await page.locator('#tutorial-heading').innerText(),'Печели точки!');
  await page.evaluate(()=>window.tour.gamepad(new Set([1])));assert.equal(await page.locator('#meadow-tutorial').isVisible(),false);
  await page.evaluate(()=>window.tour.open(true));await page.locator('#tutorial-skip').click();assert.equal(await page.locator('#meadow-tutorial').isVisible(),false);
  assert.deepEqual(errors,[]);reports.push({name,completed:true,skipped:true,gamepad:true,localized:true,uiVisible:true});await context.close();
 }
 // A separate new player checks automatic opening and replay in the actual game.
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-player-name-v1','Новичок');});
 await page.goto(base);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Новичок');await page.locator('#start-game').click();
 await page.locator('#meadow-tutorial').waitFor({state:'visible'});assert.equal(await page.locator('#meadow-tutorial').getAttribute('data-step'),'welcome');
 await page.locator('#tutorial-skip').click();await page.locator('#settings-toggle').click();
 const buttons=await page.evaluate(()=>{
  const save=document.querySelector('#save-game'),replay=document.querySelector('#replay-tutorial'),style=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {width:r.width,height:r.height,font:s.fontSize,padding:s.padding,margin:s.margin};};return {save:style(save),replay:style(replay),adjacent:save.nextElementSibling===replay};
 });assert.deepEqual(buttons.save,buttons.replay);assert(buttons.adjacent);
 await page.locator('#replay-tutorial').click();
 assert.equal(await page.locator('#settings-toggle').getAttribute('aria-expanded'),'false');assert.equal(await page.locator('#meadow-tutorial').getAttribute('data-step'),'welcome');
 await page.screenshot({path:new URL('tutorial-game.png',out).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 await page.locator('#tutorial-skip').click();await page.reload();await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.locator('#new-game').click();await page.locator('#start-game').click();assert.equal(await page.locator('#meadow-tutorial').isVisible(),false);
 assert.deepEqual(errors,[]);reports.push({actualGame:true,autoOpen:true,replayFromSettings:true,remembered:true});await context.close();
 console.log(JSON.stringify(reports));
}finally{await browser.close();}
