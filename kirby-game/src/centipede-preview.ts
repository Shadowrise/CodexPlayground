import './centipede-preview.css';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {CENTIPEDE_CLIPS,CENTIPEDE_PHASE_DEMOS,type CentipedeClip} from './centipede-clips';
const stage=document.querySelector<HTMLElement>('#stage')!,loading=document.querySelector<HTMLElement>('#loading')!;
const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;stage.prepend(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#bbd5d4');scene.fog=new T.Fog('#bbd5d4',45,100);
const camera=new T.PerspectiveCamera(39,1,.1,150);camera.position.set(16,11,20);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.5,0);controls.enableDamping=true;controls.minDistance=4;controls.maxDistance=48;controls.maxPolarAngle=Math.PI*.49;
const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.55;room.dispose();pmrem.dispose();
scene.add(new T.HemisphereLight('#e8f8ff','#76928b',1.3));const light=new T.DirectionalLight('#fff1d4',2.5);light.position.set(-9,18,13);light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-13,right:13,top:13,bottom:-13,near:1,far:60});light.shadow.normalBias=.035;light.shadow.bias=-.00015;scene.add(light);
const floor=new T.Mesh(new T.PlaneGeometry(250,250),new T.MeshStandardMaterial({color:'#adc9be',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.22;floor.receiveShadow=true;scene.add(floor);
const dais=new T.Mesh(new T.CylinderGeometry(11.3,11.55,.3,96),new T.MeshStandardMaterial({color:'#e7ead6',roughness:.88}));dais.position.y=-.16;dais.receiveShadow=true;scene.add(dais);
const edge=new T.Mesh(new T.TorusGeometry(11.16,.035,5,96),new T.MeshStandardMaterial({color:'#759e8d',roughness:.7}));edge.rotation.x=Math.PI/2;edge.position.y=.002;scene.add(edge);
let mixer:T.AnimationMixer|undefined,current:T.AnimationAction|undefined,model:T.Object3D|undefined,phase=1,paused=false,queue:CentipedeClip[]=[],remaining=0,clipName:CentipedeClip='Idle';
const buttons=document.querySelector<HTMLElement>('#clips')!;
function showList(){buttons.replaceChildren();for(const meta of CENTIPEDE_CLIPS.filter(c=>c.phase===0||c.phase===phase)){const b=document.createElement('button');b.textContent=meta.label;b.dataset.clip=meta.name;b.classList.toggle('selected',meta.name===clipName);b.addEventListener('click',()=>{queue=[];play(meta.name);});buttons.append(b);}}
function play(name:CentipedeClip){
 if(!mixer||!model)return;const meta=CENTIPEDE_CLIPS.find(c=>c.name===name)!,clip=T.AnimationClip.findByName(model.animations,name)!,next=mixer.clipAction(clip);
 next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);next.setLoop(meta.loop?T.LoopRepeat:T.LoopOnce,meta.loop?Infinity:1);next.clampWhenFinished=true;next.play();if(current&&current!==next)current.crossFadeTo(next,.18,false);current=next;clipName=name;remaining=meta.duration;
 document.querySelector('#clip-title')!.textContent=meta.label;document.querySelector('#clip-description')!.textContent=meta.description;document.querySelector('#phase-label')!.textContent=meta.phase?`ФАЗА ${meta.phase} / ${['','ПОЙМАЙ ХВОСТИК','НЕ КАСАЙСЯ ПОЛА','БОЛЬШОЙ ПЕРЕКАТ'][meta.phase]}`:'ЗНАКОМСТВО';
 for(const b of buttons.querySelectorAll('button'))b.classList.toggle('selected',b.dataset.clip===name);
}
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-phase]'))b.addEventListener('click',()=>{phase=Number(b.dataset.phase);queue=[];document.querySelectorAll('[data-phase]').forEach(button=>button.classList.toggle('selected',button===b));showList();play(phase===1?'Idle':phase===2?'CoilArena':'CurlWheel');});
document.querySelector('#demo')!.addEventListener('click',()=>{queue=[...CENTIPEDE_PHASE_DEMOS[phase-1]];paused=false;document.querySelector('#pause')!.textContent='Ⅱ';play(queue.shift()!);});
document.querySelector('#pause')!.addEventListener('click',()=>{paused=!paused;document.querySelector('#pause')!.textContent=paused?'▶':'Ⅱ';});
document.querySelector('#restart')!.addEventListener('click',()=>{queue=[];play(clipName);});
const speed=document.querySelector<HTMLInputElement>('#speed')!;speed.addEventListener('input',()=>{document.querySelector('#speed-value')!.textContent=`${speed.value}×`;});
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-view]'))b.addEventListener('click',()=>{const mode=b.dataset.view;controls.target.set(0,mode==='face'?1.8:2,mode==='face'?7:0);camera.position.set(...(mode==='face'?[4,4,15]:mode==='side'?[25,9,2]:mode==='top'?[.01,30,.01]:[16,11,20]) as [number,number,number]);controls.update();});
function resize(){camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();renderer.setSize(stage.clientWidth,stage.clientHeight);}new ResizeObserver(resize).observe(stage);resize();
new GLTFLoader().load('/models/centipede-animated.glb',gltf=>{
 model=gltf.scene;model.animations=gltf.animations;let triangles=0,meshes=0;model.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=o.receiveShadow=true;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;meshes++;}});scene.add(model);mixer=new T.AnimationMixer(model);showList();play('Idle');loading.hidden=true;document.querySelector('#budget')!.textContent=`${gltf.animations.length} анимации · ${Math.round(triangles/1000)} тыс. треугольников · ${meshes} частей`;
 // Isolated preview diagnostics, never imported by the game.
 Object.assign(window,{centipedePreview:{model,mixer,renderer,scene,camera,play,freeze:()=>{paused=true;},sample:(name:CentipedeClip,time:number)=>{queue=[];paused=true;mixer!.stopAllAction();current=undefined;play(name);current!.time=time;mixer!.update(0);renderer.render(scene,camera);}}});
},undefined,error=>{console.error(error);loading.textContent='Не удалось загрузить модель. Обнови страницу.';});
let previous=performance.now();renderer.setAnimationLoop(now=>{const dt=Math.min(.05,(now-previous)/1000);previous=now;if(mixer&&!paused){const step=dt*Number(speed.value);mixer.update(step);remaining-=step;if(remaining<=0&&queue.length)play(queue.shift()!);}controls.update();renderer.render(scene,camera);});
