const fs = require('node:fs');
const path = require('node:path');
// Seven original arrangements, each with three evolving 16-bar sections.
const tracks = [
  ['meadow-day', 100, 0, 391], ['citrus-walk', 108, 2, 721],
  ['mint-breeze', 92, -2, 1193], ['berry-dance', 114, 5, 2027],
  ['cloud-picnic', 96, -5, 3319], ['sunny-path', 104, 3, 4517],
  ['firefly-waltz', 90, -3, 6121],
];
for (const [trackIndex, [name, bpm, transpose, initialSeed]] of tracks.entries()) {
const rate = 22050, beat = 60 / bpm, bars = 48, duration = bars * 4 * beat;
const length = Math.round(rate * duration);
const left = new Float32Array(length), right = new Float32Array(length);
let seed = initialSeed;
const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
function mix(start, seconds, sample, volume, pan=0, echo=false) {
  const offset = Math.round(start * rate), count = Math.ceil(seconds * rate);
  const l = Math.sqrt((1-pan)/2), r = Math.sqrt((1+pan)/2);
  for(let i=0;i<count;i++) {
    const t=i/rate, v=sample(t,seconds)*volume, p=(offset+i)%length;
    left[p]+=v*l; right[p]+=v*r;
    if(echo) {
      const a=(p+Math.round(.3*rate))%length,b=(p+Math.round(.6*rate))%length;
      left[a]+=v*.15*r;right[a]+=v*.15*l;left[b]+=v*.065*l;right[b]+=v*.065*r;
    }
  }
}
function pluck(midi, when, velocity=.16, pan=0) {
  const f=hz(midi);
  mix(when,1.7,(t,d)=> (1-Math.exp(-t*240))*Math.exp(-t*4.7)*Math.min(1,(d-t)*20)*
    (Math.sin(2*Math.PI*f*t)+.28*Math.exp(-t*7)*Math.sin(2*Math.PI*f*2*t)+.10*Math.exp(-t*10)*Math.sin(2*Math.PI*f*3*t)),velocity,pan,true);
}
function flute(midi, when, seconds, volume, pan) {
  const f = hz(midi);
  mix(when, seconds, (t,d) => Math.min(1,t/.065)*Math.min(1,(d-t)/.16)*
    (Math.sin(2*Math.PI*f*t + .035*Math.sin(t*32)) + .12*Math.sin(4*Math.PI*f*t)), volume, pan, true);
}
function marimba(midi, when, volume, pan) {
  const f = hz(midi);
  mix(when,.75,(t,d)=>(1-Math.exp(-t*350))*Math.exp(-t*7)*Math.min(1,(d-t)*30)*
    (Math.sin(2*Math.PI*f*t)+.22*Math.exp(-t*15)*Math.sin(2*Math.PI*f*4*t)),volume,pan,true);
}
const chords = [[50,57,62,66],[45,57,61,64],[47,54,59,62],[43,55,59,62],[40,55,59,64],[45,57,61,64],[43,55,59,62],[45,55,61,64]];
const melody = [
 [74,0,78,81,78,76,74,0], [73,76,81,0,76,73,71,0],
 [71,74,78,0,81,78,74,71], [74,0,79,78,76,74,71,0],
 [76,0,79,83,81,79,76,0], [73,76,81,0,83,81,76,73],
 [74,79,78,76,74,71,74,0], [73,0,76,0,69,73,76,0],
 [78,0,81,86,81,78,76,74], [76,73,69,0,73,76,81,0],
 [78,81,83,81,78,74,71,0], [79,0,78,76,74,71,74,0],
 [76,79,83,0,81,79,76,74], [73,76,81,83,81,76,73,0],
 [74,78,79,0,78,76,74,71], [73,0,76,0,81,76,73,0],
];
for(let bar=0;bar<bars;bar++) {
  const section = Math.floor(bar / 16);
  const chordIndex = trackIndex === 0 ? bar % 8 : (bar + [0, 3, 6, 2, 4, 1, 5][trackIndex] + section * 2) % 8;
  const start=bar*4*beat,c=chords[chordIndex].map(n => n + transpose);
  for(const [j,midi] of c.slice(1).entries()) {
    const f=hz(midi);
    mix(start,4*beat+.22,(t,d)=>Math.min(1,t/.15)*Math.min(1,(d-t)/.4)*(.75*Math.sin(2*Math.PI*f*t)+.2*Math.sin(2*Math.PI*(f*1.0015)*t)),.027,(j-1)*.45);
  }
  // Airy strings, softly strummed guitar, marimba and a flute countermelody
  // enter in different sections, so the longer form is not a repeated loop.
  if (section !== 0 || trackIndex % 2 === 1) {
    for (const [j, midi] of c.slice(1).entries()) {
      const f=hz(midi+12);
      mix(start,beat*4+.3,(t,d)=>Math.min(1,t/.4)*Math.min(1,(d-t)/.6)*
        (Math.sin(2*Math.PI*f*t)+.25*Math.sin(2*Math.PI*f*2.002*t)+.1*Math.sin(2*Math.PI*f*3*t)),.014,(j-1)*.65);
    }
  }
  for (const b of [0, 2]) for (let j=1;j<4;j++) pluck(c[j],start+b*beat+j*.022,.033,-.6);
  if (section > 0) {
    flute(c[2]+12,start+beat*.25,beat*1.35,.034,.3);
    flute(c[section === 2 ? 3 : 1]+12,start+beat*2.5,beat*1.25,.032,.3);
  }
  for(let b=0;b<4;b++) {
    const f=hz(c[0]+(b===2?7:0));
    if(b%2===0) mix(start+b*beat,.46,(t,d)=>(1-Math.exp(-t*110))*Math.exp(-t*6)*Math.min(1,(d-t)*25)*Math.sin(2*Math.PI*f*t),.12,-.08);
    // A quiet, rounded kick and brush-like offbeat shaker.
    if(b===0||b===2) mix(start+b*beat,.16,(t,d)=>Math.sin(2*Math.PI*(52*t+18*.025*(1-Math.exp(-t/.025))))*Math.exp(-t*28)*Math.min(1,t*450)*Math.min(1,(d-t)*80),.075);
    mix(start+(b+.5)*beat,.085,(t,d)=>(random()*2-1)*Math.exp(-t*52)*Math.min(1,t*900)*Math.min(1,(d-t)*80),.021,.35);
    if (b % 2 === 1) mix(start+b*beat,.12,(t,d)=>(random()*2-1)*Math.exp(-t*35)*Math.min(1,t*600)*Math.min(1,(d-t)*60),.023,-.25);
    if (section === 2 && b === 3) marimba(c[3]+12,start+(b+.75)*beat,.045,.65);
  }
  for(let n=0;n<8;n++) {
    const when=start+n*beat/2;
    let note = melody[bar % 16][n];
    if (trackIndex > 0) {
      const motifs = [[0,2,1,3,2,1,3,2],[2,1,0,2,3,2,1,3],[3,2,1,0,1,3,2,1],
        [1,3,2,1,0,2,3,2],[0,1,3,2,1,2,0,3],[2,3,1,2,0,1,2,3]];
      note = (n + bar + trackIndex) % 5 === 0 ? 0 : c[motifs[trackIndex-1][(n+section*2+bar%2)%8]] + 12;
    } else if (note) note += transpose;
    if (note) {
      if (section === 1 || trackIndex === 2 || trackIndex === 4) flute(note,when,beat*.55,.065,-.15);
      else pluck(note,when,.105+(n%2===0?.015:0),-.15);
    }
    if(n%2===1) pluck(c[1+(Math.floor(n/2)%3)]+12,when,.045,.45);
    if (n % 2 === (trackIndex % 2)) marimba(c[1+(n+bar)%3],when,.045,.6);
  }
}
// Soft saturation, DC removal and conservative normalization. Tails wrap into
// the beginning, so the WAV loops without a silent gap or chopped-off reverb.
let meanL=0,meanR=0;for(let i=0;i<length;i++){meanL+=left[i];meanR+=right[i];}meanL/=length;meanR/=length;
let peak=0;for(let i=0;i<length;i++){left[i]=Math.tanh((left[i]-meanL)*1.2);right[i]=Math.tanh((right[i]-meanR)*1.2);peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));}
const gain=.68/peak, data=Buffer.alloc(length*4);let energy=0;
for(let i=0;i<length;i++){const l=left[i]*gain,r=right[i]*gain;energy+=(l*l+r*r)/2;data.writeInt16LE(Math.round(l*32767),i*4);data.writeInt16LE(Math.round(r*32767),i*4+2);}
const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+data.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(2,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*4,28);header.writeUInt16LE(4,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(data.length,40);
const out=path.resolve(__dirname,`../public/audio/${name}.wav`);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,Buffer.concat([header,data]));
console.log(JSON.stringify({file:out,seconds:duration,bpm,peak:.68,rms:Math.sqrt(energy/length),loopBoundaryDelta:Math.max(Math.abs(left[0]-left[length-1]),Math.abs(right[0]-right[length-1]))*gain}));
}
