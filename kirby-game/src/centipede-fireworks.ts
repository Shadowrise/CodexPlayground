import * as T from 'three';

/** Five deterministic bursts in one GPU particle draw, with no lights or shadows. */
export class CentipedeFireworks{
 readonly mesh:T.Mesh<T.InstancedBufferGeometry,T.ShaderMaterial>;
 private clock={value:0};
 constructor(){
  const positions:number[]=[],flights:number[]=[],timing:number[]=[],colors:number[]=[],color=new T.Color();
  const palette=['#ff658f','#ffd247','#57efb0','#58cfff','#bd88ff'];
  for(let burst=0;burst<5;burst++){
   const angle=burst*2.399,x=Math.cos(angle)*(burst?7.5:0),z=Math.sin(angle)*(burst?7.5:0),height=7.5+burst%3*1.4,launch=.15+burst*1.3,rise=1.05+burst%2*.15;
   const add=(dx:number,dy:number,dz:number,speed:number,trail:number,hue:string)=>{positions.push(x,height,z);flights.push(dx,dy,dz,speed);timing.push(launch,rise,trail);color.set(hue);colors.push(color.r,color.g,color.b);};
   for(let i=0;i<72;i++){
    const y=1-2*(i+.5)/72,r=Math.sqrt(1-y*y),a=i*2.399;
    add(Math.cos(a)*r,y,Math.sin(a)*r,4.8+i%5*.35,-1,i%11===0?palette[(burst+2)%5]:palette[burst]);
   }
   for(let i=0;i<14;i++)add(0,0,0,0,i/14,palette[burst]);
  }
  const geo=new T.InstancedBufferGeometry();geo.instanceCount=positions.length/3;geo.setIndex([0,1,2,0,2,3]);geo.setAttribute('position',new T.Float32BufferAttribute([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],3));geo.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));geo.setAttribute('origin',new T.InstancedBufferAttribute(new Float32Array(positions),3));geo.setAttribute('flight',new T.InstancedBufferAttribute(new Float32Array(flights),4));geo.setAttribute('timing',new T.InstancedBufferAttribute(new Float32Array(timing),3));geo.setAttribute('color',new T.InstancedBufferAttribute(new Float32Array(colors),3));
  const material=new T.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,blending:T.NormalBlending,toneMapped:false,uniforms:{clock:this.clock},
   vertexShader:`attribute vec3 origin;attribute vec4 flight;attribute vec3 timing;attribute vec3 color;uniform float clock;varying vec3 tint;varying float fade;varying vec2 sparkUv;
    vec3 sparkPosition(float t){float travel=(1.0-exp(-t*.42))/.42;return origin+flight.xyz*flight.w*travel-vec3(0.0,t*t*1.1,0.0);}
    vec3 rocketPosition(float t){float u=clamp(t/timing.y,0.0,1.0);return vec3(origin.x,1.0+(origin.y-1.0)*(1.0-pow(1.0-u,1.6)),origin.z);}
    void main(){
     float age=clock-timing.x;vec3 tip,tail;float width=.18;fade=0.0;
     if(timing.z>=0.0){
      float t=age-timing.z*.18;tip=rocketPosition(t);tail=rocketPosition(t-.035);
      fade=smoothstep(0.0,.12,t)*(1.0-smoothstep(timing.y-.08,timing.y+.08,t))*(1.0-timing.z*.8);width=.22-timing.z*.1;
     }else{
      float t=max(0.0,age-timing.y);tip=sparkPosition(t);tail=sparkPosition(max(0.0,t-.18));
      fade=smoothstep(0.0,.06,age-timing.y)*(1.0-smoothstep(1.35,2.8,t));width*=.85+.15*sin(clock*14.0+flight.w*9.0);
     }
     vec4 mv=modelViewMatrix*vec4(tip,1.0),back=modelViewMatrix*vec4(tail,1.0);vec2 delta=mv.xy-back.xy;float span=length(delta);vec2 along=span>.001?delta/span:vec2(0.0,1.0);
     mv.xy=(mv.xy+back.xy)*.5+along*position.y*max(span,.24)+vec2(along.y,-along.x)*position.x*width;
     tint=color;sparkUv=uv;gl_Position=projectionMatrix*mv;
    }`,
   fragmentShader:`varying vec3 tint;varying float fade;varying vec2 sparkUv;void main(){
    vec2 p=sparkUv*2.0-1.0;float core=exp(-p.x*p.x*7.0),a=core*(1.0-p.y*p.y)*fade;if(a<.015)discard;gl_FragColor=vec4(mix(tint,vec3(1.0),core*.2),a);
    #include <colorspace_fragment>
   }`});
  this.mesh=new T.Mesh(geo,material);this.mesh.name='Топотушка — радужный салют';this.mesh.frustumCulled=false;this.mesh.visible=false;
 }
 update(active:boolean,elapsed:number,x:number,z:number){this.mesh.visible=active&&elapsed>=0&&elapsed<9.3;if(!this.mesh.visible)return;this.mesh.position.set(x,0,z);this.clock.value=elapsed;}
}
