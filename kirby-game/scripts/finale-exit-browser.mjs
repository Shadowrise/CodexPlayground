import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/room',route=>route.fulfill({json:{players:0,occupiedVariants:[],capacity:14}}));
 await page.routeWebSocket('**/ws?**',ws=>{
  const now=Date.now();ws.send(JSON.stringify({type:'welcome',protocolVersion:2,playerId:'test',players:[{id:'test'}],room:{id:'test-room',host:'test',epoch:now-300000,fruits:Array(70).fill(null),starAt:0,mill:false,locks:{},festival:{startsAt:now-268500,endsAt:now-148500,initiator:'Тест',players:{test:{name:'Тест',variant:0,base:36,fruits:0,size:1,bonus:0,collected:[]}},results:[{id:'test',name:'Тест',variant:0,points:36,bonus:0,fruits:0,size:1}]}}}));
  ws.onMessage(m=>{if(m==='ping')ws.send('pong');});
 });
 await page.goto('http://127.0.0.1:5173/');await page.locator('#startup-loader').waitFor({state:'hidden',timeout:60000});await page.locator('#player-name-input').fill('Тест');await page.locator('#network-join').click();
 let navigations=0;page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});
 await page.locator('#start-game').click();await page.waitForFunction(()=>document.querySelector('#startup-menu')&&!document.querySelector('#startup-menu').hidden,{timeout:60000});await page.locator('#startup-loader').waitFor({state:'hidden',timeout:60000});
 await page.waitForTimeout(2500);assert.equal(navigations,1);assert(await page.locator('#startup-menu').isVisible());assert(await page.locator('#new-game').isEnabled());assert.deepEqual(errors,[]);
 await page.reload();await page.locator('#startup-loader').waitFor({state:'hidden',timeout:60000});assert(await page.locator('#startup-menu').isVisible());console.log('PASS expired network results redirect exactly once; menu remains interactive after reload');
}finally{await browser.close();}
