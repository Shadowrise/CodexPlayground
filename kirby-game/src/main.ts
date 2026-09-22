import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSM } from 'three/addons/csm/CSM.js';
import { CharacterController } from './controller';
import { resolveAttack } from './combat';
import { FruitWorld } from './fruits';
import { FollowCamera } from './follow-camera';
import { Coaster, STATION } from './coaster';
import { Watermill, MILL_LEVER } from './watermill';
import { Treehouse, TREEHOUSE_SITE } from './treehouse';
import { Benches } from './benches';
import { Balloons } from './balloons';
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
import { captureGame, parseSave, restoreGame, SAVE_KEY, type GameSave } from './save-game';
import { createGamepadInput, stickSteering } from './gamepad';
const gamepad = createGamepadInput();

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
  if(open)audioPanel.querySelector<HTMLElement>('select, button, input')?.focus();
});
const music = new BackgroundMusic(document.querySelector<HTMLButtonElement>('#music-toggle')!, document.querySelector<HTMLInputElement>('#music-volume')!, document.querySelector<HTMLButtonElement>('#music-previous')!, document.querySelector<HTMLButtonElement>('#music-next')!, document.querySelector<HTMLElement>('#music-track')!);
const sounds = new SoundEffects(document.querySelector<HTMLButtonElement>('#sounds-toggle')!, document.querySelector<HTMLInputElement>('#sounds-volume')!);
let playing = false;
let selected: KirbyVariant = KIRBY_VARIANTS[0];
let loadedModel: GLTF | undefined;
let pendingSave: GameSave | undefined;
const loadButton=document.createElement('button');loadButton.id='load-game';loadButton.type='button';loadButton.textContent='Загрузить сохранение';loadButton.disabled=true;
const selectionCard=document.querySelector<HTMLElement>('.selection-card')!;
const startupCard=document.createElement('div');startupCard.className='selection-card';startupCard.id='startup-menu';startupCard.hidden=true;
startupCard.innerHTML='<span class="eyebrow">GREEN PLAYGROUND</span><h2>С возвращением!</h2><p class="selection-description">Продолжить приключение или начать заново?</p>';
const newGameButton=document.createElement('button');newGameButton.id='new-game';newGameButton.type='button';newGameButton.textContent='Новая игра';
startupCard.append(newGameButton,loadButton);
const startupMessage=document.createElement('p');startupMessage.setAttribute('role','status');startupMessage.className='gamepad-hint';startupMessage.textContent='Геймпад: A — новая игра · X — загрузить сохранение';startupCard.append(startupMessage);
selectionCard.before(startupCard);
newGameButton.addEventListener('click',()=>{pendingSave=undefined;startupCard.hidden=true;selectionCard.hidden=false;document.querySelector<HTMLButtonElement>('.variant-button')?.focus();});
const saveButton=document.createElement('button');saveButton.type='button';saveButton.id='save-game';saveButton.textContent='Сохранить игру';audioPanel.append(saveButton);
const saveMessage=document.createElement('p');saveMessage.setAttribute('role','status');saveMessage.className='gamepad-hint';audioPanel.append(saveMessage);
try {startupCard.hidden=localStorage.getItem(SAVE_KEY)===null;}catch {startupCard.hidden=true;}
selectionCard.hidden=!startupCard.hidden;
loadButton.addEventListener('click',()=>{
  try {
    const raw=localStorage.getItem(SAVE_KEY);if(!raw)throw Error('Сохранение не найдено.');
    pendingSave=parseSave(raw);selected=KIRBY_VARIANTS.find(v=>v[0]===pendingSave!.player.variant)!;
    startButton.click();
  }catch(error){pendingSave=undefined;startupMessage.textContent=error instanceof Error?error.message:'Не удалось загрузить сохранение.';}
});
saveButton.addEventListener('click',()=>{
  if(!character)return;
  try {
    if(localStorage.getItem(SAVE_KEY)!==null && !window.confirm('Сохранение уже существует. Перезаписать его текущей игрой?'))return;
    localStorage.setItem(SAVE_KEY,JSON.stringify(captureGame(character,selected,npcs,fruits,coaster.riding,c=>balloons.savePosition(c))));
    saveMessage.textContent='Игра сохранена.';loadButton.hidden=false;
  }catch {saveMessage.textContent='Не удалось сохранить игру: хранилище браузера недоступно или заполнено.';}
});
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
// A less extreme depth range keeps distant ground overlays from fighting at altitude.
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .75, 1200);
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
  lightNear:1,lightFar:1400,lightMargin:250,shadowBias:-.00003});
