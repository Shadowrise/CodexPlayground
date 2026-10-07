import {chromium} from 'playwright';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage();await page.route('**/check-bark-audio',r=>r.fulfill({contentType:'text/html',body:'<button id="start">Start</button><button id="sound">Sound</button><input id="volume" type="range">'}));await page.goto('http://127.0.0.1:5173/check-bark-audio');
 await page.evaluate(async()=>{
  const Native=window.AudioContext;
  window.AudioContext=class extends Native{constructor(){super();const sink=this.createMediaStreamDestination();Object.defineProperty(this,'destination',{value:sink});window.testContext=this;const create=this.createBufferSource.bind(this);this.createBufferSource=()=>{const source=create(),start=source.start.bind(source);source.start=(...args)=>{window.starts++;start(...args);};return source;};}};
  window.starts=0;const {SoundEffects}=await import('/src/sfx.ts');window.sfx=new SoundEffects(document.querySelector('#sound'),document.querySelector('#volume'));document.querySelector('#start').onclick=()=>window.sfx.start();
  window.sfx.playDogBark(0,0,0);if(window.starts!==0)throw Error('Audio starts before user interaction');
 });
 await page.click('#start');await page.waitForFunction(()=>window.sfx.buffers.has('dog-bark'));
 console.log(await page.evaluate(()=>{
  const s=window.sfx,b=s.buffers.get('dog-bark');if(b.duration>.3||b.numberOfChannels!==1)throw Error('Wrong bark asset');
  s.playDogBark(0,0,0);if(window.starts!==1)throw Error('Nearby bark missing');s.playDogBark(24,0,0);if(window.starts!==1)throw Error('Distant bark audible');
  s.playDogBark(6,0,0);const voices=[...s.active],level=voices[1].gain.gain.value;if(level<=0||level>=voices[0].gain.gain.value)throw Error('Distance attenuation missing');
  document.querySelector('#sound').click();s.playDogBark(0,0,0);if(window.starts!==2)throw Error('Muted bark audible');
  document.querySelector('#sound').click();for(let i=0;i<5;i++)s.playDogBark(0,0,0);if(s.active.size!==4||window.starts!==6)throw Error('Ambient voice budget exceeded');
  s.stopAll();return {duration:b.duration,mono:true,distanceAttenuation:true,mute:true,voiceBudget:true,output:'captured without speaker playback'};
 }));await page.evaluate(()=>window.testContext.close());
}finally{await browser.close();}
