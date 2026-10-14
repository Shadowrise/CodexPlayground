import { Box3, BufferGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshLambertMaterial, Object3D, SphereGeometry, Vector3 } from 'three';
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
import {startupTask} from './startup-tasks';

export const FRUIT_TYPES = ['Яблоко', 'Клубника', 'Арбуз', 'Груша', 'Апельсин', 'Банан', 'Виноград', 'Ананас', 'Персик', 'Вишня'] as const;
export type Fruit = { type: typeof FRUIT_TYPES[number]; object: Group; eaten: boolean };
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
      this.fruits.push({ type: FRUIT_TYPES[kind], object, eaten: false });
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
        const visible = !fruit.eaten && fruit.object.visible;
        if (visible === slot.shown) continue;
        slot.shown = visible;
        dirty = true;
      }
      if (!dirty) continue;
      // Pack active instances instead of submitting zero-scale hidden fruit to
      // the vertex shader and both shadow passes. Capacity/bounds stay stable.
      let count = 0;
      for (const slot of batch.slots) if (slot.shown) {
        batch.mesh.setMatrixAt(count++, fruitMatrix(this.fruits[slot.fruit].object, this.scratch).multiply(slot.local));
      }
      batch.mesh.count = count;
      batch.mesh.visible = count > 0;
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  restore(eaten:readonly boolean[],npcEaten:number) {
    this.fruits.forEach((fruit,i)=>{fruit.eaten=eaten[i];fruit.object.visible=!fruit.eaten;});
    this.npcEaten=npcEaten;this.pickupAfter=new WeakMap();
    this.syncInstances();
  }
  get remaining() { return this.onMap; }
  update(dt: number, player: CharacterController, npcs: readonly KirbyNpc[], riding = false, playerPickupPosition?: Vector3) {
    this.time += dt;
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
    let playerFruit: Fruit | undefined;
    for (const eater of [player, ...npcs]) {
      const isPlayer = eater === player;
      if ((isPlayer && riding) || ('isDown' in eater && eater.isDown)
        || ['Jump', 'Fly', 'Death', 'Roll'].includes(eater.state)
        || this.time < (this.pickupAfter.get(eater.actor) ?? 0)) continue;
      let nearest: Fruit | undefined;
      let distance = .9 * eater.actor.scale.x + .65;
      for (const fruit of this.fruits) {
        if (fruit.eaten) continue;
        const d = (isPlayer && playerPickupPosition ? playerPickupPosition : eater.actor.position).distanceTo(fruit.object.position);
        if (d < distance) { nearest = fruit; distance = d; }
      }
      if (!nearest) continue;
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
