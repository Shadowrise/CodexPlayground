import { InteractionOutline, outlineRegion, type OutlineTarget } from './interaction-outline';
import { watchPlayerCount } from './player-count';
import { TaskList } from './tasks';
import { awardFirst, scoreOf } from './score';
import { normalizePlayerName, readPlayerName, rememberPlayerName } from './player-name';
import { FpsCounter } from './fps';
import { EMOTES, EmoteWheel, type Emote } from './emotes';
import { Wayfinder, type Destination } from './navigation';
import { LANDMARKS, POND_SCALE } from './landmark-sites';
import { BALLOON_SITES } from './balloon-sites';
import { Ponds } from './ponds';
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
import { HedgeMaze } from './maze';
import { MAZE_SITE } from './maze-layout';
import { MazeTrampoline } from './maze-trampoline';
import { KirbyHome } from './kirby-home';
import { NightFireflies } from './night-fireflies';
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
const playerStatsRow=document.querySelector<HTMLElement>('#player-avatar')!;
const npcStatsRow=document.querySelector<HTMLElement>('.npc-avatar')!;
const remainingFruitValue = document.querySelector<HTMLElement>('#remaining-fruits')!;
const settingsToggle = document.querySelector<HTMLButtonElement>('#settings-toggle')!;
const audioPanel = document.querySelector<HTMLElement>('#audio-panel')!;
const controlsPanel = document.querySelector<HTMLElement>('#controls-panel')!;
const taskList=new TaskList(document.querySelector<HTMLOListElement>('#task-list')!,document.querySelector<HTMLElement>('#task-count')!,document.querySelector<HTMLButtonElement>('#tasks-toggle')!);
settingsToggle.addEventListener('click', () => {
  const open = settingsToggle.getAttribute('aria-expanded') !== 'true';
  settingsToggle.setAttribute('aria-expanded', String(open));
  audioPanel.hidden = controlsPanel.hidden = !open;
  keys.clear();pendingTurn=undefined;pendingJump=pendingAttack=pendingBoard=false;pendingEmote=undefined;emoteWheel.close();stopDragging();
  if(open)audioPanel.querySelector<HTMLElement>('select, button, input')?.focus();
  else if(playing)canvas.focus();
});
const music = new BackgroundMusic(document.querySelector<HTMLButtonElement>('#music-toggle')!, document.querySelector<HTMLInputElement>('#music-volume')!, document.querySelector<HTMLButtonElement>('#music-previous')!, document.querySelector<HTMLButtonElement>('#music-next')!, document.querySelector<HTMLElement>('#music-track')!);
const sounds = new SoundEffects(document.querySelector<HTMLButtonElement>('#sounds-toggle')!, document.querySelector<HTMLInputElement>('#sounds-volume')!);
let playing = false;
let selected: KirbyVariant = KIRBY_VARIANTS[0];
let loadedModel: GLTF | undefined;
let pendingSave: GameSave | undefined;
const loadButton=document.createElement('button');loadButton.id='load-game';loadButton.type='button';loadButton.textContent='Загрузить сохранение';loadButton.disabled=true;
const selectionCard=document.querySelector<HTMLElement>('.selection-card')!;
const nameField=document.querySelector<HTMLElement>('#player-name-field')!;
const nameInput=document.querySelector<HTMLInputElement>('#player-name-input')!;
try{nameInput.value=readPlayerName(localStorage);}catch{ /* Storage may be unavailable. */ }
nameInput.addEventListener('input',()=>{
  nameInput.setCustomValidity('');nameInput.removeAttribute('aria-invalid');
  try{rememberPlayerName(localStorage,nameInput.value);}catch{}
});
function requirePlayerName(){
  const name=normalizePlayerName(nameInput.value);
  nameInput.setCustomValidity(name?'':'Введи имя, чтобы войти в игру.');
  if(!name){nameInput.setAttribute('aria-invalid','true');nameInput.focus();nameInput.reportValidity();return false;}
  nameInput.value=name;nameInput.removeAttribute('aria-invalid');
  try{rememberPlayerName(localStorage,name);}catch{}
  return true;
}

