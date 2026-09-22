import * as THREE from 'three';

export const SUN_DIRECTION = new THREE.Vector3(-.6, .45, 1).normalize();

export function createSky(scene: THREE.Scene) {
  const sun = new THREE.Mesh(new THREE.SphereGeometry(15,32,20),new THREE.MeshBasicMaterial({color:'#fff3ba',fog:false,toneMapped:false}));
  sun.name='Sun disc'; scene.add(sun);
  const moon=new THREE.Group();moon.name='Moon';scene.add(moon);
  moon.add(new THREE.Mesh(new THREE.SphereGeometry(13,32,20),new THREE.MeshBasicMaterial({color:'#dbe8ff',fog:false,toneMapped:false})));
  for(let i=0;i<12;i++){const a=i*2.399,r=2+Math.sqrt(i/12)*8,x=Math.cos(a)*r,y=Math.sin(a)*r;const crater=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshBasicMaterial({color:i%2?'#adbdd4':'#c0cfe3',fog:false}));crater.position.set(x,y,Math.sqrt(169-r*r));crater.scale.set(1+i%3*.5,1+i%3*.4,.18);moon.add(crater);}
  const stars=new THREE.InstancedMesh(new THREE.SphereGeometry(1,5,4),new THREE.MeshBasicMaterial({color:'#cfddff',fog:false}),160);stars.name='Night stars';stars.frustumCulled=false;scene.add(stars);
  const glowMaterial=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{tint:{value:new THREE.Color('#ffc259')}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec2 vUv; uniform vec3 tint; void main(){float r=length(vUv-.5)*2.;float a=pow(max(0.,1.-r),3.)*.38;gl_FragColor=vec4(tint,a);}',
  });
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(110,110),glowMaterial);halo.name='Soft sunlight halo';scene.add(halo);
  const cloudMaterial=new THREE.MeshStandardMaterial({color:'#fffaf0',roughness:1,fog:true});
  const geometry=new THREE.SphereGeometry(1,12,8);
  const clouds=new THREE.InstancedMesh(geometry,cloudMaterial,28*7);
  clouds.name='Drifting clouds';clouds.frustumCulled=false;scene.add(clouds);
  const dummy=new THREE.Object3D();
  let elapsed=0;
  return (dt:number,camera:THREE.Camera,night=false) => {
    elapsed+=dt;
    sun.position.copy(camera.position).addScaledVector(SUN_DIRECTION,850);
    sun.visible=!night;moon.visible=stars.visible=night;moon.position.copy(sun.position);moon.quaternion.copy(camera.quaternion);
    glowMaterial.uniforms.tint.value.set(night?'#9ebcff':'#ffc259');cloudMaterial.color.set(night?'#8394b5':'#fffaf0');
    if(night)for(let i=0;i<160;i++){const a=i*2.399,y=.12+(i%23)/26,r=Math.sqrt(1-y*y);dummy.position.copy(camera.position).add(new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r).multiplyScalar(800));dummy.scale.setScalar(.45+i%3*.25);dummy.updateMatrix();stars.setMatrixAt(i,dummy.matrix);}stars.instanceMatrix.needsUpdate=night;
    halo.position.copy(camera.position).addScaledVector(SUN_DIRECTION,830);halo.quaternion.copy(camera.quaternion);
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

