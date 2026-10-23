import * as T from 'three';
import type {KnightBattle} from './meta-knight-battle';
import {crossTriangles,crossBoundaries,crossPairs,starProgress} from './meta-knight-star-assault';
import {META_KNIGHT_ARENA} from './meta-knight-arena-site';
import {KNIGHT_WARNING_STYLE} from './meta-knight-warning-style';

function glass(){return new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,
 uniforms:{a:{value:new T.Vector2()},b:{value:new T.Vector2()},c:{value:new T.Vector2()},sweep:{value:0},radius:{value:META_KNIGHT_ARENA.radius},progress:{value:0},attack:{value:0},clock:{value:0},gold:{value:new T.Color(KNIGHT_WARNING_STYLE.gold)},red:{value:new T.Color(KNIGHT_WARNING_STYLE.red)},baseOpacity:{value:KNIGHT_WARNING_STYLE.opacity}},
 vertexShader:'varying vec2 point;void main(){point=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`varying vec2 point;uniform vec2 a;uniform vec2 b;uniform vec2 c;uniform float sweep;uniform float radius;uniform float progress;uniform float attack;uniform float clock;uniform vec3 gold;uniform vec3 red;uniform float baseOpacity;
 vec2 edge(vec2 p,vec2 from,vec2 to){vec2 d=to-from;float t=clamp(dot(p-from,d)/max(.0001,dot(d,d)),0.,1.);return vec2(length(p-from-d*t),t*length(d));}
 void main(){float radial=length(point);if(radial>radius)discard;float arc=mod((atan(point.y,point.x)-atan(b.y,b.x))*sign(sweep)+6.2831853,6.2831853);vec2 ab=edge(point,a,b),bc=vec2(arc<=abs(sweep)?abs(radius-radial):10000.,arc*radius),ca=edge(point,c,a);float base=abs(sweep)*radius;float perimeter=length(b-a)+base+length(a-c);vec2 closest=ab;
 if(bc.x<closest.x)closest=vec2(bc.x,length(b-a)+bc.y);if(ca.x<closest.x)closest=vec2(ca.x,length(b-a)+base+ca.y);
 float along=closest.y/max(.001,perimeter);float rim=1.-smoothstep(.14,.42,closest.x);float timer=rim*step(along,progress)*step(.0001,progress);float head=exp(-pow((along-progress)*45.,2.))*timer;
 float glint=exp(-pow((point.x*.65+point.y*.35-8.*sin(clock*.22))*.17,2.));float sheen=.5+.5*sin(point.y*.15+clock*.7);
 vec3 colour=mix(gold,red,attack)+vec3(.07,.055,.025)*(glint+sheen);colour=mix(colour,gold+vec3(.10,.08,.025),rim);colour=mix(colour,red+vec3(.30,.20,.10)*head,timer);
 gl_FragColor=vec4(colour,max(baseOpacity+.06*glint+.045*sheen+attack*.15,max(rim*.75,timer*.96)));
 #include <colorspace_fragment>
 }`,
});}

/** Filled danger matches the shared triangles; each perimeter carries its own timer. */
export class MetaKnightCrossZonesView{
 readonly group=new T.Group();
 readonly triangles=Array.from({length:2},(_,i)=>{
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(9),3));
  const mesh=new T.Mesh(geometry,glass());mesh.name=`Crystal cross danger triangle ${i+1}`;mesh.position.y=.115;mesh.frustumCulled=false;mesh.renderOrder=1;return mesh;
 });
 private key='';
 constructor(){this.group.name='Crystal cross opposing triangles';this.group.visible=false;this.group.add(...this.triangles);}
 update(s:KnightBattle|undefined,now:number){
  this.group.visible=!!s&&s.phase===3&&(s.stage==='cross-warn'||s.stage==='cross');if(!s||!this.group.visible)return;
  const key=[s.id,s.cycle,...crossPairs(s).flat(),s.starCross?.side??0].join(':');
  if(key!==this.key){this.key=key;const boundaries=crossBoundaries(s);crossTriangles(s).forEach((triangle,i)=>{const mesh=this.triangles[i],position=mesh.geometry.getAttribute('position') as T.BufferAttribute;triangle.forEach((p,j)=>position.setXYZ(j,p[0],0,p[2]));const {centre,start,end,sweep}=boundaries[i];[centre,start,end].forEach((p,j)=>mesh.material.uniforms[['a','b','c'][j]].value.set(p[0],p[2]));mesh.material.uniforms.sweep.value=sweep;position.needsUpdate=true;});}
  for(const mesh of this.triangles){const u=mesh.material.uniforms;u.progress.value=s.stage==='cross'?1:starProgress(s,now);u.attack.value=s.stage==='cross'?1:0;u.clock.value=now/1000;}
 }
 dispose(){this.group.removeFromParent();for(const mesh of this.triangles){mesh.geometry.dispose();mesh.material.dispose();}}
}
