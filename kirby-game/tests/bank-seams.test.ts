import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Mesh} from 'three';
import polygonClipping from 'polygon-clipping';
import {LAND_WATER_REGIONS,WATER_REGIONS,meadowGeometry,WATER_Y} from '../src/pond-layout';
import {Ponds} from '../src/ponds';
import {MEADOW_HALF_SIZE} from '../src/world-bounds';

const key=(x:number,z:number)=>`${Math.fround(x)},${Math.fround(z)}`;

test('every bank joins the flat meadow without open height seams, including small islands and tight bends',()=>{
 const bank=new Ponds().group.getObjectByName('Soft sloping river banks') as Mesh;
 const p=bank.geometry.attributes.position;
 const meadow=meadowGeometry(MEADOW_HALF_SIZE);meadow.rotateX(-Math.PI/2);
 const m=meadow.attributes.position,land=new Set<string>();
 for(let i=0;i<m.count;i++)land.add(key(m.getX(i),m.getZ(i)));
 let joins=0;
 for(let i=0;i<p.count;i++)if(land.has(key(p.getX(i),p.getZ(i)))){
  assert(Math.abs(p.getY(i)+.012)<1e-7,`open meadow/bank seam at ${p.getX(i)},${p.getZ(i)}: height ${p.getY(i)}`);
  joins++;
 }
 assert(joins>900,'check the entire outer and inner circuit, not only the reported lake');
 assert(bank.geometry.index!.count/3<5000,'repair does not require dense terrain tessellation');
 meadow.dispose();
});

test('the shoreline cutout contains all water and bank inner edges stay above its surface',()=>{
 assert.deepEqual(polygonClipping.difference(WATER_REGIONS,LAND_WATER_REGIONS),[],'no tiny water protrusions beyond the land cutout');
 const bank=new Ponds().group.getObjectByName('Soft sloping river banks') as Mesh;
 const land=new Set(LAND_WATER_REGIONS.flatMap(region=>region.flatMap(ring=>ring.map(([x,z])=>key(x,z)))));
 const water=new Set(WATER_REGIONS.flatMap(region=>region.flatMap(ring=>ring.map(([x,z])=>key(x,z)))));
 const p=bank.geometry.attributes.position;
 let joins=0;
 for(let i=0;i<p.count;i++){
  assert(p.getY(i)>=WATER_Y+.01999,'all dry bank faces remain above the water');
  const k=key(p.getX(i),p.getZ(i));
  if(water.has(k)&&!land.has(k)){
   assert(Math.abs(p.getY(i)-(WATER_Y+.02))<1e-6,'water-side boundary has a consistent height');joins++;
  }
 }
 assert(joins>900,'check both sides of every river and lake');
});