const startupCard=document.createElement('div');startupCard.className='selection-card';startupCard.id='startup-menu';startupCard.hidden=false;
startupCard.innerHTML='<span class="eyebrow">GREEN PLAYGROUND</span><h2>Добро пожаловать!</h2>';
const newGameButton=document.createElement('button');newGameButton.id='new-game';newGameButton.type='button';newGameButton.textContent='Новая игра';
const soloSection=document.createElement('section');soloSection.className='startup-section';soloSection.innerHTML='<h3>Одиночная игра</h3>';soloSection.append(newGameButton,loadButton);
const networkSection=document.createElement('section');networkSection.className='startup-section';networkSection.innerHTML='<div class="network-heading"><h3>Сетевая игра</h3><span id="online-players" aria-live="polite">… игроков</span></div><div class="network-entry"><button type="button" disabled title="Подключение появится позже">Подключиться к сетевой игре</button></div>';
startupCard.append(nameField,soloSection,networkSection);
watchPlayerCount(networkSection.querySelector<HTMLElement>('#online-players')!,startupCard,import.meta.env.VITE_GAME_SERVER_URL || 'https://kirby-game-server.kirby-game-server.workers.dev');
const startupMessage=document.createElement('p');startupMessage.setAttribute('role','status');startupMessage.className='gamepad-hint';startupMessage.hidden=true;startupCard.append(startupMessage);
selectionCard.before(startupCard);
newGameButton.addEventListener('click',()=>{pendingSave=undefined;startupCard.hidden=true;selectionCard.hidden=false;document.querySelector('#variant-grid')!.before(nameField);if(!normalizePlayerName(nameInput.value))nameInput.focus();else document.querySelector<HTMLButtonElement>('.variant-button')?.focus();});
const saveButton=document.createElement('button');saveButton.type='button';saveButton.id='save-game';saveButton.textContent='Сохранить игру';audioPanel.append(saveButton);
const saveMessage=document.createElement('p');saveMessage.setAttribute('role','status');saveMessage.className='gamepad-hint';audioPanel.append(saveMessage);
let hasSave=false;
try{hasSave=localStorage.getItem(SAVE_KEY)!==null;}catch{}
selectionCard.hidden=true;
loadButton.title=hasSave?'Загрузить сохранение':'Сохранений пока нет';
loadButton.addEventListener('click',()=>{
  if(!requirePlayerName())return;
  try {
    const raw=localStorage.getItem(SAVE_KEY);if(!raw)throw Error('Сохранение не найдено.');
    pendingSave=parseSave(raw);selected=KIRBY_VARIANTS.find(v=>v[0]===pendingSave!.player.variant)!;
    startButton.click();
  }catch(error){pendingSave=undefined;startupMessage.dataset.error='true';startupMessage.hidden=false;startupMessage.textContent=error instanceof Error?error.message:'Не удалось загрузить сохранение.';}
});
saveButton.addEventListener('click',()=>{
  if(!character)return;
  try {
    if(localStorage.getItem(SAVE_KEY)!==null && !window.confirm('Сохранение уже существует. Перезаписать его текущей игрой?'))return;
    localStorage.setItem(SAVE_KEY,JSON.stringify(captureGame(character,selected,npcs,fruits,coaster.riding,c=>balloons.savePosition(c)??(c instanceof CharacterController?fireflies?.savePosition(c)??trampoline.savePosition(c)??home.savePosition(c):undefined),home.night)));
    saveMessage.textContent='Игра сохранена.';hasSave=true;loadButton.disabled=false;loadButton.title='Загрузить сохранение';
  }catch {saveMessage.textContent='Не удалось сохранить игру: хранилище браузера недоступно или заполнено.';}
});
const startButton = document.querySelector<HTMLButtonElement>('#start-game')!;
const spawnNearDepot = document.querySelector<HTMLInputElement>('#spawn-near-depot')!;
spawnNearDepot.checked = false;
const mapMode=document.querySelector<HTMLSelectElement>('#map-mode')!;mapMode.value='day';
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
const interactionOutline=new InteractionOutline();scene.add(interactionOutline.group);
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

const ambient=new THREE.HemisphereLight('#ffffff', '#779455', 2.4);scene.add(ambient);
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

