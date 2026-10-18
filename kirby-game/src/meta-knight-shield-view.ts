import * as T from 'three';
import type {KnightBattle} from './meta-knight-battle';
import {SHIELD as S,SHIELD_WAVE_SLOTS,shieldWaves,shieldWaveAngle,shieldCountdown,shieldNextWave} from './meta-knight-shield';

function waveGeometry(segmented=true){
 const vertices:number[]=[],normals:number[]=[],uv:number[]=[],indices:number[]=[],steps=segmented?48:192,profile=16;
 for(let arc=0;arc<(segmented?4:1);arc++){
  const start=vertices.length/3;
  for(let j=0;j<=steps;j++)for(let k=0;k<=profile;k++){
   const a=segmented?arc*Math.PI/2+j/steps*Math.PI/4:j/steps*Math.PI*2,p=k/profile*Math.PI*2;
   vertices.push(a,1.95+1.75*Math.sin(p),S.waveHalfWidth*Math.cos(p));normals.push(Math.cos(p),Math.sin(p),0);uv.push(j/steps,k/profile);
   if(j&&k){const b=start+(j-1)*(profile+1)+k-1;indices.push(b,b+1,b+profile+1,b+1,b+profile+2,b+profile+1);}
  }
  // Closed polished oval ends leave the angular gaps completely open.
  if(segmented)for(const j of [0,steps]){const base=start+j*(profile+1);for(let k=1;k<profile-1;k++)indices.push(base,base+k,base+k+1);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);return g;
}
function waveMaterial(glow=false){return new T.ShaderMaterial({transparent:true,depthWrite:!glow,side:T.DoubleSide,blending:glow?T.AdditiveBlending:T.NormalBlending,toneMapped:false,
 uniforms:{radius:{value:S.radius},angle:{value:0},clock:{value:0},fade:{value:1},glow:{value:glow?1:0},gold:{value:0}},
 vertexShader:`uniform float radius;uniform float angle;uniform float glow;varying vec3 n;varying vec3 eye;varying vec2 surface;void main(){float a=position.x+angle;float r=radius+position.z*(1.+glow*.35);vec3 p=vec3(sin(a)*r,position.y+glow*.05,cos(a)*r);vec4 mv=modelViewMatrix*vec4(p,1.);n=normalize(normalMatrix*vec3(sin(a)*normal.x,normal.y,cos(a)*normal.x));eye=-mv.xyz;surface=uv;gl_Position=projectionMatrix*mv;}`,
 fragmentShader:`uniform float clock;uniform float fade;uniform float glow;uniform float gold;varying vec3 n;varying vec3 eye;varying vec2 surface;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(eye))),2.);float crown=pow(max(0.,sin(surface.y*6.2831853)),18.);float end=pow(abs(surface.x-.5)*2.,14.);float sparkle=pow(max(0.,sin(surface.x*24.-clock*4.+surface.y*9.)),20.);vec3 colour=mix(mix(vec3(.56,.22,1.),vec3(.95,.48,.06),gold),vec3(1.,.70,.25),.5+.5*sin(surface.y*6.2831853));colour=mix(colour,vec3(1.,.96,.80),clamp(crown*.8+rim*.65+end*.6+sparkle*.22,0.,1.));gl_FragColor=vec4(colour,(glow>.5?(.10+.20*rim):(.78+.18*rim))*fade);
 #include <colorspace_fragment>
 }`});}

export class MetaKnightPressureWave{
 readonly group=new T.Group();readonly body:T.Mesh<T.BufferGeometry,T.ShaderMaterial>;private glow:T.Mesh<T.BufferGeometry,T.ShaderMaterial>;
 constructor(segmented=false){const geometry=waveGeometry(segmented);this.body=new T.Mesh(geometry,waveMaterial());this.glow=new T.Mesh(geometry,waveMaterial(true));this.body.name='Meta Knight solid golden impact wave';this.body.frustumCulled=this.glow.frustumCulled=false;this.body.renderOrder=7;this.glow.renderOrder=8;this.body.material.uniforms.gold.value=this.glow.material.uniforms.gold.value=1;this.group.add(this.body,this.glow);this.group.visible=false;}
 update(radius:number,now:number,heightScale:number){this.group.visible=true;this.group.scale.y=heightScale;for(const mesh of [this.body,this.glow]){mesh.material.uniforms.radius.value=radius;mesh.material.uniforms.clock.value=now/1000;}}
 dispose(){this.group.removeFromParent();this.body.geometry.dispose();this.body.material.dispose();this.glow.material.dispose();}
}

/** Reusable inward waves; their shrinking arcs and four gaps match shared damage. */
export class MetaKnightShieldView{
 readonly group=new T.Group();readonly dome:T.Mesh<T.SphereGeometry,T.ShaderMaterial>;
 readonly waves:{body:T.Mesh<T.BufferGeometry,T.ShaderMaterial>;glow:T.Mesh<T.BufferGeometry,T.ShaderMaterial>}[]=[];
 readonly countdown:T.Mesh<T.RingGeometry,T.ShaderMaterial>;
 private base=new T.Mesh(new T.TorusGeometry(S.radius,.11,8,128),new T.MeshBasicMaterial({color:0xd2afff,transparent:true,opacity:.85,depthWrite:false,toneMapped:false}));
 constructor(){
  this.group.name='Meta Knight crystal shield';this.group.visible=false;
  this.dome=new T.Mesh(new T.SphereGeometry(1,64,32,0,Math.PI*2,0,Math.PI/2),new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,
   uniforms:{clock:{value:0},opacity:{value:1},pulse:{value:0}},
   vertexShader:'varying vec3 n;varying vec3 eye;varying vec2 glass;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);eye=-p.xyz;glass=uv;gl_Position=projectionMatrix*p;}',
   fragmentShader:`uniform float clock;uniform float opacity;uniform float pulse;varying vec3 n;varying vec3 eye;varying vec2 glass;void main(){float fresnel=pow(1.-abs(dot(normalize(n),normalize(eye))),2.8);vec2 tile=glass*vec2(36.,13.);tile.x+=mod(floor(tile.y),2.)*.5;vec2 cell=abs(fract(tile)-.5);float grid=smoothstep(.41,.49,max(cell.x,cell.y));float shine=pow(max(0.,cos(glass.x*6.2831853+glass.y*3.-clock*.65)),28.);float scan=pow(max(0.,cos(glass.y*18.-clock*2.)),22.);vec3 colour=mix(vec3(.26,.14,.62),vec3(.56,.82,1.),fresnel);colour+=vec3(.35,.23,.40)*(shine+grid*.35)+vec3(.40,.23,.08)*scan*.5+vec3(.15,.08,.25)*pulse;gl_FragColor=vec4(colour,(.10+.45*fresnel+.07*grid+.20*shine+.055*scan+pulse*.08)*opacity);
   #include <colorspace_fragment>
   }`,
  }));this.dome.name='Solid iridescent crystal dome';this.dome.renderOrder=5;this.base.rotation.x=Math.PI/2;this.base.position.y=.18;
  this.group.add(this.dome,this.base);
  const geometry=waveGeometry();for(let i=0;i<SHIELD_WAVE_SLOTS;i++){
   const body=new T.Mesh(geometry,waveMaterial()),glow=new T.Mesh(geometry,waveMaterial(true));body.name=`Segmented crystal wave ${i+1}`;glow.name=`Segmented crystal wave halo ${i+1}`;body.frustumCulled=glow.frustumCulled=false;body.renderOrder=7;glow.renderOrder=8;this.waves.push({body,glow});this.group.add(body,glow);
  }
  this.countdown=new T.Mesh(new T.RingGeometry(S.crystalRadius-.5,S.crystalRadius+.5,192),new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,
   uniforms:{angle:{value:0},progress:{value:0},clock:{value:0}},vertexShader:'varying vec2 p;void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`uniform float angle;uniform float progress;uniform float clock;varying vec2 p;void main(){float a=atan(p.x,-p.y);float part=fract((a-angle)/1.57079633);if(part>.5)discard;float along=part*2.;float timer=step(along,progress);float head=exp(-pow((along-progress)*40.,2.));float edge=smoothstep(${(S.crystalRadius-.3).toFixed(2)},${(S.crystalRadius+.4).toFixed(2)},length(p));vec3 colour=mix(vec3(1.,.65,.18),vec3(1.,.08,.25),timer)+vec3(.20,.17,.10)*head;gl_FragColor=vec4(colour,.72+.2*edge);
   #include <colorspace_fragment>
   }`,
  }));this.countdown.name='Next segmented wave countdown';this.countdown.rotation.x=-Math.PI/2;this.countdown.position.y=.16;this.countdown.renderOrder=3;this.group.add(this.countdown);
 }
 update(s:KnightBattle|undefined,now:number){
  const shield=s?.stage==='shield',breaking=s?.stage==='crystal-break',age=s?now-s.since:0;this.group.visible=shield||breaking;if(!s||!this.group.visible)return;
  const power=shield?T.MathUtils.smoothstep(age,0,450):1-T.MathUtils.smoothstep(age,0,700),scale=shield?.94+.06*power:1+.12*(1-power);
  this.dome.scale.set(S.radius*scale,S.height*scale,S.radius*scale);this.dome.material.uniforms.clock.value=now/1000;this.dome.material.uniforms.opacity.value=shield?.65+.35*power:power;this.dome.material.uniforms.pulse.value=Math.exp(-(age%S.interval)/220);
  this.base.visible=power>.01;this.base.material.opacity=power*.85;
  this.countdown.visible=shield;this.countdown.material.uniforms.angle.value=shieldWaveAngle(s,shieldNextWave(s,now));this.countdown.material.uniforms.progress.value=shieldCountdown(s,now);
  const waves=shieldWaves(s,now);this.waves.forEach((view,i)=>{const wave=waves[i];for(const mesh of [view.body,view.glow]){mesh.visible=!!wave;if(wave){const u=mesh.material.uniforms;u.radius.value=wave.radius;u.angle.value=wave.angle;u.clock.value=now/1000;u.fade.value=.55+.45*T.MathUtils.smoothstep(wave.radius,S.radius,S.radius+1.5);}}});
 }
 dispose(){this.group.removeFromParent();const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>();this.group.traverse(o=>{if(o instanceof T.Mesh){gs.add(o.geometry);ms.add(o.material as T.Material);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());}
}
