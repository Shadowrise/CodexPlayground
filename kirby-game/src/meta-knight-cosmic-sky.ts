import * as T from 'three';
import {COSMIC_WORLDS,cosmicWorldPosition} from './meta-knight-cosmic-world';

const noise=`float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=noise(p)*a;p=p*2.04+vec3(3.1,1.7,2.3);a*=.5;}return n;}`;

// Distance between the two nearest cells forms continuous faults around plates.
const faults=`float plateEdge(vec3 p){vec3 cell=floor(p),f=fract(p);float first=20.,second=20.;
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){
  vec3 g=vec3(float(x),float(y),float(z)),id=cell+g;
  vec3 seed=vec3(hash(id),hash(id+17.3),hash(id+31.7));vec3 delta=g+.18+.64*seed-f;float v=dot(delta,delta);
  if(v<first){second=first;first=v;}else second=min(second,v);
 }return sqrt(second)-sqrt(first);}`;

// The nearest cell centre gives round impact basins or isolated volcanic vents,
// rather than reusing the lava world's polygonal fault network.
const basins=`float basin(vec3 p){vec3 cell=floor(p),f=fract(p);float nearest=20.;
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){
  vec3 g=vec3(float(x),float(y),float(z)),id=cell+g;
  vec3 seed=vec3(hash(id+4.2),hash(id+23.1),hash(id+53.8));
  nearest=min(nearest,length(g+.22+.56*seed-f));
 }return nearest;}`;

