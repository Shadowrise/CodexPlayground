const fs=require('node:fs'),path=require('node:path');
// Original C-major friendship fanfare: warm brass, bells, plucked chords and bass.
const rate=22050,seconds=10,beat=60/112,length=rate*seconds,left=new Float32Array(length),right=new Float32Array(length),hz=n=>440*2**((n-69)/12);
function note(midi,at,duration,kind,volume,pan=0){
 const f=hz(midi),start=Math.round(at*rate),l=Math.sqrt((1-pan)/2),r=Math.sqrt((1+pan)/2);
 for(let i=0;i<duration*rate&&start+i<length;i++){
  const t=i/rate,edge=Math.min(1,t/.025,(duration-t)/.1),s=Math.sin(2*Math.PI*f*t);
  const tone=kind==='brass'?(s+.14*Math.sin(4*Math.PI*f*t)+.055*Math.sin(6*Math.PI*f*t))*(.8+.2*Math.exp(-t*3)):
   kind==='bell'?(s+.12*Math.sin(2*Math.PI*f*3*t))*Math.exp(-t*4.5):(s+.12*Math.sin(4*Math.PI*f*t))*Math.exp(-t*5);
  const v=tone*volume*Math.max(0,edge);left[start+i]+=v*l;right[start+i]+=v*r;
 }
}
const bars=[{chord:[60,64,67],melody:[[0,72,.45],[.5,76,.45],[1,79,.85],[2,84,.85],[3,79,.8]]},
 {chord:[65,69,72],melody:[[0,81,.8],[1,79,.45],[1.5,77,.45],[2,81,.85],[3,84,.8]]},
 {chord:[55,59,62],melody:[[0,79,.45],[.5,83,.45],[1,86,.8],[2,83,.8],[3,79,.8]]},
 {chord:[60,64,67],melody:[[0,76,.45],[.5,79,.45],[1,84,2.4]]}];
for(let bar=0;bar<4;bar++){
 const {chord,melody}=bars[bar],at=bar*4*beat;
 for(const [b,midi,d] of melody){note(midi,at+b*beat,d*beat,'brass',.095,-.12);note(midi+12,at+b*beat+.025,.85,'bell',.022,.3);}
 for(const b of [0,2]){note(chord[0]-12,at+b*beat,beat*.9,'bass',.07);chord.forEach((n,i)=>note(n,at+b*beat+i*.018,1.1,'pluck',.027,(i-1)*.25));}
}
// A held tonic resolves the melody and a quiet stereo echo lets it settle.
for(const [i,midi] of [60,64,67,72].entries())note(midi,7.1+i*.025,2.6,'brass',.019,(i-1.5)*.12);
const delayLeft=Math.round(rate*.17),delayRight=Math.round(rate*.23);
for(let i=length-1;i>=delayLeft;i--){left[i]+=right[i-delayLeft]*.13;if(i>=delayRight)right[i]+=left[i-delayRight]*.1;}
let peak=0;for(let i=0;i<length;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
const data=Buffer.alloc(length*4),gain=.58/peak;
for(let i=0;i<length;i++){const fade=Math.min(1,i/(rate*.02),(length-1-i)/(rate*.25));data.writeInt16LE(Math.round(left[i]*gain*fade*32767),i*4);data.writeInt16LE(Math.round(right[i]*gain*fade*32767),i*4+2);}
const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(36+data.length,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(2,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*4,28);h.writeUInt16LE(4,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(data.length,40);
fs.writeFileSync(path.resolve(__dirname,'../public/audio/topotushka-victory.wav'),Buffer.concat([h,data]));console.log(JSON.stringify({seconds,bytes:data.length+44,peak:.58}));
