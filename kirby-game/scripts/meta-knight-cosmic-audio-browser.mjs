import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/__cosmic-audio-probe',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
 await page.goto((process.env.GAME_URL??'http://127.0.0.1:5173')+'/__cosmic-audio-probe');
 const samples=await page.evaluate(async()=>{
  const {SoundEffects}=await import('/src/sfx.ts'),sounds=new SoundEffects(document.createElement('button'),document.createElement('input'));sounds.unlock();await sounds.prepareKnightCosmic();
  const output={};for(const kind of ['charge','impact','draw','ascent','arrive']){const b=sounds.buffers.get('knight-v2-cosmic-'+kind);let peak=0;for(const x of b.getChannelData(0))peak=Math.max(peak,Math.abs(x));for(const x of b.getChannelData(1))peak=Math.max(peak,Math.abs(x));output[kind]={duration:b.duration,peak,rate:b.sampleRate};}
  sounds.playKnight('cosmic-impact');const playing=sounds.knightCosmicSources.size;sounds.stopKnightCosmic();return {output,playing,afterCancel:sounds.knightCosmicSources.size};
 });
 for(const [kind,peak] of Object.entries({charge:.46,impact:.72,draw:.45,ascent:.48,arrive:.38}))assert(Math.abs(samples.output[kind].peak-peak)<.04,'the actual downloaded sample is used, rather than its generated fallback');
 assert.equal(samples.playing,1);assert.equal(samples.afterCancel,0);
 assert.equal(samples.output.impact.duration,4.6,'the landing plays the full rolling thunder edit');
 await page.route('**/audio/meta-knight-cosmic/*.wav',r=>r.fulfill({status:404,body:''}));
 const missing=await page.evaluate(async()=>{
  const {SoundEffects}=await import('/src/sfx.ts'),sounds=new SoundEffects(document.createElement('button'),document.createElement('input'));sounds.unlock();await sounds.prepareKnightCosmic();
  const before=sounds.buffers.has('knight-v2-cosmic-impact');sounds.playKnight('cosmic-impact');const buffer=sounds.buffers.get('knight-v2-cosmic-impact'),playing=sounds.knightCosmicSources.size;sounds.stopKnightCosmic();return {before,duration:buffer.duration,playing,afterCancel:sounds.knightCosmicSources.size};
 });
 assert.equal(missing.before,false);assert.equal(missing.duration,1.9);assert.equal(missing.playing,1);assert.equal(missing.afterCancel,0);assert.deepEqual(errors,[]);
 const report={samples,missing,errors};await writeFile(new URL('../artifacts/meta-knight-phase4-transition-2026-10-24-v5/audio-browser-report.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
