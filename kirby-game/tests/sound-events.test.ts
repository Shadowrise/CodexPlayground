import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SoundEvents, type SoundActor } from '../src/sound-events';
const actor = (id: string): SoundActor => ({ id, state: 'Idle', down: false, size: 1, x: 0, z: 0 });

test('smooth player growth sounds once per swallowed fruit',()=>{
  const events=new SoundEvents(),player={...actor('player'),player:true,fruitsEaten:0};
  events.update(.016,[player],player);player.fruitsEaten=1;
  let count=0;
  for(let i=0;i<30;i++){
    player.size=1+i/290;
    count+=events.update(1/60,[player],player).filter(e=>e.kind==='grow').length;
  }
  assert.equal(count,1);
});

test('steps follow actual travel, sprint cadence, grounded states and nearby NPC limits', () => {
  const count = (speed: number, state = 'Run', down = false) => {
    const events = new SoundEvents(() => 0), player = { ...actor('player'), player: true, state, down };
    let steps = 0;
    for (let i=0;i<240;i++) {
      player.z += speed / 60;
      steps += events.update(1/60,[player],player).filter(e=>e.kind==='step').length;
    }
    return steps;
  };
  assert(count(3.4)>10);
  assert(count(6.8)>count(3.4));
  assert.equal(count(0),0);
  assert.equal(count(3.4,'Jump'),0);
  assert.equal(count(3.4,'Run',true),0);
  const events=new SoundEvents(() => 0);
  const npcs=Array.from({length:14},(_,i)=>({...actor(String(i)),state:'Walk',x:i===0?100:0}));
  let total=0;
  for(let i=0;i<240;i++) {
    for(const npc of npcs) npc.z+=.04;
    const steps=events.update(1/60,npcs,{x:0,z:0}).filter(e=>e.kind==='step');
    assert(steps.length<=1);
    assert(steps.every(e=>e.actor.id!=='0'));
    total+=steps.length;
  }
  assert(total>0 && total<=14);
});

test('sound effects fire once for action, growth, death and revival transitions', () => {
  const events = new SoundEvents(() => 0), player = { ...actor('player'), player: true }, npc = actor('npc');
  const update = () => events.update(.016, [player, npc], player).map(e => e.kind);
  assert.deepEqual(update(), []);
  player.state = 'Jump'; assert.deepEqual(update(), ['jump']); assert.deepEqual(update(), []);
  player.state = 'Attack'; assert.deepEqual(update(), ['attack']); assert.deepEqual(update(), []);
  player.size = 1.1; assert.deepEqual(update(), ['grow']); assert.deepEqual(update(), []);
  npc.down = true; npc.state = 'Death'; assert.deepEqual(update(), ['death']); assert.deepEqual(update(), []);
  npc.down = false; npc.state = 'Walk'; assert.deepEqual(update(), ['revive']); assert.deepEqual(update(), []);
});
test('ambient voices have global spacing, per-NPC cooldown, and exclude distant or downed NPCs', () => {
  const events = new SoundEvents(() => 0), actors = Array.from({ length: 14 }, (_, i) => actor(String(i)));
  actors[0].down = true; actors[1].x = 100;
  let last = -100; const byNpc = new Map<string, number>(); let count = 0;
  for (let t = 0; t < 180; t++) {
    for (const event of events.update(1, actors, { x: 0, z: 0 })) {
      if (event.kind !== 'voice') continue;
      assert(t - last >= 9); last = t;
      assert(t - (byNpc.get(event.actor.id) ?? -100) > 45);
      assert(!event.actor.down); assert.notEqual(event.actor.id, '1');
      byNpc.set(event.actor.id, t); count++;
    }
  }
  assert(count > 0 && count <= 20);
});
