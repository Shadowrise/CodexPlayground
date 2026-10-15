import './meta-knight-seal-preview.css';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {MetaKnightSeal} from './meta-knight-seal';

type SealView='front'|'three'|'side'|'back';
const stage=document.querySelector<HTMLElement>('#seal-stage')!;
const modelToggle=document.querySelector<HTMLInputElement>('#seal-model')!;
const mistToggle=document.querySelector<HTMLInputElement>('#seal-mist')!;
const pauseButton=document.querySelector<HTMLButtonElement>('#seal-pause')!;
const spinButton=document.querySelector<HTMLButtonElement>('#seal-spin')!;
const callsOutput=document.querySelector<HTMLElement>('#seal-calls')!;
const trianglesOutput=document.querySelector<HTMLElement>('#seal-triangles')!;
const viewButtons=[...document.querySelectorAll<HTMLButtonElement>('[data-view]')];
const countButtons=[...document.querySelectorAll<HTMLButtonElement>('[data-count]')];

const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.setClearColor(0,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
stage.prepend(renderer.domElement);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(34,1,.05,100);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.enablePan=false;controls.minDistance=2.2;controls.maxDistance=16;
controls.minPolarAngle=.24;controls.maxPolarAngle=Math.PI*.88;controls.target.set(0,0,0);

// One startup environment supplies both the silver and gold reflections.
// The measured frame contains only the seals and their optional mist.
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
const environment=pmrem.fromScene(room,.06);scene.environment=environment.texture;scene.environmentIntensity=1;
room.dispose();pmrem.dispose();
const seals=Array.from({length:3},(_,index)=>new MetaKnightSeal(index*2.1));
for(const seal of seals){seal.spinEnabled=false;scene.add(seal.group);}
let count:1|3=1,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,spinning=false;
let elapsed=0,previousTime:number|undefined,currentView:SealView='three';
let lastCalls=-1,lastTriangles=-1;

function setView(view:SealView){
 currentView=view;const angle=view==='three'?.40:view==='side'?Math.PI/2:view==='back'?Math.PI:0;
 const width=stage.clientWidth,height=Math.max(1,stage.clientHeight),aspect=width/height;
 const distance=(count===1?4.9:9.2)*Math.max(1,1/aspect);
 camera.position.set(Math.sin(angle)*distance,.16*distance,Math.cos(angle)*distance);controls.target.set(0,0,0);controls.update();
 for(const button of viewButtons)button.setAttribute('aria-pressed',String(button.dataset.view===view));
}
function setCount(value:1|3){
 count=value;
 for(const [index,seal] of seals.entries()){
  seal.active=index<count;seal.group.position.set(count===1?0:(index-1)*1.8,0,0);
 }
 for(const button of countButtons)button.setAttribute('aria-pressed',String(Number(button.dataset.count)===count));
 setView(currentView);
}
function updatePlayback(){
 pauseButton.setAttribute('aria-pressed',String(paused));pauseButton.innerHTML=paused?'<span aria-hidden="true">▷</span> Продолжить':'<span aria-hidden="true">Ⅱ</span> Пауза';
 spinButton.setAttribute('aria-pressed',String(spinning));
 for(const seal of seals)seal.spinEnabled=spinning;
}
function renderFrame(){
 for(const [index,seal] of seals.entries()){
  seal.update(elapsed,camera.position);seal.group.visible=index<count;
  seal.model.visible=modelToggle.checked;seal.aura.visible=mistToggle.checked;seal.mistEnabled=mistToggle.checked;
 }
 controls.update();renderer.info.reset();renderer.render(scene,camera);
 const {calls,triangles}=renderer.info.render;
 if(calls!==lastCalls){callsOutput.textContent=calls.toLocaleString('ru-RU');lastCalls=calls;}
 if(triangles!==lastTriangles){trianglesOutput.textContent=triangles.toLocaleString('ru-RU');lastTriangles=triangles;}
}
for(const button of viewButtons)button.addEventListener('click',()=>setView(button.dataset.view as SealView));
for(const button of countButtons)button.addEventListener('click',()=>setCount(Number(button.dataset.count) as 1|3));
modelToggle.addEventListener('change',renderFrame);mistToggle.addEventListener('change',renderFrame);
pauseButton.addEventListener('click',()=>{paused=!paused;updatePlayback();});
spinButton.addEventListener('click',()=>{spinning=!spinning;updatePlayback();});
const resize=new ResizeObserver(()=>{renderer.setSize(stage.clientWidth,stage.clientHeight);camera.aspect=stage.clientWidth/Math.max(1,stage.clientHeight);camera.updateProjectionMatrix();setView(currentView);});
resize.observe(stage);updatePlayback();setCount(1);
renderer.setAnimationLoop(time=>{
 if(previousTime!==undefined&&!paused)elapsed+=Math.min(.06,Math.max(0,(time-previousTime)/1000));previousTime=time;
 renderFrame();document.querySelector<HTMLElement>('#seal-loading')!.hidden=true;
});
window.addEventListener('pagehide',event=>{if(event.persisted)return;renderer.setAnimationLoop(null);resize.disconnect();controls.dispose();for(const seal of seals)seal.dispose();environment.dispose();renderer.dispose();});
