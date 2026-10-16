import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {knightSound,KNIGHT_SOUND_RATE,type KnightSound} from '../src/meta-knight-sounds';

test('original duel score is a stereo 44.1 kHz seamless loop with headroom and audible musical energy',()=>{
 const wav=readFileSync(new URL('../public/audio/meta-knight-duel.wav',import.meta.url));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt16LE(22),2);assert.equal(wav.readUInt32LE(24),44100);
 const seconds=wav.readUInt32LE(40)/wav.readUInt32LE(28);assert(Math.abs(seconds-32*4*60/144)<.001);
 let peak=0,energy=0,difference=0;for(let i=44;i<wav.length;i+=4){const l=wav.readInt16LE(i)/32768,r=wav.readInt16LE(i+2)/32768;peak=Math.max(peak,Math.abs(l),Math.abs(r));energy+=l*l+r*r;difference+=(l-r)**2;}
 const frames=(wav.length-44)/4;assert(peak>.7&&peak<.81);assert(Math.sqrt(energy/frames/2)>.08);assert(difference/frames>.0001);
 for(const offset of [0,2])assert(Math.abs(wav.readInt16LE(44+offset)-wav.readInt16LE(wav.length-4+offset))<3000,'loop boundary has no hard click');
});
test('duel sound palette has distinct stereo layers, gentle boundaries and no clipping',()=>{
 const kinds:KnightSound[]=['warn','slash','dash','slam','shot','reflect','hit','hurt','phase','win'],fingerprints=new Set<string>();
 for(const kind of kinds){const {left,right}=knightSound(kind);assert.equal(left.length,right.length);assert(left.length>=KNIGHT_SOUND_RATE*.5);assert.equal(Math.abs(left[0]),0);assert.equal(Math.abs(right[right.length-1]),0);
  let energy=0,stereo=0;for(let i=0;i<left.length;i++){assert(Number.isFinite(left[i])&&Number.isFinite(right[i]));assert(Math.abs(left[i])<=.681&&Math.abs(right[i])<=.681);energy+=left[i]**2+right[i]**2;stereo+=(left[i]-right[i])**2;}
  assert(energy/left.length>.0001,kind+' is audible');assert(stereo>0,kind+' is stereo');fingerprints.add(left.length+':'+energy.toFixed(5));
 }assert.equal(fingerprints.size,kinds.length);
});
