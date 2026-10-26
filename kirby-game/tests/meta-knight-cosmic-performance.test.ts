import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {MetaKnightCosmicRefugeView} from '../src/meta-knight-cosmic-refuge-view';
import {COSMIC_WORLDS} from '../src/meta-knight-cosmic-world';
import {REFUGE_WORLDS} from '../src/meta-knight-cosmic-refuge';
import {startKnightBattle,setKnightPhase,type KnightActor} from '../src/meta-knight-battle';
import {refugeGravityPaths} from '../src/meta-knight-refuge-gravity';

test('every planet round reuses prepared surfaces and fracture buffers, then releases owned resources once',()=>{
 const scene=new T.Scene(),star=new T.Mesh(new T.SphereGeometry(1),new T.MeshStandardMaterial()),sourceGeometries:T.BufferGeometry[]=[],sourceMaterials:T.Material[]=[];
 star.name='Background refuge star';const starGroup=new T.Group();starGroup.add(star);scene.add(starGroup);
 for(const world of COSMIC_WORLDS){const geometry=new T.SphereGeometry(world.radius,8,4),material=new T.ShaderMaterial({uniforms:{clock:{value:0}}}),mesh=new T.Mesh(geometry,material);mesh.name=world.name;scene.add(mesh);sourceGeometries.push(geometry);sourceMaterials.push(material);}
 const view=new MetaKnightCosmicRefugeView(scene,new T.Group()),resources=()=>{
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();view.group.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});return {geometries,materials};
 };
 const before=resources(),sharedMistGeometry=(view.burst.group.children.find(o=>o instanceof T.Mesh&&o.name==='Fruit colored mist') as T.Mesh).geometry,disposals=new Map<T.BufferGeometry,number>();for(const g of before.geometries)g.addEventListener('dispose',()=>disposals.set(g,(disposals.get(g)??0)+1));
 const actor:KnightActor={id:'a',p:[0,0,-2],yaw:0,available:true},s=startKnightBattle([actor],'a',1000)!;setKnightPhase(s,4,[actor],5000,3);
 for(let round=0;round<2;round++)for(const world of REFUGE_WORLDS){
  s.cosmicRefuge!.world=world;s.cosmicRefuge!.at+=1000;delete s.cosmicRefuge!.impactAt;
  Object.assign(s,{stage:'cosmic-planet-draw',since:5000,until:7400});view.update(s,6200);
  assert.equal(view.group.children.filter(o=>o.name.startsWith('Captured rolling')&&o.visible).length,1);
  Object.assign(s,{stage:'cosmic-planet-sweep',since:7400,until:16400});view.update(s,10000);
  s.cosmicRefuge!.impactAt=16400;Object.assign(s,{stage:'cosmic-star-strike',since:16400,until:17050});view.update(s,16600);
  assert.deepEqual(resources().geometries,before.geometries,'combat must not construct or replace geometry');
  assert.equal(disposals.size,0,'switching worlds must not discard prepared buffers');
 }
 view.dispose();assert([...disposals.values()].every(count=>count===1));
 for(const g of before.geometries)assert.equal(disposals.get(g),g===sharedMistGeometry?undefined:1);
 assert(sourceGeometries.every(g=>!disposals.has(g)));assert(scene.getObjectByName(COSMIC_WORLDS[0].name)!.visible);
 sourceGeometries.forEach(g=>g.dispose());sourceMaterials.forEach(m=>m.dispose());star.geometry.dispose();star.material.dispose();
});

test('gravity updates reuse every point while responding to a new origin, radius and clock',()=>{
 const tip=new T.Vector3(0,184,0),center=new T.Vector3(30,181,10),paths=refugeGravityPaths(tip,center,19,0),points=paths.map(p=>p.slice());
 for(let i=0;i<30;i++){
  tip.set(i-5,183+i*.1,-i);center.set(40+i,181,10);const radius=19+i,result=refugeGravityPaths(tip,center,radius,i*.13,paths),fresh=refugeGravityPaths(tip,center,radius,i*.13);
  assert.equal(result,paths);for(let j=0;j<4;j++)for(let k=0;k<paths[j].length;k++){assert.equal(paths[j][k],points[j][k]);assert(paths[j][k].distanceTo(fresh[j][k])<1e-10);}
 }
});
