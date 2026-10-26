import './health-heart-preview.css';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HealthHeart } from './health-heart';
import { getHealthHeartStats } from './health-heart-model';

const stage = document.querySelector<HTMLElement>('#stage')!;
const mist = document.querySelector<HTMLInputElement>('#mist')!;
const glints = document.querySelector<HTMLInputElement>('#glints')!;
const spin = document.querySelector<HTMLInputElement>('#spin')!;
const pause = document.querySelector<HTMLButtonElement>('#pause')!;
const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setClearColor(0, 0); renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = .95; stage.prepend(renderer.domElement);
const scene = new T.Scene(), camera = new T.PerspectiveCamera(32, 1, .05, 50);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.enablePan = false;
controls.minDistance = 1.9; controls.maxDistance = 7;
const pmrem = new T.PMREMGenerator(renderer), room = new RoomEnvironment();
const environment = pmrem.fromScene(room, .045);
scene.environment = environment.texture; scene.environmentIntensity = .55;
room.dispose(); pmrem.dispose();
const key = new T.DirectionalLight('#fff0e6', 2); key.position.set(-3, 4, 5);
const rim = new T.DirectionalLight('#ff7b96', 1.1); rim.position.set(3, 1, -2);
scene.add(key, rim, new T.HemisphereLight('#eddce9', '#5b253d', .5));
const heart = new HealthHeart(); scene.add(heart.group);
// Reuse this exact viewer in browser checks, including after Vite hot updates.
Object.assign(window, { healthHeartPreview: { heart, renderer, scene, camera } });
let elapsed = 0, previous: number | undefined;
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let view = 'three';
function setView(next: string) {
  view = next;
  const yaw = next === 'front' ? 0 : next === 'side' ? Math.PI / 2 : next === 'back' ? Math.PI : .38;
  const aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
  const distance = 3.25 * Math.max(1, .85 / aspect);
  camera.position.set(Math.sin(yaw) * distance, next === 'front' || next === 'back' ? .02 : .14 * distance, Math.cos(yaw) * distance);
  controls.target.set(0, 0, 0); controls.update();
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === next)));
}
function updatePause() { pause.setAttribute('aria-pressed', String(paused)); pause.textContent = paused ? '▷ Продолжить' : 'Ⅱ Пауза'; }
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view!)));
document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => button.addEventListener('click', () => {
  heart.floating = button.dataset.mode === 'dropped';
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
}));
mist.addEventListener('change', () => { heart.mistEnabled = mist.checked; });
glints.addEventListener('change', () => { heart.glintsEnabled = glints.checked; });
spin.addEventListener('change', () => { heart.spinEnabled = spin.checked; });
pause.addEventListener('click', () => { paused = !paused; updatePause(); });
document.querySelector('#triangles')!.textContent = getHealthHeartStats().triangles.toLocaleString('ru-RU');
let lastDraws = -1;
const resize = new ResizeObserver(() => {
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  camera.aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
  camera.updateProjectionMatrix(); setView(view);
});
resize.observe(stage); updatePause(); setView(view);
renderer.setAnimationLoop(time => {
  if (!paused && previous !== undefined) elapsed += Math.min(.06, (time - previous) / 1000);
  previous = time; heart.update(elapsed); controls.update();
  renderer.render(scene, camera);
  if (renderer.info.render.calls !== lastDraws) {
    lastDraws = renderer.info.render.calls; document.querySelector('#draws')!.textContent = String(lastDraws);
  }
  document.querySelector<HTMLElement>('#loading')!.hidden = true;
});
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  renderer.setAnimationLoop(null); resize.disconnect(); controls.dispose(); heart.dispose(); environment.dispose(); renderer.dispose();
});
