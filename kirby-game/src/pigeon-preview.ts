import './pigeon-preview.css';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {PIGEON_CLIPS, PIGEON_CLIP_GROUPS} from './pigeon-clips';
import {PIGEON_EMOTE_SOUNDS, loadPigeonEmoteBuffers, playPigeonEmoteBuffer, preloadPigeonEmoteSounds} from './pigeon-voice';
import type {Emote} from './emotes';
import {isPigeonGait, pigeonGaitRate, pigeonStanceSpeed, type PigeonGait} from './pigeon-locomotion';

const stage = document.querySelector<HTMLElement>('#stage')!;
const loading = document.querySelector<HTMLElement>('#loading')!;
const pauseButton = document.querySelector<HTMLButtonElement>('#pause')!;
const speedInput = document.querySelector<HTMLInputElement>('#speed')!;
const status = document.querySelector<HTMLElement>('#status')!;
const voiceInput = document.querySelector<HTMLInputElement>('#voice')!;
const voiceStatus = document.querySelector<HTMLElement>('#voice-status')!;
const clipDescription = document.querySelector<HTMLElement>('#clip-description')!;
const clipMetadata = new Map<string, typeof PIGEON_CLIPS[number]>(PIGEON_CLIPS.map(clip => [clip.name, clip]));
const emotionKeys: Emote[] = ['Hello', 'Joy', 'Fear', 'Anger', 'Sad'];
const groundSpeeds: Record<PigeonGait, number> = {Walk:pigeonStanceSpeed('Walk'), Run:3.4, WalkBackward:1.65};
let gamePace = true;
const pacePanel = document.createElement('div');
pacePanel.className = 'pace-panel';
pacePanel.innerHTML = '<div class="pace-options" role="group" aria-label="Темп движения"><button type="button" data-pace="game">Как в игре</button><button type="button" data-pace="native">Исходный темп</button></div><small class="pace-caption"></small>';
pacePanel.hidden = true;
clipDescription.before(pacePanel);
const descriptions: Record<string, string> = {
  Idle:'Переминается с лапки на лапку и оглядывается.',
  Walk:'Короткие шаги и знакомое голубиное качание головы.',
  Run:'Лапки торопятся, крылья помогают держать равновесие.',
  WalkBackward:'Осторожные шаги назад с небольшим наклоном.',
  RotateLeft:'Переступает лапками и поворачивается налево.',
  RotateRight:'Переступает лапками и поворачивается направо.',
  Jump:'Приседает, отталкивается лапками и мягко приземляется.',
  Fly:'Взмахи крыльев, лапки подняты и отведены назад под животом.',
  Swim:'Держится на воде, плавно гребёт лапками.',
  Push:'Наклоняется вперёд, упираясь грудью.',
  Attack:'Короткий выпад грудью с раскрытием крыльев.',
  Eat:'Наклоняется к земле и клюёт.',
  Peck:'Втягивает живот, наклоняется к земле и клюёт три раза подряд.',
  Death:'Теряет равновесие и оседает на бок.',
  Roll:'Подбирает лапки и крылья для переката.',
  Sitting:'Усаживается на живот, лапки расслаблены.',
  Swing:'Лапки свисают, голова и хвост ловят равновесие.',
  Cart:'Компактно сидит, слегка покачивается на ходу.',
  Boat:'Сидит в лодочке и мягко качается на волнах.',
  Balloon:'Выглядывает из корзины и оглядывается.',
  FireflyRide:'Держит равновесие на спине светлячка.',
  Sleep:'Подбирает лапки, закрывает глаза и тихо дышит.',
  Wake:'Открывает глаза, потягивается и просыпается.',
  Climb:'Перебирает лапками и помогает себе крыльями.',
  Lookout:'Осматривает окрестности, вытягивая шейку.',
  LeafDive:'Прячется в листьях, встряхивает перья.',
  Trampoline:'Мягко приседает и подпрыгивает с расправленными крыльями.',
  Hello:'Машет крылом и кивает: мягкое приветственное курлы-курлы.',
  Joy:'Приподнимается и встряхивает крылья: весёлое переливчатое курлы.',
  Fear:'Отшатывается и замирает: короткое дрожащее курлы.',
  Anger:'Нахохливается и делает выпад: низкое ворчливое курлы.',
  Sad:'Опускает голову и крылья: тихое нисходящее курлы.',
};