shadows.fade=true;
shadows.updateFrustums();
// Allow for the coarse distant-cascade texels to suppress moving self-shadow stripes.
for(const light of shadows.lights){light.color.set('#fff1d7');light.shadow.normalBias=.12;}
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
const watermill=new Watermill();scene.add(watermill.group);
const treehouse=new Treehouse(kind=>sounds.playTreehouse(kind));scene.add(treehouse.group);
const benches=new Benches();
const balloons=new Balloons((kind,position)=>{if(character){const gain=Math.max(0,1-position.distanceTo(character.actor.position)/35);if(gain>0)sounds.playBalloon(kind,gain);}});scene.add(balloons.group);
const rideHint=document.createElement('div');rideHint.className='panel ride-hint';document.body.appendChild(rideHint);
const fruits = new FruitWorld();
for(const fruit of fruits.fruits){watermill.constrain(fruit.object.position,.15);treehouse.constrain(fruit.object.position,.15);}
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
  if (!playing || gamepad.input.active !== 'keyboard') return;
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
  if (!playing || gamepad.input.active !== 'keyboard' || event.button !== 0 || event.pointerType !== 'mouse') return;
  event.preventDefault();
  dragPointer = event.pointerId;
  dragX = event.clientX; dragY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
  canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('pointermove', event => {
  if (gamepad.input.active !== 'keyboard') { stopDragging(); return; }
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
const labels: Record<string, string> = { Idle: 'Отдыхаем', Run: 'Бежим', WalkBackward: 'Пятимся назад', Jump: 'Парим', Attack: 'Атака', Eat: 'Кушаем', RotateLeft: 'Поворот налево', RotateRight: 'Поворот направо' };

async function loadCharacter() {
  try {
    const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/kirby-animated.glb`);
    loadedModel = gltf;
    startButton.disabled = false;
    loadButton.disabled = false;
    startButton.textContent = 'На поляну →';
    document.querySelector('#selection-message')!.textContent = 'W / S — движение · A / D — поворот · Пробел — полёт (два подъёма, затем вперёд) · Q — атака · E — взаимодействие';
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
  if(pendingSave){restoreGame(pendingSave,character,npcs,fruits);pendingSave=undefined;}
  watermill.constrain(character.actor.position,character.actor.scale.x);
  treehouse.constrain(character.actor.position,character.actor.scale.x);
  viewScale=character.actor.scale.x;
  cameraTarget.set(character.actor.position.x,.9*viewScale,character.actor.position.z);
  followCamera.reset(character.yaw);
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
let menuRepeat=0;
function navigateSettings(direction:number, adjust:number, confirm:boolean) {
  const elements=Array.from(document.querySelectorAll<HTMLElement>('#audio-panel button, #audio-panel input, #audio-panel select, #reset-camera')).filter(element=>element.getClientRects().length>0);
  if(!elements.length)return;
  let index=elements.indexOf(document.activeElement as HTMLElement);
  if(direction || index<0) {index=index<0?0:(index+direction+elements.length)%elements.length;elements[index].focus();}
  const element=elements[index];
  if(adjust && element instanceof HTMLSelectElement) {
    element.selectedIndex=(element.selectedIndex+adjust+element.options.length)%element.options.length;
    element.dispatchEvent(new Event('change'));
  } else if(adjust && element instanceof HTMLInputElement) {
    element.value=String(Math.max(0,Math.min(100,Number(element.value)+adjust*5)));
    element.dispatchEvent(new Event('input'));
  }
  if(confirm && element instanceof HTMLButtonElement)element.click();
}
renderer.setAnimationLoop((time: number) => {
  const dt = Math.min((time - previousTime) / 1000, .05);
  previousTime = time;
  const pad=gamepad.poll();
  if(pad.changed){keys.clear();pendingTurn=undefined;pendingJump=pendingAttack=pendingBoard=false;stopDragging();}
  const usingPad=gamepad.input.active!=='keyboard';
  if(usingPad && pad.pressed.has(9) && playing)settingsToggle.click();
  const settingsOpen=!audioPanel.hidden;
  const wasChoosing=!playing;
  menuRepeat=Math.max(0,menuRepeat-dt);
  const horizontal=pad.held.has(15)?1:pad.held.has(14)?-1:Math.abs(pad.x)>.35?Math.sign(pad.x):0;
  const vertical=pad.held.has(13)?1:pad.held.has(12)?-1:Math.abs(pad.y)>.35?Math.sign(pad.y):0;
  if(usingPad && (!playing || settingsOpen)) {
    const repeat=(horizontal!==0 || vertical!==0) && menuRepeat===0;
    if(repeat)menuRepeat=.22;
    if(!horizontal && !vertical)menuRepeat=0;
    if(!playing && !startupCard.hidden) {
      if(pad.pressed.has(2))loadButton.click();
      else if(pad.pressed.has(0))newGameButton.click();
    } else if(!playing) {
      if(repeat){const i=(KIRBY_VARIANTS.indexOf(selected)+horizontal+vertical*5+15)%15;(variantGrid.children[i] as HTMLButtonElement).click();}
      if(pad.pressed.has(3))spawnNearDepot.checked=!spawnNearDepot.checked;
      if(pad.pressed.has(0))startButton.click();
    } else {
      if(pad.pressed.has(1))settingsToggle.click();
      else if(repeat || pad.pressed.has(0))navigateSettings(repeat?vertical:0,repeat?horizontal:0,pad.pressed.has(0));
    }
  }
  const padKeys=new Set<string>();
  if(usingPad && !settingsOpen && !wasChoosing) {
    if(pad.y<-.05)padKeys.add('KeyW');if(pad.y>.05)padKeys.add('KeyS');
    if(pad.held.has(7))padKeys.add('ShiftLeft');
    if(pad.pressed.has(0))padKeys.add('Space');if(pad.pressed.has(2))padKeys.add('KeyQ');
    if(pad.pressed.has(3))pendingBoard=true;
    followCamera.zoom((Number(pad.held.has(13))-Number(pad.held.has(12)))*dt*600);
  }
  const held=(key:string)=>usingPad?padKeys.has(key):keys.has(key);
  if (character) {
    const previousX = character.actor.position.x;
    const previousZ = character.actor.position.z;
    const previousYaw = character.yaw;
    const atStation=!!coaster.prompt(character);
    if(pendingBoard) {
      if(coaster.riding)coaster.disembark();
      else if(balloons.riding){ /* Remain safely in the basket until landing. */ }
      else if(benches.active || ((!treehouse.active || treehouse.canSit) && benches.prompt(character.actor.position)))benches.interact(character);
      else if(treehouse.active || treehouse.prompt(character.actor.position))treehouse.interact(character);
      else if(watermill.prompt(character.actor.position))watermill.interact(character.actor.position);
      else if(balloons.prompt(character.actor.position))balloons.board(character);
      else if(atStation)coaster.board(character);
    }
    const treehouseWasActive=treehouse.active;
    const balloonWasActive=balloons.riding;
    balloons.update(dt,npcs,character);
    const benchWasActive=benches.active;benches.update(dt);
    if(!benchWasActive)treehouse.update(dt,{steer:usingPad ? (!settingsOpen?stickSteering(pad.x,pad.y):0) : undefined,forward:held('KeyW'),backward:held('KeyS'),left:held('KeyA'),right:held('KeyD')},pendingJump || (usingPad && pad.pressed.has(0)));
    if(!coaster.riding && !treehouseWasActive && !benchWasActive && !balloonWasActive)character.update(dt, { steer:usingPad ? (!settingsOpen?stickSteering(pad.x,pad.y):0) : undefined, sprint: held('ShiftLeft') || held('ShiftRight'), attack: held('KeyQ') || pendingAttack, forward: held('KeyW'), backward: held('KeyS'), jump: held('Space') || pendingJump, left: held('KeyA') || pendingTurn === 'KeyA', right: held('KeyD') || pendingTurn === 'KeyD' });
    coaster.update(dt);
    if(!coaster.riding && !treehouse.active && !balloons.riding){watermill.constrain(character.actor.position,character.actor.scale.x);treehouse.constrain(character.actor.position,character.actor.scale.x);}
    const interaction=balloons.prompt(character.actor.position) || (!coaster.riding && (((!treehouse.active || treehouse.canSit) && benches.prompt(character.actor.position)) || treehouse.prompt(character.actor.position) || watermill.prompt(character.actor.position))) || coaster.prompt(character);
    rideHint.textContent=interaction ? interaction.replace('E —',usingPad?'Y —':'E —').replace('W/S — гулять · A/D — повернуться',usingPad?'Левый стик — гулять · A — прыгнуть':'W/S — гулять · A/D — повернуться') : `Воздушные шары ${balloons.nearestDistance(character.actor.position)} м | Домик ${Math.round(character.actor.position.distanceTo(TREEHOUSE_SITE))} м | Мельница ${Math.round(character.actor.position.distanceTo(MILL_LEVER))} м | Депо ${Math.round(character.actor.position.distanceTo(STATION))} м`;
    const movingOrTurning = previousX !== character.actor.position.x || previousZ !== character.actor.position.z || previousYaw !== character.yaw;
    followCamera.update(dt, character.yaw, movingOrTurning,
      usingPad && !settingsOpen ? pad.cameraX : Number(held('ArrowRight')) - Number(held('ArrowLeft')),
      usingPad && !settingsOpen ? pad.cameraY : Number(held('ArrowUp')) - Number(held('ArrowDown')), dragPointer !== undefined);
    pendingBoard = false;
    pendingAttack = false;
    pendingTurn = undefined;
    pendingJump = false;
    const position = character.actor.position;
    viewScale = THREE.MathUtils.lerp(viewScale, character.actor.scale.x, 1 - Math.exp(-3 * dt));
    cameraTarget.lerp(new THREE.Vector3(position.x, position.y + .9 * viewScale, position.z), 1 - Math.exp(-8 * dt));
    status.textContent = character.state === 'Run' && (held('ShiftLeft') || held('ShiftRight')) ? 'Спринт' : ({Balloon:'Летим на воздушном шаре',Sitting:'Отдыхаем на лавочке',Climb:'Лезем в домик',Lookout:'На обзорной площадке',LeafDive:'Прыгаем в листья',Swing:'Качаемся'} as Record<string,string>)[character.state] || labels[character.state] || character.state;
    const neighbors = [character.actor.position, ...npcs.map(npc => npc.actor.position)];
    greetingCooldown=Math.max(0,greetingCooldown-dt);
    if(!coaster.riding && greetingCooldown===0) {
      const nearby=[...npcs].sort((a,b)=>a.actor.position.distanceToSquared(position)-b.actor.position.distanceToSquared(position));
      for(const npc of nearby)if(npc.actor.position.distanceTo(position)<24 && npc.greet(position)){greetingCooldown=3;break;}
    }
    for (const npc of npcs) {if(!balloons.owns(npc))npc.update(dt, neighbors);if(npc.state!=='Balloon'){watermill.constrain(npc.actor.position,npc.actor.scale.x);treehouse.constrain(npc.actor.position,npc.actor.scale.x);}}
    if(npcs.some(n=>n.hello))sounds.sayHello();
    const hit = resolveAttack(character, npcs);
    const eaten = fruits.update(dt, character, npcs, coaster.riding || treehouse.active || benches.active || balloons.riding);
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
  else {coaster.update(dt);treehouse.update(dt);balloons.update(dt);}
  const { azimuth, elevation, distance } = followCamera;
  camera.position.set(cameraTarget.x + distance * viewScale * Math.cos(elevation) * Math.sin(azimuth), cameraTarget.y + distance * viewScale * Math.sin(elevation), cameraTarget.z + distance * viewScale * Math.cos(elevation) * Math.cos(azimuth));
  constrainToMeadow(camera.position, .5);
  camera.lookAt(cameraTarget);
  camera.updateMatrixWorld();
  shadows.update();
  updateSky(dt,camera);
  watermill.update(dt);
  renderer.render(scene, camera);
});
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  shadows.updateFrustums();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
});



