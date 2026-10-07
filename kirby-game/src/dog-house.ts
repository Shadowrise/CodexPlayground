import {ShibaAnimation} from './shiba-animation';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Static decoration; local coordinates relative to Kirby's home. */
export class DogHouse extends T.Group {
  readonly dogSeat=new T.Group();
  private animation?:ShibaAnimation;
  private dogPosition=new T.Vector3();
  constructor(){
    super();this.name='Shiba cottage';this.position.set(8,0,2);
    const batches=new Map<string,T.BufferGeometry[]>();
    const box=(color:string,x:number,y:number,z:number,w:number,h:number,d:number,angle=0)=>{
      const g=new T.BoxGeometry(w,h,d);
      g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),angle),new T.Vector3(1,1,1)));
      if(!batches.has(color))batches.set(color,[]);batches.get(color)!.push(g);
    };
    // Wide open porch keeps the eventual dog's face and front paws in view.
    box('#99704c',0,.12,.35,3.7,.24,4.1);
    box('#f0dab6',0,1.16,-1.25,3.2,2.08,.18);
    for(const s of [-1,1]){
      box('#f0dab6',s*1.51,1.16,-.08,.18,2.08,2.5);
      box('#f0dab6',s*1.18,1.16,1.2,.65,2.08,.18);
      box('#96684b',s*1.51,1.16,1.32,.15,2.13,.19);
      box('#96684b',s*.81,1.16,1.32,.13,2.13,.19);
      const pitch=Math.atan2(.92,1.85);
      box('#ab526a',s*.94,2.71,0,2.13,.15,3.4,-s*pitch);
      // Raised seams are genuine geometry, with no coplanar overlays.
      for(let j=0;j<7;j++)box('#c97688',s*.94,2.80,-1.44+j*.48,2.15,.065,.055,-s*pitch);
      box('#f5d69a',s*.94,2.71,1.76,2.19,.19,.16,-s*pitch);
      for(let j=0;j<5;j++)box('#d9b98c',s*1.615,.43+j*.36,-.08,.035,.035,2.43);
    }
    box('#f5d69a',0,3.24,0,.18,.18,3.6);
    box('#96684b',0,2.20,1.32,3.3,.16,.19);
    for(let j=0;j<9;j++)box('#cba575',-1.55+j*.387,.257,.35,.35,.035,3.9);
    box('#c8758d',0,.30,.95,1.48,.045,1.65);
    box('#ead6ae',0,.08,2.8,2.0,.16,.8);
    // Paw emblem above the doorway, using small low segment spheres.
    const paw=(x:number,y:number,r:number)=>{
      const g=new T.SphereGeometry(r,8,5);g.scale(1,1,.30);g.translate(x,y,1.445);
      if(!batches.has('#f5d69a'))batches.set('#f5d69a',[]);batches.get('#f5d69a')!.push(g);
    };
    paw(0,2.43,.15);for(const x of [-.20,0,.20])paw(x,2.66-Math.abs(x)*.3,.075);
    for(const [color,parts] of batches){
      const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());
      const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:.86}));
      mesh.castShadow=mesh.receiveShadow=true;this.add(mesh);
    }
    this.dogSeat.name='Shiba porch seat';this.add(this.dogSeat);
  }
  /** Call with the licensed asset once supplied; preserve its original textures. */
  placeDog(model:T.Object3D){
    this.animation=new ShibaAnimation(model);
    this.dogSeat.clear();const holder=new T.Group();holder.add(model);holder.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(holder,true),size=bounds.getSize(new T.Vector3());
    if(!Number.isFinite(size.length())||Math.min(size.x,size.y,size.z)<=0)throw new Error('Invalid Shiba bounds');
    const scale=Math.min(1.24/size.x,1.65/size.y,1.85/size.z);
    holder.scale.setScalar(scale);
    const center=bounds.getCenter(new T.Vector3());
    holder.position.set(-center.x*scale,.335-bounds.min.y*scale,1.13-center.z*scale);
    holder.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=o.receiveShadow=true;}});
    this.dogSeat.add(holder);return holder;
  }
  update(dt:number,camera:T.Vector3){
    if(this.animation&&this.getWorldPosition(this.dogPosition).distanceToSquared(camera)<80*80)return this.animation.update(dt);
    return false;
  }
  constrain(p:T.Vector3,r:number){
    const center=this.getWorldPosition(new T.Vector3());
    if(p.y>center.y+3.4+r)return;
    const x=p.x-center.x,z=p.z-center.z,hx=1.85+r,hz=2.05+r;
    if(Math.abs(x)<hx&&Math.abs(z-.35)<hz){
      const dz=z-.35;
      if(hx-Math.abs(x)<hz-Math.abs(dz))p.x=center.x+(x<0?-hx:hx);
      else p.z=center.z+.35+(dz<0?-hz:hz);
    }
  }
}
