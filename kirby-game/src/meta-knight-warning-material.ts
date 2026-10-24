import * as T from 'three';
import {KNIGHT} from './meta-knight-battle';
import {KNIGHT_WARNING_STYLE as STYLE} from './meta-knight-warning-style';

/** All floor footprints use the original duel's glass, including its highlights. */
export const KNIGHT_WARNING_SURFACE=`
 vec4 knightWarningSurface(vec2 uv,float edge,float rim,float timer,float front,vec3 tint,vec3 activeTint,float clock,float baseOpacity){
  float glint=1.-smoothstep(.025,.16,abs(uv.x*.62+uv.y*.38-.54));
  float sheen=.5+.5*sin(uv.y*8.+clock*.6);
  vec3 colour=tint+vec3(.07,.055,.025)*glint+vec3(.10,.075,.025)*rim;
  colour=mix(colour,activeTint+vec3(.35,.22,.09)*front,timer);
  return vec4(colour,max(max(baseOpacity+.25*edge+.065*glint+.025*sheen,rim*.98),timer*.98));
 }
`;

export function knightWarningGlass(color:number=STYLE.gold,lane=false){
 return new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,
  uniforms:{tint:{value:new T.Color(color)},activeTint:{value:new T.Color(STYLE.red)},lane:{value:lane?1:0},clock:{value:0},span:{value:1},width:{value:KNIGHT.laneHalfWidth*2},progress:{value:-1},baseOpacity:{value:STYLE.opacity}},
  vertexShader:'varying vec2 glassUv;void main(){glassUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec2 glassUv;uniform vec3 tint;uniform vec3 activeTint;uniform float lane;uniform float clock;uniform float span;uniform float width;uniform float progress;uniform float baseOpacity;
  ${KNIGHT_WARNING_SURFACE}
  void main(){vec2 p=glassUv*2.-1.;float edge=smoothstep(.12,1.,length(p));float mask=1.;float rim=0.;float timer=0.;float front=0.;
   if(lane>.5){vec2 point=(glassUv-.5)*vec2(width,span+width);float radius=width*.5;
    float distanceToEdge=length(vec2(point.x,max(abs(point.y)-span*.5,0.)))-radius;
    mask=1.-smoothstep(-.015,.015,distanceToEdge);if(mask<.001)discard;
    edge=pow(clamp(1.+distanceToEdge/radius,0.,1.),1.7);rim=1.-smoothstep(.025,.085,abs(distanceToEdge));
    if(progress>=0.){float along=(span*.5+radius-point.y)/(span+width);float ribbon=1.-smoothstep(.12,.20,abs(distanceToEdge+.20));
     timer=ribbon*(1.-smoothstep(progress-.004,progress+.004,along))*step(.0001,progress);front=exp(-pow((along-progress)*45.,2.))*timer;}}
   gl_FragColor=knightWarningSurface(glassUv,edge,rim,timer,front,tint,activeTint,clock,baseOpacity);gl_FragColor.a*=mask;
   #include <colorspace_fragment>
  }`});
}

export function knightWarningArrowGeometry(){
 const shape=new T.Shape();shape.moveTo(-.35,-.4);shape.lineTo(0,0);shape.lineTo(.35,-.4);shape.lineTo(.35,-.15);shape.lineTo(0,.25);shape.lineTo(-.35,-.15);shape.closePath();
 return new T.ShapeGeometry(shape);
}
export function knightWarningArrowMaterial(){return new T.MeshBasicMaterial({color:STYLE.arrow,transparent:true,opacity:STYLE.arrowOpacity,side:T.DoubleSide,depthWrite:false,toneMapped:false});}
export function knightWarningArrow(){const mesh=new T.Mesh(knightWarningArrowGeometry(),knightWarningArrowMaterial());mesh.rotation.x=-Math.PI/2;mesh.renderOrder=3;return mesh;}

/** The same rounded red countdown surrounds every circular landing warning. */
export function knightWarningCountdown(radius=KNIGHT.slashRadius-.035*KNIGHT.effectScale,half:number=KNIGHT.slashHalfAngle,full=false){
 const width=.14*KNIGHT.effectScale;
 const mesh=new T.Mesh(new T.RingGeometry(radius-width-.04,radius+width+.04,96,1,-half-(full?0:.06),half*2+(full?0:.12)),new T.ShaderMaterial({
  transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,
  uniforms:{progress:{value:0},direction:{value:-1},radius:{value:radius},width:{value:width},halfAngle:{value:half},tint:{value:new T.Color(STYLE.red)}},
  vertexShader:'varying vec2 arcPoint;void main(){arcPoint=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec2 arcPoint;uniform float progress;uniform float direction;uniform float radius;uniform float width;uniform float halfAngle;uniform vec3 tint;
   void main(){if(progress<.0001)discard;
    vec2 p=vec2(arcPoint.x,arcPoint.y*direction);float angle=atan(p.y,p.x);float end=mix(-halfAngle,halfAngle,progress);
    float closest=clamp(angle,-halfAngle,end);vec2 centre=radius*vec2(cos(closest),sin(closest));float distanceToArc=length(p-centre);
    distanceToArc=min(distanceToArc,length(p-radius*vec2(cos(-halfAngle),sin(-halfAngle))));
    float mask=1.-smoothstep(width-.025,width+.025,distanceToArc);if(mask<.001)discard;
    float front=exp(-pow((angle-end)*radius/(width*2.8),2.));float rim=smoothstep(width*.25,width,distanceToArc);
    vec3 colour=tint*(.92+.08*rim)+vec3(.40,.21,.12)*front+vec3(.09,.045,.035)*(1.-rim);
    gl_FragColor=vec4(colour,mask*.97);
    #include <colorspace_fragment>
   }`,
 }));
 mesh.name='Meta Knight sword wind-up countdown';mesh.renderOrder=2;return mesh;
}
