import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const mobile=process.argv.includes('--mobile');
const output=fileURLToPath(new URL('../node_modules/.cache/portal-commands/',import.meta.url));await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const context=await browser.newContext(mobile?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:850}});
 const page=await context.newPage(),errors=[],arenaRequests=[];
 page.on('dialog',dialog=>dialog.accept());
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error'&&/THREE|WebGL|shader/i.test(message.text()))errors.push(message.text());});
 page.on('request',request=>{if(/\/src\/meta-knight-arena\.ts(?:\?|$)/.test(request.url()))arenaRequests.push(request.url());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,route=>route.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`
 window.portalCommandsQA={chat,portal:meadowPortal,travel:cosmicArena,get c(){return character},get progress(){return sealProgress},set online(value){networkIntent=value},leave:returnToMenu,
  complete(){for(const site of META_KNIGHT_SEAL_SITES)sealProgress=collectSeal(sealProgress,site.id,{id:'solo',p:[site.x,site.surfaceY,site.z],size:1,available:true},Date.now());}
 };
 `});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5184/');await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 const start=async(load=false)=>{await page.locator(load?'#load-game':'#new-game').click();await page.locator('#player-name-input').fill('Портал');await page.locator('#start-game').click();await page.waitForFunction(()=>!!portalCommandsQA.c);};
 const state=async open=>{await page.waitForFunction(open=>portalCommandsQA.portal.working===open,open);};
 const command=async text=>{await page.evaluate(()=>portalCommandsQA.chat.show());await page.locator('#chat-input').fill(text);if(mobile)await page.locator('#chat-composer button[type=submit]').click();else await page.keyboard.press('Enter');assert(await page.locator('#chat-command-error').isHidden(),text);if(mobile)await page.evaluate(()=>portalCommandsQA.chat.close());};
 const save=async()=>{await page.locator('#settings-toggle').click();await page.locator('#save-game').click();await page.evaluate(()=>portalCommandsQA.leave());await page.locator('#startup-menu').waitFor({state:'visible'});};
 await page.locator('#new-game').click();const card=page.locator('.variant-button.meta-knight-character');await card.scrollIntoViewIfNeeded();
 if(mobile){const bounds=await card.boundingBox();assert(bounds);await page.touchscreen.tap(bounds.x+bounds.width/2,bounds.y+bounds.height/2);}else await card.hover();
 await page.locator('#locked-character-tooltip').waitFor({state:'visible'});
 assert.equal(await page.locator('#locked-character-tooltip p').textContent(),'Кто сможет победить Метакнайта, тот станет новым метакнайтом.');
 await page.locator('#player-name-input').fill('Портал');await page.locator('#start-game').click();await page.waitForFunction(()=>!!portalCommandsQA.c);await state(false);
 await page.evaluate(()=>portalCommandsQA.chat.show());await page.locator('#chat-input').fill('/por');assert.deepEqual(await page.locator('#chat-command-list code').allTextContents(),['/portal']);
 await page.locator('#chat-input').fill('/portal ');assert.deepEqual(await page.locator('#chat-command-list code').allTextContents(),['1','0']);await page.evaluate(()=>portalCommandsQA.chat.close());
 await command('/portal 1');await state(true);assert.equal(arenaRequests.length,0,'opening alone must not load the arena');assert.equal(await page.evaluate(()=>Object.keys(portalCommandsQA.progress.collected).length),0);
 await command('/portal 0');await state(false);await page.evaluate(()=>portalCommandsQA.complete());await state(false);
 await command('/portal 1');await state(true);assert.equal(await page.evaluate(()=>Object.keys(portalCommandsQA.progress.collected).length),3);
 await command('/portal 0');await state(false);await save();await start(true);await state(true); // Save preserves badges, not the forced closed state.
 await page.evaluate(()=>portalCommandsQA.online=true);await page.evaluate(()=>portalCommandsQA.chat.show());await page.locator('#chat-input').fill('/portal 0');if(mobile)await page.locator('#chat-composer button[type=submit]').click();else await page.keyboard.press('Enter');
 assert(await page.locator('#chat-command-error').isVisible());await state(true);await page.evaluate(()=>{portalCommandsQA.online=false;portalCommandsQA.chat.close();});
 await page.evaluate(()=>portalCommandsQA.leave());await start();await state(false);await command('/portal 1');await state(true);await save();await start(true);await state(false); // A forced open without badges also resets on load.
 await command('/portal 1');await page.evaluate(()=>{const q=portalCommandsQA,p=q.portal.group.position;q.c.setActivity('Idle');q.c.actor.position.set(p.x,0,p.z);});
 await page.waitForFunction(()=>portalCommandsQA.travel.active,null,{timeout:90000});assert.equal(arenaRequests.length,1);
 await page.evaluate(()=>portalCommandsQA.travel.leave());await page.waitForFunction(()=>!portalCommandsQA.travel.active);await command('/portal 0');await state(false);
 await page.screenshot({path:output+(mobile?'phone':'desktop')+'.png'});assert.deepEqual(errors,[]);
 const report={mobile,tooltip:true,englishCommands:true,soloOnly:true,overrideOpenAndClosed:true,badgesUnchanged:true,resetOnNewGameAndLoad:true,lazyArenaEntry:true,errors};
 await writeFile(output+(mobile?'phone':'desktop')+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
