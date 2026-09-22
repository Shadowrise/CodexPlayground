import { AnimationMixer, Color, Mesh, MeshStandardMaterial, PointLight, type ColorRepresentation } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
/** One GLTF instance per firefly; glow color and mode can be changed at any time. */
export class Firefly {
  readonly object;
  readonly mixer;
  private mode?:'Sit'|'Fly';
  constructor(private gltf:GLTF,color:ColorRepresentation='#baff55'){
    this.object=gltf.scene;this.mixer=new AnimationMixer(this.object);
    this.object.traverse(o=>{if(o instanceof Mesh){o.castShadow=true;const list=Array.isArray(o.material)?o.material:[o.material];const own=list.map(m=>m.name==='Firefly_Glow'?m.clone():m);o.material=Array.isArray(o.material)?own:own[0];}});
    this.setGlowColor(color);this.setMode('Sit');
  }
  setGlowColor(value:ColorRepresentation){
    const color=new Color(value);
    this.object.traverse(o=>{if(o instanceof PointLight && o.name==='Firefly_Light')o.color.copy(color);if(o instanceof Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof MeshStandardMaterial && m.name==='Firefly_Glow'){m.emissive.copy(color);m.color.copy(color).lerp(new Color('#ffffff'),.3);}});
  }
  setMode(mode:'Sit'|'Fly'){
    if(mode===this.mode)return;const clip=this.gltf.animations.find(c=>c.name===mode);if(!clip)throw Error(`Missing firefly animation: ${mode}`);
    const next=this.mixer.clipAction(clip);next.reset().fadeIn(.25).play();if(this.mode)this.mixer.clipAction(this.gltf.animations.find(c=>c.name===this.mode)!).fadeOut(.25);this.mode=mode;
  }
  update(dt:number){this.mixer.update(dt);}
}
