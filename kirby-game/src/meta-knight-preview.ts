import './meta-knight-preview.css';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {META_KNIGHT_CLIPS,META_KNIGHT_CLIP_BY_NAME,META_KNIGHT_CLIP_GROUPS,type MetaKnightClipName} from './meta-knight-clips';

type PreviewClip = MetaKnightClipName;
type PreviewView = 'three' | 'front' | 'side' | 'back';
const CLIPS = META_KNIGHT_CLIP_BY_NAME;
const stage = document.querySelector<HTMLElement>('#stage')!;
const loading = document.querySelector<HTMLElement>('#loading')!;
const status = document.querySelector<HTMLElement>('#status')!;
const description = document.querySelector<HTMLElement>('#clip-description')!;
const pauseButton = document.querySelector<HTMLButtonElement>('#pause')!;
const restartButton = document.querySelector<HTMLButtonElement>('#restart')!;
const speedInput = document.querySelector<HTMLInputElement>('#speed')!;
const speedValue = document.querySelector<HTMLOutputElement>('#speed-value')!;
const clipButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-clip]')];
const clipSelect = document.querySelector<HTMLSelectElement>('#all-clips')!;
for(const [group,label] of Object.entries(META_KNIGHT_CLIP_GROUPS)) {
  const choices=document.createElement('optgroup');choices.label=label;
  for(const clip of META_KNIGHT_CLIPS.filter(clip=>clip.group===group)) {
    const option=document.createElement('option');option.value=clip.name;option.textContent=clip.label;choices.append(option);
  }
  clipSelect.append(choices);
}
const viewButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-view]')];
let model: THREE.Object3D | undefined;
let mixer: THREE.AnimationMixer | undefined;
let currentAction: THREE.AnimationAction | undefined;
let currentClip: PreviewClip = 'Idle';
let currentView: PreviewView = 'three';
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let bounds: THREE.Box3 | undefined;
const actions = new Map<string, THREE.AnimationAction>();

