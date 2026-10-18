import * as T from 'three';
import {KNIGHT,type KnightPoint} from './meta-knight-battle';

export class MetaKnightDazedStars{
 readonly group=new T.Group();private stars:T.Mesh[]=[];
 private geometry:T.ExtrudeGeometry;private haloGeometry=new T.PlaneGeometry(2.2,2.2);
 private gold=new T.MeshStandardMaterial({color:0xffd34e,emissive:0xffb52b,emissiveIntensity:.8,metalness:.35,roughness:.23});
 private glow=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,
  vertexShader:'varying vec2 glowUv;void main(){glowUv=uv;vec4 p=modelViewMatrix*vec4(0.,0.,0.,1.);p.xy+=position.xy;gl_Position=projectionMatrix*p;}',
  fragmentShader:'varying vec2 glowUv;void main(){float a=pow(max(0.,1.-length(glowUv*2.-1.)),2.5);gl_FragColor=vec4(1.,.65,.08,a*.48);\n#include <colorspace_fragment>\n}'});
 constructor(name='Meta Knight golden dizziness stars'){
  this.group.name=name;const shape=new T.Shape(),r=.33*KNIGHT.effectScale;
  for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,d=i%2?r*.45:r;if(i)shape.lineTo(Math.cos(a)*d,Math.sin(a)*d);else shape.moveTo(Math.cos(a)*d,Math.sin(a)*d);}shape.closePath();
  this.geometry=new T.ExtrudeGeometry(shape,{depth:.14*KNIGHT.effectScale,bevelEnabled:true,bevelThickness:.035*KNIGHT.effectScale,bevelSize:.025*KNIGHT.effectScale,bevelSegments:2,steps:1});this.geometry.translate(0,0,-.07*KNIGHT.effectScale);
  for(let i=0;i<3;i++){
   const carrier=new T.Group(),star=new T.Mesh(this.geometry,this.gold),halo=new T.Mesh(this.haloGeometry,this.glow);star.name=`Meta Knight dazed star ${i}`;star.userData.twist=0;
   star.onBeforeRender=(_renderer,_scene,camera)=>{camera.getWorldQuaternion(star.quaternion);star.rotateY(.25*Math.sin(star.userData.twist));star.rotateZ(star.userData.twist);star.updateMatrixWorld();};
   carrier.add(halo,star);this.group.add(carrier);this.stars.push(star);
  }
 }
 update(p:KnightPoint,now:number,visible:boolean){
  this.group.visible=visible;if(!visible)return;this.group.position.fromArray(p);
  this.stars.forEach((star,i)=>{const a=now*.002+i*Math.PI*2/3;star.parent!.position.set(Math.cos(a)*2.6,7.35+Math.sin(a*1.5)*.3,Math.sin(a)*1.25);star.userData.twist=.22*Math.sin(now*.003+i);});
 }
 dispose(){this.group.removeFromParent();this.geometry.dispose();this.haloGeometry.dispose();this.gold.dispose();this.glow.dispose();}
}
