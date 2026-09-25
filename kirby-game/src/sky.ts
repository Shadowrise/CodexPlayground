import {daylight,type Daylight} from './day-cycle';
import * as THREE from 'three';

export const SUN_DIRECTION = new THREE.Vector3(-.6, .45, 1).normalize();

export function createSky(scene: THREE.Scene) {
  const sun = new THREE.Mesh(new THREE.SphereGeometry(15,32,20),new THREE.MeshBasicMaterial({color:'#fff3ba',fog:false,toneMapped:false,transparent:true}));
  sun.name='Sun disc'; scene.add(sun);
  const moon=new THREE.Group();moon.name='Moon';scene.add(moon);
  moon.add(new THREE.Mesh(new THREE.SphereGeometry(13,32,20),new THREE.MeshBasicMaterial({color:'#dbe8ff',fog:false,toneMapped:false,transparent:true})));
  for(let i=0;i<12;i++){const a=i*2.399,r=2+Math.sqrt(i/12)*8,x=Math.cos(a)*r,y=Math.sin(a)*r;const crater=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshBasicMaterial({color:i%2?'#adbdd4':'#c0cfe3',fog:false,transparent:true}));crater.position.set(x,y,Math.sqrt(169-r*r));crater.scale.set(1+i%3*.5,1+i%3*.4,.18);moon.add(crater);}
  const stars=new THREE.InstancedMesh(new THREE.SphereGeometry(1,5,4),new THREE.MeshBasicMaterial({color:'#cfddff',fog:false,transparent:true,depthWrite:false}),160);stars.name='Night stars';stars.frustumCulled=false;scene.add(stars);
  const glowMaterial=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{tint:{value:new THREE.Color('#ffc259')},strength:{value:1}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec2 vUv; uniform vec3 tint; uniform float strength; void main(){float r=length(vUv-.5)*2.;float a=pow(max(0.,1.-r),3.)*.38;gl_FragColor=vec4(tint,a*strength);}',
  });
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(110,110),glowMaterial);halo.name='Soft sunlight halo';scene.add(halo);
  const cloudMaterial=new THREE.MeshStandardMaterial({color:'#fffaf0',roughness:1,fog:true});
  const geometry=new THREE.SphereGeometry(1,12,8);
  const clouds=new THREE.InstancedMesh(geometry,cloudMaterial,28*7);
  clouds.name='Drifting clouds';clouds.frustumCulled=false;scene.add(clouds);
  const dummy=new THREE.Object3D();
  const horizonMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color()},horizon:{value:new THREE.Color()}},vertexShader:'varying vec3 dir;void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 dir;uniform vec3 top;uniform vec3 horizon;void main(){float h=smoothstep(0.,.65,normalize(dir).y);gl_FragColor=vec4(mix(horizon,top,h),1.);}'});
  const dome=new THREE.Mesh(new THREE.SphereGeometry(950,24,12),horizonMaterial);dome.name='Daylight sky gradient';dome.renderOrder=-10;scene.add(dome);
  const dayColor=new THREE.Color('#fffaf0'),nightColor=new THREE.Color('#8394b5'),sunsetColor=new THREE.Color('#ffc19d');
  const topDay=new THREE.Color('#93c8ed'),topNight=new THREE.Color('#091127'),topDusk=new THREE.Color('#82669a'),horizonDay=new THREE.Color('#d8e9eb'),horizonNight=new THREE.Color('#182b4b'),horizonDusk=new THREE.Color('#ffc392');
  const orbit=new THREE.Vector3();
  let elapsed=0;
  return (dt:number,camera:THREE.Camera,lighting:boolean|Daylight=false) => {
    elapsed+=dt;const light=typeof lighting==='boolean'?daylight(lighting?.75:.25):lighting;
    const {night,twilight,elevation,angle}=light;
    orbit.set(Math.cos(angle)*.85,elevation,Math.cos(angle)*.4).normalize();
    sun.position.copy(camera.position).addScaledVector(orbit,850);moon.position.copy(camera.position).addScaledVector(orbit,-850);moon.quaternion.copy(camera.quaternion);
    sun.visible=elevation>-.06;moon.visible=elevation<.06;stars.visible=night>.001;
    sun.material.opacity=THREE.MathUtils.smoothstep(elevation,-.06,.1);sun.material.color.set('#fff3ba').lerp(sunsetColor,twilight);
    moon.traverse(o=>{if(o instanceof THREE.Mesh)(o.material as THREE.MeshBasicMaterial).opacity=THREE.MathUtils.smoothstep(-elevation,-.06,.1);});
    stars.material.opacity=night*.85;
    glowMaterial.uniforms.tint.value.copy(dayColor).lerp(nightColor,night).lerp(sunsetColor,twilight);glowMaterial.uniforms.strength.value=Math.max(sun.material.opacity,THREE.MathUtils.smoothstep(-elevation,-.06,.1))*(1-twilight*.65);
    cloudMaterial.color.copy(dayColor).lerp(nightColor,night).lerp(sunsetColor,twilight*.65);
    dome.position.copy(camera.position);horizonMaterial.uniforms.top.value.copy(topDay).lerp(topNight,night).lerp(topDusk,twilight*.65);horizonMaterial.uniforms.horizon.value.copy(horizonDay).lerp(horizonNight,night).lerp(horizonDusk,twilight*.85);
    if(stars.visible)for(let i=0;i<160;i++){const a=i*2.399,y=.12+(i%23)/26,r=Math.sqrt(1-y*y);dummy.position.copy(camera.position).add(new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r).multiplyScalar(800));dummy.scale.setScalar(.45+i%3*.25);dummy.updateMatrix();stars.setMatrixAt(i,dummy.matrix);}stars.instanceMatrix.needsUpdate=stars.visible;
    halo.position.copy(camera.position).addScaledVector(orbit,elevation>=0?830:-830);halo.quaternion.copy(camera.quaternion);
    for(let i=0;i<28;i++) {
      const x=((i*137.3+elapsed*(1.1+i%3*.18))%820)-410;
      const z=((i*229.7)%820)-410, y=85+(i%5)*13;
      const size=7+(i%4)*2;
      for(let j=0;j<7;j++) {
        dummy.position.set(x+(j-3)*size*.72,y+Math.sin(j*1.7+i)*size*.18,z+Math.sin(j*2.3)*size*.45);
        dummy.scale.set(size*(.9+(j%3)*.17),size*(.32+(j%3)*.09),size*.75);
        dummy.updateMatrix();clouds.setMatrixAt(i*7+j,dummy.matrix);
      }
    }
    clouds.instanceMatrix.needsUpdate=true;
  };
}

