import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {connectedArchShadowGeometry,ProjectedStructureShadows} from '../src/projected-structure-shadows';
import {daylight,phaseAtHour} from '../src/day-cycle';
import {groundShadowOpacity} from '../src/ground-shadow-style';

test('the prepared arch envelope retains both piers, open crown and columns with a small shared mesh',()=>{
 const geometry=connectedArchShadowGeometry();assert.equal(geometry,connectedArchShadowGeometry());
 assert(geometry.attributes.position.count/3<600);assert.equal(Object.keys(geometry.attributes).join(','),'position');
 const bounds=geometry.boundingBox!;assert(bounds.min.x<=-7&&bounds.max.x>=7);assert(Math.abs(bounds.min.y)<1e-6&&bounds.max.y>7.9);
 const material=new T.MeshBasicMaterial({side:T.DoubleSide}),mesh=new T.Mesh(geometry,material),ray=new T.Raycaster();mesh.updateMatrixWorld();
 const intersects=(x:number,y:number)=>{ray.set(new T.Vector3(x,y,-10),new T.Vector3(0,0,1));return ray.intersectObject(mesh).length>0;};
 for(const x of [-3,3])for(const y of [.1,1,2,3,4.2])assert(intersects(x,y),'both piers must be solid all the way to the crown');
 for(let i=0;i<=32;i++){const angle=i*Math.PI/32;assert(intersects(3*Math.cos(angle),4.3+3*Math.sin(angle)),'the crown must remain continuous');}
 assert(!intersects(0,2),'the archway stays open');material.dispose();
});

test('connected shadows reuse static vertex buffers and preserve the common density without depth casters',()=>{
 const geometry=connectedArchShadowGeometry(),shadows=new ProjectedStructureShadows(),source=new T.Matrix4().makeTranslation(-90,0,9);shadows.add(geometry,source);shadows.commit();
 const mesh=shadows.group.children[0] as T.InstancedMesh,matrix=new T.Matrix4();mesh.getMatrixAt(0,matrix);
 assert.deepEqual(matrix.elements,source.elements);assert.equal(mesh.geometry.attributes.position,geometry.attributes.position);assert.equal(mesh.castShadow,false);
 assert(!shadows.material.depthWrite);assert.equal(shadows.material.depthFunc,T.LessEqualDepth);
 for(const hour of [7,9,12,17,23]){const time=daylight(phaseAtHour(hour));shadows.update(time,new T.Vector3());assert.equal(shadows.material.opacity,groundShadowOpacity(time));}
 shadows.commit();assert.equal(shadows.group.children.length,1);
 const bounds=mesh.boundingBox!;assert(bounds.min.x<source.elements[12]-7&&bounds.max.x>source.elements[12]+7);
});
