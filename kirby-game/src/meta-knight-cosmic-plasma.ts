import * as T from 'three';

/** Camera-facing soft plasma. Shared by the sword and the ascent wakes. */
export class CosmicPlasma{
 readonly group=new T.Group();
 private geometry=new T.PlaneGeometry(2,1);
 private material=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false,
  uniforms:{clock:{value:0}},
  vertexShader:`attribute float energy;attribute float seed;varying vec2 vUv;varying float power;varying float phase;
   void main(){vUv=uv;power=energy;phase=seed;
    vec4 a=modelViewMatrix*instanceMatrix*vec4(0.,-.5,0.,1.);
    vec4 b=modelViewMatrix*instanceMatrix*vec4(0.,.5,0.,1.);
    vec2 tangent=normalize(b.xy-a.xy+vec2(.00001,0.));vec2 side=vec2(tangent.y,-tangent.x);
    float width=length((modelViewMatrix*instanceMatrix*vec4(1.,0.,0.,0.)).xyz);
    vec4 p=mix(a,b,uv.y);p.xy+=side*position.x*width;gl_Position=projectionMatrix*p;
   }`,
  fragmentShader:`varying vec2 vUv;varying float power;varying float phase;uniform float clock;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
   void main(){
    float along=vUv.y,x=vUv.x*2.-1.;float flow=noise(vec2(x*3.+phase,along*13.-clock*3.));
    float curl=sin(along*18.-clock*5.+phase)*.12+sin(along*31.+clock*2.)*.06;
    float radius=.38+.42*along;float d=abs(x-curl)/radius;
    float mist=exp(-d*d*3.2),core=exp(-d*d*18.);
    float ends=smoothstep(0.,.16,along)*(1.-smoothstep(.84,1.,along));
    float density=(.30+.70*flow)*ends*power;
    vec3 color=mix(vec3(1.,.18,.015),vec3(1.,.63,.09),mist);color=mix(color,vec3(1.,.93,.64),core*.65);
    gl_FragColor=vec4(color,(mist*.32+core*.14)*density);
    #include <colorspace_fragment>
   }`});
 readonly mesh=new T.InstancedMesh(this.geometry,this.material,24);
 private energies=new T.InstancedBufferAttribute(new Float32Array(24),1);private seeds=new T.InstancedBufferAttribute(new Float32Array(24),1);
 private a=new T.Vector3();private b=new T.Vector3();private center=new T.Vector3();private axis=new T.Vector3();private rotation=new T.Quaternion();private scale=new T.Vector3();private matrix=new T.Matrix4();private count=0;
 constructor(){this.geometry.setAttribute('energy',this.energies);this.geometry.setAttribute('seed',this.seeds);this.mesh.frustumCulled=false;this.mesh.renderOrder=4;this.mesh.name='Soft amber plasma around Galaxia and ascent wakes';this.group.add(this.mesh);}
 begin(clock:number){this.count=0;this.material.uniforms.clock.value=clock;}
 add(a:T.Vector3,b:T.Vector3,radius:number,strength:number,seed:number){
  if(this.count>=24)return;this.a.copy(a);this.b.copy(b);this.axis.subVectors(b,a);const length=this.axis.length();if(length<.001)return;
  this.center.addVectors(a,b).multiplyScalar(.5);this.rotation.setFromUnitVectors(T.Object3D.DEFAULT_UP,this.axis.multiplyScalar(1/length));this.scale.set(radius,length,radius);this.matrix.compose(this.center,this.rotation,this.scale);
  this.mesh.setMatrixAt(this.count,this.matrix);this.energies.setX(this.count,strength);this.seeds.setX(this.count++,seed);
 }
 end(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=this.energies.needsUpdate=this.seeds.needsUpdate=true;this.group.visible=this.count>0;}
 dispose(){this.group.removeFromParent();this.mesh.dispose();this.geometry.dispose();this.material.dispose();}
}
