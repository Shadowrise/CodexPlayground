import * as T from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { Firefly } from './firefly';
import { sceneryClearance } from './landmarks';
import { makeFruitMist } from './fruit-mist';
type Bug={carrier:T.Group;firefly:Firefly;home:T.Vector3;halo:T.Sprite;color:T.Color;phase:number;land:boolean;lightPosition:T.Vector3};
export class NightFireflies {
  readonly group=new T.Group();
  readonly lights:T.PointLight[]=[];
  readonly bugs:Bug[]=[];
  private time=0;
  constructor(gltf:GLTF){
    this.group.name='Forty nocturnal fireflies';
    for(let i=0;i<40;i++){
      const object=gltf.scene.clone(true);const imported:T.Object3D[]=[];object.traverse(o=>{if(o instanceof T.PointLight)imported.push(o);});imported.forEach(o=>o.removeFromParent());
      const color=new T.Color().setHSL((i*.618)%1,1,.46),firefly=new Firefly({...gltf,scene:object},color);
      object.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=false;});object.scale.setScalar(.65);
      const home=new T.Vector3((i%8-3.5)*54,0,(Math.floor(i/8)-2)*78);
      for(let j=0;j<600;j++){const x=home.x+Math.sin(j*2.399+i)*j*.32,z=home.z+Math.cos(j*2.399+i)*j*.32;if(Math.abs(x)<210 && Math.abs(z)<210 && sceneryClearance(x,z,15)){home.set(x,0,z);break;}}
      const carrier=new T.Group();carrier.add(object);this.group.add(carrier);
      const halo=makeFruitMist(0);halo.material=halo.material.clone();halo.material.color.copy(color);halo.material.opacity=.8;halo.material.blending=T.AdditiveBlending;halo.material.fog=false;halo.scale.set(3.5,3.5,1);carrier.add(halo);
      this.bugs.push({carrier,firefly,home,halo,color,phase:i*1.87,land:true,lightPosition:new T.Vector3()});
    }
    // A fixed light pool avoids forty point lights on every terrain fragment.
    for(let i=0;i<4;i++){const light=new T.PointLight('#ffffff',0,11,2);light.castShadow=false;this.lights.push(light);}
    this.group.visible=false;
  }
  buzzLevel(listener:T.Vector3){
    if(!this.group.visible)return 0;
    let level=0;
    for(const bug of this.bugs)if(!bug.land)level=Math.max(level,Math.max(0,1-bug.carrier.position.distanceTo(listener)/16)**2);
    return level;
  }
  update(dt:number,night:boolean,camera:T.Vector3){
    this.group.visible=night;if(!night){for(const l of this.lights)l.intensity=0;return;}
    this.time+=dt;
    const nearest=[...this.bugs].sort((a,b)=>a.carrier.position.distanceToSquared(camera)-b.carrier.position.distanceToSquared(camera));
    const detailed=new Set(nearest.slice(0,5));
    for(const bug of this.bugs){
      const cycle=(this.time+bug.phase)%32,flying=cycle<23;
      const t=cycle/23,fade=Math.sin(Math.PI*Math.min(1,t));
      const x=flying?Math.sin(t*Math.PI*2)*11:0,z=flying?(1-Math.cos(t*Math.PI*2))*5:0;
      bug.carrier.position.copy(bug.home).add(new T.Vector3(x,flying?Math.max(0,fade)*3.4:0,z));bug.carrier.rotation.y=flying?Math.atan2(Math.cos(t*Math.PI*2),Math.sin(t*Math.PI*2)):bug.phase;
      if(bug.land===flying){bug.firefly.setMode(flying?'Fly':'Sit');bug.land=!flying;}
      const visible=detailed.has(bug)&&bug.carrier.position.distanceTo(camera)<42;bug.firefly.object.visible=visible;if(visible)bug.firefly.update(dt);
      // Keep the light on the luminous rear end even when the detailed mesh is culled.
      bug.carrier.updateWorldMatrix(true,false);bug.lightPosition.set(0,.5+(flying?.23:0),-.58).applyMatrix4(bug.carrier.matrixWorld);
      bug.halo.position.set(0,.5+(flying?.23:0),-.58);bug.halo.material.opacity=.65+.15*Math.sin(this.time*2+bug.phase);
    }
    const sources=[...this.bugs].sort((a,b)=>a.lightPosition.distanceToSquared(camera)-b.lightPosition.distanceToSquared(camera));
    this.lights.forEach((light,i)=>{const bug=sources[i];light.position.copy(bug.lightPosition);light.color.copy(bug.color);light.intensity=9*T.MathUtils.clamp(1-light.position.distanceTo(camera)/48,0,1);});
  }
}
