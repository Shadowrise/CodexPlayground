import * as THREE from 'three';

export const SUN_DIRECTION = new THREE.Vector3(-.6, .45, 1).normalize();

export function createSky(scene: THREE.Scene) {
  const sun = new THREE.Mesh(new THREE.SphereGeometry(15,32,20),new THREE.MeshBasicMaterial({color:'#fff3ba',fog:false,toneMapped:false}));
  sun.name='Sun disc'; scene.add(sun);
  const glowMaterial=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec2 vUv; void main(){float r=length(vUv-.5)*2.;float a=pow(max(0.,1.-r),3.)*.38;gl_FragColor=vec4(1.,.76,.35,a);}',
  });
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(110,110),glowMaterial);halo.name='Soft sunlight halo';scene.add(halo);
  const cloudMaterial=new THREE.MeshStandardMaterial({color:'#fffaf0',roughness:1,fog:true});
  const geometry=new THREE.SphereGeometry(1,12,8);
  const clouds=new THREE.InstancedMesh(geometry,cloudMaterial,28*7);
  clouds.name='Drifting clouds';clouds.frustumCulled=false;scene.add(clouds);
  const dummy=new THREE.Object3D();
  let elapsed=0;
  return (dt:number,camera:THREE.Camera) => {
    elapsed+=dt;
    sun.position.copy(camera.position).addScaledVector(SUN_DIRECTION,850);
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

