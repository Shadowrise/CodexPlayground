import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PidgieNpc} from '../src/pidgie-npc';
import {PigeonCrowd,pigeonPalette} from '../src/pigeon-crowd';
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1280,800);document.body.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#a5c3dc');scene.add(new T.HemisphereLight(0xffffff,0x556655,3));
const light=new T.DirectionalLight(0xffffff,3);light.position.set(20,40,20);scene.add(light);
const camera=new T.PerspectiveCamera(45,1.6,.1,1000);camera.position.set(27,30,41);camera.lookAt(0,1,0);
const loader=new GLTFLoader(),templates=await Promise.all(['pigeon','snowball'].map(name=>loader.loadAsync('/models/'+name+'-animated.glb')));
templates.forEach(pigeonPalette);
let group=new T.Group();scene.add(group);
(window as any).benchReady=true;
(window as any).runBench=async(mode:string)=>{
 scene.remove(group);group=new T.Group();scene.add(group);
 const crowds=templates.map(t=>new PigeonCrowd(t)),actors:PidgieNpc[]=[];crowds.forEach(c=>c.begin(10));
 for(let i=0;i<20;i++){
  const npc=new PidgieNpc(templates[i%2],{safeGround:()=>true,summoned:true,clockOnly:mode==='instanced'});
  const state=npc.networkState();state.phase='follow';state.followId='target';state.followSpeed=0;state.clip=(['Fly','Hello','Run','Idle'] as const)[i%4];
  const clip=templates[i%2].animations.find(c=>c.name===state.clip)!;state.clipTime=clip.duration*.5;state.p=[(i%5-2)*6,0,(Math.floor(i/5)-1.5)*7];state.yaw=.45;
  npc.presentSummoned(state,.2);actors.push(npc);group.add(npc.actor);if(mode==='instanced')crowds[i%2].add(npc);
 }
 if(mode==='instanced')for(const c of crowds){c.end();group.add(c.group);}
 const gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),gpu:number[]=[],cpu:number[]=[],frames:number[]=[],pending:WebGLQuery[]=[];
 for(let i=0;i<150;i++){
  const at=await new Promise<number>(r=>requestAnimationFrame(r));if(i>30)frames.push(at-(window as any).lastFrame);(window as any).lastFrame=at;
  const q=ext&&gl.createQuery();if(q)gl.beginQuery(ext.TIME_ELAPSED_EXT,q);
  const start=performance.now();renderer.render(scene,camera);if(i>30)cpu.push(performance.now()-start);
  if(q){gl.endQuery(ext.TIME_ELAPSED_EXT);if(i>30)pending.push(q);else gl.deleteQuery(q);}
  while(pending.length&&gl.getQueryParameter(pending[0],gl.QUERY_RESULT_AVAILABLE)){
   const p=pending.shift()!;if(!gl.getParameter(ext.GPU_DISJOINT_EXT))gpu.push(gl.getQueryParameter(p,gl.QUERY_RESULT)/1e6);gl.deleteQuery(p);
  }
 }
 const stats=(v:number[])=>{v.sort((a,b)=>a-b);return {mean:v.reduce((a,b)=>a+b,0)/v.length,p95:v[Math.floor(v.length*.95)]};};
 let buffersStable=true;
 if(mode==='instanced'){
  const before={...renderer.info.memory};
  for(const capacity of [17,41,81]){
   crowds.forEach(c=>c.begin(capacity));actors.forEach((npc,i)=>crowds[i%2].add(npc));crowds.forEach(c=>c.end());renderer.render(scene,camera);
   buffersStable&&=renderer.info.memory.geometries===before.geometries&&renderer.info.memory.textures===before.textures;
  }
 }
 return {mode,birds:20,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,cpuMs:stats(cpu),gpuMs:stats(gpu),frameMs:stats(frames),buffersStable,gpu:renderer.getContext().getParameter(gl.RENDERER)};
};
