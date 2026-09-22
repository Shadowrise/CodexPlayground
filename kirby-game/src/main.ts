import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSM } from 'three/addons/csm/CSM.js';
import { CharacterController } from './controller';
import { resolveAttack } from './combat';
import { FruitWorld } from './fruits';
import { FollowCamera } from './follow-camera';
import { Coaster, STATION } from './coaster';
import { randomSpawn } from './spawn';
import { createSky, SUN_DIRECTION } from './sky';
import { BackgroundMusic } from './music';
import { SoundEffects } from './sfx';
import { MEADOW_HALF_SIZE, MOUNTAIN_WIDTH, constrainToMeadow } from './world-bounds';
import { addEnvironment } from './environment';
import { createNpcs, type KirbyNpc } from './npcs';
import { cloneVariant, KIRBY_VARIANTS, type KirbyVariant } from './variants';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';

const mount = document.querySelector<HTMLDivElement>('#game')!;
const status = document.querySelector<HTMLSpanElement>('#status')!;
const statusDot = document.querySelector<HTMLSpanElement>('#status-dot')!;
const sizeValue = document.querySelector<HTMLElement>('#player-size')!;
const fruitValue = document.querySelector<HTMLElement>('#player-fruits')!;
const npcFruitValue = document.querySelector<HTMLElement>('#npc-fruits')!;
const remainingFruitValue = document.querySelector<HTMLElement>('#remaining-fruits')!;
const settingsToggle = document.querySelector<HTMLButtonElement>('#settings-toggle')!;
const audioPanel = document.querySelector<HTMLElement>('#audio-panel')!;
const controlsPanel = document.querySelector<HTMLElement>('#controls-panel')!;
settingsToggle.addEventListener('click', () => {
  const open = settingsToggle.getAttribute('aria-expanded') !== 'true';
  settingsToggle.setAttribute('aria-expanded', String(open));
  audioPanel.hidden = controlsPanel.hidden = !open;
});
const music = new BackgroundMusic(document.querySelector<HTMLButtonElement>('#music-toggle')!, document.querySelector<HTMLInputElement>('#music-volume')!, document.querySelector<HTMLButtonElement>('#music-previous')!, document.querySelector<HTMLButtonElement>('#music-next')!, document.querySelector<HTMLElement>('#music-track')!);
const sounds = new SoundEffects(document.querySelector<HTMLButtonElement>('#sounds-toggle')!, document.querySelector<HTMLInputElement>('#sounds-volume')!);
let playing = false;
let selected: KirbyVariant = KIRBY_VARIANTS[0];
let loadedModel: GLTF | undefined;
const startButton = document.querySelector<HTMLButtonElement>('#start-game')!;
const spawnNearDepot = document.querySelector<HTMLInputElement>('#spawn-near-depot')!;
spawnNearDepot.checked = false;
const variantGrid = document.querySelector<HTMLDivElement>('#variant-grid')!;
for (const variant of KIRBY_VARIANTS) {
  const button = document.createElement('button');
  button.className = 'variant-button';
  button.type = 'button';
  button.setAttribute('aria-label', variant[0]);
  button.setAttribute('aria-pressed', String(variant === selected));
  button.style.setProperty('--kirby-color', variant[1]);
  button.innerHTML = `<span class="mini-kirby" aria-hidden="true"><i class="mini-feet"></i><i class="mini-body"><i class="mini-eyes"></i><i class="mini-mouth"></i></i></span><span>${variant[0]}</span><span class="choice-check" aria-hidden="true">✓</span>`;
  button.addEventListener('click', () => {
    selected = variant;
    variantGrid.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    document.querySelector('#selected-name')!.textContent = variant[0];
  });
  variantGrid.appendChild(button);
}
const scene = new THREE.Scene();
scene.background = new THREE.Color('#b3d9ef');
scene.fog = new THREE.Fog('#d8e9eb', 180, 750);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .1, 1200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
mount.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight('#ffffff', '#779455', 2.4));
const shadows = new CSM({camera,parent:scene,cascades:2,maxFar:300,mode:'practical',
  shadowMapSize:1024,lightDirection:SUN_DIRECTION.clone().negate(),lightIntensity:3.2,
  lightNear:1,lightFar:1400,lightMargin:250,shadowBias:-.000001});
shadows.fade=true;
shadows.updateFrustums();
for(const light of shadows.lights){light.color.set('#fff1d7');light.shadow.normalBias=.025;}
const shadowMaterials=new WeakSet<THREE.Material>();
function setupShadowMaterials() {
  scene.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    for(const material of Array.isArray(object.material)?object.material:[object.material]) {
      if(!(material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhongMaterial || material instanceof THREE.MeshLambertMaterial) || shadowMaterials.has(material))continue;
      shadows.setupMaterial(material);shadowMaterials.add(material);material.needsUpdate=true;
    }
  });
}
const updateSky = createSky(scene);

