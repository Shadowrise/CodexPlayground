import * as T from 'three';
import type {KnightBattle,KnightPoint} from './meta-knight-battle';
import {STAR_ASSAULT as A,STAR_FLIGHTS,crossPairs,crossLines,crystalPoint,ricochetCrystal,ricochetCurve,ricochetIndex,ricochetCountdown,starOpening,starImpactProgress,starProgress} from './meta-knight-star-assault';
import {AssaultRibbon} from './meta-knight-assault-ribbon';
import {crystalBroken} from './meta-knight-shield';
import {MetaKnightShieldView} from './meta-knight-shield-view';
import {MetaKnightCrossZonesView} from './meta-knight-cross-zones-view';

const UP=new T.Vector3(0,1,0),GOLD=new T.Color(0xffcb58),VIOLET=new T.Color(0xb58aff),WHITE=new T.Color(0xfff3c8);
const basic=(color:number,opacity=1)=>new T.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:false,toneMapped:false});
function haloMaterial(){return new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,
 uniforms:{power:{value:0},tint:{value:new T.Color(0xffcc6a)}},
 vertexShader:'varying vec2 haloUv;void main(){haloUv=uv;vec4 p=modelViewMatrix*vec4(0.,0.,0.,1.);p.xy+=position.xy*vec2(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz));gl_Position=projectionMatrix*p;}',
 fragmentShader:`varying vec2 haloUv;uniform float power;uniform vec3 tint;void main(){vec2 p=haloUv*2.-1.;float r=length(p);float cloud=pow(max(0.,1.-r),3.);
  float flare=exp(-abs(p.x)*55.)*exp(-abs(p.y)*5.)+exp(-abs(p.y)*55.)*exp(-abs(p.x)*5.);
  gl_FragColor=vec4(tint,(cloud*.45+flare*.22)*power);
  #include <colorspace_fragment>
 }`});}
function crystalMist(){return new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,
 uniforms:{clock:{value:0},power:{value:1}},
 vertexShader:'varying vec2 mistUv;void main(){mistUv=uv;vec4 p=modelViewMatrix*vec4(0.,0.,0.,1.);p.xy+=position.xy;gl_Position=projectionMatrix*p;}',
 fragmentShader:`varying vec2 mistUv;uniform float clock;uniform float power;void main(){vec2 p=mistUv*2.-1.;float cloud=exp(-p.x*p.x*4.-p.y*p.y*2.5);float curl=.55+.20*sin(p.x*8.+sin(p.y*7.-clock)*2.+clock*.7)+.16*sin(p.y*12.-clock*1.4+p.x*5.);float taper=(1.-smoothstep(.55,1.,abs(p.y)))*(1.-smoothstep(.6,1.,abs(p.x)));float shaft=exp(-p.x*p.x*300.)*(1.-smoothstep(.15,1.,abs(p.y)));vec3 colour=mix(vec3(.40,.08,1.),vec3(1.,.60,1.),cloud);gl_FragColor=vec4(colour,(cloud*curl*.35+shaft*.5)*taper*power);
 #include <colorspace_fragment>
 }`});}
