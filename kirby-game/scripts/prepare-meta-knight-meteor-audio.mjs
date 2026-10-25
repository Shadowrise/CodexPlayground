import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),source='artifacts/meta-knight-phase4-meteors-2026-10-25/audio-sources/',old='artifacts/meta-knight-phase4-transition-2026-10-24-v3/audio-sources/',output='public/audio/meta-knight-cosmic/';
const sources=[
 {id:'swish',path:source+'swishes/swishes/swish-7.wav',author:'artisticdude',page:'https://opengameart.org/content/swishes-sound-pack',url:'https://opengameart.org/sites/default/files/swishes.zip'},
 {id:'fire',path:source+'fire-1.wav',author:'AntumDeluge',page:'https://opengameart.org/content/fire-crackling',url:'https://opengameart.org/sites/default/files/fire-1.wav'},
 {id:'boom',path:old+'boom.wav',author:'faxcorp',page:'https://opengameart.org/content/electricity-game-sound-pack'},
 {id:'charge',path:old+'charge.wav',author:'faxcorp',page:'https://opengameart.org/content/electricity-game-sound-pack'},
];
const samples={};
for(const s of sources){
 const b=await readFile(new URL(s.path,root));s.sha256=createHash('sha256').update(b).digest('hex');s.license='CC0-1.0';let fmt,pcm;
 for(let at=12;at+8<=b.length;){const tag=b.toString('ascii',at,at+4),n=b.readUInt32LE(at+4);if(tag==='fmt ')fmt=b.subarray(at+8,at+8+n);if(tag==='data')pcm=b.subarray(at+8,at+8+n);at+=8+n+(n%2);}
 const channels=fmt.readUInt16LE(2),rate=fmt.readUInt32LE(4),bits=fmt.readUInt16LE(14),width=bits/8,frames=pcm.length/(channels*width),data=Array.from({length:2},()=>new Float32Array(frames));
 for(let i=0;i<frames;i++)for(let ch=0;ch<2;ch++){const at=(i*channels+Math.min(ch,channels-1))*width;data[ch][i]=fmt.readUInt16LE(0)===3?pcm.readFloatLE(at):pcm.readIntLE(at,width)/2**(bits-1);}
 let peak=0;for(const channel of data)for(const v of channel)peak=Math.max(peak,Math.abs(v));samples[s.id]={data,rate,frames,peak};
}
const rate=44100,report=[];await mkdir(new URL(output,root),{recursive:true});
for(const [kind,duration] of [['draw',1.5],['throw',1.75],['reflect',.75],['impact',1.4]]){
 const n=Math.ceil(rate*duration),data=[new Float32Array(n),new Float32Array(n)];
 function layer(name,at,gain,speed,seconds,pan=0,loop=false,env=()=>1){
  const s=samples[name];for(let i=Math.max(0,Math.floor(at*rate));i<n;i++){const t=i/rate-at;if(t>seconds)break;let p=t*speed*s.rate;if(loop)p%=(s.frames-1);if(p>=s.frames-1)break;const a=Math.floor(p),f=p-a,edge=Math.min(1,t/.008,(seconds-t)/.065),g=gain/s.peak*edge*env(t/seconds);for(let ch=0;ch<2;ch++)data[ch][i]+=(s.data[ch][a]*(1-f)+s.data[ch][a+1]*f)*g*(ch===0?1-Math.max(0,pan)*.4:1+Math.min(0,pan)*.4);}
 }
 if(kind==='draw'){layer('charge',0,.26,.72,1.5,0,false,u=>.12+.88*u*u);layer('fire',0,.16,.7,1.5,-.3,true,u=>.2+.8*u);layer('swish',.85,.12,.3,.65,.4);}
 if(kind==='throw'){layer('swish',0,.65,.30,1.3,-.4);layer('swish',.16,.30,.42,1.1,.6);layer('fire',0,.29,.9,1.75,0,true,u=>Math.exp(-u*2.4));layer('boom',0,.12,.65,.8);}
 if(kind==='reflect'){layer('swish',0,.36,.85,.6,.5);layer('boom',0,.32,1.9,.5,-.4);layer('charge',.02,.13,2.2,.6);for(let i=0;i<n;i++){const t=i/rate,v=(Math.sin(t*2*Math.PI*1174.66)+.4*Math.sin(t*2*Math.PI*1760))*.13*Math.exp(-t*10)*Math.min(1,t/.004);data[0][i]+=v;data[1][i]+=v*.9;}}
 if(kind==='impact'){layer('boom',0,.72,.78,1.4);layer('fire',0,.12,.55,1.4,0,true,u=>Math.exp(-u*6));layer('swish',0,.11,1.1,.4);}
 let peak=0;for(const channel of data)for(const v of channel)peak=Math.max(peak,Math.abs(v));const gain={draw:.47,throw:.61,reflect:.58,impact:.70}[kind]/peak;
 const b=Buffer.alloc(44+n*4);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*4,40);
 for(let i=0;i<n;i++)for(let ch=0;ch<2;ch++){const edge=Math.min(1,i/(rate*.003),(n-1-i)/(rate*.06));b.writeInt16LE(Math.round(data[ch][i]*gain*edge*32767),44+i*4+ch*2);}
 const file=output+'cosmic-meteor-'+kind+'.wav';await writeFile(new URL(file,root),b);report.push({file,duration,peak:peak*gain});
}
await writeFile(new URL(source+'sources.json',root),JSON.stringify(sources,null,2));await writeFile(new URL(source+'mix-report.json',root),JSON.stringify(report,null,2));
await writeFile(new URL(output+'METEOR-CREDITS.md',root),'# Meteor sound recordings\n\nAll recordings CC0-1.0.\n\n'+sources.map(s=>`- ${s.author}: [source page](${s.page}), ${s.path}; SHA-256 ${s.sha256}.`).join('\n')+'\n\nEdits: layered real swishes, fire, electrical charge and impact; pitch, stereo, fades and headroom. Four 44.1kHz stereo PCM16 WAV files. Rebuild: scripts/prepare-meta-knight-meteor-audio.mjs.\n');
console.log(JSON.stringify(report));
