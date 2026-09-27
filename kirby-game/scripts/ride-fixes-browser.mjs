import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:5173/');
 await page.waitForSelector('#startup-loader',{state:'hidden',timeout:120000});
 const result=await page.evaluate(async()=>{
  const {StarfallView}=await import('/src/starfall-view.ts');
  const {createStarfall,finishStarfall}=await import('/src/starfall.ts');
  const {Vector3,PerspectiveCamera}=await import('/node_modules/.vite/deps/three.js');
  const view=new StarfallView(()=>{},()=>{},()=>{}),state=createStarfall(0,'Проверка');
  state.players.player={name:'Проверка',variant:0,base:42,fruits:6,size:1.6,bonus:12,collected:[]};
  finishStarfall(state,state.endsAt);
  view.update(state,'player',state.endsAt,new Vector3(),1,new PerspectiveCamera(),true,[],()=>{});
  const result={open:view.results.open,rows:view.results.querySelectorAll('li').length,text:view.results.textContent};
  view.results.close();view.results.remove();view.hud.remove();return result;
 });
 assert(result.open,'Results must open on the exact ending frame, before the celebration timeout');
 assert.equal(result.rows,1);assert(result.text.includes('54 очков'));assert(result.text.includes('120 с'));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({immediateResults:result.open,errors}));
}finally{await browser.close();}
