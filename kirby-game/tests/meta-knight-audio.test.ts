import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {knightSound,KNIGHT_SOUND_RATE,type KnightSound} from '../src/meta-knight-sounds';

test('original duel score is a stereo 44.1 kHz seamless loop with headroom and audible musical energy',()=>{
 const wav=readFileSync(new URL('../public/audio/meta-knight-duel.wav',import.meta.url));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt16LE(22),2);assert.equal(wav.readUInt32LE(24),44100);
 const seconds=wav.readUInt32LE(40)/wav.readUInt32LE(28);assert(seconds>=90&&seconds<=120);assert(Math.abs(seconds-64*4*60/144)<.001);
 let peak=0,energy=0,difference=0;for(let i=44;i<wav.length;i+=4){const l=wav.readInt16LE(i)/32768,r=wav.readInt16LE(i+2)/32768;peak=Math.max(peak,Math.abs(l),Math.abs(r));energy+=l*l+r*r;difference+=(l-r)**2;}
 const frames=(wav.length-44)/4;assert(peak>.7&&peak<.81);assert(Math.sqrt(energy/frames/2)>.08);assert(difference/frames>.0001);
 for(const offset of [0,2])assert(Math.abs(wav.readInt16LE(44+offset)-wav.readInt16LE(wav.length-4+offset))<3000,'loop boundary has no hard click');
});
test('duel sound palette has distinct stereo layers, gentle boundaries and no clipping',()=>{
 const kinds:KnightSound[]=['count','start','warn','slash','dash','thrust','slam','shot','reflect','hit','hurt','phase','win','crystal','constellation','shield','wave','shatter'],fingerprints=new Set<string>();
 for(const kind of kinds){const {left,right}=knightSound(kind);assert.equal(left.length,right.length);assert(left.length>=KNIGHT_SOUND_RATE*(kind==='count'?.2:.5));assert.equal(Math.abs(left[0]),0);assert.equal(Math.abs(right[right.length-1]),0);
  let energy=0,stereo=0;for(let i=0;i<left.length;i++){assert(Number.isFinite(left[i])&&Number.isFinite(right[i]));assert(Math.abs(left[i])<=.681&&Math.abs(right[i])<=.681);energy+=left[i]**2+right[i]**2;stereo+=(left[i]-right[i])**2;}
  assert(energy/left.length>.0001,kind+' is audible');assert(stereo>0,kind+' is stereo');fingerprints.add(left.length+':'+energy.toFixed(5));
 }assert.equal(fingerprints.size,kinds.length);
});

test('crescent launch is an airy sweep while health loss has an immediate bass impact',()=>{
 const character=(kind:KnightSound)=>{
  const {left,right}=knightSound(kind);let bass=0,total=0,low=0,peak=0,peakAt=0;
  const smoothing=1-Math.exp(-2*Math.PI*350/KNIGHT_SOUND_RATE);
  for(let i=0;i<KNIGHT_SOUND_RATE*.3;i++){
   const sample=(left[i]+right[i])*.5;low+=(sample-low)*smoothing;bass+=low*low;total+=sample*sample;
   if(Math.abs(sample)>peak){peak=Math.abs(sample);peakAt=i/KNIGHT_SOUND_RATE;}
  }
  return {bass:bass/total,peakAt};
 };
 const launch=character('shot'),damage=character('hit');
 assert(damage.bass>launch.bass*3,'damage must sound substantially deeper than a launched crescent');
 assert(damage.peakAt<.05,'HP loss has an immediate impact');
 assert(launch.peakAt>.08,'the launched crescent swells into a swish');
});