const outer=MEADOW_HALF_SIZE+MOUNTAIN_WIDTH,inner=MEADOW_HALF_SIZE;
const border=new THREE.Shape([new THREE.Vector2(-outer,-outer),new THREE.Vector2(outer,-outer),new THREE.Vector2(outer,outer),new THREE.Vector2(-outer,outer)]);
border.holes.push(new THREE.Path([new THREE.Vector2(-inner,-inner),new THREE.Vector2(-inner,inner),new THREE.Vector2(inner,inner),new THREE.Vector2(inner,-inner)]));
const ground = new THREE.Mesh(new THREE.ShapeGeometry(border), new THREE.MeshStandardMaterial({ color: '#80b654', roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -.02;
ground.receiveShadow = true;
scene.add(ground);
addEnvironment(scene);
const ponds=new Ponds();scene.add(ponds.group);
const coaster=new Coaster();scene.add(coaster.group);
const watermill=new Watermill();scene.add(watermill.group);
const treehouse=new Treehouse(kind=>sounds.playTreehouse(kind));scene.add(treehouse.group);
const benches=new Benches();
const home=new KirbyHome();scene.add(home.group);
let fireflies:NightFireflies|undefined;
const maze=new HedgeMaze();scene.add(maze.group);
const trampoline=new MazeTrampoline(kind=>{if(kind==='bounce'){sounds.playBalloon('departure',.8);sounds.playTreehouse('cheer');}else sounds.playTreehouse('leaves');});scene.add(trampoline.group);
const balloons=new Balloons((kind,position)=>{if(character){const gain=Math.max(0,1-position.distanceTo(character.actor.position)/35);if(gain>0)sounds.playBalloon(kind,gain);}});scene.add(balloons.group);
const routePanel=document.createElement('div');routePanel.className='panel ride-hint route-panel';document.body.appendChild(routePanel);
const rideHint=document.createElement('div');rideHint.className='interaction-hint';routePanel.append(rideHint);
const destinations:Destination[]=[
 {id:'home',name:'Домик Кирби',x:home.entrance.x,z:home.entrance.z},
 {id:'treehouse',name:'Домик на дереве и качели',x:TREEHOUSE_SITE.x-4,z:TREEHOUSE_SITE.z+11,radius:3},
 {id:'swing',name:'Качели у домика',x:TREEHOUSE_SITE.x-11,z:TREEHOUSE_SITE.z+3,radius:3},
 {id:'mill',name:'Водяная мельница',x:MILL_LEVER.x,z:MILL_LEVER.z},
 {id:'depot',name:'Американские горки — депо',x:STATION.x,z:STATION.z-7},
 {id:'maze',name:'Радужный лабиринт',x:MAZE_SITE.x,z:MAZE_SITE.z+39},
 ...BALLOON_SITES.map((p,i)=>({id:`balloon-${i}`,name:`Шар: ${p.name}`,x:p.x,z:p.z})),
 ...LANDMARKS.flatMap((p,i)=>p.kind===0 || p.kind===4 ? [{id:`landmark-${i}`,name:`${p.kind===0?'Озеро с мостиком':'Пикник и лавочки'} ${LANDMARKS.slice(0,i+1).filter(s=>s.kind===p.kind).length}`,x:p.x+(p.kind===0?13*POND_SCALE:0),z:p.z,radius:6,group:'Места на поляне'}] : []),
];
const wayfinder=new Wayfinder(routePanel,scene,destinations);
const fruitObstacles=[...(scene.getObjectByName('Four woodland biomes')?.userData.treePositions??[]),...coaster.supports.map(s=>({x:s.base.x,z:s.base.z,radius:2}))];
const fruits = new FruitWorld(fruitObstacles);
// Clear only the small footprints beneath fruit, keeping surrounding grass intact.
const grassMatrix=new THREE.Matrix4();
scene.getObjectByName('Meadow grass')?.traverse(object=>{
 if(!(object instanceof THREE.InstancedMesh))return;
 for(let i=0;i<object.count;i++){
  object.getMatrixAt(i,grassMatrix);const x=grassMatrix.elements[12],z=grassMatrix.elements[14];
  if(fruits.fruits.some(f=>Math.hypot(x-f.object.position.x,z-f.object.position.z)<2.6)){grassMatrix.scale(new THREE.Vector3(0,0,0));object.setMatrixAt(i,grassMatrix);}
 }
 object.instanceMatrix.needsUpdate=true;
});
scene.add(fruits.group);
setupShadowMaterials();

const keys = new Set<string>();
let pendingTurn: 'KeyA' | 'KeyD' | undefined;
let pendingJump = false;
let pendingAttack = false;
let pendingEmote:Emote|undefined;
const emoteWheel=new EmoteWheel();
let pendingBoard = false;
let hitMessageRemaining = 0;
const controls = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyE', 'KeyQ', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ShiftLeft', 'ShiftRight']);
window.addEventListener('keydown', event => {
  if(!playing)return;
  if(event.code==='Escape'){
    event.preventDefault();
    if(!event.repeat)settingsToggle.click();
    return;
  }
  if(gamepad.input.active !== 'keyboard' || !audioPanel.hidden)return;
  if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
  const digit=/^(?:Digit|Numpad)([1-5])$/.exec(event.code);
  if(digit && audioPanel.hidden && !event.repeat){event.preventDefault();pendingEmote=EMOTES[Number(digit[1])-1].id;return;}
  if(event.target instanceof HTMLElement && event.target.closest('button') && (event.code==='Space'||event.code==='Enter'))return;
  if (controls.has(event.code)) {
    event.preventDefault(); keys.add(event.code);
    if (!event.repeat && (event.code === 'KeyA' || event.code === 'KeyD')) pendingTurn = event.code;
    if (!event.repeat && event.code === 'Space') pendingJump = true;
    if (!event.repeat && event.code === 'KeyE') pendingBoard = true;
    if (!event.repeat && event.code === 'KeyQ') pendingAttack = true;
  }
});
window.addEventListener('keyup', event => { keys.delete(event.code); });
window.addEventListener('blur', () => { pendingEmote=undefined;emoteWheel.close();keys.clear(); pendingTurn = undefined; pendingJump = false; pendingAttack = false; pendingBoard = false; });
document.addEventListener('visibilitychange', () => { keys.clear(); pendingTurn = undefined; pendingJump = false; pendingAttack = false; pendingBoard = false; });

const followCamera = new FollowCamera();
const canvas = renderer.domElement;
let dragPointer: number | undefined;
let dragX = 0, dragY = 0;
let dragMode:'camera'|'character'='camera';
let mouseTurn=0;
let pointerLocked=false;
let rightMouseHeld=false;
const stopDragging = () => {
  const pointer=dragPointer;dragPointer=undefined;mouseTurn=0;rightMouseHeld=false;
  if(pointer!==undefined && canvas.hasPointerCapture(pointer))canvas.releasePointerCapture(pointer);
  if(document.pointerLockElement===canvas)document.exitPointerLock();
  canvas.style.cursor='grab';
};
canvas.style.cursor = 'grab';
canvas.addEventListener('pointerdown', event => {
  if (!playing || gamepad.input.active !== 'keyboard' || !audioPanel.hidden || event.button !== 0 || event.pointerType !== 'mouse') return;
  event.preventDefault();
  if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
  if(rightMouseHeld)return;
  dragMode='camera';mouseTurn=0;
  dragPointer = event.pointerId;
  dragX = event.clientX; dragY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
  canvas.style.cursor='grabbing';
});
// Use MouseEvents throughout the right-button gesture. Pointer capture cancellation
// during pointer lock must not end the separate mouse-lock gesture.
canvas.addEventListener('mousedown',event=>{
  if(event.button!==2 || !playing || gamepad.input.active!=='keyboard' || !audioPanel.hidden)return;
  event.preventDefault();stopDragging();
  if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
  rightMouseHeld=true;dragMode='character';canvas.style.cursor='grabbing';
  try{Promise.resolve(canvas.requestPointerLock()).catch(()=>{if(rightMouseHeld)stopDragging();});}catch{stopDragging();}
});
canvas.addEventListener('pointermove', event => {
  if(document.pointerLockElement===canvas)return;
  if (gamepad.input.active !== 'keyboard') { stopDragging(); return; }
  if (event.pointerId !== dragPointer) return;
  if (!(event.buttons & (dragMode==='character'?2:1))) { stopDragging(); return; }
  if(dragMode==='character')mouseTurn=THREE.MathUtils.clamp(mouseTurn-(event.clientX-dragX)*.006,-.5,.5);
  else followCamera.orbit(event.clientX - dragX, event.clientY - dragY);
  dragX = event.clientX; dragY = event.clientY;
});
canvas.addEventListener('contextmenu',event=>{if(playing && gamepad.input.active==='keyboard')event.preventDefault();});
document.addEventListener('pointerup',event=>{if(event.button===0 && dragMode==='camera')stopDragging();});
document.addEventListener('mouseup',event=>{if(event.button===2 && dragMode==='character')stopDragging();});
document.addEventListener('mousemove',event=>{
  if(document.pointerLockElement!==canvas || !rightMouseHeld)return;
  if(gamepad.input.active!=='keyboard' || !audioPanel.hidden){stopDragging();return;}
  mouseTurn=THREE.MathUtils.clamp(mouseTurn-event.movementX*.006,-.5,.5);
});
document.addEventListener('pointerlockchange',()=>{
  const locked=document.pointerLockElement===canvas;
  if(locked && !rightMouseHeld){document.exitPointerLock();return;}
  const released=pointerLocked&&!locked;pointerLocked=locked;if(released)stopDragging();
});
document.addEventListener('pointerlockerror',stopDragging);
canvas.addEventListener('pointercancel',()=>{if(dragMode==='camera')stopDragging();});
canvas.addEventListener('lostpointercapture',()=>{if(dragMode==='camera')stopDragging();});
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
  labels.Trampoline='Прыгаем с батута';
  labels.Sleep='Спим в домике';
  for(const emote of EMOTES)labels[emote.id]=emote.name;
  try {
    const [gltf,bugModel] = await Promise.all([new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/kirby-animated.glb`),new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/firefly-animated.glb`)]);
    fireflies=new NightFireflies(bugModel);scene.add(fireflies.group,...fireflies.lights);setupShadowMaterials();
    loadedModel = gltf;
    startButton.disabled = false;
    loadButton.disabled = !hasSave;
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
  if (!loadedModel || playing || !requirePlayerName()) return;
  music.start();
  sounds.start();
  const { scene: template, animations } = loadedModel;
  npcs = createNpcs(template, animations, selected);
  coaster.addKirbyPassengers(template,animations,selected);
  character = new CharacterController(cloneVariant(template, selected, false), animations);
  const spawn=spawnNearDepot.checked ? {x:STATION.x,z:STATION.z-8} : randomSpawn([...(scene.getObjectByName('Four woodland biomes')?.userData.treePositions ?? []),...npcs.map(n=>n.actor.position)]);
  character.actor.position.set(spawn.x,0,spawn.z);
  home.night=mapMode.value==='night';
  if(pendingSave){restoreGame(pendingSave,character,npcs,fruits);home.night=pendingSave.night===true;pendingSave=undefined;}
  watermill.constrain(character.actor.position,character.actor.scale.x);
  treehouse.constrain(character.actor.position,character.actor.scale.x);
  maze.constrain(character.actor.position,character.actor.scale.x);
  home.constrain(character.actor.position,character.actor.scale.x);
  for(const npc of npcs)maze.constrain(npc.actor.position,npc.actor.scale.x);
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
  document.querySelector<HTMLElement>('#player-avatar')!.style.setProperty('--kirby-color',selected[1]);
  const nameLabel=document.querySelector<HTMLElement>('#player-name')!;nameLabel.textContent=nameInput.value;nameLabel.title=nameInput.value;
  renderer.domElement.tabIndex = -1;
  renderer.domElement.focus();
});

