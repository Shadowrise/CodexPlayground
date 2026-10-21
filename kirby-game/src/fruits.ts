import { Box3, BufferGeometry, CylinderGeometry, Group, InstancedMesh, MathUtils, Matrix4, Mesh, MeshLambertMaterial, Object3D, SphereGeometry, Vector3 } from 'three';
import type { CharacterController } from './controller';
import type { KirbyNpc } from './npcs';
import { makeStrawberry } from './strawberry';
import { makeBanana } from './banana';
import { makeFruitVolumeMist } from './fruit-mist';
import { makeWatermelon } from './watermelon';
import { makePineapple } from './pineapple';
import { makePeach } from './peach';
import { makeOrange } from './orange';
import { makePear } from './pear';
import { makeCherry } from './cherry';
import { makeGrapes } from './grapes';
import { fruitLayout,type FruitObstacle } from './fruit-layout';
import {shadowParts,type ShadowPart} from './prepared-shadows';
import {startupTask} from './startup-tasks';
import {FRUIT_EATING} from './fruit-eating';

export const FRUIT_TYPES = ['Яблоко', 'Клубника', 'Арбуз', 'Груша', 'Апельсин', 'Банан', 'Виноград', 'Ананас', 'Персик', 'Вишня'] as const;
export type Fruit = { type: typeof FRUIT_TYPES[number]; object: Group; eaten: boolean; shadow?:ShadowPart[] };
type InhalingFruit={index:number;eater:CharacterController;elapsed:number;position:Vector3;rotation:Vector3;scale:Vector3;center:Vector3;start:Vector3;side:number;viewOnly:boolean;delivered:boolean};
const sphere = new SphereGeometry(1, 16, 12);
const materials = new Map<string, MeshLambertMaterial>();
function material(color: string) {
  if (!materials.has(color)) materials.set(color, new MeshLambertMaterial({ color }));
  return materials.get(color)!;
}
function ball(g: Group, color: string, x: number, y: number, z: number, sx: number, sy = sx, sz = sx) {
  const mesh = new Mesh(sphere, material(color)); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); g.add(mesh); return mesh;
}
function leaf(g: Group, x: number, y: number, z: number, angle = .5) {
  const mesh = ball(g, '#3e982e', x, y, z, .15, .035, .07); mesh.rotation.z = angle;
}
function stem(g: Group, y: number, x = 0) {
  const mesh = new Mesh(new CylinderGeometry(.025, .035, .22, 6), material('#71432a')); mesh.position.set(x, y, 0); mesh.rotation.z = -.2; g.add(mesh);
}
function makeFruit(kind: number) {
  const g = new Group();
  if (kind === 0) {
    ball(g, '#ed343a', -.12, .32, 0, .26, .3); ball(g, '#ef3f32', .12, .32, 0, .26, .3); stem(g, .64); leaf(g, .12, .7, 0);
  } else if (kind === 1) {
    g.add(makeStrawberry());
  } else if (kind === 2) {
    g.add(makeWatermelon());
  } else if (kind === 3) {
    g.add(makePear());
  } else if (kind === 4) {
    g.add(makeOrange());
  } else if (kind === 5) {
    g.add(makeBanana());
  } else if (kind === 6) {
    g.add(makeGrapes());
  } else if (kind === 7) {
    g.add(makePineapple());
  } else if (kind === 8) {
    g.add(makePeach());
  } else {
    g.add(makeCherry());
  }
  g.traverse(o => { if (o instanceof Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  const bounds = new Box3().setFromObject(g);
  for (const child of g.children) child.position.y -= bounds.min.y;
  return g;
}

function fruitMatrix(object: Object3D, target: Matrix4) {
  object.updateMatrix();
  return target.copy(object.matrix);
}

export class FruitWorld {
  claim?: (index:number,eater:CharacterController|KirbyNpc)=>void;
  readonly group = new Group();
  readonly fruits: Fruit[] = [];
  private npcEaten = 0;
  private pickupAfter = new WeakMap<Object3D, number>();
  private time = 0;
  private readonly batches: { mesh: InstancedMesh; slots: { fruit: number; local: Matrix4; shown: boolean }[] }[] = [];
  private readonly scratch = new Matrix4();
  private readonly mists:{object:Mesh;center:Vector3;scale:Vector3}[]=[];
  private readonly centers:Vector3[]=[];
  private readonly radii:number[]=[];
  private readonly inhaling=new Map<number,InhalingFruit>();
  private readonly transformed=new Set<number>();
  private readonly pendingClaims=new Map<number,number>();
  private readonly target=new Vector3();
  private readonly control=new Vector3();
  private readonly visualCenter=new Vector3();
  private lastPickupActor?:Object3D;
  private readonly lastPickupPosition=new Vector3();
  private readonly pickupVelocity=new Vector3();
  get onMap() { return this.fruits.filter(f => !f.eaten).length; }
  get eatenByNpcs() { return this.npcEaten; }
  static async create(obstacles:readonly FruitObstacle[]=[]){
    const templates:Group[]=[];
    for(let i=0;i<FRUIT_TYPES.length;i++){templates.push(makeFruit(i));await startupTask();}
    return new FruitWorld(obstacles,templates);
  }
  constructor(obstacles:readonly FruitObstacle[]=[],templates=FRUIT_TYPES.map((_, i) => makeFruit(i))) {
    const bounds=templates.map(template=>new Box3().setFromObject(template));
    const positions=fruitLayout(obstacles);
    for (let i = 0; i < 70; i++) {
      const kind = i % 10, object = templates[kind].clone(true);
      const mist=makeFruitVolumeMist(kind,bounds[kind]);object.add(mist);
      this.mists.push({object:mist,center:mist.position.clone(),scale:mist.scale.clone()});
      object.scale.setScalar(2.5);
      const position=positions[i];object.position.set(position.x,-.012,position.z);
      object.rotation.y=i*2.399;
      object.name = FRUIT_TYPES[kind]; this.group.add(object);
      this.fruits.push({ type: FRUIT_TYPES[kind], object, eaten: false, shadow:shadowParts(object) });
      this.centers.push(bounds[kind].getCenter(new Vector3()));
      const size=bounds[kind].getSize(new Vector3());this.radii.push(Math.max(size.x,size.z)/2);
    }
    this.bakeInstances();
  }
  private bakeInstances() {
    this.group.updateMatrixWorld(true);
    const inv = new Matrix4();
    const placed = new Matrix4();
    const parts = new Map<string, { geometry: BufferGeometry; material: MeshLambertMaterial; items: { fruit: number; local: Matrix4 }[] }>();
    const add = (geometry: BufferGeometry, material: MeshLambertMaterial, fruit: number, local: Matrix4) => {
      const key = geometry.uuid + material.uuid;
      const part = parts.get(key) ?? { geometry, material, items: [] };
      part.items.push({ fruit, local });
      parts.set(key, part);
    };
    this.fruits.forEach((fruit, fruitIndex) => {
      fruit.object.updateMatrixWorld(true);
      inv.copy(fruit.object.matrixWorld).invert();
      const meshes: Mesh[] = [];
      fruit.object.traverse(object => { if (object instanceof Mesh) meshes.push(object); });
      for (const mesh of meshes) {
        const source = mesh.material;
        if (!(source instanceof MeshLambertMaterial)) continue;
        if (mesh instanceof InstancedMesh) {
          const instance = new Matrix4();
          for (let i = 0; i < mesh.count; i++) {
            mesh.getMatrixAt(i, instance);
            add(mesh.geometry, source, fruitIndex, placed.copy(mesh.matrixWorld).multiply(instance).premultiply(inv).clone());
          }
        } else add(mesh.geometry, source, fruitIndex, mesh.matrixWorld.clone().premultiply(inv));
        mesh.removeFromParent();
      }
    });
    for (const part of parts.values()) {
      const mesh = new InstancedMesh(part.geometry, part.material, part.items.length);
      mesh.castShadow = mesh.receiveShadow = true;
      const slots = part.items.map((item, index) => {
        fruitMatrix(this.fruits[item.fruit].object, this.scratch).multiply(item.local);
        mesh.setMatrixAt(index, this.scratch);
        return { fruit: item.fruit, local: item.local, shown: true };
      });
      mesh.computeBoundingSphere();
      mesh.instanceMatrix.needsUpdate = true;
      this.group.add(mesh);
      this.batches.push({ mesh, slots });
    }
  }
  syncInstances() {
    for (const batch of this.batches) {
      let dirty = false;
      for (const slot of batch.slots) {
        const fruit = this.fruits[slot.fruit];
        const visible = this.isVisible(slot.fruit) && fruit.object.visible;
        const moving=visible&&this.inhaling.has(slot.fruit);
        if (visible === slot.shown && !moving&&!this.transformed.has(slot.fruit)) continue;
        slot.shown = visible;
        dirty = true;
      }
      if (!dirty) continue;
      // Pack active instances instead of submitting zero-scale hidden fruit to
      // the vertex shader and both shadow passes. Only moving/changed batches upload.
      let count = 0;
      for (const slot of batch.slots) if (slot.shown) {
        batch.mesh.setMatrixAt(count++, fruitMatrix(this.fruits[slot.fruit].object, this.scratch).multiply(slot.local));
      }
      batch.mesh.count = count;
      batch.mesh.visible = count > 0;
      batch.mesh.instanceMatrix.needsUpdate = true;
      batch.mesh.computeBoundingSphere();
    }
    this.transformed.clear();
  }
  restore(eaten:readonly boolean[],npcEaten:number) {
    for(const flight of this.inhaling.values())this.finishInhale(flight);
    this.inhaling.clear();this.pendingClaims.clear();
    this.fruits.forEach((fruit,i)=>{fruit.eaten=eaten[i];fruit.object.visible=!fruit.eaten;});
    this.npcEaten=npcEaten;this.pickupAfter=new WeakMap();this.lastPickupActor=undefined;
    this.syncInstances();
  }
  get remaining() { return this.onMap; }
  /** Rendering and gameplay both hide swallowed fruit, including pending claims. */
  isVisible(index:number){
    const flight=this.inhaling.get(index);
    return flight?flight.elapsed<FRUIT_EATING[flight.eater.fruitEating.kind].swallow:!this.fruits[index].eaten&&!this.pendingClaims.has(index);
  }
  private beginInhale(index:number,eater:CharacterController,viewOnly=false){
    const object=this.fruits[index].object,center=this.centers[index].clone();
    const start=object.localToWorld(center.clone()),dx=start.x-eater.actor.position.x,dz=start.z-eater.actor.position.z;
    const side=dx*Math.cos(eater.yaw)-dz*Math.sin(eater.yaw)<0?-1:1;
    const flight:InhalingFruit={index,eater,elapsed:0,position:object.position.clone(),rotation:new Vector3(object.rotation.x,object.rotation.y,object.rotation.z),scale:object.scale.clone(),center,start,side,viewOnly,delivered:false};
    this.inhaling.set(index,flight);eater.fruitEating.apply(0,flight.start);
  }
  private finishInhale(flight:InhalingFruit){
    const fruit=this.fruits[flight.index],object=fruit.object;
    object.position.copy(flight.position);object.scale.copy(flight.scale);object.rotation.set(flight.rotation.x,flight.rotation.y,flight.rotation.z);
    object.visible=!fruit.eaten&&!this.pendingClaims.has(flight.index);
    flight.eater.fruitEating.clear();this.inhaling.delete(flight.index);
    this.transformed.add(flight.index);
  }
  /** The room remains authoritative; other players also get a visible swallow. */
  confirm(index:number,eater?:CharacterController){
    if(this.fruits[index].eaten)return;
    const claimedHere=this.pendingClaims.has(index);
    const previous=this.inhaling.get(index);
    if(previous&&previous.eater!==eater)this.finishInhale(previous);
    this.pendingClaims.delete(index);this.fruits[index].eaten=true;
    if(!claimedHere&&!this.inhaling.has(index)&&eater&&!Array.from(this.inhaling.values()).some(f=>f.eater===eater))this.beginInhale(index,eater,true);
    this.fruits[index].object.visible=this.isVisible(index);
  }
  update(dt: number, player: CharacterController, npcs: readonly KirbyNpc[], riding = false, playerPickupPosition?: Vector3) {
    this.time += dt;
    const pickupPosition=playerPickupPosition??player.actor.position;
    this.pickupVelocity.set(0,0,0);
    if(this.lastPickupActor===player.actor&&dt>0){
      this.pickupVelocity.copy(pickupPosition).sub(this.lastPickupPosition).divideScalar(dt);this.pickupVelocity.y=0;
      this.pickupVelocity.clampLength(0,player.speed*2);
    }
    this.lastPickupPosition.copy(pickupPosition);this.lastPickupActor=player.actor;
    let playerFruit: Fruit | undefined;
    for(const [index,expires] of this.pendingClaims)if(this.time>=expires){this.pendingClaims.delete(index);this.fruits[index].object.visible=!this.fruits[index].eaten;}
    for(const flight of this.inhaling.values()){
      const {eater,index}=flight,fruit=this.fruits[index],object=fruit.object;
      const timing=FRUIT_EATING[eater.fruitEating.kind];
      if(!flight.viewOnly&&!flight.delivered&&(riding&&!playerPickupPosition||eater.flight.active||eater.roll.active||['Death','Roll','Jump','Fly','Dash'].includes(eater.state))){this.finishInhale(flight);continue;}
      flight.elapsed+=dt;
      object.localToWorld(this.visualCenter.copy(flight.center));
      eater.fruitEating.apply(flight.elapsed,this.visualCenter);
      eater.fruitEating.mouthPosition(this.target);
      const u=Math.max(0,Math.min(1,(flight.elapsed-.10)/(timing.swallow-.10))),travel=u*u*(3-2*u);
      // The final approach stays in front of the face. A side arc carries fruit
      // from behind around the cheek instead of through the character's body.
      const size=eater.actor.scale.x,yaw=eater.yaw;
      const dx=flight.start.x-eater.actor.position.x,dz=flight.start.z-eater.actor.position.z;
      const behind=1-MathUtils.smoothstep(dx*Math.sin(yaw)+dz*Math.cos(yaw),-.4*size,.4*size);
      this.control.copy(this.target).add(new Vector3(Math.sin(yaw)*1.2*size,0,Math.cos(yaw)*1.2*size));
      this.control.x+=Math.cos(yaw)*flight.side*1.8*size*behind;this.control.z-=Math.sin(yaw)*flight.side*1.8*size*behind;
      this.visualCenter.copy(flight.start).multiplyScalar((1-travel)**2).addScaledVector(this.control,2*(1-travel)*travel).addScaledVector(this.target,travel*travel);
      this.visualCenter.y+=Math.sin(Math.PI*travel)*.34*size;
      const shrink=1-MathUtils.smoothstep(u,.27,1),stretch=Math.sin(Math.PI*u)*.20;
      object.scale.copy(flight.scale).multiply(new Vector3(Math.max(.001,shrink*(1-stretch*.6)),Math.max(.001,shrink*(1-stretch*.35)),Math.max(.001,shrink*(1+stretch))));
      object.rotation.set(flight.rotation.x+.12*Math.sin(Math.PI*u),flight.rotation.y+.55*travel,flight.rotation.z);
      // Models have their origin at ground level, not at their centre. Keep the
      // fruit's actual centre on the trajectory as it shrinks and rotates.
      this.group.worldToLocal(this.visualCenter);
      this.control.copy(flight.center).multiply(object.scale).applyEuler(object.rotation);
      object.position.copy(this.visualCenter).sub(this.control);
      object.visible=flight.elapsed<timing.swallow;
      if(!flight.delivered&&flight.elapsed>=timing.swallow){
        flight.delivered=true;
        if(!flight.viewOnly){
          if(this.claim){this.pendingClaims.set(index,this.time+3);this.claim(index,eater);}
          else {fruit.eaten=true;eater.eatFruit();if(eater===player)playerFruit=fruit;}
        }
      }
      if(flight.elapsed>=timing.duration)this.finishInhale(flight);
    }
    for (let i=0;i<this.fruits.length;i++) {
      const fruit=this.fruits[i];
      if(fruit.eaten||!fruit.object.visible)continue;
      const {object:mist,center,scale}=this.mists[i];
      if(!mist.visible)continue;
      const phase=this.time*.7+i*2.4;
      mist.position.set(center.x+Math.sin(phase)*.04,center.y+Math.sin(phase*.8)*.025,center.z);
      const swell=1+Math.sin(phase)*.025;
      mist.scale.set(scale.x*swell,scale.y*swell,scale.z*swell);
    }
    for (const eater of [player, ...npcs]) {
      const isPlayer = eater === player;
      if ((isPlayer && riding) || ('isDown' in eater && eater.isDown)
        || ['Jump', 'Fly', 'Death', 'Roll'].includes(eater.state)
        || this.time < (this.pickupAfter.get(eater.actor) ?? 0)
        || isPlayer&&Array.from(this.inhaling.values()).some(f=>f.eater===player)) continue;
      let nearest: Fruit | undefined;
      let distance = Infinity;
      for (let index=0;index<this.fruits.length;index++) {
        const fruit=this.fruits[index];
        if (fruit.eaten||this.inhaling.has(index)||this.pendingClaims.has(index)) continue;
        const origin=isPlayer&&playerPickupPosition?playerPickupPosition:eater.actor.position;
        const dx=fruit.object.position.x-origin.x,dz=fruit.object.position.z-origin.z;
        const d=Math.hypot(dx,dz),size=eater.actor.scale.x;
        const contact=.9*size+.65;
        const radius=this.radii[index]*fruit.object.scale.x;
        const closing=Math.max(0,(dx*this.pickupVelocity.x+dz*this.pickupVelocity.z)/(d||1));
        // Start sooner at sprint/boost speed so the runner cannot overtake the
        // fruit before its final approach to the mouth.
        const reach=isPlayer?Math.max(1.9*size+radius+1.3,closing*FRUIT_EATING[player.fruitEating.kind].swallow+.9*size+radius+.5):contact;
        const facing=dx*Math.sin(eater.yaw)+dz*Math.cos(eater.yaw);
        if(Math.abs(fruit.object.position.y-origin.y)>1.4*size+.6)continue;
        if(isPlayer&&d>contact&&facing<d*.15)continue;
        if (d < reach && d < distance) { nearest = fruit; distance = d; }
      }
      if (!nearest) continue;
      if(isPlayer&&!playerPickupPosition){this.beginInhale(this.fruits.indexOf(nearest),player);continue;}
      if(this.claim){this.claim(this.fruits.indexOf(nearest),eater);this.pickupAfter.set(eater.actor,this.time+.45);continue;}
      nearest.eaten = true;
      nearest.object.visible = false;
      eater.eatFruit();
      this.pickupAfter.set(eater.actor, this.time + (isPlayer ? .45 : 3));
      if (isPlayer) playerFruit = nearest;
      else this.npcEaten++;
    }
    return playerFruit;
  }
}
