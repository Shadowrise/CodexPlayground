import * as T from 'three';
import type {KnightBattle} from './meta-knight-battle';

export const PIDGEY_FLIGHT_TRAIL={capacity:96,lifetime:1.15,spacingMs:20,teleportSpeed:145};
type Sample={at:number;p:T.Vector3;strength:number;segment:number;scale:number};
const noise=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}float clouds(vec2 p){return .57*noise(p)+.29*noise(p*2.03+2.7)+.14*noise(p*4.07-1.3);}`;
const colors=`vec3 iridescence(float t){return .65+.35*cos(6.2831853*(vec3(0.,.34,.67)+t));}vec3 gold(float edge,float shimmer){return mix(mix(vec3(1.,.67,.09),vec3(1.,.94,.58),shimmer*.5),iridescence(edge*.45+shimmer*.15),edge*.48);}`;

/** World-space wake, pooled once. The bird may stop or turn while old vapour fades.
 * Samples never connect a teleport, a different battle, or an unobserved long pause.
 */
export class MetapidgieFlightTrail{
 readonly group=new T.Group();private history:Sample[]=[];private battle=0;private segment=0;private last?:{at:number;p:T.Vector3;scale:number};
 private puffGeometry=new T.PlaneGeometry(1,1);private puffAges=new Float32Array(PIDGEY_FLIGHT_TRAIL.capacity*3);
 private puffMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,toneMapped:false,side:T.DoubleSide,
  vertexShader:`attribute vec3 aAge;varying vec2 vUv;varying vec3 vAge;void main(){vUv=uv;vAge=aAge;vec4 p=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);vec2 size=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));p.xy+=position.xy*size;gl_Position=projectionMatrix*p;}`,
  fragmentShader:`varying vec2 vUv;varying vec3 vAge;${noise}${colors}void main(){vec2 p=(vUv-.5)*2.;float r=length(p),age=vAge.x;float cloud=clouds(p*2.4+vec2(age*.7+vAge.y*8.,-age*.55));float feather=exp(-r*r*2.8)*(1.-smoothstep(.48,1.,r));float fade=pow(max(0.,1.-age),1.6)*exp(-age*2.5);float a=feather*(.25+.38*cloud)*fade*vAge.z;if(a<.002)discard;gl_FragColor=vec4(gold(smoothstep(.15,.9,r),cloud),a);\n#include <colorspace_fragment>}`,
 });
 private puffs=new T.InstancedMesh(this.puffGeometry,this.puffMaterial,PIDGEY_FLIGHT_TRAIL.capacity);
 private ribbonGeometry=new T.BufferGeometry();private ribbonPositions=new Float32Array(PIDGEY_FLIGHT_TRAIL.capacity*6);private ribbonAges=new Float32Array(PIDGEY_FLIGHT_TRAIL.capacity*4);
 private ribbonMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,toneMapped:false,
  vertexShader:'attribute vec2 aAge;varying vec2 vUv;varying vec2 vAge;void main(){vUv=uv;vAge=aAge;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec2 vUv;varying vec2 vAge;${noise}${colors}void main(){float edge=abs(vUv.x*2.-1.),age=vAge.x;float shape=pow(max(0.,1.-edge*edge),2.);float n=clouds(vec2(vUv.x*3.,vUv.y*11.-age*.7));float fade=pow(max(0.,1.-age),2.)*exp(-age*2.);float a=shape*(.23+.36*n)*fade*vAge.y;if(a<.002)discard;gl_FragColor=vec4(gold(edge,n),a);\n#include <colorspace_fragment>}`,
 });
 private ribbon=new T.Mesh(this.ribbonGeometry,this.ribbonMaterial);
 private sparkGeometry=new T.BufferGeometry();private sparkPositions=new Float32Array(PIDGEY_FLIGHT_TRAIL.capacity*3);private sparkAges=new Float32Array(PIDGEY_FLIGHT_TRAIL.capacity*3);
 private sparkMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,toneMapped:false,
  vertexShader:'attribute vec3 aAge;varying vec3 vAge;void main(){vAge=aAge;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=(2.5+3.*aAge.y)*min(1.5,28./max(1.,-p.z));}',
  fragmentShader:`varying vec3 vAge;void main(){vec2 p=(gl_PointCoord-.5)*2.;float r=length(p);float core=exp(-r*r*14.);float rays=(exp(-abs(p.x)*26.)*exp(-abs(p.y)*3.)+exp(-abs(p.y)*26.)*exp(-abs(p.x)*3.))*.32;float age=vAge.x,twinkle=.45+.55*pow(sin(age*14.+vAge.y*27.),2.);float a=(core+rays)*pow(max(0.,1.-age),2.)*twinkle*vAge.z;gl_FragColor=vec4(mix(vec3(1.,.72,.20),vec3(1.,.98,.83),core),a);\n#include <colorspace_fragment>}`,
 });
 private sparks=new T.Points(this.sparkGeometry,this.sparkMaterial);private dummy=new T.Object3D();private center=new T.Vector3();private tangent=new T.Vector3();private side=new T.Vector3();private view=new T.Vector3();
 constructor(){
  this.group.name='Meta Pidgey golden iridescent flight wake';this.group.visible=false;
  this.puffGeometry.setAttribute('aAge',new T.InstancedBufferAttribute(this.puffAges,3));this.puffs.count=0;this.puffs.frustumCulled=false;this.puffs.renderOrder=6;
  const uv=new Float32Array(PIDGEY_FLIGHT_TRAIL.capacity*4),indices:number[]=[];
  for(let i=0;i<PIDGEY_FLIGHT_TRAIL.capacity;i++){uv.set([0,i/12,1,i/12],i*4);if(i<PIDGEY_FLIGHT_TRAIL.capacity-1){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}
  this.ribbonGeometry.setAttribute('position',new T.BufferAttribute(this.ribbonPositions,3).setUsage(T.DynamicDrawUsage));this.ribbonGeometry.setAttribute('uv',new T.BufferAttribute(uv,2));this.ribbonGeometry.setAttribute('aAge',new T.BufferAttribute(this.ribbonAges,2).setUsage(T.DynamicDrawUsage));this.ribbonGeometry.setIndex(indices);this.ribbonGeometry.setDrawRange(0,0);this.ribbon.frustumCulled=false;this.ribbon.renderOrder=5;
  this.sparkGeometry.setAttribute('position',new T.BufferAttribute(this.sparkPositions,3).setUsage(T.DynamicDrawUsage));this.sparkGeometry.setAttribute('aAge',new T.BufferAttribute(this.sparkAges,3).setUsage(T.DynamicDrawUsage));this.sparkGeometry.setDrawRange(0,0);this.sparks.frustumCulled=false;this.sparks.renderOrder=8;
  this.group.add(this.ribbon,this.puffs,this.sparks);this.group.traverse(node=>{node.castShadow=node.receiveShadow=false;});
 }
 get sampleCount(){return this.history.length;}
 get samples(){return this.history.map(s=>({at:s.at,p:s.p.toArray(),strength:s.strength}));}
 update(s:KnightBattle|undefined,now:number,tail:T.Vector3,camera:T.Camera){
  const active=!!s&&['dash-warn','dash','dive-warn','dive','shot-warn','shot','return','star-rise','ricochet-warn','ricochet','star-warn','star-fall','cosmic-rise','cosmic-flight'].includes(s.stage);
  this.advance(s?.id??0,!!active,s?.stage==='dash'||s?.stage==='dive',now,tail,camera,1);
 }
 /** The player's burst shares the boss's shaders, sampling and fading. */
 updateDash(active:boolean,now:number,tail:T.Vector3,camera:T.Camera,scale=1){this.advance(0,active,active,now,tail,camera,Math.max(.001,scale));}
 clear(){this.history=[];this.last=undefined;this.group.visible=false;this.puffs.count=0;this.ribbonGeometry.setDrawRange(0,0);this.sparkGeometry.setDrawRange(0,0);}
 private advance(id:number,active:boolean,fast:boolean,now:number,tail:T.Vector3,camera:T.Camera,scale:number){
  if(this.battle!==id){this.battle=id;this.clear();}
  if(this.last&&now<this.last.at){this.history=[];this.last=undefined;}
  if(active){
   const elapsed=this.last?now-this.last.at:0,distance=this.last?this.last.p.distanceTo(tail):0;
   if(this.last&&(elapsed>180||distance>Math.max(8*scale,elapsed*.001*PIDGEY_FLIGHT_TRAIL.teleportSpeed*scale))){this.history=[];this.last=undefined;}
   const quick=fast||distance>Math.max(.1,elapsed*.001),spacing=quick?20:100,strength=quick?1:.24;
   if(!this.last)this.history.push({at:now,p:tail.clone(),strength,segment:++this.segment,scale});
   else if(elapsed>=spacing){const steps=Math.ceil(elapsed/spacing);for(let i=1;i<=steps;i++)this.history.push({at:this.last.at+elapsed*i/steps,p:this.last.p.clone().lerp(tail,i/steps),strength,segment:this.segment,scale:T.MathUtils.lerp(this.last.scale,scale,i/steps)});}
   if(!this.last||elapsed>=spacing)this.last={at:now,p:tail.clone(),scale};
  }else this.last=undefined;
  this.history=this.history.filter(p=>now-p.at<PIDGEY_FLIGHT_TRAIL.lifetime*1000).slice(-PIDGEY_FLIGHT_TRAIL.capacity);
  const count=this.history.length;this.group.visible=count>0;this.puffs.count=count;this.sparkGeometry.setDrawRange(0,count);
  let indexCount=0;const index=this.ribbonGeometry.index!;
  for(let i=0;i<count-1;i++)if(this.history[i].segment===this.history[i+1].segment){const a=i*2;for(const vertex of [a,a+1,a+2,a+1,a+3,a+2])index.setX(indexCount++,vertex);}
  index.needsUpdate=true;this.ribbonGeometry.setDrawRange(0,indexCount);
  camera.getWorldPosition(this.view);this.group.worldToLocal(this.view);
  for(let i=0;i<count;i++){
   const sample=this.history[i],age=Math.max(0,(now-sample.at)/(PIDGEY_FLIGHT_TRAIL.lifetime*1000)),seed=((Math.floor(sample.at/20)*73)%997)/997;
   this.center.copy(sample.p);this.center.y+=age*.75*sample.scale;this.center.x+=Math.sin(seed*12.+age*2)*age*.22*sample.scale;this.center.z+=Math.cos(seed*9.+age)*age*.22*sample.scale;
   this.dummy.position.copy(this.center);this.dummy.scale.set(4.2+age*5.0,2.9+age*3.8,1).multiplyScalar(sample.scale);this.dummy.updateMatrix();this.puffs.setMatrixAt(i,this.dummy.matrix);this.puffAges.set([age,seed,sample.strength],i*3);
   this.tangent.copy(this.history[Math.min(count-1,i+1)].p).sub(this.history[Math.max(0,i-1)].p);if(this.tangent.lengthSq()<.001)this.tangent.set(0,0,1);
   this.side.crossVectors(this.tangent,this.view.clone().sub(this.center)).normalize().multiplyScalar((1.15+age*2.0)*sample.scale);
   this.center.clone().sub(this.side).toArray(this.ribbonPositions,i*6);this.center.clone().add(this.side).toArray(this.ribbonPositions,i*6+3);this.ribbonAges.set([age,sample.strength,age,sample.strength],i*4);
   // Birth-time UVs keep the mist texture attached to its world-space samples
   // when the oldest samples leave the pool, rather than sliding a frame at a time.
   const along=(sample.at-this.battle)*.001*.6;this.ribbonGeometry.attributes.uv.setXY(i*2,0,along);this.ribbonGeometry.attributes.uv.setXY(i*2+1,1,along);
   this.center.add(new T.Vector3(Math.sin(seed*37)*(.6+age),.25+Math.cos(seed*17)*age,Math.cos(seed*23)*(.6+age)).multiplyScalar(sample.scale)).toArray(this.sparkPositions,i*3);this.sparkAges.set([age,seed,sample.strength],i*3);
  }
  this.puffs.instanceMatrix.needsUpdate=true;this.puffGeometry.attributes.aAge.needsUpdate=true;this.ribbonGeometry.attributes.position.needsUpdate=this.ribbonGeometry.attributes.aAge.needsUpdate=this.ribbonGeometry.attributes.uv.needsUpdate=true;this.sparkGeometry.attributes.position.needsUpdate=this.sparkGeometry.attributes.aAge.needsUpdate=true;
 }
 dispose(){this.group.removeFromParent();this.history=[];this.last=undefined;this.puffs.dispose();for(const geometry of [this.puffGeometry,this.ribbonGeometry,this.sparkGeometry])geometry.dispose();for(const material of [this.puffMaterial,this.ribbonMaterial,this.sparkMaterial])material.dispose();}
}