let audioContext: AudioContext | undefined;
let activeVoice: ReturnType<typeof playPigeonEmoteBuffer>;
let voiceRequest = 0;
void preloadPigeonEmoteSounds();

function stopVoice() {
  voiceRequest++;
  activeVoice?.source.stop();
  activeVoice = undefined;
}

async function speak(kind: Emote) {
  stopVoice();
  if (!voiceInput.checked || document.hidden) return;
  const request = voiceRequest;
  try {
    audioContext ??= new AudioContext();
    await audioContext.resume();
    const buffers = await loadPigeonEmoteBuffers(audioContext);
    if (request !== voiceRequest || document.hidden || !voiceInput.checked || paused) return;
    const buffer = buffers.get(kind);
    if (!buffer) {
      voiceStatus.textContent = 'Голос пока не загрузился. Анимация доступна.';
      return;
    }
    voiceStatus.textContent = PIGEON_EMOTE_SOUNDS[kind].label;
    activeVoice = playPigeonEmoteBuffer(audioContext, audioContext.destination, buffer, {gain:.65});
  } catch {
    voiceStatus.textContent = 'Голос пока недоступен. Анимация доступна.';
  }
}

const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .98;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#eee7db');
scene.fog = new THREE.Fog('#eee7db', 22, 45);
const perspectiveCamera = new THREE.PerspectiveCamera(34, 1, .05, 60);
perspectiveCamera.position.set(4.5, 2.55, 5.8);
const sideCamera = new THREE.OrthographicCamera(-2, 2, 2, -2, .05, 60);
let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = perspectiveCamera;
const controls = new OrbitControls(perspectiveCamera, renderer.domElement);
controls.target.set(0, 1.14, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 3.2;
controls.maxDistance = 12;
controls.maxPolarAngle = Math.PI * .49;
controls.update();

const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const environment = pmrem.fromScene(room, .04);
scene.environment = environment.texture;
scene.environmentIntensity = .38;
room.dispose();
pmrem.dispose();

scene.add(new THREE.HemisphereLight('#f3f7ff', '#b3a99b', 1.8));
const keyLight = new THREE.DirectionalLight('#fff3df', 3.15);
keyLight.position.set(-3.5, 7, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
Object.assign(keyLight.shadow.camera, {left:-4, right:4, top:4, bottom:-4, near:.1, far:16});
keyLight.shadow.normalBias = .025;
keyLight.shadow.bias = -.0001;
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight('#dbe7ff', 1.1);
fillLight.position.set(4, 3, -2);
scene.add(fillLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({color:'#eee7db', roughness:1}),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -.13;
floor.receiveShadow = true;
scene.add(floor);
const plinth = new THREE.Mesh(
  new THREE.CylinderGeometry(2.3, 2.35, .12, 96),
  new THREE.MeshStandardMaterial({color:'#f7f2e8', roughness:.88}),
);
plinth.position.y = -.07;
plinth.receiveShadow = true;
scene.add(plinth);

// Ride placement belongs to the game; this wrapper grounds the compact sleeping
// pose on the preview mattress without changing the exported model.
const poseRoot = new THREE.Group();
scene.add(poseRoot);
const bed = new THREE.Group();
const mattress = new THREE.Mesh(
  new THREE.BoxGeometry(2.3, .13, 3.1),
  new THREE.MeshStandardMaterial({color:'#e8d8bd', roughness:1}),
);
mattress.position.y = -.07;
mattress.receiveShadow = true;
bed.add(mattress);
const pillow = new THREE.Mesh(
  new THREE.SphereGeometry(.47, 24, 12),
  new THREE.MeshStandardMaterial({color:'#faf4e7', roughness:1}),
);
pillow.scale.set(1.4, .28, 1);
pillow.position.set(0, .01, 1.03);
pillow.receiveShadow = true;
bed.add(pillow);
bed.visible = false;
scene.add(bed);

let model: THREE.Object3D | undefined;
let mixer: THREE.AnimationMixer | undefined;
let currentAction: THREE.AnimationAction | undefined;
const actions = new Map<string, THREE.AnimationAction>();
let currentClip = 'Idle';
let activeGroup = 'movement';
let paused = false;
let resting = false;
let finished = false;
let sideBounds: THREE.Box3 | undefined;
let peckBounds: THREE.Box3 | undefined;

function selectGroup(group: string) {
  activeGroup = group;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-group]')) {
    const selected = button.dataset.group === group;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  }
  for (const panel of document.querySelectorAll<HTMLElement>('[data-clip-group]')) {
    panel.hidden = panel.dataset.clipGroup !== group;
  }
}

function buildClipControls(clips: THREE.AnimationClip[]) {
  const groups = document.querySelector<HTMLElement>('#clip-groups')!;
  const panels = document.querySelector<HTMLElement>('#clip-panels')!;
  const available = new Map(clips.map(clip => [clip.name, clip]));
  const ordered = [...PIGEON_CLIPS.map(clip => clip.name as string).filter(name => available.has(name)),
    ...clips.map(clip => clip.name).filter(name => !clipMetadata.has(name))];
  const headings: Record<string, string> = {...PIGEON_CLIP_GROUPS, other:'Ещё'};
  for (const [group, label] of Object.entries(headings)) {
    const names = ordered.filter(name => (clipMetadata.get(name)?.group ?? 'other') === group);
    if (!names.length) continue;
    const tab = document.createElement('button');
    tab.type = 'button'; tab.dataset.group = group; tab.id = `tab-${group}`;
    tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', `clips-${group}`);
    tab.textContent = label;
    tab.addEventListener('click', () => selectGroup(group));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const tabs = [...groups.querySelectorAll<HTMLButtonElement>('[data-group]')];
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
        : (tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      selectGroup(tabs[index].dataset.group!); tabs[index].focus();
    });
    groups.append(tab);
    const panel = document.createElement('div');
    panel.id = `clips-${group}`; panel.dataset.clipGroup = group; panel.className = 'clip-panel';
    panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', tab.id);
    for (const name of names) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'clip'; button.dataset.clip = name;
      if (name === 'Walk') button.id = 'walk';
      button.textContent = clipMetadata.get(name)?.label ?? name;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        play(name);
        if (emotionKeys.includes(name as Emote)) void speak(name as Emote);
      });
      panel.append(button);
    }
    panels.append(panel);
  }
  selectGroup(activeGroup);
}

