import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

// No sound is sent to speakers: the recorder's output stays silent. A quiet DC
// probe makes any resets in the shared bus unambiguous, without a 3D/GPU load.
async function probe(){
  const {createSoundOutput}=await import('http://127.0.0.1:5173/src/sound-output.ts');
  const results=[];
  for(const mode of ['legacy-mono','legacy-switching','stereo-switching']){
    const ctx=new AudioContext({sampleRate:48000});
    const {master,headroom,limiter}=createSoundOutput(ctx);
    if(mode.startsWith('legacy')){master.channelCountMode=headroom.channelCountMode='max';limiter.channelCountMode='clamped-max';}
    master.gain.value=.45;
    const recorder=ctx.createScriptProcessor(1024,2,2);
    limiter.connect(recorder);recorder.connect(ctx.destination);
    const voice=ctx.createConstantSource();voice.offset.value=.2;voice.connect(master);
    const samples=[];
    let start;
    recorder.onaudioprocess=e=>{
      if(start===undefined||e.playbackTime<start+.3||e.playbackTime>start+1.9)return;
      // Deliberately leave outputBuffer zero: only capture, never audible playback.
      samples.push(...e.inputBuffer.getChannelData(0));
    };
    await ctx.resume();start=ctx.currentTime;voice.start();
    const timers=[];
    if(mode!=='legacy-mono')for(const at of [350,700,1050,1400]){
      timers.push(setTimeout(()=>{
        const source=ctx.createConstantSource(),pan=ctx.createStereoPanner();
        source.offset.value=1e-8;source.connect(pan);pan.connect(master);source.start();
        timers.push(setTimeout(()=>{source.stop();source.disconnect();pan.disconnect();},155));
      },at));
    }
    await new Promise(resolve=>setTimeout(resolve,2200));
    timers.forEach(clearTimeout);voice.stop();recorder.disconnect();await ctx.close();
    if(!samples.length)throw Error('No captured audio: context/recording did not start');
    let minimum=Infinity,maximum=-Infinity,jump=0,dropouts=0;
    for(let i=0;i<samples.length;i++){minimum=Math.min(minimum,samples[i]);maximum=Math.max(maximum,samples[i]);if(i)jump=Math.max(jump,Math.abs(samples[i]-samples[i-1]));if(Math.abs(samples[i])<.01)dropouts++;}
    results.push({mode,minimum,maximum,jump,dropouts,samples:samples.length});
  }
  return {browser:navigator.userAgent,results};
}

let finish;
const result=new Promise(resolve=>finish=resolve);
const server=createServer((req,res)=>{
  if(req.method==='POST'&&req.url==='/result'){
    let body='';req.on('data',data=>body+=data);req.on('end',()=>{res.end('ok');finish(JSON.parse(body));});
  }else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Audio mixer regression</title><script type="module">('+probe.toString()+')().then(report=>fetch("/result",{method:"POST",body:JSON.stringify(report)})).catch(error=>fetch("/result",{method:"POST",body:JSON.stringify({error:String(error),stack:error.stack})}));</script>');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port;
let browser,firefox,timeout;
try{
  if(process.env.AUDIO_BROWSER==='firefox'){
    const profile=await mkdtemp(join(tmpdir(),'kirby-audio-firefox-'));
    await writeFile(join(profile,'user.js'),'user_pref("media.autoplay.default",0);\nuser_pref("media.autoplay.block-webaudio",false);\nuser_pref("media.autoplay.blocking_policy",0);');
    firefox=spawn(process.env.BROWSER_EXECUTABLE??'C:/Program Files/Mozilla Firefox/firefox.exe',['-headless','-no-remote','-profile',profile,url],{windowsHide:true,stdio:'ignore'});
    firefox.on('error',error=>finish({error:String(error)}));
  }else{
    browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
    await (await browser.newPage()).goto(url);
  }
  const report=await Promise.race([result,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Audio probe timeout')),45000);})]);
  console.log(JSON.stringify(report,null,2));
  if(report.error)throw Error(report.error);
  const baseline=report.results[0],fixed=report.results[2];
  assert(baseline.dropouts===0&&baseline.jump<1e-5,'Control signal must remain continuous');
  assert(fixed.dropouts===0&&fixed.jump<1e-5,'Mono/stereo footsteps must not interrupt the shared output');
}finally{clearTimeout(timeout);await browser?.close();firefox?.kill();server.closeAllConnections();server.close();}
