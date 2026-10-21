import * as T from 'three';

/** Shared floor warning: gold glass, forward chevrons and a red edge timer. */
export function attackRibbonMaterial(width:number){
 return new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,
  uniforms:{width:{value:width},span:{value:1},progress:{value:0},attack:{value:0},opacity:{value:1},time:{value:0}},
  vertexShader:`varying vec2 pathPoint;
   void main(){pathPoint=uv;vec4 p=vec4(position,1.);
    #ifdef USE_INSTANCING
     p=instanceMatrix*p;
    #endif
    gl_Position=projectionMatrix*modelViewMatrix*p;
   }`,
  fragmentShader:`varying vec2 pathPoint;uniform float width;uniform float span;uniform float progress;uniform float attack;uniform float opacity;uniform float time;
   void main(){float cap=max(max(-pathPoint.y,pathPoint.y-span),0.);float d=length(vec2(pathPoint.x,cap))-width;float mask=1.-smoothstep(-.025,.025,d);if(mask<.001)discard;
    float detail=min(1.,width/1.35);float edge=1.-smoothstep(.06*detail,.18*detail,abs(d));float band=1.-smoothstep(.13*detail,.23*detail,abs(d+.22*detail));float along=(pathPoint.y+width)/(span+2.*width);
    float timer=band*(1.-smoothstep(progress-.003,progress+.003,along))*step(.0001,progress);float head=exp(-pow((along-progress)*42.,2.))*timer;
    float shine=pow(max(0.,1.-abs(pathPoint.x/width)),5.);float flow=.5+.5*sin(pathPoint.y*.65-time*1.8);vec2 arrowPoint=pathPoint/detail;
    float arrow=(1.-smoothstep(.12,.26,abs(mod(arrowPoint.y+3.5,7.)-3.5-(1.1-abs(arrowPoint.x)*.8))))*(1.-smoothstep(width*.60,width*.85,abs(pathPoint.x)))*step(0.,pathPoint.y)*step(pathPoint.y,span);
    vec3 gold=vec3(1.,.62,.10),red=vec3(1.,.09,.22);vec3 colour=mix(gold,red,attack)+vec3(.10,.07,.03)*(shine+edge);
    colour=mix(colour,red+vec3(.30,.23,.12)*head,timer);colour=mix(colour,vec3(1.,.92,.66),arrow*.8);
    gl_FragColor=vec4(colour,mask*max(max(.38+.17*edge+.05*shine+.025*flow+attack*.18,timer*.98),arrow*.88)*opacity);
    #include <colorspace_fragment>
   }`,
 });
}

export function updateAttackRibbon(material:T.ShaderMaterial,progress:number,active:boolean,now:number,opacity=1){
 const u=material.uniforms;u.progress.value=Math.max(0,Math.min(1,progress));u.attack.value=active?1:0;u.time.value=now/1000;u.opacity.value=opacity;
}