function presentPose(time = 0) {
  if (!model) return;
  const sleep = !resting && (currentClip === 'Sleep' || currentClip === 'Wake');
  poseRoot.rotation.x = 0;
  poseRoot.position.y = 0;
  bed.visible = sleep;
  plinth.visible = camera !== sideCamera && !sleep;
  if (sleep) {
    poseRoot.updateMatrixWorld(true);
    model.traverse(object => {
      if (object instanceof THREE.SkinnedMesh) {
        object.skeleton.update();
        object.computeBoundingBox();
      }
    });
    const bounds = new THREE.Box3().setFromObject(poseRoot);
    poseRoot.position.y = .025 - bounds.min.y;
  }
}

function fitSideCamera() {
  if (!sideBounds) return;
  let bounds = sideBounds;
  if (!resting) {
    if (currentClip === 'Peck' && peckBounds) bounds = peckBounds;
    else if (['Sleep','Wake'].includes(currentClip)) bounds = new THREE.Box3().setFromObject(poseRoot);
  }
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const aspect = stage.clientWidth / stage.clientHeight;
  const halfHeight = Math.max(size.y / 2, size.z / (2 * aspect)) * 1.3;
  sideCamera.left = -halfHeight * aspect;
  sideCamera.right = halfHeight * aspect;
  sideCamera.top = halfHeight;
  sideCamera.bottom = -halfHeight;
  // Looking from −X makes +Z (the beak) point right, as in the approved sketch.
  sideCamera.position.set(-8, center.y, center.z);
  sideCamera.lookAt(0, center.y, center.z);
  sideCamera.updateProjectionMatrix();
}

