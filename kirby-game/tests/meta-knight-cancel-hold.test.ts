import test from 'node:test';
import assert from 'node:assert/strict';
import {KnightCancelHold} from '../src/meta-knight-cancel-hold';

test('a full two-second hold confirms once; short presses never add together',()=>{
 const h=new KnightCancelHold();h.update(1,undefined,0);
 for(let tap=0;tap<4;tap++){for(let i=0;i<19;i++)assert(!h.update(1,'keyboard',.05));h.update(1,undefined,.05);assert.equal(h.progress,0);}
 for(let i=0;i<39;i++)assert(!h.update(1,'keyboard',.05));assert(h.progress<1);assert(h.update(1,'keyboard',.05));for(let i=0;i<100;i++)assert(!h.update(1,'keyboard',.05));
});
test('pause, a new duel, and changing input devices reset the hold and require release',()=>{
 const h=new KnightCancelHold();h.update(1,undefined,0);for(let i=0;i<30;i++)h.update(1,'keyboard',.05);h.update(undefined,undefined,0);assert.equal(h.progress,0);
 for(let i=0;i<60;i++)assert(!h.update(1,'keyboard',.05));h.update(1,undefined,0);for(let i=0;i<20;i++)h.update(1,'keyboard',.05);for(let i=0;i<20;i++)assert(!h.update(1,'gamepad',.05));assert(h.progress<.6);
 for(let i=0;i<60;i++)assert(!h.update(2,'gamepad',.05));h.update(2,undefined,0);for(let i=0;i<39;i++)assert(!h.update(2,'touch',.05));assert(h.update(2,'touch',.05));
});
test('an old held start button or stalled frame cannot instantly cancel a duel',()=>{
 const h=new KnightCancelHold();for(let i=0;i<60;i++)assert(!h.update(1,'gamepad',.05));h.update(1,undefined,0);assert(!h.update(1,'keyboard',10));assert(h.progress<=.05);h.reset();assert.equal(h.progress,0);
});
