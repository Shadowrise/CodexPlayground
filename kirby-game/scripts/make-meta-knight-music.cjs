const fs=require('node:fs'),path=require('node:path');
// Preserve the approved sampled recording during ordinary asset generation.
// The score below remains the original editable melody source. An explicit
// --legacy-preview renders the old synth to a cache file for comparison.
if(!process.argv.includes('--legacy-preview')){
 const approved=path.resolve(__dirname,'../public/audio/meta-knight-duel.wav');
 if(!fs.existsSync(approved))throw new Error('Restore the approved meta-knight-duel.wav from Git; its editable score and render settings are in design/music/meta-knight-orchestral/approved.');
 console.log(JSON.stringify({file:approved,source:'approved orchestral arrangement with muted solo violin; preserved'}));
 process.exit(0);
}
// Original score: “Galaxia — Knight of the Stars”, D minor, 144 BPM, 64 bars.
// Theme, answer, reprise, lyrical bridge, bridge variation, return and two-part finale.
// Every instrument tail wraps into the loop.
const rate=44100,bpm=144,beat=60/bpm,bars=64,duration=bars*4*beat,n=Math.round(rate*duration);
const left=new Float32Array(n),right=new Float32Array(n),hz=m=>440*2**((m-69)/12);
let seed=23491;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const chords=[[50,53,57],[46,50,53],[53,57,60],[48,52,55],[43,46,50],[46,50,53],[45,50,52],[45,49,55]];
const themeA=[
 [74,81,79,77,76,74,77,79],[81,-1,77,76,74,-1,72,74],
 [77,84,81,79,77,76,77,81],[79,76,72,-1,76,79,81,79],
 [79,82,81,79,77,74,77,79],[77,-1,74,77,82,81,79,77],
 [76,74,73,76,81,79,76,74],[73,-1,76,79,81,-1,73,76]];
const themeB=[
 [86,-1,81,84,86,84,81,79],[82,81,77,74,77,81,82,-1],
 [84,-1,81,79,77,81,84,86],[88,84,79,76,79,-1,84,81],
 [86,82,79,77,74,77,79,82],[89,-1,86,82,81,77,79,81],
 [88,86,85,81,79,76,74,73],[81,79,76,73,76,79,85,-1]];
const themeC=[
 [77,-1,74,-1,81,79,77,-1],[74,-1,70,-1,77,74,72,-1],
 [81,-1,77,79,84,-1,81,77],[79,-1,76,-1,72,76,79,-1],
 [79,-1,74,77,82,-1,79,77],[77,-1,74,70,77,81,82,-1],
 [76,-1,73,74,81,-1,79,76],[73,-1,76,79,85,81,79,-1]];
