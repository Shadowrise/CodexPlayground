import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,Raycaster,Vector3} from 'three';
import {createBroadleafTree} from '../src/broadleaf-tree';
import {makeGreatOak,greatOakBark} from '../src/great-oak';
import {Treehouse} from '../src/treehouse';

test('great oak retains the approved leaves and uses outward bark surfaces attached over both rope anchors',()=>{
 const oak=makeGreatOak(),original=createBroadleafTree('oak');
 assert.deepEqual(oak.leaves.attributes.position.array,original.leaves.attributes.position.array);assert.deepEqual(oak.leaves.index!.array,original.leaves.index!.array);
 assert.equal(oak.bough.userData.forks.length,6);assert(oak.boughLeaves.attributes.position.count>=600,'the supporting limb has its own attached leafy shoots');
 const p=oak.wood.attributes.position,n=oak.wood.attributes.normal;let outside=0,count=0;
 for(let i=0;i<p.count;i++)if(p.getY(i)>1&&p.getY(i)<17&&Math.hypot(p.getX(i)-.3,p.getZ(i)+6)>1){count++;if(n.getX(i)*(p.getX(i)-.3)+n.getZ(i)*(p.getZ(i)+6)>0)outside++;}
 assert(count>150);assert(outside/count>.95,'the visible trunk has outward normals and winding');
 const bough=new Mesh(oak.bough,greatOakBark());bough.updateMatrixWorld(true);const ray=new Raycaster();
 for(const x of [-12.45,-9.55]){ray.set(new Vector3(x,10,3),new Vector3(0,-1,0));const hit=ray.intersectObject(bough)[0];assert(hit&&hit.point.y>8.1&&hit.point.y<8.5,'each rope saddle surrounds solid bark');}
 const positions=oak.bough.attributes.position;for(let i=0;i<positions.count;i++)assert(positions.getY(i)<13,'the limb remains below the raised cabin');
 const material=greatOakBark();assert.equal(material,greatOakBark());assert(material.bumpMap&&material.bumpMap!==material.map);assert(material.map!.generateMipmaps);assert(material.map!.image.width*material.map!.image.height<=131072);
});

test('the more detailed lookout remains static and within the old whole-attraction triangle budget',()=>{
 const house=new Treehouse();let calls=0,triangles=0;
 house.group.traverse(o=>{assert(!('isLight' in o));assert(!('isSprite' in o));if(o instanceof Mesh){calls++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*('count' in o?Number(o.count):1);}});
 assert(calls<=28);assert(triangles<111100);assert.equal(house.swing.position.y,7.5);assert.equal(house.swing.position.x,-11);
});
