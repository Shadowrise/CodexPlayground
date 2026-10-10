import * as T from 'three';
import {centipedeBalls,CENTIPEDE_BALLS as B,type CentipedeEvent} from './centipede-event';

const COLOURS=['#ff1469','#ff8b0d','#ffe128','#03b856','#168cff','#8742ff','#f62cc1'];
/** At most fifteen striped rubber balls, two instanced draws, no lights/shadows. */
export class CentipedeBallsView{
 readonly group=new T.Group();readonly balls:T.InstancedMesh;readonly warnings:T.InstancedMesh;
 private matrix=new T.Matrix4();private position=new T.Vector3();private rotation=new T.Quaternion();private scale=new T.Vector3();
 private euler=new T.Euler();private colours=COLOURS.map(c=>new T.Color(c));
 constructor(){
  const geometry=new T.SphereGeometry(B.radius,20,14),positions=geometry.getAttribute('position'),colours:number[]=[];
  for(let i=0;i<positions.count;i++){
   const y=positions.getY(i),angle=Math.atan2(positions.getZ(i),positions.getX(i));
   const panel=Math.floor((angle+Math.PI)/(Math.PI/3)),stripe=Math.abs(y)<B.radius*.16;
   const shade=stripe?1:panel%2?.68:.91;colours.push(shade,shade,shade);
  }
  geometry.setAttribute('color',new T.Float32BufferAttribute(colours,3));
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.28,metalness:.05,emissive:'#fff6e7',emissiveIntensity:.08});
  // Paint the cream equator after instance tinting, keeping every ball in one draw.
  material.onBeforeCompile=shader=>{
   shader.vertexShader='varying float ballLatitude;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\nballLatitude=position.y/${B.radius.toFixed(3)};`);
   shader.fragmentShader='varying float ballLatitude;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\nfloat stripe=1.-smoothstep(.12,.12+max(fwidth(ballLatitude),.025),abs(ballLatitude));\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.98,.98,.91),stripe*.93);`);
  };
  material.customProgramCacheKey=()=> 'centipede-striped-ball-v1';
  this.balls=new T.InstancedMesh(geometry,material,B.waves*B.perWave);
  this.warnings=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({transparent:true,opacity:.42,depthWrite:false,side:T.DoubleSide}),B.perWave);
  this.group.name='Топотушка — прыгучие шарики';this.balls.name='Разноцветные полосатые шарики';this.warnings.name='Дорожки перед волной шариков';
  for(const mesh of [this.balls,this.warnings]){mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;}
  this.group.add(this.balls,this.warnings);this.group.visible=false;
 }
 update(q:CentipedeEvent|undefined,now:number){
  this.group.visible=q?.stage==='balls';if(!this.group.visible)return;
  let active=0,preview=0;
  for(const b of centipedeBalls(q!,now)){
   const colour=this.colours[(b.index+q!.cycle)%this.colours.length];
   if(b.active){
    this.position.set(b.x,b.y,b.z);this.euler.set(b.age*.0018,b.age*.001+b.index,b.age*.0007);this.rotation.setFromEuler(this.euler);
    this.scale.setScalar(Math.min(1,.55+b.age/220));this.matrix.compose(this.position,this.rotation,this.scale);
    this.balls.setMatrixAt(active,this.matrix);this.balls.setColorAt(active++,colour);
   }else {
    this.position.set(b.x+b.dx*6,.105,b.z+b.dz*6);this.euler.set(-Math.PI/2,0,Math.atan2(b.dx,b.dz));this.rotation.setFromEuler(this.euler);
    this.scale.set(.65,12,1);this.matrix.compose(this.position,this.rotation,this.scale);
    this.warnings.setMatrixAt(preview,this.matrix);this.warnings.setColorAt(preview++,colour);
   }
  }
  this.balls.count=active;this.warnings.count=preview;
  for(const mesh of [this.balls,this.warnings]){mesh.visible=mesh.count>0;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
 }
}
