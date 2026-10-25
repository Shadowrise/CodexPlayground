import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url)),folder=root+'artifacts/meta-knight-phase4-transition-2026-10-24-v5/',originals=root+'artifacts/meta-knight-phase4-transition-2026-10-24-v3/audio-sources/',output=root+'public/audio/meta-knight-cosmic/';
await mkdir(originals,{recursive:true});await mkdir(output,{recursive:true});await mkdir(folder,{recursive:true});
const sources=[
 {name:'tesla-spark',file:'spark.wav',author:'Brian MacIntosh (BMacZero)',page:'https://opengameart.org/content/electricity-sound-effects-0'},
 {name:'tesla-continuous',file:'continuousspark.wav',author:'Brian MacIntosh (BMacZero)',page:'https://opengameart.org/content/electricity-sound-effects-0'},
 ...[['charge','charge.wav'],['crackle','crackleelectricityloop.wav'],['boom','deathboom.wav'],['powerup','powerup.wav'],['turbo','turbo.wav']].map(([name,file])=>({name,file,author:'faxcorp',page:'https://opengameart.org/content/electricity-game-sound-pack'})),
 {name:'thunder',file:'thunder.wav',url:'https://lasonotheque.org/UPLOAD/bwf-fr/2718.wav',author:'Joseph SARDIN / LaSonotheque',page:'https://lasonotheque.org/tonnerre-1-s2718.html'},
];
for(const source of sources){
 source.url??='https://opengameart.org/sites/default/files/'+source.file;
 const path=originals+source.name+'.wav';try{await access(path);}catch{const response=await fetch(source.url);if(!response.ok)throw Error(`${source.url}: ${response.status}`);await writeFile(path,Buffer.from(await response.arrayBuffer()));}
 const bytes=await readFile(path);source.sha256=createHash('sha256').update(bytes).digest('hex');source.license='CC0-1.0';source.bytes=bytes.length;console.log(`${source.name}: ${bytes.length} bytes`);
}
await writeFile(originals+'sources.json',JSON.stringify(sources,null,2));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage();await page.goto(process.env.GAME_URL??'http://127.0.0.1:5173/');
 const data=Object.fromEntries(await Promise.all(sources.map(async s=>[s.name,(await readFile(originals+s.name+'.wav')).toString('base64')])));
 const mixed=await page.evaluate(async data=>{
  const rate=44100,context=new OfflineAudioContext(2,rate,rate),samples={};
  for(const [name,encoded] of Object.entries(data)){const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));samples[name]=await context.decodeAudioData(bytes.buffer);}
  const info=Object.fromEntries(Object.entries(samples).map(([name,b])=>[name,{duration:b.duration,channels:b.numberOfChannels,rate:b.sampleRate}]));
  // Find the beginning of the real thunderclap, without the recording's lead-in.
  const thunder=samples.thunder.getChannelData(0);let peak=0,peakIndex=0;
  for(let i=0;i<thunder.length;i++)if(Math.abs(thunder[i])>peak){peak=Math.abs(thunder[i]);peakIndex=i;}
  let thunderStart=Math.max(0,peakIndex/rate-.15);
  for(let i=Math.max(0,peakIndex-rate*3);i<peakIndex;i++)if(Math.abs(thunder[i])>peak*.16){thunderStart=Math.max(0,i/rate-.02);break;}
  const output={};
  for(const [kind,duration] of [['charge',2.8],['impact',4.6],['draw',1.05],['ascent',5.6],['arrive',3.2]]){
   const length=Math.ceil(duration*rate),l=new Float32Array(length),r=new Float32Array(length);
   function layer(name,at=0,gain=1,playback=1,offset=0,seconds=duration,pan=0,envelope=()=>1){
    const b=samples[name],left=b.getChannelData(0),right=b.getChannelData(Math.min(1,b.numberOfChannels-1));let sourcePeak=0;
    for(let i=0;i<left.length;i++)sourcePeak=Math.max(sourcePeak,Math.abs(left[i]),Math.abs(right[i]));
    for(let i=Math.max(0,Math.floor(at*rate));i<length;i++){
     const t=i/rate-at;if(t<0||t>seconds)continue;const index=(offset+t*playback)*rate,j=Math.floor(index);if(j+1>=left.length)break;
     const f=index-j,edge=Math.min(1,t/.009,(seconds-t)/.065),g=gain/Math.max(.01,sourcePeak)*edge*envelope(t/seconds);
     l[i]+=(left[j]+(left[j+1]-left[j])*f)*g*(1-Math.max(0,pan)*.4);r[i]+=(right[j]+(right[j+1]-right[j])*f)*g*(1+Math.min(0,pan)*.4);
    }
   }
   const sparks=(seconds,gain)=>{for(let k=0;k<seconds*7;k++)layer(k%3?'tesla-spark':'tesla-continuous',k*.137+.035,gain*(.65+(k%4)*.13),.75+(k%5)*.095,0,.15+(k%3)*.04,k%2?.7:-.7);};
   if(kind==='charge'){layer('charge',0,.26,.8,0,duration,0,u=>.15+.85*u*u);sparks(duration,.13);layer('powerup',1.35,.10,.7,0,1.45);}
   if(kind==='impact'){layer('thunder',0,.72,1,thunderStart,duration);layer('boom',0,.065,.84,0,.8);sparks(.75,.045);}
   if(kind==='draw'){layer('powerup',0,.26,1.25,0,1.05);layer('tesla-spark',.04,.20,.8,0,.30,-.4);layer('tesla-spark',.46,.16,.95,0,.26,.4);}
   if(kind==='ascent'){layer('turbo',0,.26,.72,0,5.6,0,u=>Math.sin(Math.PI*u)**.5);for(let k=0;k<7;k++)layer('crackle',k*.77,.075,.85,0,.9,k%2?.6:-.6);layer('thunder',0,.13,.85,thunderStart+.15,5.6);sparks(5.3,.07);}
   if(kind==='arrive'){layer('thunder',0,.21,.8,thunderStart+.45,3.2);layer('powerup',0,.14,.65,0,3.2);layer('tesla-spark',.03,.17,.7,0,.35);}
   let max=0;for(let i=0;i<length;i++)max=Math.max(max,Math.abs(l[i]),Math.abs(r[i]));const target={charge:.46,impact:.72,draw:.45,ascent:.48,arrive:.38}[kind],gain=Math.min(4,target/Math.max(.001,max));
   for(let i=0;i<length;i++){const edge=Math.min(1,i/(rate*.004),(length-1-i)/(rate*.07));l[i]*=gain*edge;r[i]*=gain*edge;}
   const bytes=new Uint8Array(length*4),view=new DataView(bytes.buffer);for(let i=0;i<length;i++){view.setInt16(i*4,Math.round(l[i]*32767),true);view.setInt16(i*4+2,Math.round(r[i]*32767),true);}
   let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));output['cosmic-'+kind]={pcm:btoa(binary),duration,peak:max*gain};
  }
  return {output,info,thunderStart};
 },data);
 function wav(pcm){const b=Buffer.alloc(44+pcm.length);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(44100,24);b.writeUInt32LE(44100*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(pcm.length,40);pcm.copy(b,44);return b;}
 for(const [kind,sample] of Object.entries(mixed.output)){await writeFile(output+kind+'.wav',wav(Buffer.from(sample.pcm,'base64')));delete sample.pcm;}
 await writeFile(folder+'audio-mix-report.json',JSON.stringify(mixed,null,2));
 await writeFile(output+'CREDITS.md',`# Meta Knight phase four — sampled sound effects\n\nAll source recordings are CC0-1.0: https://creativecommons.org/publicdomain/zero/1.0/\n\n`+sources.map(s=>`- ${s.author}: [${s.file}](${s.page}); source [download](${s.url}); SHA-256 ${s.sha256}.`).join('\n')+`\n\nGame edits: trimmed recording lead-in; layered Tesla sparks, electrical charge, impacts and thunder; adjusted pitch, stereo placement and fades. Five stereo 44.1 kHz PCM WAVs, with peak headroom. No attribution is required by CC0; credits are preserved here.\n\nRebuild with scripts/prepare-meta-knight-cosmic-audio.mjs. Original source recordings and hashes are in artifacts/meta-knight-phase4-transition-2026-10-24-v3/audio-sources/.\n`);
 console.log(JSON.stringify({output,...mixed},null,2));
}finally{await browser.close();}