const fpsCounter=new FpsCounter();
document.addEventListener('visibilitychange',()=>{if(document.hidden)fpsCounter.sample(performance.now(),false);});
const fpsLabel=document.createElement('span');fpsLabel.id='fps-counter';fpsLabel.textContent='—';fpsLabel.title='Кадров в секунду';fpsLabel.setAttribute('aria-label','Кадров в секунду');document.body.append(fpsLabel);
let previousTime = performance.now();
let greetingCooldown=0;
let menuRepeat=0;
function navigateSettings(direction:number, adjust:number, confirm:boolean) {
  const elements=Array.from(document.querySelectorAll<HTMLElement>('#audio-panel button, #audio-panel input, #audio-panel select, #reset-camera, #destination-select, #tasks-toggle')).filter(element=>element.getClientRects().length>0);
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
  const fps=fpsCounter.sample(time,!document.hidden);if(fps!==undefined)fpsLabel.textContent=String(fps);
  const pad=gamepad.poll();
  if(pad.changed){pendingEmote=undefined;emoteWheel.close();keys.clear();pendingTurn=undefined;pendingJump=pendingAttack=pendingBoard=false;stopDragging();}
  const usingPad=gamepad.input.active!=='keyboard';
  document.querySelectorAll<HTMLElement>('[data-controls]').forEach(element=>element.hidden=element.dataset.controls!==(usingPad?'gamepad':'keyboard'));
  if(!startupMessage.dataset.error){startupMessage.hidden=!usingPad;startupMessage.textContent=usingPad?'Геймпад: A — новая игра · X — загрузить сохранение':'';}
  if(usingPad && pad.pressed.has(9) && playing)settingsToggle.click();
  const settingsOpen=!audioPanel.hidden;
  const wasChoosing=!playing;
  const wheelUsed=usingPad && playing && !settingsOpen && (emoteWheel.open || pad.held.has(4));
  if(usingPad && playing && !settingsOpen && !document.hidden && document.hasFocus()){const picked=emoteWheel.update(pad.held.has(4),pad.x,pad.y,pad.held.has(1));if(picked)pendingEmote=picked;}else emoteWheel.close();
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
      if(pad.pressed.has(2))mapMode.value=mapMode.value==='day'?'night':'day';
      if(pad.pressed.has(3))spawnNearDepot.checked=!spawnNearDepot.checked;
      if(pad.pressed.has(0))startButton.click();
    } else {
      if(pad.pressed.has(1))settingsToggle.click();
      else if(repeat || pad.pressed.has(0))navigateSettings(repeat?vertical:0,repeat?horizontal:0,pad.pressed.has(0));
    }
  }
  const padKeys=new Set<string>();
  if(usingPad && !settingsOpen && !wasChoosing && !wheelUsed) {
    if(pad.pressed.has(14))wayfinder.cycle(-1);
    else if(pad.pressed.has(15))wayfinder.cycle(1);
    if(pad.y<-.05)padKeys.add('KeyW');if(pad.y>.05)padKeys.add('KeyS');
    if(pad.held.has(7))padKeys.add('ShiftLeft');
    if(pad.pressed.has(0))padKeys.add('Space');if(pad.pressed.has(2))padKeys.add('KeyQ');
    if(pad.pressed.has(3))pendingBoard=true;
    followCamera.zoom((Number(pad.held.has(13))-Number(pad.held.has(12)))*dt*600);
  }
  const editingUi=document.activeElement instanceof HTMLElement && ['SELECT','INPUT','TEXTAREA'].includes(document.activeElement.tagName);
  const held=(key:string)=>settingsOpen || wheelUsed || (!usingPad && editingUi)?false:usingPad?padKeys.has(key):keys.has(key);
  const mouseTurning=!usingPad && rightMouseHeld && document.pointerLockElement===canvas && !settingsOpen;
  const mouseSteer=mouseTurning?THREE.MathUtils.clamp(mouseTurn/Math.max(.0001,Math.PI*.55*dt),-1,1):undefined;
  if(mouseSteer!==undefined)mouseTurn-=mouseSteer*Math.PI*.55*dt;
  if (character) {
    const achievementsBefore=character.achievements.size;
    const previousX = character.actor.position.x;
    const previousZ = character.actor.position.z;
    const previousYaw = character.yaw;
    if(pendingBoard)resolveInteraction(character)?.run();
    if(pendingEmote && !fireflies?.riding && !home.active && !coaster.riding && !treehouse.active && !benches.active && !balloons.riding && !trampoline.active && character.startEmote(pendingEmote))sounds.playEmote(pendingEmote);
    pendingEmote=undefined;
    const treehouseWasActive=treehouse.active;
    const balloonWasActive=balloons.riding;
    const homeWasActive=home.active;home.update(dt);
    if(!fireflies?.riding && !homeWasActive && !coaster.riding && !balloonWasActive && !treehouseWasActive && !benches.active && (pendingJump || (usingPad && !wheelUsed && pad.pressed.has(0))))trampoline.start(character);
    const trampolineWasActive=trampoline.active;trampoline.update(dt);
    balloons.update(dt,npcs,character);
    const benchWasActive=benches.active;benches.update(dt);
    if(!benchWasActive)treehouse.update(dt,{steer:usingPad ? (!settingsOpen && !wheelUsed?stickSteering(pad.x,pad.y):0) : mouseSteer,forward:held('KeyW'),backward:held('KeyS'),left:held('KeyA'),right:held('KeyD')},pendingJump || (usingPad && !wheelUsed && pad.pressed.has(0)));
    if(!fireflies?.riding && !homeWasActive && !coaster.riding && !treehouseWasActive && !benchWasActive && !balloonWasActive && !trampolineWasActive)character.update(dt, { steer:usingPad ? (!settingsOpen && !wheelUsed?stickSteering(pad.x,pad.y):0) : mouseSteer, sprint: held('ShiftLeft') || held('ShiftRight'), attack: held('KeyQ') || pendingAttack, forward: held('KeyW'), backward: held('KeyS'), jump: !maze.contains(character.actor.position,2) && (held('Space') || pendingJump), left: held('KeyA') || pendingTurn === 'KeyA', right: held('KeyD') || pendingTurn === 'KeyD' });
    if(fireflies?.riding)fireflies.moveRider(dt,{forward:held('KeyW'),backward:held('KeyS'),left:held('KeyA'),right:held('KeyD'),sprint:held('ShiftLeft')||held('ShiftRight'),steer:usingPad?(!settingsOpen&&!wheelUsed?stickSteering(pad.x,pad.y):0):mouseSteer});
    coaster.update(dt);
    if(!homeWasActive && !coaster.riding && !treehouse.active && !balloons.riding && !trampolineWasActive){watermill.constrain(character.actor.position,character.actor.scale.x);treehouse.constrain(character.actor.position,character.actor.scale.x);home.constrain(character.actor.position,character.actor.scale.x);}
    if(!homeWasActive && !coaster.riding && !treehouse.active && !balloons.riding && !trampolineWasActive){
      maze.constrain(character.actor.position,character.actor.scale.x,new THREE.Vector3(previousX,0,previousZ));
      if(maze.contains(character.actor.position,2) && character.flight.active){character.setActivity('Idle');character.actor.position.y=0;}
    }
    ponds.apply(character,new THREE.Vector3(previousX,0,previousZ),!fireflies?.riding && !homeWasActive && !coaster.riding && !treehouseWasActive && !benchWasActive && !balloonWasActive && !trampolineWasActive);
    sounds.updateWater(dt,character.swimming,Math.hypot(character.actor.position.x-previousX,character.actor.position.z-previousZ)>.002,!fireflies?.riding && !homeWasActive && !coaster.riding && !treehouseWasActive && !benchWasActive && !balloonWasActive && !trampolineWasActive);
    fireflies?.syncRider(dt);
    const availableInteraction=resolveInteraction(character);
    const interaction=availableInteraction?.text;
    interactionOutline.update(playing && !settingsOpen && !wheelUsed ? availableInteraction?.target : undefined);
    rideHint.textContent=interaction ? interaction.replace('E —',usingPad?'Y —':'E —').replace('W/S — гулять · A/D — повернуться',usingPad?'Левый стик — гулять · A — прыгнуть':'W/S — гулять · A/D — повернуться') : maze.contains(character.actor.position,5) ? (character.starRemaining>0?`★ Скорость и прыжок ×2: ${Math.ceil(character.starRemaining)} с`:character.starCooldown>0?`★ Новая звезда через ${Math.ceil(character.starCooldown)} с`:'Найди звезду в глубине лабиринта · здесь только пешком') : '';
    const movingOrTurning = previousX !== character.actor.position.x || previousZ !== character.actor.position.z || previousYaw !== character.yaw;

    followCamera.update(dt, character.yaw, movingOrTurning,
      usingPad && !settingsOpen && !wheelUsed ? pad.cameraX : Number(held('ArrowRight')) - Number(held('ArrowLeft')),
      usingPad && !settingsOpen && !wheelUsed ? pad.cameraY : Number(held('ArrowUp')) - Number(held('ArrowDown')), dragPointer !== undefined && dragMode==='camera');
    pendingBoard = false;
    pendingAttack = false;
    pendingTurn = undefined;
    pendingJump = false;
    const position = character.actor.position;
    viewScale = THREE.MathUtils.lerp(viewScale, character.actor.scale.x, 1 - Math.exp(-3 * dt));
    cameraTarget.lerp(new THREE.Vector3(position.x, position.y + .9 * viewScale, position.z), 1 - Math.exp(-8 * dt));
    status.textContent = character.state === 'Run' && (held('ShiftLeft') || held('ShiftRight')) ? 'Спринт' : ({FireflyRide:'Катаемся на светлячке',Swim:'Плывём в круге',Balloon:'Летим на воздушном шаре',Sitting:'Отдыхаем на лавочке',Climb:'Лезем в домик',Lookout:'На обзорной площадке',LeafDive:'Прыгаем в листья',Swing:'Качаемся'} as Record<string,string>)[character.state] || labels[character.state] || character.state;
    if(character.starRemaining>0)status.textContent+=` · ★ ×2: ${Math.ceil(character.starRemaining)} с`;
    const neighbors = [character.actor.position, ...npcs.map(npc => npc.actor.position)];
    greetingCooldown=Math.max(0,greetingCooldown-dt);
    if(!coaster.riding && greetingCooldown===0) {
      const nearby=[...npcs].sort((a,b)=>a.actor.position.distanceToSquared(position)-b.actor.position.distanceToSquared(position));
      for(const npc of nearby)if(npc.actor.position.distanceTo(position)<24 && npc.greet(position)){greetingCooldown=3;break;}
    }
    for (const npc of npcs) {const previous=npc.actor.position.clone();if(!balloons.owns(npc))npc.update(dt, neighbors);if(npc.state!=='Balloon'){watermill.constrain(npc.actor.position,npc.actor.scale.x);treehouse.constrain(npc.actor.position,npc.actor.scale.x);maze.constrain(npc.actor.position,npc.actor.scale.x,previous);home.constrain(npc.actor.position,npc.actor.scale.x);}}
    if(npcs.some(n=>n.hello))sounds.sayHello();
    const hit = resolveAttack(character, npcs);
    const fireflyPickup=fireflies?.fruitPickupPosition;
    const eaten = fruits.update(dt, character, npcs, coaster.riding || treehouse.active || benches.active || balloons.riding || trampoline.active || home.active || (!!fireflies?.riding && !fireflyPickup),fireflyPickup);
    sounds.update(dt, character, npcs, followCamera.azimuth);
    sounds.updateRide(coaster.riding,coaster.rideMotion);
    sizeValue.textContent = `${Math.round(character.actor.scale.x * 100)}%`;
    npcFruitValue.textContent = String(npcs.reduce((sum,npc)=>sum+scoreOf(npc),0));
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
    if(maze.update(dt,character,!coaster.riding && !balloons.riding && !treehouse.active && !benches.active)){
      sounds.playBalloon('arrival',1);sounds.playTreehouse('cheer');message.textContent='★ Звезда найдена! Скорость и прыжок ×2 на 30 секунд!';hitMessageRemaining=5;
    }
    if(character.achievements.size>achievementsBefore){sounds.playTaskComplete(character.achievements.size-achievementsBefore);message.textContent=`+${3*(character.achievements.size-achievementsBefore)} очка за новое приключение!`;hitMessageRemaining=3;}
    taskList.update(character.achievements);
    fruitValue.textContent=String(scoreOf(character));
    const playerPoints=scoreOf(character),teamPoints=npcs.reduce((sum,npc)=>sum+scoreOf(npc),0);
    document.querySelector<HTMLElement>('#player-place')!.textContent=`${teamPoints>playerPoints?2:1}.`;
    document.querySelector<HTMLElement>('#npc-place')!.textContent=`${playerPoints>teamPoints?2:1}.`;
    const [leader,runnerUp]=teamPoints>playerPoints?[npcStatsRow,playerStatsRow]:[playerStatsRow,npcStatsRow];
    if(leader.nextElementSibling!==runnerUp)runnerUp.parentElement!.insertBefore(leader,runnerUp);
    hitMessageRemaining = Math.max(0, hitMessageRemaining - dt);
    message.hidden = hitMessageRemaining === 0;
  }
  else {coaster.update(dt);treehouse.update(dt);balloons.update(dt);maze.update(dt);trampoline.update(dt);}
  const { azimuth, elevation, distance } = followCamera;
  camera.position.set(cameraTarget.x + distance * viewScale * Math.cos(elevation) * Math.sin(azimuth), cameraTarget.y + distance * viewScale * Math.sin(elevation), cameraTarget.z + distance * viewScale * Math.cos(elevation) * Math.cos(azimuth));
  constrainToMeadow(camera.position, .5);
  camera.lookAt(cameraTarget);
  camera.updateMatrixWorld();
  if(character)wayfinder.update(character.actor.position,character.actor.scale.x,camera);
  shadows.update();
  const night=home.night;
  (scene.background as THREE.Color).set(night?'#0b1428':'#b3d9ef');(scene.fog as THREE.Fog).color.set(night?'#182b4b':'#d8e9eb');
  ambient.color.set(night?'#9db5e0':'#ffffff');ambient.groundColor.set(night?'#293850':'#779455');ambient.intensity=night?.7:2.4;
  for(const light of shadows.lights){light.color.set(night?'#bad0ff':'#fff1d7');light.intensity=night?1.35:3.2;}
  renderer.toneMappingExposure=night?1:1.2;
  updateSky(dt,camera,night);fireflies?.update(dt,night,camera.position);
  sounds.updateFireflyBuzz(character && fireflies ? fireflies.buzzLevel(character.actor.position) : 0);
  ponds.update(dt);
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




