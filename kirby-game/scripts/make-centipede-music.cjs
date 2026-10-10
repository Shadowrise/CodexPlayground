const fs=require('node:fs'),path=require('node:path');
// Original playful C-major chase: pizzicato, marimba, piccolo, bass and soft brushes.
// Wrapped instrument tails make the 32-bar arrangement seamless when looped.
const rate=22050,bpm=112,beat=60/bpm,duration=32*4*beat,length=Math.round(rate*duration);
const left=new Float32Array(length),right=new Float32Array(length),hz=n=>440*2**((n-69)/12);
const chords=[[60,64,67],[65,69,72],[57,60,64],[55,59,62],[60,64,67],[62,65,69],[55,59,62],[60,64,67]];
const motifs=[[0,1,2,1,0,-1,1,2],[2,-1,1,0,1,2,1,-1],[0,2,1,-1,2,1,0,-1],[1,0,2,1,-1,0,1,-1]];
let seed=1729;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function mix(at,seconds,fn,volume,pan=0){const start=Math.round(at*rate),l=Math.sqrt((1-pan)/2),r=Math.sqrt((1+pan)/2);for(let i=0;i<seconds*rate;i++){const t=i/rate,v=fn(t)*volume*Math.min(1,t/.015,(seconds-t)/.025),p=(start+i)%length;left[p]+=v*l;right[p]+=v*r;}}
function note(midi,at,seconds,kind,volume,pan=0){const f=hz(midi);mix(at,seconds,t=>{
 const s=Math.sin(2*Math.PI*f*t);
 if(kind==='piccolo')return (s+.1*Math.sin(4*Math.PI*f*t))*Math.min(1,t/.06)*Math.min(1,(seconds-t)/.09);
 if(kind==='marimba')return (s+.18*Math.sin(2*Math.PI*f*4*t)*Math.exp(-t*14))*Math.exp(-t*7);
 if(kind==='bass')return (s+.12*Math.sin(4*Math.PI*f*t))*Math.exp(-t*5);
 return (s+.22*Math.sin(4*Math.PI*f*t)+.08*Math.sin(6*Math.PI*f*t))*Math.exp(-t*10);
 },volume,pan);}
for(let bar=0;bar<32;bar++){
 const c=chords[bar%8],at=bar*4*beat,section=Math.floor(bar/8),pattern=motifs[(bar+section)%4];
 note(c[0]-24,at,beat*.9,'bass',.075);note(c[2]-24,at+2*beat,beat*.85,'bass',.06);
 for(const b of [1,3])c.forEach((n,i)=>note(n,at+b*beat+i*.012,beat*.48,'pizzicato',.037,(i-1)*.3));
 pattern.forEach((n,i)=>{if(n>=0)note(c[n]+12,at+i*beat/2,beat*.6,'marimba',.11,-.2);});
 if(section===1||section===3){for(const [i,n] of [[0,c[0]+24],[2,c[2]+12],[3,c[1]+12]])note(n,at+i*beat,beat*.8,'piccolo',.042,.28);}
 // Discrete, lightly brushed percussion; no bright snare or abrasive hi-hat.
 for(let b=0;b<4;b++)mix(at+b*beat,.09,t=>(random()*2-1)*Math.exp(-t*48),.022,.2);
}
let peak=0;for(let i=0;i<length;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
const data=Buffer.alloc(length*4),gain=.62/peak;
for(let i=0;i<length;i++){data.writeInt16LE(Math.round(left[i]*gain*32767),i*4);data.writeInt16LE(Math.round(right[i]*gain*32767),i*4+2);}
const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(36+data.length,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(2,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*4,28);h.writeUInt16LE(4,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(data.length,40);
fs.writeFileSync(path.resolve(__dirname,'../public/audio/topotushka-play.wav'),Buffer.concat([h,data]));
console.log(JSON.stringify({seconds:duration,bytes:data.length+44,peak:.62}));