/** Crystal flares, countdowns and attacks sampled from the same shared paths as damage. */
export class MetaKnightStarAssaultView{
 readonly group=new T.Group();
 readonly cross=new AssaultRibbon('Star assault cross countdown',A.beamHalfWidth);
 readonly cross2=new AssaultRibbon('Star assault second cross countdown',A.beamHalfWidth);
 readonly routes=Array.from({length:STAR_FLIGHTS},(_,i)=>new AssaultRibbon(`Star assault curved countdown ${i+1}`,A.routeHalfWidth));
 readonly shield=new MetaKnightShieldView();
 readonly crossZones=new MetaKnightCrossZonesView();
 private gems:T.Mesh<T.OctahedronGeometry,T.MeshStandardMaterial>[]=[];private halos:T.Mesh<T.PlaneGeometry,T.ShaderMaterial>[]=[];
 private ornaments:T.Mesh[]=[];private key='';
 private beam=new T.Mesh(new T.CylinderGeometry(1,1,1,12,1,true),basic(0xfff4d4));
 private beamAura=new T.Mesh(this.beam.geometry,basic(0xffb844,.16));
 private secondBeam=new T.Mesh(this.beam.geometry,this.beam.material);private secondAura=new T.Mesh(this.beam.geometry,this.beamAura.material);
 private links=Array.from({length:4},()=>new T.Mesh(this.beam.geometry,basic(0xd6adff,.32)));
 private rings=new T.InstancedMesh(new T.TorusGeometry(.75,.035,4,20),basic(0xffe7a1,.78),24);
 private sparks=new T.InstancedMesh(new T.OctahedronGeometry(.075),basic(0xffe6a1),96);
 private rubble=new T.InstancedMesh(new T.OctahedronGeometry(.5),new T.MeshStandardMaterial({color:0x655876,metalness:.4,roughness:.5,emissive:0x291a3b,emissiveIntensity:.2}),56);
 private fragments=new T.InstancedMesh(new T.OctahedronGeometry(.21),basic(0xd7a2ff),32);
 private nativeCrystals:T.Object3D[]=[];
 private comet=new T.InstancedMesh(new T.OctahedronGeometry(.11),basic(0xffe0a0,.72),48);
 private beacon=new T.Group();private mist=new T.Mesh(new T.PlaneGeometry(18,25),crystalMist());
 private beaconGlints=new T.InstancedMesh(new T.OctahedronGeometry(.16),basic(0xffdeff),28);
 private beaconRings=Array.from({length:3},()=>new T.Mesh(new T.TorusGeometry(2.4,.045,5,64),basic(0xec9cff,.6)));
 private impactHalo=new T.Mesh(new T.TorusGeometry(1,.07,6,96),basic(0xffe8a1,.7));
 private disc:T.Mesh<T.PlaneGeometry,T.ShaderMaterial>;
 private matrix=new T.Matrix4();private q=new T.Quaternion();private p=new T.Vector3();private scale=new T.Vector3();private a=new T.Vector3();private b=new T.Vector3();private delta=new T.Vector3();
 constructor(){
  this.group.name='Meta Knight star assault';this.group.visible=false;
  this.group.add(this.cross.mesh,this.cross2.mesh,...this.routes.map(r=>r.mesh),this.shield.group,this.crossZones.group,this.rubble,this.fragments,this.beacon);this.rubble.name='Broken arena crystal rubble';this.fragments.name='Shattered violet crystal fragments';this.rubble.frustumCulled=this.fragments.frustumCulled=false;
  this.beacon.name='Active violet crystal beacon';this.mist.name='Violet crystal drifting mist';this.mist.position.y=5;this.mist.frustumCulled=false;this.beaconGlints.frustumCulled=false;this.mist.renderOrder=9;this.beaconGlints.renderOrder=10;this.beacon.add(this.mist,this.beaconGlints,...this.beaconRings);this.beacon.visible=false;
  const geometry=new T.OctahedronGeometry(1.2),plane=new T.PlaneGeometry(13,13),orbit=new T.TorusGeometry(1.55,.025,4,40);
  for(let i=0;i<8;i++){
   const p=crystalPoint(i),gem=new T.Mesh(geometry,new T.MeshStandardMaterial({color:0xcfb6ff,emissive:0x9753e5,emissiveIntensity:1,metalness:.3,roughness:.22,flatShading:true}));
   gem.name=`Star assault crystal ${i}`;gem.position.fromArray(p);gem.scale.set(.66,1.6,.66);this.gems.push(gem);
   const halo=new T.Mesh(plane,haloMaterial());halo.position.copy(gem.position);halo.name=`Star assault crystal flare ${i}`;this.halos.push(halo);
   const ring=new T.Mesh(orbit,basic(0xffd580,.55));ring.position.copy(gem.position);ring.rotation.set(.7,i*.6,.4);this.ornaments.push(ring);this.group.add(gem,halo,ring);
  }
  this.beam.name='Star assault crystal beam';this.beamAura.name='Star assault crystal beam aura';this.rings.frustumCulled=this.sparks.frustumCulled=this.comet.frustumCulled=false;
  this.secondBeam.name='Star assault second crystal beam';this.impactHalo.rotation.x=Math.PI/2;this.group.add(this.beam,this.beamAura,this.secondBeam,this.secondAura,...this.links,this.rings,this.sparks,this.comet,this.impactHalo);
  const r=A.impactRadius;
  this.disc=new T.Mesh(new T.PlaneGeometry(r*2+.6,r*2+.6),new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,
   uniforms:{progress:{value:0},attack:{value:0}},vertexShader:'varying vec2 point;void main(){point=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`varying vec2 point;uniform float progress;uniform float attack;void main(){float r=length(point);if(r>1.)discard;float rim=smoothstep(.86,.96,r)*(1.-smoothstep(.97,1.,r));float a=fract(atan(point.y,point.x)/6.2831853+.75);
    float timer=rim*step(a,progress);vec3 tint=mix(vec3(1.,.64,.10),vec3(1.,.08,.22),max(attack,timer));gl_FragColor=vec4(tint,max(.38+.1*r,timer*.98));
    #include <colorspace_fragment>
   }`,
  }));this.disc.name='Star assault centre impact countdown';this.disc.rotation.x=-Math.PI/2;this.disc.position.y=.12;this.group.add(this.disc);
 }
 bindCrystals(scene:T.Scene){this.nativeCrystals=Array.from({length:8},(_,i)=>scene.getObjectByName('Cosmic arena crystal '+i)).filter((o):o is T.Object3D=>!!o);}
 private line(mesh:T.Mesh,a:T.Vector3,b:T.Vector3,radius:number){
  this.delta.subVectors(b,a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(UP,this.delta.clone().normalize());mesh.scale.set(radius,this.delta.length(),radius);mesh.visible=true;
 }
 update(s:KnightBattle|undefined,now:number,bladeTip:T.Vector3){
  const visible=!!s&&s.phase===3&&s.stage!=='cancelled';this.group.visible=visible;this.nativeCrystals.forEach(o=>o.visible=!visible);this.shield.update(s,now);this.crossZones.update(s,now);if(!s||!visible)return;
  const f=starProgress(s,now),elapsed=now-s.since,opening=starOpening(s),impact=s.stage==='shield'&&elapsed<220,finale=s.stage==='star-warn'||s.stage==='star-fall';
  const key=[s.id,s.cycle,s.brokenCrystals??0,s.starRoute?.join(','),s.starAims?.flat().join(','),s.yaw.toFixed(5)].join(':');if(key!==this.key){
   this.key=key;this.routes.forEach((r,i)=>r.setPath(Array.from({length:65},(_,j)=>ricochetCurve(s,i,j/64))));
  }
  this.cross.mesh.visible=this.cross2.mesh.visible=false;this.routes.forEach(r=>r.mesh.visible=false);
  for(const mesh of [this.beam,this.beamAura,this.secondBeam,this.secondAura,...this.links,this.rings,this.comet,this.impactHalo,this.disc,this.fragments])mesh.visible=false;
  const cross=s.stage==='cross'||s.stage==='cross-warn',route=s.stage==='ricochet'||s.stage==='ricochet-warn',index=ricochetIndex(s);
  for(let i=0;i<8;i++){
   const broken=crystalBroken(s,i),selected=s.stage==='shield'&&s.activeCrystal===i;this.gems[i].visible=this.halos[i].visible=this.ornaments[i].visible=!broken;
   let charge=0,flash=0;
   if(cross&&crossPairs(s).some(pair=>pair.includes(i))){charge=s.stage==='cross-warn'?f*f:1;flash=s.stage==='cross'?Math.exp(-elapsed/240):0;}
   if(route){if(i===ricochetCrystal(s,index))charge=s.stage==='ricochet-warn'?f:Math.max(0,(f-.65)/.35);if(index>0&&i===ricochetCrystal(s,index-1))flash=Math.exp(-elapsed/300);}
   if(finale)charge=s.stage==='star-warn'?f:1;
   if(opening)flash=Math.exp(-elapsed/350);
   const entry=s.stage==='transition'?T.MathUtils.smoothstep(elapsed-i*95,0,650):1,pulse=.5+.5*Math.sin(now*.002+i*.8),power=(.25+.12*pulse+charge*.85+flash*1.2)*entry;
   const gem=this.gems[i],grow=selected?1+1.1*T.MathUtils.smoothstep(elapsed,0,650)+.04*Math.sin(now*.005):1;gem.scale.set(.66*grow,1.6*grow,.66*grow);gem.material.color.copy(VIOLET).lerp(GOLD,selected?0:charge).lerp(WHITE,selected?0:flash*.65);if(selected)gem.material.color.setHex(0xc659ff);gem.material.emissive.copy(gem.material.color);gem.material.emissiveIntensity=selected?5+.8*pulse:.65+power*1.4;
   const halo=this.halos[i];halo.material.uniforms.power.value=selected?3.6+.7*pulse:power;halo.material.uniforms.tint.value.copy(gem.material.color);halo.scale.setScalar(selected?2.7:1+charge*.22+flash*.18);
   const ring=this.ornaments[i];ring.rotation.y=now*.0004+i;ring.rotation.z=.45+Math.sin(now*.001+i)*.18;(ring.material as T.MeshBasicMaterial).opacity=power*.55;
  }
  this.beacon.visible=s.stage==='shield'&&s.activeCrystal!==undefined&&!crystalBroken(s,s.activeCrystal);
  if(this.beacon.visible){this.beacon.position.fromArray(crystalPoint(s.activeCrystal!));this.mist.material.uniforms.clock.value=now/1000;this.mist.material.uniforms.power.value=T.MathUtils.smoothstep(elapsed,0,500);for(let i=0;i<28;i++){const age=(now*.0003+i/28)%1,a=i*2.399+age*2,r=1.4+Math.sin(age*Math.PI)*2.3;this.p.set(Math.sin(a)*r,age*12-1,Math.cos(a)*r);this.scale.set(.5,.5,2.7).multiplyScalar(Math.sin(age*Math.PI)*(.7+.3*Math.sin(now*.009+i)));this.matrix.compose(this.p,this.q,this.scale);this.beaconGlints.setMatrixAt(i,this.matrix);}this.beaconGlints.instanceMatrix.needsUpdate=true;this.beaconRings.forEach((ring,i)=>{const age=(now*.0004+i/3)%1;ring.position.y=-1.9+age*2;ring.rotation.set(Math.PI/2,0,0);ring.scale.setScalar(.7+age*.9);(ring.material as T.MeshBasicMaterial).opacity=(1-age)*.65;});}
  this.sparks.visible=!['won','lost'].includes(s.stage);for(let i=0;i<96;i++){
   const crystal=crystalPoint(i%8),age=(now*.00022+i/96)%1,a=i*2.399+age*3;this.p.set(crystal[0]+Math.cos(a)*(.7+age*.9),crystal[1]-1+age*4.5,crystal[2]+Math.sin(a)*(.7+age*.9));this.scale.setScalar(crystalBroken(s,i%8)?0:Math.sin(age*Math.PI)*(.6+(i%3)*.25));this.matrix.compose(this.p,this.q,this.scale);this.sparks.setMatrixAt(i,this.matrix);
  }this.sparks.instanceMatrix.needsUpdate=true;
  for(let i=0;i<56;i++){const crystal=Math.floor(i/7),p=crystalPoint(crystal),a=i*2.399,r=.4+(i%3)*.36;this.p.set(p[0]+Math.sin(a)*r,1.32+(i%2)*.13,p[2]+Math.cos(a)*r);this.q.setFromEuler(new T.Euler(i*.5,i,i*.7));this.scale.set(.45+(i%3)*.13,.32+(i%4)*.12,.5).multiplyScalar(crystalBroken(s,crystal)?1:0);this.matrix.compose(this.p,this.q,this.scale);this.rubble.setMatrixAt(i,this.matrix);}this.rubble.instanceMatrix.needsUpdate=true;this.q.identity();
  if(s.lastCrystal!==undefined&&s.stage==='crystal-break'&&elapsed<1000){this.fragments.visible=true;const p=crystalPoint(s.lastCrystal),t=elapsed/1000;for(let i=0;i<32;i++){const a=i*2.399,v=3+(i%6);this.p.set(p[0]+Math.sin(a)*t*v,p[1]+Math.sin(Math.PI*t)*(2+i%4),p[2]+Math.cos(a)*t*v);this.scale.setScalar((1-t)*(.6+i%3*.22));this.matrix.compose(this.p,this.q,this.scale);this.fragments.setMatrixAt(i,this.matrix);}this.fragments.instanceMatrix.needsUpdate=true;}
  if(cross){
   const lines=crossLines(s);for(let j=0;j<2;j++){
    const line=lines[j],ribbon=j?this.cross2:this.cross,tag=`${s.id}:${crossPairs(s).flat().join(',')}`;
    if(ribbon.mesh.userData.path!==tag){ribbon.mesh.userData.path=tag;ribbon.setPath(line);}ribbon.update(s.stage==='cross'?1:f,s.stage==='cross',now);
    if(s.stage==='cross-warn')for(let i=0;i<2;i++){this.a.copy(bladeTip);this.b.fromArray(line[i]);this.line(this.links[j*2+i],this.a,this.b,.045+.055*f);}
    if(s.stage==='cross'){
     this.a.fromArray(line[0]);this.b.fromArray(line[1]);this.line(j?this.secondBeam:this.beam,this.a,this.b,.16*(.9+.1*Math.sin(now*.035)));this.line(j?this.secondAura:this.beamAura,this.a,this.b,1.8);
     this.rings.visible=true;this.delta.subVectors(this.b,this.a);this.q.setFromUnitVectors(new T.Vector3(0,0,1),this.delta.clone().normalize());
     for(let i=0;i<12;i++){const u=(i/12+elapsed*.0018)%1;this.p.copy(this.a).addScaledVector(this.delta,u);this.scale.setScalar(.65+.35*Math.sin(u*Math.PI));this.matrix.compose(this.p,this.q,this.scale);this.rings.setMatrixAt(j*12+i,this.matrix);}this.q.identity();
    }
   }this.rings.instanceMatrix.needsUpdate=true;
  }
  if(route){
   this.routes[index].mesh.renderOrder=4;this.routes[index].update(ricochetCountdown(s,now,index),s.stage==='ricochet',now);
   if(s.stage==='ricochet'){
    this.comet.visible=true;for(let i=0;i<48;i++){const age=i/48,t=Math.max(0,f-age*.27),p=ricochetCurve(s,index,t),a=i*2.399;this.p.set(p[0]+Math.cos(a)*age*3.2,p[1]+2.4+Math.sin(a)*age*1.4,p[2]+Math.sin(a)*age*3.2);this.scale.setScalar((1-age)*2.5);this.matrix.compose(this.p,this.q,this.scale);this.comet.setMatrixAt(i,this.matrix);}this.comet.instanceMatrix.needsUpdate=true;
   }
  }
  if(finale||impact){
   const progress=starImpactProgress(s,now);this.disc.visible=true;this.disc.material.uniforms.progress.value=progress;this.disc.material.uniforms.attack.value=impact?1:0;
  }
  if(opening&&elapsed<650){const t=elapsed/650;this.impactHalo.visible=true;this.impactHalo.position.set(0,4+t*1.5,0);this.impactHalo.scale.setScalar(6+t*25);(this.impactHalo.material as T.MeshBasicMaterial).opacity=(1-t)*.7;}
 }
 dispose(){
  for(const ribbon of [this.cross,this.cross2,...this.routes])ribbon.dispose();this.shield.dispose();this.crossZones.dispose();this.nativeCrystals.forEach(o=>o.visible=true);this.group.removeFromParent();const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
  this.group.traverse(o=>{if(o instanceof T.Mesh){if(o instanceof T.InstancedMesh)o.dispose();geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}else if(o instanceof T.Sprite){o.material.map?.dispose();materials.add(o.material);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
 }
}
