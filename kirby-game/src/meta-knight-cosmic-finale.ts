import * as T from 'three';
import type {KnightBattle} from './meta-knight-battle';
import {cosmicDescent} from './meta-knight-cosmic';
import {softMist,softMistMaterial} from './soft-mist';

/** Air streams pass upward during the fall; the landing happens on the real floor. */
export class MetaKnightCosmicFinale{
 readonly group=new T.Group();
 private windMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,uniforms:{strength:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);float lengthY=length(instanceMatrix[1].xyz);center.xy+=position.xy*vec2(.12,lengthY);gl_Position=projectionMatrix*center;}`,fragmentShader:`varying vec2 vUv;uniform float strength;void main(){float a=pow(max(0.,1.-abs(vUv.x-.5)*2.),3.)*pow(sin(vUv.y*3.14159265),2.);gl_FragColor=vec4(.67,.82,1.,a*strength);}`});
 private wind=new T.InstancedMesh(new T.PlaneGeometry(1,1),this.windMaterial,24);
 private dust=Array.from({length:12},()=>softMist(softMistMaterial(0xc4b39b,0)));
 private ring=new T.Mesh(new T.RingGeometry(.94,1,80),new T.MeshBasicMaterial({color:0xffdba8,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,toneMapped:false}));
 readonly light=new T.PointLight(0xffd4a0,0,24,2);
 private matrix=new T.Matrix4();private position=new T.Vector3();private scale=new T.Vector3();private rotation=new T.Quaternion();
 private impact='';private lastNow=-Infinity;
 constructor(){this.group.name='Meta Knight fall air and landing';this.wind.frustumCulled=false;this.wind.instanceMatrix.setUsage(T.DynamicDrawUsage);this.ring.rotation.x=-Math.PI/2;this.ring.position.y=.09;this.light.position.y=1.6;this.group.add(this.wind,this.ring,this.light,...this.dust);}
 update(s:KnightBattle|undefined,now:number){
  if(now<this.lastNow)this.impact='';this.lastNow=now;const fall=cosmicDescent(s,now);this.group.visible=!!fall&&fall.landAge<1450;if(!fall||!this.group.visible)return false;
  const {elapsed,progress,height,landed,landAge}=fall;this.wind.visible=!landed;this.windMaterial.uniforms.strength.value=.04+.21*progress;
  for(let i=0;i<24&&!landed;i++){const a=i*2.399,r=5.5+(i%7)*.72;this.position.set(Math.sin(a)*r,height+((elapsed/1000*(7+progress*20)+i*.71)%15)-4,Math.cos(a)*r);this.scale.set(1,1.2+progress*5,1);this.matrix.compose(this.position,this.rotation,this.scale);this.wind.setMatrixAt(i,this.matrix);}this.wind.instanceMatrix.needsUpdate=true;
  const t=landAge/1000;for(let i=0;i<this.dust.length;i++){const m=this.dust[i],a=i*2.399;m.visible=landed;m.position.set(Math.sin(a)*(2.2+t*(4+i%3)),.2+t*.7,Math.cos(a)*(2.2+t*(4+i%3)));m.scale.set(1.5+t*3,.45+t*.5,1.6+t*3);m.material.opacity=landed?.23*Math.exp(-t*3.1):0;}
  this.ring.visible=landed;this.ring.scale.setScalar(2+t*20);this.ring.material.opacity=landed?.45*Math.exp(-t*7):0;this.light.intensity=landed?32*Math.exp(-t*14):0;
  const key=`${s!.id}:${fall.at}`;if(landed&&landAge<160&&this.impact!==key){this.impact=key;return true;}return false;
 }
 dispose(){this.group.removeFromParent();this.wind.dispose();this.wind.geometry.dispose();this.windMaterial.dispose();this.ring.geometry.dispose();this.ring.material.dispose();for(const m of this.dust)m.material.dispose();this.light.dispose();}
}
