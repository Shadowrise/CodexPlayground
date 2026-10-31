import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const output=process.env.QA_OUTPUT??fileURLToPath(new URL('../node_modules/.cache/meta-knight-opponents/',import.meta.url));await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const mobile=process.argv.includes('--mobile');
const page=await browser.newPage(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
try{
 await page.addInitScript(()=>{try{localStorage.setItem('kirby-meta-knight-unlocked-v1','1');localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');}catch{}});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.opponentsQA={travel:cosmicArena,renderer,get c(){return character}};'});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5197/');await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Метакнайт');await page.locator('#variant-grid button').nth(18).click();await page.locator('#start-game').click();
 await page.waitForFunction(()=>window.opponentsQA?.c,{},{timeout:180000});
 await page.evaluate(async()=>{const q=opponentsQA;await q.travel.enter(q.c);q.c.actor.position.set(2000,0,-2);q.travel.startBattle();});
 await page.locator('#knight-side-choice').waitFor({state:'visible'});await page.screenshot({path:output+'/solo-choice.png'});
 await page.locator('#knight-side-choice [data-side=boss]').click();await page.waitForFunction(()=>Object.keys(opponentsQA.travel.battle?.opponents??{}).length===3);
 await page.waitForFunction(()=>opponentsQA.travel.opponentsView.characters.size===3);
 assert.equal(await page.locator('.knight-party-row').count(),4);await page.locator('#knight-helper-actions button').first().waitFor({state:'visible'});
 await page.waitForTimeout(3500);if(mobile)await page.locator('#knight-helper-actions button').first().tap();else await page.keyboard.press('Digit1');await page.waitForFunction(()=>opponentsQA.travel.battle.players.solo.helper.cast?.ability===1);
 await page.screenshot({path:output+'/solo-three-opponents.png'});
 const roster=await page.evaluate(()=>Object.values(opponentsQA.travel.battle.opponents).map(a=>({variant:a.variant,p:a.p})));
 await page.waitForTimeout(1500);assert(await page.evaluate(before=>Object.values(opponentsQA.travel.battle.opponents).some((a,i)=>Math.hypot(a.p[0]-before[i].p[0],a.p[2]-before[i].p[2])>.1),roster));
 for(const [width,height] of [[390,844],[844,390]]){await page.setViewportSize({width,height});await page.waitForTimeout(350);assert.equal(await page.locator('.knight-party-row').count(),4);await page.screenshot({path:output+`/bots-${width}x${height}.png`});}
 await page.evaluate(()=>{const q=opponentsQA;q.travel.cancelBattle();q.travel.startBattle();});await page.locator('#knight-side-choice').waitFor({state:'visible'});
 await page.locator('#knight-side-choice [data-side=players]').click();await page.waitForFunction(()=>opponentsQA.travel.battle.stage==='intro'&&!opponentsQA.travel.battle.opponents);
 assert.equal(await page.evaluate(()=>opponentsQA.travel.opponentsView.characters.size),0);
 // A second boss attempt can be cancelled and leaves no models behind on the meadow.
 await page.evaluate(()=>{opponentsQA.travel.cancelBattle();opponentsQA.travel.startBattle();});await page.locator('#knight-side-choice [data-side=boss]').click();await page.waitForFunction(()=>opponentsQA.travel.opponentsView.characters.size===3);
 await page.evaluate(()=>opponentsQA.travel.leave());assert.equal(await page.evaluate(()=>opponentsQA.travel.active),false);
 assert.deepEqual(errors,[]);await writeFile(output+'/report.json',JSON.stringify({soloChoice:true,threeOpponents:true,soloAbility:true,retryBothSides:true,cleanup:true,roster,errors},null,2));console.log(JSON.stringify({output,roster,errors}));
}catch(e){await page.screenshot({path:output+'/failure.png'});console.log(errors);throw e;}finally{await browser.close();}