/** Layered nebulae and slowly drifting worlds. No downloaded texture or backdrop plane. */
export class MetaKnightCosmicSky{
 readonly group=new T.Group();
 private sky:T.Mesh<T.SphereGeometry,T.ShaderMaterial>;
 readonly planets:T.Mesh<T.SphereGeometry,T.ShaderMaterial>[]=[];
 private clock=0;private previousSeconds?:number;
 private star=new T.Group();private starHalo:T.Sprite;
 constructor(){
  this.group.name='Fourth phase deep cosmic vista';
  const skyMaterial=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,toneMapped:false,uniforms:{strength:{value:1},clock:{value:0}},vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 direction;uniform float strength;uniform float clock;${noise}
   void main(){vec3 d=normalize(direction);float n=fbm(d*4.2+vec3(7.,1.,4.)),fine=fbm(d*17.+n*3.);
   float lane=exp(-pow((d.y*.35+d.x*.25+sin(d.z*4.)*.18+n*.3+.15)*3.8,2.));
   float clouds=pow(smoothstep(.24,.79,n),1.3)*lane;
   vec3 c=vec3(.006,.008,.028);c+=mix(vec3(.12,.025,.34),vec3(.025,.19,.38),smoothstep(.28,.73,fine))*clouds*2.4;
   c+=vec3(.48,.15,.42)*pow(clouds,2.)*fine*.9;
   float wisps=pow(max(0.,1.-abs(fine-.52)*4.),5.)*clouds;c+=vec3(.16,.21,.39)*wisps*.28;
   float core=exp(-length((d.xy-vec2(-.34,-.51))*vec2(2.4,4.8))*9.)*(1.-smoothstep(-.5,.1,d.z));c+=vec3(.32,.40,.58)*core;
   gl_FragColor=vec4(c,strength);\n#include <colorspace_fragment>\n}`});
  this.sky=new T.Mesh(new T.SphereGeometry(1800,48,28),skyMaterial);this.sky.name='Layered cobalt violet nebula';this.group.add(this.sky);
  COSMIC_WORLDS.forEach((_,i)=>this.planet(i));
  this.planets.forEach((planet,i)=>{
   const world=COSMIC_WORLDS[i];if(!('rings' in world))return;
   planet.rotation.z=world.kind===1?-.30:.23;
   const rings=new T.Group();rings.name='Three opaque connected ring bands';
   rings.scale.setScalar(world.radius/100*1.3);rings.rotation.set(world.kind===1?1.12:.87,-.2,world.kind===1?.22:-.34);
   const edges=[86,100,115,130];
   world.rings.forEach((color,band)=>{
    const ring=new T.Mesh(new T.RingGeometry(edges[band],edges[band+1],160,1),new T.MeshBasicMaterial({color,side:T.DoubleSide}));
    ring.name=`Opaque ring band ${band+1}`;rings.add(ring);
   });planet.add(rings);
  });
  const s=new T.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?1:2.25;i?s.lineTo(Math.cos(a)*r,Math.sin(a)*r):s.moveTo(Math.cos(a)*r,Math.sin(a)*r);}s.closePath();
  const star=new T.Mesh(new T.ExtrudeGeometry(s,{depth:.45,bevelEnabled:true,bevelThickness:.16,bevelSize:.16,bevelSegments:2,steps:1}),new T.MeshStandardMaterial({color:0xffdc62,emissive:0xffbd3e,emissiveIntensity:2,metalness:.35,roughness:.3}));star.name='Background refuge star';this.star.add(star);
  // A real alpha gradient gives the little star a quiet readable glow.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d')!,gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(255,231,148,.8)');gradient.addColorStop(.2,'rgba(255,199,70,.3)');gradient.addColorStop(1,'rgba(255,160,50,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;this.starHalo=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));this.starHalo.scale.setScalar(13);this.star.add(this.starHalo);this.group.add(this.star);
 }
 private planet(index:number){
  const world=COSMIC_WORLDS[index],kind=world.kind;
  const material=new T.ShaderMaterial({uniforms:{clock:{value:0},kind:{value:kind},seed:{value:index*13.71},low:{value:new T.Color(world.low)},high:{value:new T.Color(world.high)}},vertexShader:'varying vec3 p;varying vec3 n;varying vec3 view;void main(){p=position;n=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);view=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',fragmentShader:`varying vec3 p;varying vec3 n;varying vec3 view;uniform float clock;uniform float kind;uniform float seed;uniform vec3 low;uniform vec3 high;${noise}${faults}${basins}
   void main(){vec3 d=normalize(p),offset=vec3(seed,seed*.31,seed*.73);float cloud=fbm(d*9.+offset+vec3(0.,clock*.007,0.));float detail=fbm(d*36.+offset);vec3 color;vec3 emission=vec3(0.);
   if(kind<.5){float continent=smoothstep(.43,.58,fbm(d*4.6));color=mix(low,high,continent);float ice=smoothstep(.78,.96,abs(d.y));color=mix(color,vec3(.65,.83,.90),ice);color=mix(color,vec3(.76,.85,.94),smoothstep(.57,.75,cloud)*.7);}
   else if(kind<1.5||kind>10.5){float latitude=kind<1.5?d.y:d.y*.85+d.x*.16;float bands=.5+.35*sin(latitude*(kind<1.5?32.:51.)+cloud*6.)+.12*sin(latitude*110.+detail*4.);color=mix(low,high,smoothstep(.1,.9,bands));color+=pow(cloud,5.)*.6;}
   else if(kind<2.5){float r=basin(d*9.+offset),pit=1.-smoothstep(.12,.30,r),rim=exp(-pow((r-.31)*24.,2.));color=mix(low,high,.25+cloud*.55)*(.85+.2*detail);color*=1.-pit*.55;color+=high*rim*.4;}
   else if(kind<3.5){
    float edge=plateEdge(d*5.6+vec3(fbm(d*10.)*.85));float lava=1.-smoothstep(.012,.065,edge),heat=1.-smoothstep(.045,.20,edge);
    color=mix(low,high,cloud*.7+heat*.3)*(.65+detail*.6);float pulse=.85+.15*sin(clock*.7+cloud*16.);
    emission=vec3(2.8,.35,.025)*lava*pulse+vec3(.55,.025,.008)*heat*heat;
    emission+=vec3(.85,.43,.12)*pow(lava,5.)*.3;
   }else if(kind<4.5){
    float ice=smoothstep(.27,.72,cloud),veins=1.-smoothstep(.012,.055,abs(fbm(d*18.)-.53));
    color=mix(low,high,ice);color=mix(color,vec3(.8,.95,1.),veins*.6);color+=pow(detail,4.)*.35;
   }else if(kind<5.5){
    float dunes=.5+.5*sin(d.y*55.+fbm(d*7.)*14.+sin(d.x*17.)*.6);
    float canyons=1.-smoothstep(.012,.07,abs(fbm(d*8.)-.42));color=mix(low,high,.25+cloud*.45+dunes*.25)*(1.-canyons*.45);
   }else if(kind<6.5){
    vec3 axis=normalize(vec3(.7,.4,.55));float polar=dot(d,axis),angle=atan(dot(d,normalize(cross(axis,vec3(0.,1.,0.)))),dot(d,normalize(cross(axis,cross(axis,vec3(0.,1.,0.))))));
    float vortex=.5+.5*sin(polar*35.+angle*2.+fbm(d*6.+offset)*8.);float eye=exp(-pow((polar-.90)*23.,2.));
    color=mix(low,high,smoothstep(.15,.85,vortex));color=mix(color,vec3(.52,.76,.96),eye*.75);color*=.75+.5*cloud;
   }else if(kind<7.5){
    float strata=.5+.5*sin(fbm(d*3.+offset)*85.+d.z*13.);float canyon=1.-smoothstep(.012,.10,plateEdge(d*4.8+offset));
    color=mix(low,high,.18+strata*.6+detail*.15);color*=1.-canyon*.72;color=mix(color,vec3(.16,.54,.39),smoothstep(.51,.72,cloud)*.35);
   }else if(kind<8.5){
    vec3 cell=floor(d*9.+offset);float facet=hash(cell),edge=plateEdge(d*9.+offset);float seam=1.-smoothstep(.008,.042,edge);
    color=mix(low,high,facet)*(.70+facet*.65);color+=vec3(.45,.22,.65)*seam*.55;emission=vec3(.18,.04,.3)*pow(seam,3.);
   }else if(kind<9.5){
    float r=basin(d*6.8+offset),vent=1.-smoothstep(.07,.17,r),caldera=exp(-pow((r-.25)*18.,2.));
    float ash=.5+.5*sin(d.z*65.+fbm(d*7.+offset)*18.);color=mix(low,high,.12+cloud*.25+ash*.12);color*=1.-caldera*.6;
    emission=vec3(3.,.65,.035)*vent+vec3(.65,.10,.012)*caldera*.5;
   }else{
    vec3 warped=d*5.+vec3(fbm(d*3.+offset)*3.);float marble=fbm(warped+offset);float ribbons=.5+.5*sin(marble*27.+d.y*7.);
    color=mix(low,high,.60+marble*.4);color=mix(color,vec3(.93,.88,.84),smoothstep(.35,.8,ribbons)*.55);color*=.85+.25*detail;
   }
   float sun=dot(normalize(n),normalize(vec3(-.65,.70,.6)));float light=.075+.925*smoothstep(-.17,.75,sun);color*=light;float rim=pow(1.-max(0.,dot(normalize(n),normalize(view))),3.);color+=vec3(.12,.27,.47)*rim*max(.1,sun);
   color+=emission;gl_FragColor=vec4(color,1.);\n#include <colorspace_fragment>\n}`});
  const planet=new T.Mesh(new T.SphereGeometry(world.radius,64,40),material);planet.position.fromArray(cosmicWorldPosition(index,0));planet.name=world.name;this.planets.push(planet);this.group.add(planet);
  const atmosphere=new T.Mesh(planet.geometry,new T.ShaderMaterial({side:T.BackSide,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,uniforms:{tint:{value:new T.Color(world.atmosphere)}},vertexShader:'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec3 n;varying vec3 v;uniform vec3 tint;void main(){float rim=pow(max(0.,1.-abs(dot(normalize(n),normalize(v)))),3.);gl_FragColor=vec4(tint,rim*.30);}' }));atmosphere.scale.setScalar(1.035);atmosphere.name='Thin planetary atmosphere';planet.add(atmosphere);return planet;
 }
 update(seconds:number){
  // Orbit time is independent of encounter phases, commands and altitude.
  if(this.previousSeconds!==undefined)this.clock+=Math.max(0,Math.min(.1,seconds-this.previousSeconds));this.previousSeconds=seconds;
  const time=this.clock;this.sky.material.uniforms.clock.value=time;
  this.planets.forEach((planet,i)=>{planet.position.fromArray(cosmicWorldPosition(i,time));planet.rotation.y=time*(.007+i*.003);planet.material.uniforms.clock.value=time;});
  this.star.position.set(-150+Math.sin(time*.055)*38,165+Math.sin(time*.09)*12,-105);this.star.rotation.set(.08*Math.sin(time),time*.12,.12*Math.sin(time*.7));this.starHalo.material.opacity=.75+.12*Math.sin(time*2);
 }
 dispose(){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();this.group.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.starHalo.material.map?.dispose();this.starHalo.material.dispose();this.group.removeFromParent();}
}