function resolveInteraction(c:CharacterController):{text:string;run:()=>unknown;target?:OutlineTarget}|undefined {
  const p=c.actor.position;
  const result=(text:string,run:()=>unknown,target?:OutlineTarget)=>({text,run,target});
  const region=(key:unknown,root:THREE.Object3D,center:THREE.Vector3,size:number[])=>outlineRegion(key,root,center,new THREE.Vector3(...size));
  const object=(root?:THREE.Object3D):OutlineTarget|undefined=>root?{key:root,root}:undefined;
  if(fireflies?.riding)return result(fireflies.prompt(c),()=>fireflies?.disembark());
  if(home.active)return result(home.prompt(p),()=>home.wake());
  const free=!coaster.riding && !balloons.riding && !treehouse.active && !benches.active && !trampoline.active;
  if(free && home.prompt(p))return c.flight.active?undefined:result(home.prompt(p),()=>home.start(c),region(home,home.group,home.group.position.clone().add(new THREE.Vector3(0,1,-.6)),[4,2.2,5]));
  if(trampoline.active)return result(trampoline.prompt(c),()=>{});
  if(free && trampoline.prompt(c))return p.y>.5?undefined:result(trampoline.prompt(c),()=>trampoline.start(c),region(trampoline,trampoline.group,trampoline.position.clone().add(new THREE.Vector3(0,.5,0)),[4,2,4]));
  if(coaster.riding)return result(coaster.prompt(c),()=>coaster.disembark());
  if(balloons.riding)return result(balloons.prompt(p),()=>{});
  if(benches.active)return result(benches.prompt(p),()=>benches.interact(c));
  if((!treehouse.active || treehouse.canSit) && benches.prompt(p)){
    if(c.flight.active)return;
    const seat=benches.outlineSeat(p)!;
    return result(benches.prompt(p),()=>benches.interact(c),region(seat,seat.floor>0?treehouse.group:scene,seat.position,[3.6,2.2,1.6]));
  }
  if(treehouse.active)return result(treehouse.prompt(p),()=>treehouse.interact(c));
  if(treehouse.prompt(p)){
    if(c.flight.active)return;
    const swing=p.x-TREEHOUSE_SITE.x<-7;
    return result(treehouse.prompt(p),()=>treehouse.interact(c),swing?object(treehouse.outlineSwing):region(treehouse,treehouse.group,TREEHOUSE_SITE.clone().add(new THREE.Vector3(-4,4.9,9.15)),[2.3,10.2,4.2]));
  }
  if(watermill.prompt(p))return result(watermill.prompt(p),()=>{watermill.interact(p);awardFirst(c,'mill');},object(watermill.handle));
  if(balloons.prompt(p))return c.flight.active?undefined:result(balloons.prompt(p),()=>balloons.board(c),object(balloons.outlineBalloon(p)));
  if(coaster.prompt(c))return result(coaster.prompt(c),()=>coaster.board(c),object(coaster.outlineCart(c)));
  const bug=fireflies?.outlineBug(c);
  if(bug)return result(fireflies!.prompt(c),()=>fireflies!.board(c),object(bug));
}