function add(at,seconds,sound,gain,pan=0){
 const start=Math.round(at*rate),l=Math.sqrt((1-pan)/2),r=Math.sqrt((1+pan)/2),count=Math.round(seconds*rate);
 for(let i=0;i<count;i++){const t=i/rate,v=sound(t)*gain*Math.min(1,t/.012,(seconds-t)/.035),j=(start+i)%n;left[j]+=v*l;right[j]+=v*r;}
}
function note(midi,at,seconds,voice,gain,pan=0){
 const f=hz(midi);add(at,seconds,t=>{
  const phase=2*Math.PI*f*t,vibrato=Math.sin(t*31)*.012;
  if(voice==='strings')return (Math.sin(phase+vibrato)+.25*Math.sin(phase*2.002)+.13*Math.sin(phase*3)+.08*Math.sin(phase*4.003))*Math.min(1,t/.045)*Math.exp(-t*.6);
  if(voice==='horn')return (Math.sin(phase)+.42*Math.sin(phase*2)+.22*Math.sin(phase*3)+.07*Math.sin(phase*5))*Math.min(1,t/.035)*Math.min(1,(seconds-t)/.16);
  if(voice==='bell')return (Math.sin(phase)*Math.exp(-t*3)+.3*Math.sin(phase*2.76)*Math.exp(-t*9)+.14*Math.sin(phase*4.07)*Math.exp(-t*13));
  if(voice==='bass')return (Math.sin(phase)+.22*Math.sin(phase*2))*Math.exp(-t*4);
  return (Math.sin(phase)+.13*Math.sin(phase*2))*Math.min(1,t/.16)*Math.min(1,(seconds-t)/.28);
 },gain,pan);
}
for(let bar=0;bar<bars;bar++){
 const section=Math.floor(bar/8),bridge=section===3||section===4,c=chords[bar%8],at=bar*4*beat;
 const melody=(bridge?themeC:section===1||section===5||section===7?themeB:themeA)[bar%8],energy=[.86,1,.98,.72,.88,1.02,1.08,1.15][section];
 for(let i=0;i<8;i++){
  note(c[[0,2,1,2,0,2,1,2][i]]+12,at+i*beat/2,beat*.65,'strings',.065*energy,-.48);
  note(c[[2,1,2,0,2,1,2,0][i]]+12,at+i*beat/2+.012,beat*.62,'strings',.054*energy,.5);
 }
 for(let i=0;i<4;i++)note(c[i%2?2:0]-12,at+i*beat,beat*.8,'bass',.15,0);
 melody.forEach((m,i)=>{if(m>=0){note(m,at+i*beat/2,beat*(melody[i+1]===-1?.96:.48),bridge?'strings':'horn',.1*energy,-.08);if((section>=6||section===4)&&i%2===0)note(m+12,at+i*beat/2,beat*.6,'bell',.038,.4);}});
 for(const b of [0,2])c.forEach((m,i)=>note(m+12,at+b*beat+i*.008,beat*.55,'horn',.034*energy,(i-1)*.25));
 if(section%2===1||bridge)c.forEach((m,i)=>note(m+24,at,beat*3.7,'pad',.026,(i-1)*.65));
 if(bar%2===0)note(c[2]+24,at+3.5*beat,beat*1.3,'bell',.07,.55);
 // Timpani, a brushed snare with a body resonance, and a restrained shaker.
 for(const b of [0,2])add(at+b*beat,.7,t=>Math.sin(2*Math.PI*(53*t+9*(1-Math.exp(-t*30))/30))*Math.exp(-t*9),.22*energy);
 for(const b of [1,3]){let low=0;add(at+b*beat,.2,t=>{const noise=random()*2-1;low+=.18*(noise-low);return (noise-low)*Math.exp(-t*24)+Math.sin(2*Math.PI*181*t)*Math.exp(-t*36)*.3;},.075*energy,.16);}
 for(let i=0;i<8;i++){let low=0;add(at+i*beat/2,.055,t=>{const noise=random()*2-1;low+=.12*(noise-low);return (noise-low)*Math.exp(-t*68);},.025,i%2?.55:-.55);}
 if(bar%8===0){let low=0;add(at,1.6,t=>{const noise=random()*2-1;low+=.04*(noise-low);return (noise-low)*Math.exp(-t*3.5);},.065,.3);}
 if(bar%8===7)for(let i=0;i<4;i++)add(at+(3+i/4)*beat,.2,t=>Math.sin(2*Math.PI*(90-i*8)*t)*Math.exp(-t*24),.07);
}
const dryL=left.slice(),dryR=right.slice();
for(const [seconds,gain,cross] of [[.071,.12,true],[.113,.16,false],[.179,.12,true],[.257,.08,false],[.389,.05,true]]){
 const delay=Math.round(rate*seconds);let l=0,r=0;
 for(let i=0;i<n;i++){const j=(i-delay+n)%n;l+=(dryL[j]-l)*.32;r+=(dryR[j]-r)*.32;left[i]+=(cross?r:l)*gain;right[i]+=(cross?l:r)*gain;}
}
let peak=0;for(let i=0;i<n;i++){left[i]=Math.tanh(left[i]*1.3);right[i]=Math.tanh(right[i]*1.3);peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));}
const data=Buffer.alloc(n*4),gain=.78/peak;let energy=0;
for(let i=0;i<n;i++){const l=left[i]*gain,r=right[i]*gain;energy+=l*l+r*r;data.writeInt16LE(Math.round(l*32767),i*4);data.writeInt16LE(Math.round(r*32767),i*4+2);}
const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(data.length+36,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(2,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*4,28);h.writeUInt16LE(4,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(data.length,40);
const preview=path.resolve(__dirname,'../node_modules/.cache/meta-knight-original/meta-knight-duel.wav');
fs.mkdirSync(path.dirname(preview),{recursive:true});fs.writeFileSync(preview,Buffer.concat([h,data]));
console.log(JSON.stringify({title:'Galaxia — Knight of the Stars',bpm,bars,seconds:duration,bytes:data.length+44,peak:.78,rms:Math.sqrt(energy/n/2)}));
