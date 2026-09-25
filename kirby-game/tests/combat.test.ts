import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Mesh, MeshStandardMaterial, Quaternion } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterController } from '../src/controller';
import { createNpcs } from '../src/npcs';
import { resolveAttack } from '../src/combat';
const idle = { forward: false, left: false, right: false };
async function setup() {
  const bytes = await readFile(new URL('../public/models/kirby-animated.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const npcs = createNpcs(gltf.scene, gltf.animations);
  return { player: new CharacterController(gltf.scene, gltf.animations), npcs };
}
test('one click yields one timed hit; attack cannot restart mid-swing or while held', async () => {
  const { player, npcs } = await setup();
  const npc = npcs[0]; npc.actor.position.set(0, 0, 2.4);
  let hits = 0;
  for (let i = 0; i < 180; i++) {
    player.update(1 / 60, { ...idle, attack: true, forward: true });
    if (i < 14) assert.equal(npc.health, 3);
    if (resolveAttack(player, [npc])) hits++;
    assert.equal(resolveAttack(player, [npc]), undefined, 'Hit event is consumed');
  }
  assert.equal(hits, 1); assert.equal(npc.health, 2);
  assert.equal(player.state, 'Run');
});
test('range, facing and nearest-target checks prevent hitting bystanders', async () => {
  const { player, npcs } = await setup();
  const [front, behind, far, side] = npcs;
  front.actor.position.set(0, 0, 2.4); behind.actor.position.set(0, 0, -2);
  far.actor.position.set(0, 0, 4); side.actor.position.set(2.5, 0, 0);
  player.attackHit = true;
  assert.equal(resolveAttack(player, [behind, far, side, front]), front);
  assert.deepEqual([front.health, behind.health, far.health, side.health], [2, 3, 3, 3]);
});
test('three flashes cause death, ten seconds lying down, then full health and walking', async () => {
  const { npcs } = await setup();
  const npc = npcs[0];
  let skin: MeshStandardMaterial | undefined;
  npc.model.traverse(o => { if (o instanceof Mesh && o.name.startsWith('Body')) skin = o.material as MeshStandardMaterial; });
  const original = skin!.color.clone();
  for (let i = 0; i < 3; i++) {
    assert(npc.takeHit());
    assert.equal(npc.health, 2 - i);
    assert.equal(skin!.color.getHexString(), 'ff1824');
    if (i < 2) { npc.update(.3, []); assert(skin!.color.equals(original)); }
  }
  assert.equal(npc.state, 'Death');
  assert(npc.isDown);
  const position = npc.actor.position.clone();
  const fall = npc.actions.get('Death')!.getClip().duration;
  npc.update(fall, []);
  const root = npc.model.children[0];
  const fallenRotation = root.quaternion.clone();
  assert(fallenRotation.angleTo(new Quaternion()) > 1.4);
  assert(skin!.color.equals(original));
  npc.update(9.9, []);
  assert(npc.isDown);
  assert(root.quaternion.clone().normalize().angleTo(fallenRotation.clone().normalize()) < 1e-6);
  assert(npc.actor.position.equals(position));
  assert.equal(npc.takeHit(), false, 'Hits on downed NPCs do not extend the timeout');
  npc.update(.11, []);
  assert.equal(npc.health, 3); assert.equal(npc.state, 'Walk');
  npc.update(.3, []);
  assert(npc.actor.position.distanceTo(position) > .1);
  assert(root.quaternion.angleTo(new Quaternion()) < 1e-6);
});

test('attack animation and hit timing run at twice the original speed',async()=>{
 const {player}=await setup();let time=0,hitTime=0;do{player.update(.01,{...idle,attack:true});time+=.01;if(player.attackHit)hitTime=time;}while(player.state==='Attack'&&time<4);
 assert(Math.abs(hitTime-.24)<.02);assert(Math.abs(time-player.actions.get('Attack')!.getClip().duration/2)<.02);
});
test('one hit knocks a firefly passenger down with a visible fall and normal revival',async()=>{
 const {player,npcs}=await setup(),n=npcs[0];n.beginFirefly(0);n.actor.position.set(0,6,2);player.attackHit=true;assert.equal(resolveAttack(player,[n]),n);assert.equal(n.health,0);assert.equal(n.state,'Death');assert.equal(n.fireflyIndex,undefined);assert.equal(n.actor.position.y,6);
 n.update(.1,[]);assert(n.actor.position.y>0&&n.actor.position.y<6);for(let i=0;i<20;i++)n.update(.05,[]);assert.equal(n.actor.position.y,0);assert(n.isDown);
 for(let i=0;i<300&&n.isDown;i++)n.update(.05,[]);assert.equal(n.health,3);assert.equal(n.state,'Walk');
});
test('an approaching NPC still requires normal three-hit combat',async()=>{const {npcs}=await setup(),n=npcs[0];n.beginFireflyApproach(0);assert(n.takeHit());assert.equal(n.health,2);assert.equal(n.fireflyIndex,undefined);});
