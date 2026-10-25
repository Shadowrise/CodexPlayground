import * as T from 'three';
import {COSMIC_WORLDS} from './meta-knight-cosmic-world';

export const planetHash=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
function noise(x:number,y:number,z:number){
 const a=Math.floor(x),b=Math.floor(y),c=Math.floor(z),smooth=(t:number)=>t*t*(3-2*t),u=smooth(x-a),v=smooth(y-b),w=smooth(z-c),h=(dx:number,dy:number,dz:number)=>planetHash((a+dx)*13.7+(b+dy)*43.3+(c+dz)*97.1),mix=T.MathUtils.lerp;
 return mix(mix(mix(h(0,0,0),h(1,0,0),u),mix(h(0,1,0),h(1,1,0),u),v),mix(mix(h(0,0,1),h(1,0,1),u),mix(h(0,1,1),h(1,1,1),u),v),w);
}
/** Small real elevation complements the fine relief in the close-up material. */
export function planetRelief(direction:T.Vector3,world=0){
 const d=direction.clone().normalize(),seed=world*7.13,wide=noise(d.x*5+seed,d.y*5,d.z*5),ridge=1-Math.abs(noise(d.x*36,d.y*36+seed,d.z*36)*2-1),grain=noise(d.x*95,d.y*95,d.z*95+seed);
 return .0012+.003*wide+.0035*ridge*ridge+.0011*grain;
}
export function detailedPlanetGeometry(world:number){
 const radius=COSMIC_WORLDS[world].radius,g=new T.SphereGeometry(radius,160,104),p=g.getAttribute('position'),d=new T.Vector3();
 for(let i=0;i<p.count;i++){d.fromBufferAttribute(p,i);d.multiplyScalar(1+planetRelief(d,world));p.setXYZ(i,d.x,d.y,d.z);}g.computeVertexNormals();return g;
}
/** Fine coasts, biomes, cloud filaments, mineral grain and relief are evaluated without bitmap magnification. */
export function detailPlanetMaterial(material:T.ShaderMaterial){
 material.uniforms.surfaceDetail={value:0};
 material.vertexShader='varying vec3 detailView;\n'+material.vertexShader.replace('view=normalize(-mv.xyz);','view=normalize(-mv.xyz);detailView=mv.xyz;');
 material.fragmentShader='uniform float surfaceDetail;varying vec3 detailView;\n'+material.fragmentShader;
 const enrichment=`
 float stone=fbm(d*115.+offset),grain=noise(d*420.+offset),vein=1.-smoothstep(.012,.042,abs(noise(d*185.+offset)-.5));
 vec3 closeColor=color;float ocean=0.;
 if(kind<.5){
  float continent=fbm(d*4.6),land=smoothstep(.457,.535,continent),humidity=fbm(d*19.+offset),mountain=pow(1.-abs(noise(d*53.+offset)*2.-1.),4.)*smoothstep(.51,.63,continent);
  vec3 sea=mix(vec3(.008,.034,.105),vec3(.025,.32,.37),smoothstep(.40,.475,continent));
  vec3 biome=mix(vec3(.09,.23,.12),vec3(.29,.43,.19),humidity);float desert=(1.-smoothstep(.25,.58,abs(d.y)))*(1.-smoothstep(.37,.55,humidity));biome=mix(biome,vec3(.54,.40,.21),desert*.8);
  biome=mix(biome,vec3(.31,.30,.28),mountain*.65);biome=mix(biome,vec3(.78,.87,.88),smoothstep(.72,.93,abs(d.y))+smoothstep(.58,.9,mountain)*.75);
  biome*=.74+.38*stone+.13*grain;closeColor=mix(sea,biome,land);ocean=1.-land;
  vec3 cloudPoint=d*24.+vec3(0.,clock*.013,0.);float bank=fbm(cloudPoint+vec3(fbm(d*11.)*2.)),wisps=fbm(d*105.+vec3(bank*7.));float clouds=smoothstep(.49,.68,bank)*smoothstep(.30,.72,wisps);
  closeColor=mix(closeColor,vec3(.84,.90,.94),clouds*.87);
 }else closeColor*=.72+.40*stone+.14*grain;
 if(kind>2.5&&kind<3.5)emission+=vec3(.40,.07,.008)*vein*stone;
 color=mix(color,closeColor,surfaceDetail);
 float reliefDetail=(stone*.75+grain*.15+vein*.07)*surfaceDetail;
 vec3 N=normalize(n),dx=dFdx(detailView),dy=dFdy(detailView),rx=cross(dy,N),ry=cross(N,dx);float determinant=dot(dx,rx);
 vec3 detailN=normalize(abs(determinant)*N-sign(determinant)*(dFdx(reliefDetail)*rx+dFdy(reliefDetail)*ry)*.035);
 `;
 material.fragmentShader=material.fragmentShader.replace('float sun=dot(normalize(n)',enrichment+'float sun=dot(detailN').replace('dot(normalize(n),normalize(view))','dot(detailN,normalize(view))');
 material.fragmentShader=material.fragmentShader.replace('color+=emission;',`float waterGlint=pow(max(0.,dot(reflect(-normalize(vec3(-.65,.70,.6)),detailN),normalize(view))),48.)*ocean*surfaceDetail;color+=vec3(.34,.48,.57)*waterGlint;color+=emission;`);
 return material;
}
