import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const out=new URL('../node_modules/.cache/menu-music/',import.meta.url);await mkdir(out,{recursive:true});
const server=process.env.GAME_URL?undefined:await createServer({server:{host:'127.0.0.1',port:5195,strictPort:true}});await server?.listen();
const base=process.env.GAME_URL??'http://127.0.0.1:5195/';
const errors=[],report={};let browser;
const launch=policy=>chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy='+policy]});
try{
 browser=await launch('document-user-activation-required');
 const blocked=await browser.newPage();blocked.on('pageerror',e=>errors.push(e.message));
 const blockedRequests=[];blocked.on('requestfailed',request=>blockedRequests.push({url:request.url(),error:request.failure()?.errorText}));
 const blockedConsole=[];blocked.on('console',message=>{if(message.type()==='error')blockedConsole.push(message.text());});
 await blocked.route('**/__menu-music',r=>r.fulfill({contentType:'text/html',body:'<button id="music"></button><input id="volume"><button id="previous"></button><button id="next"></button><span id="track"></span><button id="resume">Продолжить</button><script type="module">import {BackgroundMusic} from "/src/music.ts";window.musicQA=new BackgroundMusic(document.querySelector("#music"),document.querySelector("#volume"),document.querySelector("#previous"),document.querySelector("#next"),document.querySelector("#track"));musicQA.enterMenu();</script>'}));
 await blocked.goto(base+'__menu-music');
 try{await blocked.waitForFunction(()=>window.musicQA,{},{timeout:10000});}
 catch(error){report.synthetic={url:blocked.url(),html:(await blocked.content()).slice(0,1000),requests:blockedRequests,console:blockedConsole};throw error;}
 report.autoplay=await blocked.evaluate(()=>({waiting:musicQA.waitingForGesture,paused:musicQA.audio.paused,enabled:musicQA.enabled}));
 await blocked.waitForFunction(()=>window.musicQA.waitingForGesture);
 assert(await blocked.evaluate(()=>musicQA.audio.paused&&musicQA.enabled&&musicQA.audio.src.includes('/audio/meadow-day.wav')));
 await blocked.click('#resume');await blocked.waitForFunction(()=>!musicQA.audio.paused&&musicQA.audio.currentTime>.1);
 report.gestureRetry=await blocked.evaluate(()=>({track:musicQA.track,time:musicQA.audio.currentTime,enabled:musicQA.enabled,waiting:musicQA.waitingForGesture}));assert.equal(report.gestureRetry.waiting,false);
 await browser.close();browser=await launch('no-user-gesture-required');
 const page=await browser.newPage({viewport:{width:1280,height:850}});page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.menuMusicQA={music,get playing(){return playing},get initialPhase(){return dayStartPhase},get phase(){return currentDayPhase()}};'});});
 await page.goto(base);await page.waitForFunction(()=>window.menuMusicQA&&!menuMusicQA.music.audio.paused&&menuMusicQA.music.audio.currentTime>.1);
 assert(await page.evaluate(()=>!menuMusicQA.playing&&menuMusicQA.music.track===0));
 report.menu=await page.evaluate(()=>({src:menuMusicQA.music.audio.src,time:menuMusicQA.music.audio.currentTime,playing:!menuMusicQA.music.audio.paused}));
 await page.locator('#startup-loader').waitFor({state:'hidden'});
 await page.evaluate(()=>{window.menuAudio=menuMusicQA.music.audio;window.menuAudioEvents=[];for(const event of ['pause','emptied','loadstart'])menuAudio.addEventListener(event,()=>menuAudioEvents.push(event));menuAudio.currentTime=17;});
 await page.waitForFunction(()=>menuAudio.currentTime>=17);
 await page.click('#new-game');await page.fill('#player-name-input','Музыка');await page.click('#start-game');await page.waitForFunction(()=>menuMusicQA.playing);
 assert.equal(await page.evaluate(()=>menuMusicQA.initialPhase),.125,'solo starts at 09:00');
 report.game=await page.evaluate(()=>({same:menuAudio===menuMusicQA.music.audio,time:menuAudio.currentTime,src:menuAudio.src,paused:menuAudio.paused,events:[...menuAudioEvents]}));
 assert(report.game.same&&!report.game.paused&&report.game.time>=17);assert.equal(report.game.src,report.menu.src);assert.deepEqual(report.game.events,[],'entering gameplay must not pause or reload menu music');
 await page.click('#settings-toggle');await page.click('#exit-to-menu');await page.waitForFunction(()=>!menuMusicQA.playing);
 report.returnToMenu=await page.evaluate(()=>({time:menuAudio.currentTime,paused:menuAudio.paused,events:[...menuAudioEvents]}));assert(!report.returnToMenu.paused);assert(report.returnToMenu.time>=report.game.time);assert.deepEqual(report.returnToMenu.events,[]);
 await page.click('#new-game');await page.click('#start-game');await page.waitForFunction(()=>menuMusicQA.playing);
 assert.equal(await page.evaluate(()=>menuMusicQA.initialPhase),.125,'another new solo game resets to 09:00');
 await page.click('#settings-toggle');assert.equal(await page.isChecked('#music-shuffle'),false);
 const beforeShuffle=await page.evaluate(()=>({track:menuMusicQA.music.track,time:menuMusicQA.music.audio.currentTime}));
 await page.check('#music-shuffle');
 assert.equal(await page.evaluate(()=>localStorage.getItem('kirby.audio.shuffle')),'true');
 assert(await page.evaluate(before=>menuMusicQA.music.track===before.track&&menuMusicQA.music.audio.currentTime>=before.time,beforeShuffle));
 report.shuffle=await page.evaluate(()=>{
  const tracks=[menuMusicQA.music.track];
  for(let i=1;i<15;i++){menuMusicQA.music.audio.dispatchEvent(new Event('ended'));tracks.push(menuMusicQA.music.track);}
  return {tracks,checked:document.querySelector('#music-shuffle').checked};
 });assert.equal(new Set(report.shuffle.tracks).size,15);
 await page.screenshot({path:fileURLToPath(new URL('shuffle-desktop.png',out))});
 await page.reload();await page.waitForFunction(()=>window.menuMusicQA);assert.equal(await page.isChecked('#music-shuffle'),true);
 await page.click('#new-game');await page.click('#start-game');await page.waitForFunction(()=>menuMusicQA.playing);
 await page.click('#settings-toggle');await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:fileURLToPath(new URL('shuffle-mobile.png',out))});
 await page.uncheck('#music-shuffle');assert.equal(await page.evaluate(()=>localStorage.getItem('kirby.audio.shuffle')),'false');
 await page.click('#music-next');const afterSequential=await page.evaluate(()=>menuMusicQA.music.track);
 await page.click('#music-previous');assert.equal(await page.evaluate(()=>menuMusicQA.music.track),(afterSequential+14)%15);
 await page.reload();await page.waitForFunction(()=>window.menuMusicQA);assert.equal(await page.isChecked('#music-shuffle'),false);assert.equal(await page.evaluate(()=>menuMusicQA.music.track),0);
 assert.deepEqual(errors,[]);await writeFile(new URL('checks.json',out),JSON.stringify({...report,errors},null,2));console.log(JSON.stringify({...report,errors}));
}catch(error){console.error(JSON.stringify({report,errors}));throw error;}
finally{await browser?.close();await server?.close();}
