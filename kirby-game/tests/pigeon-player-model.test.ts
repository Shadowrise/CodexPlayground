import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group, Mesh, Scene, SkinnedMesh} from 'three';
import {GLTFLoader, type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {createPigeon} from '../src/pigeon-model';
import {createPlayerModel} from '../src/player-model';
import {KIRBY_VARIANTS} from '../src/variant-palette';
import {CharacterController} from '../src/controller';
import {actorState, applyActor, RemotePlayers} from '../src/network-actors';
import {NetworkSession} from '../src/network';
import {PROTOCOL, validActor} from '../src/network-protocol';

const pigeonVariant = KIRBY_VARIANTS.find(v => v[0] === 'Пиджи')!;
const pigeonIndex = KIRBY_VARIANTS.indexOf(pigeonVariant);
const originalPigeon = createPigeon(), pigeonScene = new Group();
pigeonScene.add(originalPigeon.root);
const pigeon = {scene: pigeonScene, animations: originalPigeon.clips} as GLTF;
const kirbyPromise = readFile(new URL('../public/models/kirby-animated.glb', import.meta.url)).then(bytes =>
  new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), ''));
const idle = {forward: false, left: false, right: false};

test('pigeon is an appended selection with its native clips, independent bones and materials', async () => {
  const kirby = await kirbyPromise;
  assert.equal(KIRBY_VARIANTS[16][0], 'Бандана', 'existing saved/network variant indices stay stable');
  assert.equal(pigeonIndex, 17);
  const first = createPlayerModel(kirby, pigeonVariant, pigeon), second = createPlayerModel(kirby, pigeonVariant, pigeon);
  assert.equal(first.character, 'pigeon');
  assert.equal(first.clips, originalPigeon.clips);
  const bodies: SkinnedMesh[] = [];
  first.model.traverse(node => { if (node instanceof SkinnedMesh) bodies.push(node); });
  assert(bodies.length > 0);
  for (const body of bodies) {
    const other = second.model.getObjectByName(body.name) as SkinnedMesh;
    const source = pigeon.scene.getObjectByName(body.name) as SkinnedMesh;
    assert.equal(body.geometry, source.geometry);
    assert.notEqual(body.skeleton, source.skeleton);
    assert.notEqual(body.skeleton.bones[1], other.skeleton.bones[1]);
    assert.notEqual(body.material, source.material);
    assert.notEqual(body.material, other.material);
    body.skeleton.bones[1].rotateX(.5);
    assert.notDeepEqual(body.skeleton.bones[1].quaternion.toArray(), other.skeleton.bones[1].quaternion.toArray());
  }
  first.model.traverse(node => {
    if (!(node instanceof Mesh)) return;
    const source = pigeon.scene.getObjectByName(node.name) as Mesh;
    assert.equal(node.geometry, source.geometry, 'approved geometry is preserved');
    assert.notEqual(node.material, source.material, 'actor disposal cannot remove the template material');
  });
  const ordinary = createPlayerModel(kirby, KIRBY_VARIANTS[0], pigeon);
  assert.equal(ordinary.character, 'kirby');
  assert.equal(ordinary.clips, kirby.animations);
  assert.throws(() => createPlayerModel(kirby, pigeonVariant), /Пиджи/);
});

test('native bird states serialize into five protocol pose slots and render as a bird remotely', async () => {
  const kirby = await kirbyPromise, first = createPlayerModel(kirby, pigeonVariant, pigeon);
  const controller = new CharacterController(first.model, first.clips);
  assert(controller.isPigeon);
  const scene = new Scene(), remote = new RemotePlayers(scene, kirby, pigeon);
  for (const state of ['Sitting', 'Swing', 'Cart', 'Sleep', 'Fly', 'Swim', 'Push', 'Hello', 'Joy', 'Fear', 'Anger', 'Sad']) {
    controller.setActivity(state);
    controller.mixer.update(.38);
    const snapshot = actorState(controller, 'Голубь', pigeonIndex);
    assert.equal(snapshot.pose.length, 5);
    assert(validActor(snapshot), state);
    remote.update(new Map([['bird', snapshot]]), 1 / 60);
    const peer = remote.players.get('bird')!;
    assert(peer.isPigeon);
    assert.equal(peer.state, state);
    applyActor(peer, snapshot, 0, true);
    for (const [slot, node] of [peer.animationRoot, ...['Left_wing', 'Right_wing', 'Left_foot', 'Right_foot'].map(name => peer.actor.getObjectByName(name)!)].entries()) {
      const restored = [...node.position.toArray(), ...node.quaternion.toArray(), ...node.scale.toArray()];
      restored.forEach((value, i) => assert(Math.abs(value - snapshot.pose[slot][i]) < 1e-6, `${state}: pose slot ${slot}`));
    }
  }
  const ordinary = createPlayerModel(kirby, KIRBY_VARIANTS[0]);
  const kirbyController = new CharacterController(ordinary.model, ordinary.clips);
  const snapshot = actorState(kirbyController, 'Кирби', 0);
  remote.update(new Map([['bird', snapshot]]), 1 / 60);
  assert(!remote.players.get('bird')!.isPigeon, 'replacing a variant replaces its rig');
  remote.clear();
  assert.equal(remote.players.size, 0);
  assert.equal(scene.children.length, 0);
  controller.setActivity('Idle');controller.update(.2, idle);
});

test('remote emotion callback retains the sender so the game can choose pigeon or Kirby voice', async () => {
  const previous = globalThis.WebSocket;
  let socket: FakeSocket | undefined;
  class FakeSocket {
    static OPEN = 1;
    readyState = 1;
    onmessage?: (event: {data: string}) => void;
    onerror?: () => void;
    onclose?: () => void;
    constructor() { socket = this; }
    close() {}
    send() {}
  }
  globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;
  const session = new NetworkSession(), calls: unknown[][] = [];
  session.onEmote = (emotion, sender) => calls.push([emotion, sender]);
  try {
    const connected = session.connect('https://example.test', pigeonIndex, 'Bird');
    socket!.onmessage!({data: JSON.stringify({type: 'welcome', protocolVersion: PROTOCOL, playerId: 'local', players: [], room: {id: 'test', host: 'local', epoch: 0, fruits: [], starAt: 0, mill: false, locks: {}}})});
    await connected;
    for (const [emote, id] of [['Hello', 'pigeon-peer'], ['Sad', 'kirby-peer'], ['Joy', 'local'], ['invalid', 'pigeon-peer']]) {
      socket!.onmessage!({data: JSON.stringify({type: 'emote', emote, id})});
    }
    assert.deepEqual(calls, [['Hello', 'pigeon-peer'], ['Sad', 'kirby-peer']]);
  } finally { session.close(); globalThis.WebSocket = previous; }
});