function selectView(view: string) {
  floor.visible = view !== 'side';
  if (view === 'side') {
    camera = sideCamera;
    controls.enabled = false;
    fitSideCamera();
  } else {
    camera = perspectiveCamera;
    controls.enabled = true;
    controls.target.set(0, 1.14, 0);
    const position: [number, number, number] = view === 'front'
      ? [0, 2.15, 6.8] : [4.5, 2.55, 5.8];
    perspectiveCamera.position.set(...position);
    controls.update();
  }
  presentPose(currentAction?.time);
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) {
    const selected = button.dataset.view === view;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  document.querySelector<HTMLElement>('.orbit-hint')!.textContent = view === 'side'
    ? 'Вид сбоку · движение в профиль' : 'Потяни, чтобы повернуть · колесо — масштаб';
  renderer.render(scene, camera);
}

function sideView() {
  selectView('side');
}

function refreshPlayback() {
  pauseButton.disabled = resting;
  const label = finished ? 'Повторить' : paused ? 'Продолжить' : 'Пауза';
  pauseButton.innerHTML = `${paused ? '▶' : 'Ⅱ'} <span>${label}</span>`;
  pauseButton.setAttribute('aria-label', finished ? 'Повторить анимацию' : paused ? 'Продолжить анимацию' : 'Приостановить анимацию');
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-clip]')) {
    const selected = !resting && button.dataset.clip === currentClip;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  document.querySelector('#rest')!.classList.toggle('selected', resting);
  document.querySelector('#rest')!.setAttribute('aria-pressed', String(resting));
  const name = clipMetadata.get(currentClip)?.label ?? currentClip;
  const state = finished ? 'готово' : paused ? 'пауза' : clipMetadata.get(currentClip)?.loop === false ? 'один раз' : 'зациклено';
  status.textContent = resting ? 'Исходная поза / модель' : `${name} / ${state}`;
  clipDescription.textContent = resting ? 'Утверждённые пропорции и текстура в исходной позе.' : descriptions[currentClip] ?? 'Анимация из модели.';
  pacePanel.hidden = resting || !isPigeonGait(currentClip);
  for (const button of pacePanel.querySelectorAll<HTMLButtonElement>('[data-pace]')) {
    const selected = (button.dataset.pace === 'game') === gamePace;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  if (isPigeonGait(currentClip)) {
    const speed = (gamePace ? groundSpeeds[currentClip] : pigeonStanceSpeed(currentClip)) * Number(speedInput.value);
    pacePanel.querySelector('.pace-caption')!.textContent = `Темп для ${speed.toLocaleString('ru-RU', {maximumFractionDigits:2})} м/с`;
  }
}

function setGamePace(enabled: boolean) {
  gamePace = enabled;
  const rate = gamePace && isPigeonGait(currentClip) ? pigeonGaitRate(currentClip, groundSpeeds[currentClip], 1, 1) : 1;
  currentAction?.setEffectiveTimeScale(rate);
  refreshPlayback();
  return rate;
}

for (const button of pacePanel.querySelectorAll<HTMLButtonElement>('[data-pace]')) {
  button.addEventListener('click', () => setGamePace(button.dataset.pace === 'game'));
}

function play(name = 'Walk') {
  const action = actions.get(name);
  if (!mixer || !action) return false;
  stopVoice();
  mixer.stopAllAction();
  currentClip = name;
  currentAction = action;
  const loops = clipMetadata.get(name)?.loop !== false;
  action.reset().setLoop(loops ? THREE.LoopRepeat : THREE.LoopOnce, loops ? Infinity : 1);
  action.clampWhenFinished = !loops;
  action.setEffectiveTimeScale(gamePace && isPigeonGait(name) ? pigeonGaitRate(name, groundSpeeds[name], 1, 1) : 1);
  action.play();
  mixer.update(0);
  resting = false;
  paused = false;
  finished = false;
  presentPose();
  if (camera === sideCamera) fitSideCamera();
  selectGroup(clipMetadata.get(name)?.group ?? 'other');
  refreshPlayback();
  return true;
}

function rest() {
  if (!mixer) return;
  stopVoice();
  mixer.stopAllAction();
  resting = true;
  paused = true;
  finished = false;
  presentPose();
  refreshPlayback();
  renderer.render(scene, camera);
}

