import {test} from 'node:test';import assert from 'node:assert/strict';import {cyclePhase,daylight,DAY_CYCLE_MS} from '../src/day-cycle';
test('full day lasts ten minutes and joining late preserves room phase',()=>{const start=.137,epoch=123000;assert(Math.abs(cyclePhase(start,epoch,epoch+DAY_CYCLE_MS)-start)<1e-9);assert(Math.abs(cyclePhase(start,epoch,epoch+300000)-.637)<1e-9);assert.equal(cyclePhase(start,epoch,epoch+137000),cyclePhase(start,epoch,epoch+137000));});
test('day, night and twilight blend continuously across sunrise sunset and loop boundary',()=>{assert.equal(daylight(.25).day,1);assert.equal(daylight(.75).night,1);assert.equal(daylight(0).label,'Рассвет');assert.equal(daylight(.5).label,'Закат');for(const p of [0,.5,1]){const a=daylight(p-1e-6),b=daylight(p+1e-6);assert(Math.abs(a.day-b.day)<.001);assert(Math.abs(a.twilight-b.twilight)<.001);}});

test('shadow rays match the visible sun or moon throughout the cycle',()=>{
 for(const phase of [.05,.125,.25,.4,.55,.625,.75,.9]){const t=daylight(phase),source=t.sunDirection.map(v=>v*(t.elevation>=0?1:-1));assert(Math.abs(Math.hypot(...t.shadowDirection)-1)<1e-9);assert(t.shadowDirection[1]<0);assert(Math.abs(source.reduce((sum,v,i)=>sum+v*t.shadowDirection[i],0)+1)<1e-9);assert(t.shadowStrength>0);}
 for(const phase of [0,.5,1]){assert.equal(daylight(phase).shadowStrength,0);assert(Math.abs(daylight(phase-1e-6).shadowStrength-daylight(phase+1e-6).shadowStrength)<1e-9);}
});
