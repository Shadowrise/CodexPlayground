import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gravityChargeRadius,gravityChargeVolume,gravityCrackleLoop} from '../src/meta-knight-gravity-charge-state';
import {COSMIC_REFUGE as R} from '../src/meta-knight-cosmic-refuge';

test('crackle grows with the actual sphere, survives late snapshots and clears outside the charge',()=>{
 const state={phase:4,stage:'cosmic-star-draw',since:1000000,until:1000000+R.drawMs,cosmicRefuge:{at:1000000}};let previousRadius=0,previousVolume=0;
 for(const [stage,at,duration] of [['cosmic-star-draw',0,R.drawMs],['cosmic-star-open',R.drawMs,R.openMs],['cosmic-planet-draw',R.drawMs+R.openMs,R.pullMs],['cosmic-planet-sweep',R.drawMs+R.openMs+R.pullMs,R.sweepMs]] as const){
  Object.assign(state,{stage,since:state.cosmicRefuge.at+at,until:state.cosmicRefuge.at+at+duration});
  for(let i=0;i<=40;i++){
   const now=state.since+duration*i/40,radius=gravityChargeRadius(state,now),volume=gravityChargeVolume(state,now);
   assert(radius>=previousRadius-1e-10&&volume>=previousVolume-1e-10);assert(volume>=.06&&volume<=.7);assert.equal(gravityChargeVolume(structuredClone(state),now),volume);previousRadius=radius;previousVolume=volume;
  }
 }
 assert(previousVolume>.69);state.stage='cosmic-star-strike';assert.equal(gravityChargeVolume(state,state.until),0);assert.equal(gravityChargeVolume(undefined,0),0);
 state.stage='cosmic-star-open';state.phase=1;assert.equal(gravityChargeVolume(state,state.since),0);
});

test('the continuous crackle reuses both ascent channels and crossfades its loop seam',async()=>{
 const wav=await readFile(new URL('../public/audio/meta-knight-cosmic/cosmic-ascent.wav',import.meta.url)),rate=wav.readUInt32LE(24),frames=wav.readUInt32LE(40)/4;
 const loops:Float32Array[]=[];for(let channel=0;channel<2;channel++){
  const source=new Float32Array(frames);for(let i=0;i<frames;i++)source[i]=wav.readInt16LE(44+i*4+channel*2)/32768;
  const loop=gravityCrackleLoop(source,rate),start=Math.round(rate*.65),fade=Math.round(rate*.12);assert(loop.length>rate*4&&loop.length<rate*4.3);
  for(let i=fade;i<loop.length;i++)assert.equal(loop[i],source[start+i],'the existing recording remains unchanged outside the overlap');
  assert.equal(loop[0],source[start+loop.length]);assert.equal(loop[loop.length-1],source[start+loop.length-1]);assert(loop.every(Number.isFinite));loops.push(loop);
 }
 assert(loops[0].some((sample,i)=>sample!==loops[1][i]),'the ascent recording retains its stereo detail');
});