function sample(time: number, name = 'Walk') {
  if (!mixer || !play(name) || !currentAction) return;
  const duration = currentAction.getClip().duration;
  const loops = clipMetadata.get(name)?.loop !== false;
  currentAction.time = loops ? ((time % duration) + duration) % duration : Math.max(0, Math.min(duration, time));
  mixer.update(0);
  paused = true;
  resting = false;
  presentPose(currentAction.time);
  if (camera === sideCamera) fitSideCamera();
  refreshPlayback();
  renderer.render(scene, camera);
}

function sampleClip(name: string, time: number) { sample(time, name); }

function renderIcon() {
  if (!model) return;
  const playback = {name:currentClip, time:currentAction?.time ?? 0, paused, resting, finished};
  const background = scene.background, fog = scene.fog;
  const size = renderer.getSize(new THREE.Vector2()), pixelRatio = renderer.getPixelRatio();
  const clearColor = renderer.getClearColor(new THREE.Color()), clearAlpha = renderer.getClearAlpha();
  const showFloor = floor.visible;
  rest();
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  const iconCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, .05, 60);
  iconCamera.position.copy(center).add(new THREE.Vector3(4.5, 1.41, 5.8).normalize().multiplyScalar(8));
  iconCamera.lookAt(center);
  iconCamera.updateMatrixWorld(true);
  const projected = new THREE.Box2();
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const point = new THREE.Vector3(x, y, z).project(iconCamera);
    projected.expandByPoint(new THREE.Vector2(point.x, point.y));
  }
  const projectedSize = projected.getSize(new THREE.Vector2());
  const aspect = 140 / 128;
  const halfHeight = Math.max(projectedSize.y / 2, projectedSize.x / (2 * aspect)) * 1.04;
  iconCamera.left = -halfHeight * aspect; iconCamera.right = halfHeight * aspect;
  iconCamera.top = halfHeight; iconCamera.bottom = -halfHeight;
  iconCamera.updateProjectionMatrix();
  scene.background = null; scene.fog = null;
  floor.visible = plinth.visible = bed.visible = false;
  renderer.setClearColor(0, 0); renderer.setPixelRatio(1); renderer.setSize(140, 128, false);
  renderer.render(scene, iconCamera);
  const image = renderer.domElement.toDataURL('image/png');
  renderer.setPixelRatio(pixelRatio); renderer.setSize(size.x, size.y);
  renderer.setClearColor(clearColor, clearAlpha);
  scene.background = background; scene.fog = fog;
  floor.visible = showFloor;
  if (!playback.resting) sample(playback.time, playback.name);
  paused = playback.paused; finished = playback.finished;
  presentPose(currentAction?.time);
  refreshPlayback();
  renderer.render(scene, camera);
  return image;
}

document.querySelector('#rest')!.addEventListener('click', rest);
pauseButton.addEventListener('click', () => {
  if (resting) return;
  if (finished) {
    play(currentClip);
    if (emotionKeys.includes(currentClip as Emote)) void speak(currentClip as Emote);
    return;
  }
  paused = !paused;
  if (paused) stopVoice();
  refreshPlayback();
});
document.querySelector('#restart')!.addEventListener('click', () => {
  play(currentClip);
  if (emotionKeys.includes(currentClip as Emote)) void speak(currentClip as Emote);
});
speedInput.addEventListener('input', () => {
  document.querySelector('#speed-value')!.textContent = `${Number(speedInput.value).toLocaleString('ru-RU')}×`;
  refreshPlayback();
});
voiceInput.addEventListener('change', () => {
  if (!voiceInput.checked) stopVoice();
  voiceStatus.textContent = voiceInput.checked ? 'У каждой эмоции свой голос.' : 'Эмоции без звука.';
});
window.addEventListener('keydown', event => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.target instanceof HTMLElement && (event.target.matches('input, select, textarea') || event.target.isContentEditable)) return;
  const digit = /^(?:Digit|Numpad)([1-5])$/.exec(event.code);
  if (!digit) return;
  const kind = emotionKeys[Number(digit[1]) - 1];
  if (play(kind)) { event.preventDefault(); void speak(kind); }
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  stopVoice();
  void audioContext?.suspend();
});
window.addEventListener('blur', stopVoice);

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) {
  button.addEventListener('click', () => selectView(button.dataset.view!));
}

