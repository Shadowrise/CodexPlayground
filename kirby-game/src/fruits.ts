import { Box3, CatmullRomCurve3, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Object3D, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import type { CharacterController } from './controller';
import type { KirbyNpc } from './npcs';
import { makeStrawberry } from './strawberry';
import { makeBanana } from './banana';
import { makeFruitMist } from './fruit-mist';
import { makeWatermelon } from './watermelon';
import { fruitLayout,type FruitObstacle } from './fruit-layout';

export const FRUIT_TYPES = ['Яблоко', 'Клубника', 'Арбуз', 'Груша', 'Апельсин', 'Банан', 'Виноград', 'Ананас', 'Персик', 'Вишня'] as const;
export type Fruit = { type: typeof FRUIT_TYPES[number]; object: Group; eaten: boolean };
const sphere = new SphereGeometry(1, 16, 12);
const materials = new Map<string, MeshStandardMaterial>();
function material(color: string) {
  if (!materials.has(color)) materials.set(color, new MeshStandardMaterial({ color, roughness: .22 }));
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
    ball(g, '#bdde33', 0, .3, 0, .32, .3); ball(g, '#c9e448', .015, .59, 0, .18, .28); stem(g, .9); leaf(g, .13, .88, 0);
  } else if (kind === 4) {
    ball(g, '#ff9218', 0, .34, 0, .34); leaf(g, .08, .68, 0);
  } else if (kind === 5) {
    g.add(makeBanana());
  } else if (kind === 6) {
    for (let row = 0; row < 3; row++) for (let j = 0; j < 5 - row; j++) { const a = j / (5 - row) * Math.PI * 2; ball(g, row % 2 ? '#8e39c9' : '#6830b7', Math.cos(a) * (.19 - row * .045), .56 - row * .2, Math.sin(a) * (.19 - row * .045), .145); }
    stem(g, .79); leaf(g, .14, .83, 0);
  } else if (kind === 7) {
    ball(g, '#e6a52c', 0, .4, 0, .3, .4, .3);
    for (let i = 0; i < 36; i++) { const a = i * 2.4, h = .15 + (i % 6) * .1, r = .3 * Math.sqrt(1 - ((h - .4) / .4) ** 2); ball(g, '#bf8122', Math.cos(a) * r, h, Math.sin(a) * r, .024); }
    for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7; const tip = new Mesh(new ConeGeometry(.06, .5, 4), material('#388b42')); tip.position.set(Math.cos(a) * .1, .94, Math.sin(a) * .1); tip.rotation.set(Math.sin(a) * .4, 0, -Math.cos(a) * .4); g.add(tip); }
  } else if (kind === 8) {
    ball(g, '#ffae66', -.10, .32, 0, .25, .31); ball(g, '#fa8b83', .10, .32, 0, .25, .31); leaf(g, .1, .64, 0);
  } else {
    ball(g, '#ba1645', -.18, .19, 0, .19); ball(g, '#e42d40', .18, .19, .05, .19);
    for (const s of [-1, 1]) { const curve = new CatmullRomCurve3([new Vector3(s * .18, .35, 0), new Vector3(s * .12, .57, 0), new Vector3(0, .73, 0)]); g.add(new Mesh(new TubeGeometry(curve, 8, .018, 5, false), material('#477b2a'))); }
    leaf(g, .1, .73, 0);
  }
  g.traverse(o => { if (o instanceof Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  const bounds = new Box3().setFromObject(g);
  for (const child of g.children) child.position.y -= bounds.min.y;
  return g;
}

export class FruitWorld {
  readonly group = new Group();
  readonly fruits: Fruit[] = [];
  private npcEaten = 0;
  private pickupAfter = new WeakMap<Object3D, number>();
  private time = 0;
  get onMap() { return this.fruits.filter(f => !f.eaten).length; }
  get eatenByNpcs() { return this.npcEaten; }
  constructor(obstacles:readonly FruitObstacle[]=[]) {
    const templates = FRUIT_TYPES.map((_, i) => makeFruit(i));
    const positions=fruitLayout(obstacles);
    for (let i = 0; i < 70; i++) {
      const kind = i % 10, object = templates[kind].clone(true);
      object.add(makeFruitMist(kind));
      object.scale.setScalar(2.5);
      const position=positions[i];object.position.set(position.x,-.012,position.z);
      object.rotation.y=i*2.399;
      object.name = FRUIT_TYPES[kind]; this.group.add(object);
      this.fruits.push({ type: FRUIT_TYPES[kind], object, eaten: false });
    }
  }
  restore(eaten:readonly boolean[],npcEaten:number) {
    this.fruits.forEach((fruit,i)=>{fruit.eaten=eaten[i];fruit.object.visible=!fruit.eaten;});
    this.npcEaten=npcEaten;this.pickupAfter=new WeakMap();
  }
  get remaining() { return this.onMap; }
  update(dt: number, player: CharacterController, npcs: readonly KirbyNpc[], riding = false, playerPickupPosition?: Vector3) {
    this.time += dt;
    for (let i=0;i<this.fruits.length;i++) {
      const fruit=this.fruits[i];
      if(fruit.eaten)continue;
      const mist=fruit.object.getObjectByName('Fruit colored mist')!;
      const phase=this.time*.7+i*2.4;
      mist.position.set(Math.sin(phase)*.07,.48+Math.sin(phase*.8)*.035,0);
      mist.scale.set(2.5+Math.sin(phase)*.12,1.7+Math.cos(phase)*.07,1);
    }
    let playerFruit: Fruit | undefined;
    for (const eater of [player, ...npcs]) {
      const isPlayer = eater === player;
      if ((isPlayer && riding) || ('isDown' in eater && eater.isDown)
        || ['Jump', 'Fly', 'Death'].includes(eater.state)
        || this.time < (this.pickupAfter.get(eater.actor) ?? 0)) continue;
      let nearest: Fruit | undefined;
      let distance = .9 * eater.actor.scale.x + .65;
      for (const fruit of this.fruits) {
        if (fruit.eaten) continue;
        const d = (isPlayer && playerPickupPosition ? playerPickupPosition : eater.actor.position).distanceTo(fruit.object.position);
        if (d < distance) { nearest = fruit; distance = d; }
      }
      if (!nearest) continue;
      nearest.eaten = true;
      nearest.object.visible = false;
      eater.grow();
      this.pickupAfter.set(eater.actor, this.time + (isPlayer ? .45 : 3));
      if (isPlayer) playerFruit = nearest;
      else this.npcEaten++;
    }
    return playerFruit;
  }
}
