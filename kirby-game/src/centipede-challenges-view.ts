import * as T from 'three';
import {BOSS_ARENA as A} from './boss-arena-site';
import {centipedeWaves,centipedePlayBall,centipedeWheel,CENTIPEDE_TIMES,type CentipedeEvent} from './centipede-event';

const RAINBOW=['#ff4b69','#ffa334','#ffe456','#52dc88','#42c8f5','#5a73fa','#b566ee'].map(c=>new T.Color(c));
/** One wave draw plus one small rainbow ball; no lights or shadow passes. */
export class CentipedeChallengesView{
 readonly group=new T.Group();readonly ball:T.Mesh;readonly stomp:T.InstancedMesh;readonly wheel:T.InstancedMesh;
 private position=new T.Vector3();private rotation=new T.Quaternion();private scale=new T.Vector3();private matrix=new T.Matrix4();private up=new T.Vector3(0,1,0);
 constructor(){
  const ring=(gap:number,count:number,name:string)=>{
   const geo=new T.RingGeometry(.98,1.02,80,3,gap/2,Math.PI*2-gap);geo.rotateX(Math.PI/2);
   const material=new T.MeshBasicMaterial({transparent:true,opacity:.9,depthWrite:false,side:T.DoubleSide,toneMapped:false});
   // Fixed 1.3m width: widening a scaled ring otherwise makes distant waves huge.
   // A shallow curved crest gives volume, still one instanced draw and no shadows.
   material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    float waveRadius = max(length(instanceMatrix[0].xyz), 0.001);
    float waveEdge = (length(position.xz) - 1.0) / 0.02;
    transformed.xz = normalize(position.xz) * (1.0 + waveEdge * 0.65 / waveRadius);
    transformed.y += 0.22 * max(0.0, 1.0 - waveEdge * waveEdge);
   `);};material.customProgramCacheKey=()=> 'topotushka-thick-wave-v1';
   const mesh=new T.InstancedMesh(geo,material,count);mesh.name=name;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.count=0;return mesh;
  };
  this.stomp=ring(1.15,6,'Радужные волны топота');this.wheel=ring(.82,3,'Быстрые волны колеса');
  const geo=new T.SphereGeometry(1.1,28,18),uv=geo.getAttribute('uv'),colours:number[]=[];
  for(let i=0;i<uv.count;i++){const c=RAINBOW[Math.max(0,Math.min(6,Math.floor(uv.getX(i)*7)))];colours.push(c.r,c.g,c.b);}geo.setAttribute('color',new T.Float32BufferAttribute(colours,3));
  this.ball=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:.25,metalness:.08}));this.ball.name='Радужный мяч для Топотушки';
  this.group.name='Топотушка — волны и радужный мяч';this.group.add(this.stomp,this.wheel,this.ball);this.group.visible=false;
 }
 update(q:CentipedeEvent|undefined,now:number){
  this.group.visible=!!q&&['stomp','wheelRoll','dizzy','ballShot'].includes(q.stage);if(!this.group.visible)return;
  const mesh=q!.stage==='stomp'?this.stomp:this.wheel,other=mesh===this.stomp?this.wheel:this.stomp,waves=centipedeWaves(q!,now);other.visible=false;mesh.visible=waves.length>0;mesh.count=waves.length;
  waves.forEach((w,i)=>{this.position.set(A.x,.14,A.z);this.rotation.setFromAxisAngle(this.up,-w.angle);this.scale.set(w.radius,1,w.radius);this.matrix.compose(this.position,this.rotation,this.scale);mesh.setMatrixAt(i,this.matrix);mesh.setColorAt(i,RAINBOW[(w.index+q!.cycle)%7]);});mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  this.ball.visible=q!.stage==='dizzy'||q!.stage==='ballShot';
  if(this.ball.visible){const from=centipedePlayBall(q!),wheel=centipedeWheel(q!,now),t=q!.stage==='ballShot'?Math.min(1,Math.max(0,(now-q!.stageAt)/CENTIPEDE_TIMES.ballShot)):0;
   this.ball.position.set(from[0]+(wheel.x-from[0])*t,from[1]+(4.3-from[1])*t+Math.sin(t*Math.PI)*2,from[2]+(wheel.z-from[2])*t);
   this.ball.rotation.set(t*8,now*.0007,t*5);this.ball.scale.setScalar(1+.035*Math.sin(now*.004));
  }
 }
}