document.querySelector<HTMLButtonElement>('#reference-toggle')!.addEventListener('click', event => {
  const panel = document.querySelector<HTMLElement>('#reference')!;
  const button = event.currentTarget as HTMLButtonElement;
  panel.hidden = !panel.hidden;
  button.classList.toggle('selected', !panel.hidden);
  button.setAttribute('aria-pressed', String(!panel.hidden));
});

function resize() {
  perspectiveCamera.aspect = stage.clientWidth / stage.clientHeight;
  perspectiveCamera.updateProjectionMatrix();
  fitSideCamera();
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  renderer.render(scene, camera);
}
new ResizeObserver(resize).observe(stage);
resize();

new GLTFLoader().load('/models/pigeon-animated.glb?v=19', gltf => {
  model = gltf.scene;
  model.animations = gltf.animations;
  let triangles = 0;
  model.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
    }
  });
  poseRoot.add(model);
  model.updateMatrixWorld(true);
  sideBounds = new THREE.Box3().setFromObject(model);
  mixer = new THREE.AnimationMixer(model);
  if (!gltf.animations.length) {
    loading.textContent = 'В модели пока нет анимаций.';
    return;
  }
  for (const clip of gltf.animations) actions.set(clip.name, mixer.clipAction(clip));
  // Fit the whole pecking motion once, so the forward reach stays in frame
  // without making the camera zoom in and out with every nod.
  const peck = actions.get('Peck');
  if (peck) {
    peck.reset().setLoop(THREE.LoopOnce, 1).play();
    peck.clampWhenFinished = true;
    peckBounds = sideBounds.clone();
    for (let frame = 0; frame <= 32; frame++) {
      peck.time = peck.getClip().duration * frame / 32;
      mixer.update(0); model.updateMatrixWorld(true);
      peckBounds.union(new THREE.Box3().setFromObject(model, true));
    }
    mixer.stopAllAction();
  }
  buildClipControls(gltf.animations);
  mixer.addEventListener('finished', event => {
    if (event.action !== currentAction) return;
    finished = true; paused = true;
    refreshPlayback();
  });
  play(actions.has('Idle') ? 'Idle' : actions.has('Walk') ? 'Walk' : gltf.animations[0].name);
  loading.hidden = true;
  const clipCount = gltf.animations.length;
  const countWord = clipCount % 10 === 1 && clipCount % 100 !== 11 ? 'анимация'
    : clipCount % 10 >= 2 && clipCount % 10 <= 4 && (clipCount % 100 < 12 || clipCount % 100 > 14) ? 'анимации' : 'анимаций';
  document.querySelector('#budget')!.textContent = `${clipCount} ${countWord} · ${Math.round(triangles / 1000)} тыс. треугольников`;
  // Isolated model-viewer diagnostics; the game does not import this module.
  Object.assign(window, {pigeonPreview:{
    model, mixer, renderer, scene, controls, sample, sampleClip, rest, play, sideView, selectView, renderIcon, setGamePace,
    clips: gltf.animations.map(clip => clip.name),
    get currentClip() { return resting ? 'Rest' : currentClip; },
    get paused() { return paused; },
    get playbackRate() { return (currentAction?.getEffectiveTimeScale() ?? 1) * Number(speedInput.value); },
    get camera() { return camera; },
  }});
  refreshPlayback();
  const parameters = new URLSearchParams(location.search);
  const initialClip = parameters.get('clip');
  if (initialClip && actions.has(initialClip)) {
    if (parameters.has('time')) sample(Number(parameters.get('time')) || 0, initialClip);
    else play(initialClip);
  }
  if (parameters.get('view') === 'side') sideView();
  else if (parameters.get('view') === 'front') selectView('front');
}, undefined, error => {
  console.error(error);
  loading.textContent = 'Не удалось загрузить голубя. Обнови страницу.';
});

let previous = performance.now();
renderer.setAnimationLoop(now => {
  const delta = Math.min((now - previous) / 1000, .05);
  previous = now;
  if (mixer && !paused && !resting && !document.hidden) {
    mixer.update(delta * Number(speedInput.value));
    presentPose(currentAction?.time);
  }
  if (controls.enabled) controls.update();
  renderer.render(scene, camera);
});
