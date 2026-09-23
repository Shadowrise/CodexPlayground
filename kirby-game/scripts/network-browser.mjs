import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined),headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],frames=[];
try{
 const context=await browser.newContext({viewport:{width:800,height:600}});
 async function enter(name){const p=await context.newPage();p.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});p.on('websocket',socket=>socket.on('framereceived',frame=>{try{frames.push(JSON.parse(String(frame.payload)));}catch{}}));await p.goto(process.env.GAME_URL||'http://127.0.0.1:5173/');await p.locator('#player-name-input').fill(name);await p.locator('#network-join').click();await p.locator('#start-game:not([disabled])').waitFor({timeout:30000});await p.waitForTimeout(1000);await p.locator('#start-game').click();await p.waitForFunction(()=>!document.body.classList.contains('choosing'),{timeout:30000});return p;}
 const a=await enter('Первый'),b=await enter('Второй');
 await b.waitForFunction(()=>document.querySelectorAll('.remote-stat-row').length===1,{timeout:15000});
 await a.bringToFront();await a.locator('#game canvas').click();await a.keyboard.press('Enter');
 await a.locator('#chat-input').fill('Привет, друзья! <b>Это текст</b>');await a.keyboard.press('Enter');
 await b.waitForFunction(()=>document.querySelector('#meadow-chat')?.textContent?.includes('Первый: Привет, друзья! <b>Это текст</b>'));
 assert.equal(await b.locator('#meadow-chat b').count(),0);
 await a.keyboard.press('1');await b.waitForFunction(()=>document.querySelector('#meadow-chat')?.textContent?.includes('приветствует всех вокруг'));
 await a.locator('#settings-toggle').click();assert(await a.locator('#meadow-chat').evaluate(el=>el.classList.contains('chat-scroll')));await a.locator('#settings-toggle').click();
 await a.locator('#game canvas').click();await a.keyboard.down('w');await a.waitForTimeout(1200);await a.keyboard.up('w');
 assert.equal(await a.locator('.player-stats .host-badge:not([hidden])').count(),1);assert.equal(await b.locator('.player-stats .host-badge:not([hidden])').count(),1);
 assert(await a.locator('.online-roster').isHidden());assert.equal(await b.locator('.variant-button:disabled').count(),1);assert(await a.locator('#save-game').isHidden());assert(await b.locator('#save-game').isHidden());
 await a.screenshot({path:(process.env.TEMP||'/tmp')+'/kirby-online.png'});
 await a.locator('#settings-toggle').click();await a.locator('#exit-to-menu').click();await a.locator('#startup-loader').waitFor({state:'hidden',timeout:60000});assert(await a.locator('#startup-menu').isVisible());await a.close();await b.waitForFunction(()=>document.querySelectorAll('.remote-stat-row').length===0);
 await b.waitForFunction(()=>document.querySelector('#meadow-chat')?.textContent?.includes('Первый покинул полянку'));await b.waitForTimeout(1200);assert(await b.locator('#player-host-badge').isVisible());assert.equal(await b.locator('.player-stats .host-badge:not([hidden])').count(),1);assert.deepEqual(errors,[]);assert(frames.some(m=>m.type==='frame'&&m.world?.npcs?.length===14));assert(frames.some(m=>m.type==='frame'&&m.actor?.state==='Run'));console.log('PASS two browser clients, roster, movement, hidden saves, departure, no browser exceptions');
}finally{await browser.close();}
