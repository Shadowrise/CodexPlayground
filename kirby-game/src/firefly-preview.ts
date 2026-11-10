import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Firefly, FIREFLY_MODES, type FireflyMode } from './firefly';
import {setFireflyBloomColor} from './firefly-bloom';
import {FIREFLY_MODEL_FILE} from './firefly-asset';
const scene=new T.Scene();scene.background=new T.Color('#121e29');
const camera=new T.PerspectiveCamera(40,innerWidth/innerHeight,.1,100);camera.position.set(3.4,2.5,4.5);
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;document.body.append(renderer.domElement);
renderer.shadowMap.type=T.PCFSoftShadowMap;
const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.04).texture;scene.environmentIntensity=.4;room.dispose();pmrem.dispose();
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.85,0);controls.enableDamping=true;controls.minDistance=2.5;controls.maxDistance=10;controls.maxPolarAngle=Math.PI*.48;
scene.add(new T.HemisphereLight('#e2f0dd','#485847',1.8));const key=new T.DirectionalLight('#fff0c9',3);key.position.set(-3,6,4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.normalBias=.015;scene.add(key);
const fill=new T.DirectionalLight('#b5e4e3',1.5);fill.position.set(4,2,-3);scene.add(fill);
const ground=new T.Mesh(new T.CircleGeometry(8,80),new T.MeshStandardMaterial({color:'#24363a',roughness:.95}));ground.rotation.x=-Math.PI/2;ground.position.y=.015;ground.receiveShadow=true;scene.add(ground);
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),.55,.5,1.1));composer.addPass(new OutputPass());
let firefly:Firefly|undefined;
let selectedMode:FireflyMode='Sit',paused=false;
const clips=new Map<string,T.AnimationClip>();
const timeInput=document.querySelector<HTMLInputElement>('#animation-time')!;
const playback=document.querySelector<HTMLButtonElement>('#playback')!;
function playbackState(){playback.textContent=paused?'Продолжить':'Пауза';playback.setAttribute('aria-pressed',String(paused));}
function seek(time:number){
  if(!firefly)return;const clip=clips.get(selectedMode)!;
  const value=T.MathUtils.clamp(time,0,clip.duration);
  firefly.mixer.stopAllAction();const action=firefly.mixer.clipAction(clip);
  action.reset().stopFading().setEffectiveWeight(1).play();action.time=value;firefly.mixer.update(0);timeInput.value=value.toFixed(2);
}
playback.onclick=()=>{paused=!paused;playbackState();};
timeInput.oninput=()=>{if(!Number.isFinite(timeInput.valueAsNumber))return;paused=true;playbackState();seek(timeInput.valueAsNumber);};
for(const [name,position,target] of [
  ['front',[0,1.35,3.9],[0,1.0,.1]],['side',[4.2,1.25,0],[0,.85,-.12]],['overview',[3.4,2.5,4.5],[0,.85,0]],
] as const)document.querySelector<HTMLButtonElement>('#view-'+name)!.onclick=()=>{camera.position.fromArray(position);controls.target.fromArray(target);controls.update();};
const descriptions:Record<FireflyMode,string>={
  Sit:'Дышит, моргает, прислушивается усиками и иногда встряхивает крылья.',
  Fly:'Машет крыльями, покачивает лапками и усиками, мягко балансирует в воздухе.',
  LookAround:'С любопытством оглядывается по сторонам и наклоняет голову.',
  Groom:'Пригибает усик к щеке и передней лапкой проводит вдоль него, затем повторяет с другой стороны.',
  WingStretch:'Неторопливо приподнимает надкрылья и расправляет прозрачные крылья.',
};
new GLTFLoader().load('./models/'+FIREFLY_MODEL_FILE,gltf=>{for(const clip of gltf.animations)clips.set(clip.name,clip);firefly=new Firefly(gltf);setFireflyBloomColor(firefly,document.querySelector<HTMLInputElement>('#glow')!.value);scene.add(firefly.object);document.querySelector('#message')!.textContent=descriptions.Sit;},undefined,()=>{document.querySelector('#message')!.textContent='Не удалось загрузить модель.';});
for(const mode of FIREFLY_MODES)document.querySelector(`#${mode.toLowerCase()}`)!.addEventListener('click',()=>{
  if(!firefly)return;selectedMode=mode;firefly.setMode(mode);timeInput.max=String(clips.get(mode)!.duration);timeInput.value='0';if(paused)seek(0);
  for(const value of FIREFLY_MODES)document.querySelector(`#${value.toLowerCase()}`)!.setAttribute('aria-pressed',String(mode===value));
  document.querySelector('#message')!.textContent=descriptions[mode];
});
document.querySelector<HTMLInputElement>('#glow')!.addEventListener('input',event=>{if(firefly)setFireflyBloomColor(firefly,(event.target as HTMLInputElement).value);});
let previous=performance.now();renderer.setAnimationLoop(time=>{const dt=Math.min(.05,(time-previous)/1000);previous=time;if(!paused){firefly?.update(dt);if(firefly&&document.activeElement!==timeInput)timeInput.value=firefly.mixer.clipAction(clips.get(selectedMode)!).time.toFixed(2);}controls.update();composer.render();});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);});
