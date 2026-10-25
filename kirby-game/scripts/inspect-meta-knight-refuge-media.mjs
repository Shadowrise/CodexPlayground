import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const folder=new URL('../artifacts/meta-knight-phase4-refuge-2026-10-25-v3/',import.meta.url),base=process.env.GAME_URL??'http://127.0.0.1:5173/';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 await page.route('**/__refuge_media_check',r=>r.fulfill({contentType:'text/html',body:'<style>body{margin:0;background:#080d20}video{width:100vw;height:100vh;object-fit:contain}</style><video controls preload="auto" src="/artifacts/meta-knight-phase4-refuge-2026-10-25-v3/stellar-refuge-in-game.webm"></video>'}));
 await page.goto(new URL('__refuge_media_check',base).href);await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
 const audio=await page.evaluate(async()=>{
  const video=document.querySelector('video'),context=new AudioContext(),bytes=await (await fetch(video.src)).arrayBuffer(),buffer=await context.decodeAudioData(bytes);let peak=0,squares=0,count=0;
  for(let c=0;c<buffer.numberOfChannels;c++){const data=buffer.getChannelData(c);for(const v of data){peak=Math.max(peak,Math.abs(v));squares+=v*v;count++;}}
  await context.close();return {channels:buffer.numberOfChannels,seconds:buffer.duration,peak,rms:Math.sqrt(squares/count),width:video.videoWidth,height:video.videoHeight};
 });
 assert.equal(audio.channels,2);assert(audio.peak>.01&&audio.peak<1);assert.equal(audio.width,2000);assert.equal(audio.height,1250);
 for(const [seconds,name] of [[4.5,'dome'],[10,'planet'],[17.8,'shatter'],[18.35,'forehead'],[19.1,'rebound']]){
  await page.evaluate(seconds=>new Promise(resolve=>{const v=document.querySelector('video');v.pause();v.addEventListener('seeked',resolve,{once:true});v.currentTime=seconds;}),seconds);
  await page.screenshot({path:new URL(`video-${name}.png`,folder).pathname.replace(/^\/([A-Z]:)/,'$1')});
 }
 audio.videoSeconds=await page.evaluate(()=>document.querySelector('video').duration);assert(audio.videoSeconds>20);
 await writeFile(new URL('video-inspection.json',folder),JSON.stringify(audio,null,2));console.log(JSON.stringify(audio));
 const frames=await Promise.all(['05-roll-start','08-planet-shatter'].map(async name=>'data:image/png;base64,'+(await readFile(new URL(`screenshots/${name}.png`,folder))).toString('base64'))),sheet=await browser.newPage({viewport:{width:1600,height:600}});
 await sheet.setContent(`<style>body{margin:0;padding:20px;background:#080d20;color:#e8edff;font:20px system-ui}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}figure{margin:0}img{width:100%}figcaption{padding:8px}</style><div class="grid">${frames.map((src,i)=>`<figure><img src="${src}"><figcaption>${i?'Неровный раскол · слои и минералы внутри':'Подробная поверхность · берега, рельеф и облака'}</figcaption></figure>`).join('')}</div>`);
 await sheet.screenshot({path:new URL('planet-detail.png',folder).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
}finally{await browser.close();}
