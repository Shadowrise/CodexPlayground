import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WaterSoundEvents,waterSamples,type WaterSound} from '../src/water-sounds';
test('water entry and exit sound once, paddling repeats and rest is quieter and less frequent',()=>{
 const events=new WaterSoundEvents();assert.equal(events.update(.1,false,false),undefined);
 assert.equal(events.update(.1,true,true),'enter');assert.equal(events.update(.1,true,true),undefined);
 assert.equal(events.update(.6,true,true),'paddle');assert.equal(events.update(.56,true,false),'float');
 assert.equal(events.update(.8,true,false),undefined);assert.equal(events.update(.4,false,false),'exit');
 assert.equal(events.update(2,false,true),undefined);
});
test('rides and other activities suppress false exits and rapid shoreline jitter is bounded',()=>{
 const events=new WaterSoundEvents();assert.equal(events.update(.1,true,false),'enter');
 assert.equal(events.update(.01,false,false),undefined);assert.equal(events.update(.01,true,false),undefined);
 assert.equal(events.update(1,false,false,false),undefined);assert.equal(events.update(1,false,false),undefined);
 assert.equal(events.update(.1,true,true),'enter');
});
test('water waveforms are finite, bounded, varied and fade at their ends',()=>{
 const waves=(['enter','exit','paddle','float'] as WaterSound[]).map(kind=>waterSamples(kind));
 for(const samples of waves){assert(samples.every(n=>Number.isFinite(n)&&Math.abs(n)<1));assert.equal(Math.abs(samples[0]),0);assert(Math.abs(samples[samples.length-1])<.001);assert(samples.some(n=>Math.abs(n)>.05));}
 assert.notDeepEqual(waves[0],waves[1]);assert.notDeepEqual(waves[1],waves[2]);
});