const renderer = new THREE.WebGLRenderer({alpha: true, antialias: true, powerPreference: 'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, .05, 120);
camera.position.set(5.4, 3.3, 8.2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 3;
controls.maxDistance = 18;
controls.minPolarAngle = .22;
controls.maxPolarAngle = Math.PI * .49;
controls.target.set(0, 1.35, 0);

const environmentGenerator = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const environment = environmentGenerator.fromScene(room, .06);
scene.environment = environment.texture;
scene.environmentIntensity = .7;
room.dispose();
environmentGenerator.dispose();

scene.add(new THREE.HemisphereLight('#c3c4ff', '#20213f', 1.4));
const key = new THREE.DirectionalLight('#fff2d7', 2.7);
key.position.set(-3.5, 7, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, {left: -5, right: 5, top: 5, bottom: -5, near: .1, far: 20});
key.shadow.bias = -.0001;
key.shadow.normalBias = .018;
key.shadow.radius = 4;
scene.add(key);
const fill = new THREE.DirectionalLight('#b9c9ff', .9);
fill.position.set(5, 3.5, 4);
scene.add(fill);
const rim = new THREE.DirectionalLight('#ad8dff', 2.3);
rim.position.set(-3, 5, -4);
scene.add(rim);
const goldRim = new THREE.DirectionalLight('#ffce7a', .7);
goldRim.position.set(4, 2, -1);
scene.add(goldRim);

const platform = new THREE.Mesh(
  new THREE.CylinderGeometry(2.85, 2.92, .12, 96),
  new THREE.MeshStandardMaterial({color: '#101222', metalness: .15, roughness: .92, envMapIntensity: .12}),
);
platform.position.y = -.07;
platform.receiveShadow = true;
scene.add(platform);
const ring = new THREE.Mesh(
  new THREE.TorusGeometry(2.86, .009, 8, 128),
  new THREE.MeshBasicMaterial({color: '#6e617e', transparent: true, opacity: .45}),
);
ring.rotation.x = Math.PI / 2;
ring.position.y = -.025;
scene.add(ring);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.ShadowMaterial({color: '#02020e', opacity: .35}));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -.135;
floor.receiveShadow = true;
scene.add(floor);

function refreshPlayback() {
  pauseButton.innerHTML = `${paused ? '▶' : 'Ⅱ'} <span>${paused ? 'Продолжить' : 'Пауза'}</span>`;
  pauseButton.setAttribute('aria-label', paused ? 'Продолжить анимацию' : 'Приостановить анимацию');
  for (const button of clipButtons) {
    const selected = button.dataset.clip === currentClip;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  clipSelect.value=currentClip;
  status.textContent = `${CLIPS[currentClip].label} / ${paused ? 'пауза' : CLIPS[currentClip].loop ? 'зациклено' : 'действие'}`;
  description.textContent = `${META_KNIGHT_CLIP_GROUPS[CLIPS[currentClip].group]} · ${CLIPS[currentClip].label}. ${CLIPS[currentClip].loop?'Плавный цикл.':'Разовое действие; повтори кнопкой ↺.'}`;
  speedValue.value = `${Number(speedInput.value).toLocaleString('ru-RU')}×`;
}

function play(name: PreviewClip, keepPause = false) {
  const action = actions.get(name);
  if (!mixer || !action) return false;
  mixer.stopAllAction();
  currentAction = action;
  currentClip = name;
  const loop=CLIPS[name].loop;
  action.reset().setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1).setEffectiveTimeScale(1).setEffectiveWeight(1).play();
  action.clampWhenFinished=!loop;
  mixer.update(0);
  if (!keepPause) paused = false;
  refreshPlayback();
  return true;
}

function fitCamera(view: PreviewView = currentView) {
  if (!bounds) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  controls.target.copy(center);
  const direction = new THREE.Vector3(...(view === 'front' ? [0, .11, 1] : view === 'back' ? [0,.11,-1] : view === 'side' ? [-1, .08, 0] : [ .5, .24, 1]) as [number, number, number]).normalize();
  // Fit the complete animation envelope, including the wings and sword.
  // A fixed envelope keeps the camera steady while changing poses.
  const horizontal = view === 'side' ? size.z : view !== 'three' ? size.x : Math.hypot(size.x, size.z * .5);
  const vertical = size.y + (view === 'three' ? size.z * .17 : 0);
  const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const distance = Math.max(vertical / (2 * tangent), horizontal / (2 * tangent * camera.aspect)) * 1.27 + size.z * .22;
  camera.position.copy(center).addScaledVector(direction, distance);
  controls.minDistance = Math.max(2.5, distance * .45);
  controls.maxDistance = Math.max(18, distance * 2);
  controls.update();
}

function selectView(view: PreviewView) {
  currentView = view;
  fitCamera(view);
  for (const button of viewButtons) {
    const selected = button.dataset.view === view;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  renderer.render(scene, camera);
}

function sample(name: PreviewClip, time: number) {
  if (!play(name) || !mixer || !currentAction) return false;
  const duration = currentAction.getClip().duration;
  currentAction.time = CLIPS[name].loop?((time % duration) + duration) % duration:THREE.MathUtils.clamp(time,0,duration);
  mixer.update(0);
  paused = true;
  refreshPlayback();
  renderer.render(scene, camera);
  return true;
}

for (const button of clipButtons) button.addEventListener('click', () => play(button.dataset.clip as PreviewClip));
clipSelect.addEventListener('change',()=>play(clipSelect.value as PreviewClip));
for (const button of viewButtons) button.addEventListener('click', () => selectView(button.dataset.view as PreviewView));
pauseButton.addEventListener('click', () => {paused = !paused; refreshPlayback();});
restartButton.addEventListener('click', () => play(currentClip));
speedInput.addEventListener('input', refreshPlayback);
controls.addEventListener('start', () => {
  for (const button of viewButtons) {button.classList.remove('selected');button.setAttribute('aria-pressed', 'false');}
});

function resize() {
  const width = stage.clientWidth, height = stage.clientHeight;
  renderer.setSize(width, height);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  fitCamera();
  renderer.render(scene, camera);
}
new ResizeObserver(resize).observe(stage);
resize();

function fail(message: string) {
  loading.classList.add('load-error');
  loading.querySelector('p')!.textContent = message;
  loading.setAttribute('role', 'alert');
  status.textContent = 'Модель пока недоступна';
}

new GLTFLoader().load('/models/meta-knight-animated.glb?v=7', gltf => {
  model = gltf.scene;
  model.animations = gltf.animations;
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  scene.add(model);
  mixer = new THREE.AnimationMixer(model);
  for (const clip of gltf.animations) actions.set(clip.name, mixer.clipAction(clip));
  const missing = Object.keys(CLIPS).filter(name => !actions.has(name));
  if (missing.length) {fail('В модели пока не хватает анимаций. Попробуй открыть её немного позже.');return;}
  model.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(model, true);
  // Sample every requested clip to frame all poses without clipping the wings.
  for (const name of Object.keys(CLIPS) as PreviewClip[]) {
    const action = actions.get(name)!;
    mixer.stopAllAction();
    action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    for (let frame = 0; frame <= 16; frame++) {
      action.time = action.getClip().duration * frame / 16;
      mixer.update(0);
      model.updateMatrixWorld(true);
      bounds.union(new THREE.Box3().setFromObject(model, true));
    }
  }
  mixer.stopAllAction();
  for (const button of clipButtons) button.disabled = false;
  clipSelect.disabled=false;
  pauseButton.disabled = restartButton.disabled = speedInput.disabled = false;
  const parameters = new URLSearchParams(location.search);
  const requestedClip = parameters.get('clip');
  play(requestedClip && requestedClip in CLIPS ? requestedClip as PreviewClip : 'Idle', true);
  const requestedView = parameters.get('view');
  selectView(requestedView === 'front' || requestedView === 'side' || requestedView === 'back' ? requestedView : 'three');
  if (parameters.has('time')) sample(currentClip, Number(parameters.get('time')) || 0);
  loading.hidden = true;
  // Kept on this isolated page so browser QA can inspect the actual GLB and poses.
  Object.assign(window, {__metaKnightPreview: {
    model, mixer, renderer, scene, camera, controls, play, sample, selectView,
    clips: gltf.animations.map(clip => clip.name),
    get currentClip() {return currentClip;},
    get paused() {return paused;},
    get playbackRate() {return Number(speedInput.value);},
    get bounds() {return bounds?.clone();},
  }});
}, undefined, error => {
  console.error('Не удалось загрузить Мета-найта:', error);
  fail('Не удалось загрузить Мета-найта. Обнови страницу, чтобы попробовать снова.');
});

let previous = performance.now();
renderer.setAnimationLoop(now => {
  const delta = Math.min((now - previous) / 1000, .05);
  previous = now;
  if (mixer && !paused && !document.hidden) mixer.update(delta * Number(speedInput.value));
  controls.update();
  renderer.render(scene, camera);
});
