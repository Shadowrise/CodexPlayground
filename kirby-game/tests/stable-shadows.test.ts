import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PerspectiveCamera,Scene,Vector3,WebGLRenderTarget} from 'three';
import {daylight} from '../src/day-cycle';
import {StableCSM} from '../src/stable-shadows';

test('shadow cameras track sun and moon without rolling over at noon or midnight',()=>{
  const camera=new PerspectiveCamera(48,1.6,.75,1200),scene=new Scene();
  camera.position.set(30,8,40);camera.lookAt(0,0,0);
  const csm=new StableCSM({camera,parent:scene,cascades:2,maxFar:200,shadowMapSize:1024});
  for(const phase of [.25,.75]){
    const rotations=[];
    for(const offset of [-.00001,0,.00001]){
      csm.lightDirection.fromArray(daylight(phase+offset).shadowDirection);csm.update();scene.updateMatrixWorld(true);
      const light=csm.lights[0];light.shadow.updateMatrices(light);
      rotations.push(light.shadow.camera.quaternion.clone());
      const forward=light.shadow.camera.getWorldDirection(new Vector3());
      assert(forward.dot(csm.lightDirection)>.999999);
      assert(light.position.toArray().every(Number.isFinite));
    }
    assert(rotations[0].angleTo(rotations[1])<.001);
    assert(rotations[1].angleTo(rotations[2])<.001);
  }
  csm.dispose();csm.remove();
});

test('far cascade retains matching light matrices between updates and refreshes immediately on camera/time jumps',()=>{
 const camera=new PerspectiveCamera(48,1.6,.75,1200),scene=new Scene();camera.position.set(30,8,40);camera.lookAt(0,0,0);
 const csm=new StableCSM({camera,parent:scene,cascades:2,maxFar:200,shadowMapSize:1024});
 csm.lightDirection.fromArray(daylight(.18).shadowDirection);csm.update(0);
 const light=csm.lights[1];light.shadow.map=new WebGLRenderTarget(1,1);light.shadow.needsUpdate=false;
 const position=light.position.clone(),target=light.target.position.clone();
 csm.update(.016);assert(!light.shadow.needsUpdate);assert(light.position.equals(position));assert(light.target.position.equals(target));
 csm.update(.034);assert(light.shadow.needsUpdate);light.shadow.needsUpdate=false;
 camera.position.x+=2;csm.update(.04);assert(light.shadow.needsUpdate);light.shadow.needsUpdate=false;
 camera.lookAt(-100,10,10);csm.update(.045);assert(light.shadow.needsUpdate);light.shadow.needsUpdate=false;
 csm.lightDirection.fromArray(daylight(.7).shadowDirection);csm.update(.05);assert(light.shadow.needsUpdate);
 csm.dispose();csm.remove();
});

test('camera motion keeps a stationary world point on the same shadow texel grid',()=>{
  const camera=new PerspectiveCamera(48,1.6,.75,1200),scene=new Scene();
  camera.position.set(30,8,40);camera.lookAt(0,0,0);
  const csm=new StableCSM({camera,parent:scene,cascades:2,maxFar:200,shadowMapSize:1024});
  csm.lightDirection.fromArray(daylight(.18).shadowDirection);
  const samples:Vector3[][]=[];
  for(let i=0;i<2;i++){
    camera.position.x+=.03;csm.update();scene.updateMatrixWorld(true);
    samples.push(csm.lights.map(light=>{
      light.shadow.updateMatrices(light);
      return new Vector3(5,0,3).applyMatrix4(light.shadow.matrix).multiply(new Vector3(light.shadow.mapSize.x,light.shadow.mapSize.y,1));
    }));
  }
  for(let i=0;i<csm.lights.length;i++)for(const axis of ['x','y'] as const){
    const delta=samples[1][i][axis]-samples[0][i][axis];
    assert(Math.abs(delta-Math.round(delta))<1e-7,'Texel grid must not drift fractionally with camera movement');
  }
  csm.dispose();csm.remove();
});
