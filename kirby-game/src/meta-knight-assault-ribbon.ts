import * as T from 'three';
import type {KnightPoint} from './meta-knight-battle';

/** Rounded glass path with a red countdown on both edges. Arc length is in metres. */
export class AssaultRibbon{
 readonly mesh:T.Mesh<T.BufferGeometry,T.ShaderMaterial>;
 private width:number;private length=1;
 constructor(name:string,width:number){
  this.width=width;this.mesh=new T.Mesh(new T.BufferGeometry(),new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,
   uniforms:{width:{value:width},span:{value:1},progress:{value:0},attack:{value:0},opacity:{value:1},time:{value:0}},
   vertexShader:'varying vec2 pathPoint;void main(){pathPoint=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`varying vec2 pathPoint;uniform float width;uniform float span;uniform float progress;uniform float attack;uniform float opacity;uniform float time;
    void main(){float cap=max(max(-pathPoint.y,pathPoint.y-span),0.);float d=length(vec2(pathPoint.x,cap))-width;float mask=1.-smoothstep(-.025,.025,d);if(mask<.001)discard;
     float edge=1.-smoothstep(.06,.18,abs(d));float band=1.-smoothstep(.13,.23,abs(d+.22));float along=(pathPoint.y+width)/(span+2.*width);
     float timer=band*(1.-smoothstep(progress-.003,progress+.003,along))*step(.0001,progress);float head=exp(-pow((along-progress)*42.,2.))*timer;
     float shine=pow(max(0.,1.-abs(pathPoint.x/width)),5.);float flow=.5+.5*sin(pathPoint.y*.65-time*1.8);
     float arrow=(1.-smoothstep(.12,.26,abs(mod(pathPoint.y+3.5,7.)-3.5-(1.1-abs(pathPoint.x)*.8))))*(1.-smoothstep(width*.60,width*.85,abs(pathPoint.x)))*step(0.,pathPoint.y)*step(pathPoint.y,span);
     vec3 gold=vec3(1.,.62,.10),red=vec3(1.,.09,.22);vec3 colour=mix(gold,red,attack)+vec3(.10,.07,.03)*(shine+edge);
     colour=mix(colour,red+vec3(.30,.23,.12)*head,timer);colour=mix(colour,vec3(1.,.92,.66),arrow*.8);
     gl_FragColor=vec4(colour,mask*max(max(.38+.17*edge+.05*shine+.025*flow+attack*.18,timer*.98),arrow*.88)*opacity);
     #include <colorspace_fragment>
    }`,
  }));this.mesh.name=name;this.mesh.position.y=.135;this.mesh.renderOrder=2;this.mesh.visible=false;
 }
 setPath(points:KnightPoint[]){
  const length=[0];for(let i=1;i<points.length;i++)length.push(length[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][2]-points[i-1][2]));
  this.length=length[length.length-1];const rows:[KnightPoint,number,number,number][]=[];
  for(let i=0;i<points.length;i++){
   const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],d=Math.hypot(b[0]-a[0],b[2]-a[2])||1,x=(b[0]-a[0])/d,z=(b[2]-a[2])/d;
   if(i===0)rows.push([[points[i][0]-x*this.width,0,points[i][2]-z*this.width],-this.width,x,z]);
   rows.push([points[i],length[i],x,z]);
   if(i===points.length-1)rows.push([[points[i][0]+x*this.width,0,points[i][2]+z*this.width],this.length+this.width,x,z]);
  }
  const positions:number[]=[],uv:number[]=[],indices:number[]=[];
  rows.forEach(([p,d,x,z],i)=>{for(const side of [-1,1]){positions.push(p[0]+z*this.width*side,0,p[2]-x*this.width*side);uv.push(this.width*side,d);}if(i){const a=(i-1)*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}});
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeBoundingSphere();
  this.mesh.geometry.dispose();this.mesh.geometry=geometry;this.mesh.material.uniforms.span.value=this.length;
 }
 update(progress:number,active:boolean,now:number,opacity=1){const u=this.mesh.material.uniforms;u.progress.value=Math.max(0,Math.min(1,progress));u.attack.value=active?1:0;u.time.value=now/1000;u.opacity.value=opacity;this.mesh.visible=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
