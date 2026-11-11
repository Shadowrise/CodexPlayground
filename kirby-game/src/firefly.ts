import { AnimationMixer, Color, DoubleSide, Mesh, MeshStandardMaterial, PointLight, type AnimationAction, type ColorRepresentation } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
export const FIREFLY_MODES = ['Sit','Fly','LookAround','Groom','WingStretch'] as const;
export type FireflyMode = typeof FIREFLY_MODES[number];
/** One GLTF instance per firefly; glow color and mode can be changed at any time. */
export class Firefly {
  readonly object;
  readonly mixer;
  private mode?:FireflyMode;
  private action?:AnimationAction;
  get currentMode(){return this.mode;}
  constructor(private gltf:GLTF,color:ColorRepresentation='#baff55'){
    this.object=gltf.scene;this.mixer=new AnimationMixer(this.object);
    this.object.traverse(o=>{if(o instanceof Mesh){o.castShadow=true;const list=Array.isArray(o.material)?o.material:[o.material];const own=list.map(m=>m.name==='Firefly_Glow'?m.clone():m);for(const m of own)if(m.transparent&&m.side===DoubleSide)m.forceSinglePass=true;o.material=Array.isArray(o.material)?own:own[0];}});
    this.setGlowColor(color);this.setMode('Sit');
  }
  setGlowColor(value:ColorRepresentation){
    const color=new Color(value);
    this.object.traverse(o=>{if(o instanceof PointLight && o.name==='Firefly_Light')o.color.copy(color);if(o instanceof Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof MeshStandardMaterial && m.name==='Firefly_Glow'){m.emissive.copy(color);m.color.copy(color);m.emissiveIntensity=1.4;m.roughness=.65;m.toneMapped=false;}});
  }
  setMode(mode:FireflyMode){
    if(mode===this.mode)return;const clip=this.gltf.animations.find(c=>c.name===mode);if(!clip)throw Error(`Missing firefly animation: ${mode}`);
    const next=this.mixer.clipAction(clip);next.reset().fadeIn(.25).play();this.action?.fadeOut(.25);this.mode=mode;this.action=next;
  }
  /** Optional shared clip clock restores the right pose after culling/reconnects
   * while mixer time continues to drive the short transitions between modes. */
  update(dt:number,animationTime?:number){
    if(animationTime!==undefined&&this.action){const duration=this.action.getClip().duration;this.action.time=((animationTime%duration)+duration)%duration-dt;}
    this.mixer.update(dt);
  }
}