const ground = new THREE.Mesh(new THREE.PlaneGeometry((MEADOW_HALF_SIZE + MOUNTAIN_WIDTH) * 2, (MEADOW_HALF_SIZE + MOUNTAIN_WIDTH) * 2), new THREE.MeshStandardMaterial({ color: '#80b654', roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -.02;
ground.receiveShadow = true;
scene.add(ground);
addEnvironment(scene);
const coaster=new Coaster();scene.add(coaster.group);
const rideHint=document.createElement('div');rideHint.className='panel ride-hint';document.body.appendChild(rideHint);
const fruits = new FruitWorld();
scene.add(fruits.group);
setupShadowMaterials();

const keys = new Set<string>();
let pendingTurn: 'KeyA' | 'KeyD' | undefined;
let pendingJump = false;
let pendingAttack = false;
let pendingBoard = false;
let hitMessageRemaining = 0;
const controls = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyE', 'KeyQ', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ShiftLeft', 'ShiftRight']);
window.addEventListener('keydown', event => {
  if (!playing) return;
  if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
  if (controls.has(event.code)) {
    event.preventDefault(); keys.add(event.code);
    if (!event.repeat && (event.code === 'KeyA' || event.code === 'KeyD')) pendingTurn = event.code;
    if (!event.repeat && event.code === 'Space') pendingJump = true;
    if (!event.repeat && event.code === 'KeyE') pendingBoard = true;
    if (!event.repeat && event.code === 'KeyQ') pendingAttack = true;
  }
});
window.addEventListener('keyup', event => { keys.delete(event.code); });
window.addEventListener('blur', () => { keys.clear(); pendingTurn = undefined; pendingJump = false; pendingAttack = false; pendingBoard = false; });
document.addEventListener('visibilitychange', () => { keys.clear(); pendingTurn = undefined; pendingJump = false; pendingAttack = false; pendingBoard = false; });

const followCamera = new FollowCamera();
const canvas = renderer.domElement;
let dragPointer: number | undefined;
let dragX = 0, dragY = 0;
const stopDragging = () => {
  if (dragPointer !== undefined && canvas.hasPointerCapture(dragPointer)) canvas.releasePointerCapture(dragPointer);
  dragPointer = undefined;
  canvas.style.cursor = 'grab';
};
canvas.style.cursor = 'grab';
canvas.addEventListener('pointerdown', event => {
  if (!playing || event.button !== 0 || event.pointerType !== 'mouse') return;
  event.preventDefault();
  dragPointer = event.pointerId;
  dragX = event.clientX; dragY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
  canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('pointermove', event => {
  if (event.pointerId !== dragPointer) return;
  if (!(event.buttons & 1)) { stopDragging(); return; }
  followCamera.orbit(event.clientX - dragX, event.clientY - dragY);
  dragX = event.clientX; dragY = event.clientY;
});
canvas.addEventListener('pointerup', stopDragging);
canvas.addEventListener('pointercancel', stopDragging);
canvas.addEventListener('lostpointercapture', stopDragging);
window.addEventListener('blur', stopDragging);
document.addEventListener('visibilitychange', stopDragging);
canvas.addEventListener('wheel', event => {
  if (!playing) return;
  event.preventDefault();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
  followCamera.zoom(event.deltaY * unit);
}, { passive: false });
let viewScale = 1;
const cameraTarget = new THREE.Vector3(0, .9, 0);
document.querySelector('#reset-camera')!.addEventListener('click', () => followCamera.reset(character?.yaw ?? 0));
let character: CharacterController | undefined;
let npcs: KirbyNpc[] = [];
const labels: Record<string, string> = { Idle: 'Отдыхаем', Run: 'Бежим', WalkBackward: 'Пятимся назад', Jump: 'Прыжок', Attack: 'Атака', Eat: 'Кушаем', RotateLeft: 'Поворот налево', RotateRight: 'Поворот направо' };

async function loadCharacter() {
  try {
    const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/kirby-animated.glb`);
    loadedModel = gltf;
    startButton.disabled = false;
    startButton.textContent = 'На поляну →';
    document.querySelector('#selection-message')!.textContent = 'W / S — движение · A / D — поворот · Пробел — прыжок · Q — атака · E — сесть в тележку';
  } catch (error) {
    console.error(error);
    status.textContent = 'Не удалось загрузить Кирби. Обновите страницу.';
    statusDot.classList.add('error');
    document.querySelector('#selection-message')!.textContent = 'Не удалось загрузить персонажей. Обновите страницу.';
    startButton.textContent = 'Загрузка не удалась';
  }
}
void loadCharacter();
startButton.addEventListener('click', () => {
  if (!loadedModel || playing) return;
  music.start();
  sounds.start();
  const { scene: template, animations } = loadedModel;
  npcs = createNpcs(template, animations, selected);
  coaster.addKirbyPassengers(template,animations,selected);
  character = new CharacterController(cloneVariant(template, selected, false), animations);
  const spawn=spawnNearDepot.checked ? {x:STATION.x,z:STATION.z-8} : randomSpawn([...(scene.getObjectByName('Four woodland biomes')?.userData.treePositions ?? []),...npcs.map(n=>n.actor.position)]);
  character.actor.position.set(spawn.x,0,spawn.z);
  cameraTarget.set(spawn.x,.9,spawn.z);
  scene.add(character.actor, ...npcs.map(npc => npc.actor));
  setupShadowMaterials();
  keys.clear(); pendingTurn = undefined; pendingJump = false;
  playing = true;
  document.body.classList.remove('choosing');
  document.querySelector<HTMLElement>('#character-select')!.hidden = true;
  statusDot.classList.add('ready');
  document.querySelector('#npc-count')!.textContent = `${selected[0]} — это ты · ${npcs.length} друзей на поляне`;
  renderer.domElement.tabIndex = -1;
  renderer.domElement.focus();
});

let previousTime = performance.now();
let greetingCooldown=0;
renderer.setAnimationLoop((time: number) => {
  const dt = Math.min((time - previousTime) / 1000, .05);
  previousTime = time;
  if (character) {
    const previousX = character.actor.position.x;
    const previousZ = character.actor.position.z;
    const previousYaw = character.yaw;
    const atStation=!!coaster.prompt(character);
    if(pendingBoard && atStation && !coaster.riding)coaster.board(character);
    if(!coaster.riding)character.update(dt, { sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'), attack: keys.has('KeyQ') || pendingAttack, forward: keys.has('KeyW'), backward: keys.has('KeyS'), jump: keys.has('Space') || pendingJump, left: keys.has('KeyA') || pendingTurn === 'KeyA', right: keys.has('KeyD') || pendingTurn === 'KeyD' });
    coaster.update(dt);
    rideHint.textContent=coaster.prompt(character) || `Американские горки · депо ${Math.round(character.actor.position.distanceTo(STATION))} м · южный край поляны`;
    const movingOrTurning = previousX !== character.actor.position.x || previousZ !== character.actor.position.z || previousYaw !== character.yaw;
    followCamera.update(dt, character.yaw, movingOrTurning,
      Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft')),
      Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown')), dragPointer !== undefined);
    pendingBoard = false;
    pendingAttack = false;
    pendingTurn = undefined;
    pendingJump = false;
    const position = character.actor.position;
    viewScale = THREE.MathUtils.lerp(viewScale, character.actor.scale.x, 1 - Math.exp(-3 * dt));
    cameraTarget.lerp(new THREE.Vector3(position.x, position.y + .9 * viewScale, position.z), 1 - Math.exp(-8 * dt));
    status.textContent = character.state === 'Run' && (keys.has('ShiftLeft') || keys.has('ShiftRight')) ? 'Спринт' : labels[character.state] || character.state;
    const neighbors = [character.actor.position, ...npcs.map(npc => npc.actor.position)];
    greetingCooldown=Math.max(0,greetingCooldown-dt);
    if(!coaster.riding && greetingCooldown===0) {
      const nearby=[...npcs].sort((a,b)=>a.actor.position.distanceToSquared(position)-b.actor.position.distanceToSquared(position));
      for(const npc of nearby)if(npc.actor.position.distanceTo(position)<24 && npc.greet(position)){greetingCooldown=3;break;}
    }
    for (const npc of npcs) npc.update(dt, neighbors);
    if(npcs.some(n=>n.hello))sounds.sayHello();
    const hit = resolveAttack(character, npcs);
    const eaten = fruits.update(dt, character, npcs, coaster.riding);
    sounds.update(dt, character, npcs, followCamera.azimuth);
    sounds.updateRide(coaster.riding,coaster.rideMotion);
    sizeValue.textContent = `${Math.round(character.actor.scale.x * 100)}%`;
    fruitValue.textContent = String(character.fruitsEaten);
    npcFruitValue.textContent = String(fruits.eatenByNpcs);
    remainingFruitValue.textContent = String(fruits.onMap);
    const message = document.querySelector<HTMLElement>('#combat-message')!;
    if (hit) {
      message.textContent = hit.isDown ? `${hit.variant[0]} отдыхает. Скоро вернётся!` : `${hit.variant[0]}  ${'♥'.repeat(hit.health)}${'♡'.repeat(3 - hit.health)}`;
      hitMessageRemaining = 2;
    }
    if (eaten) {
      message.textContent = `${eaten.type} съеден! Размер +10% · ${Math.round(character.actor.scale.x * 100)}%`;
      hitMessageRemaining = 2.5;
    }
    hitMessageRemaining = Math.max(0, hitMessageRemaining - dt);
    message.hidden = hitMessageRemaining === 0;
  }
  else coaster.update(dt);
  const { azimuth, elevation, distance } = followCamera;
  camera.position.set(cameraTarget.x + distance * viewScale * Math.cos(elevation) * Math.sin(azimuth), cameraTarget.y + distance * viewScale * Math.sin(elevation), cameraTarget.z + distance * viewScale * Math.cos(elevation) * Math.cos(azimuth));
  constrainToMeadow(camera.position, .5);
  camera.lookAt(cameraTarget);
  camera.updateMatrixWorld();
  shadows.update();
  updateSky(dt,camera);
  renderer.render(scene, camera);
});
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  shadows.updateFrustums();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
});



