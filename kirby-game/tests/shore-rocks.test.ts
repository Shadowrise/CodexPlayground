import {test} from 'node:test';
import assert from 'node:assert/strict';
import {InstancedMesh,Matrix4,Vector3,MeshStandardMaterial,Color} from 'three';
import {createLandmarks,rockHasGround} from '../src/landmarks';
import {RIVERS,inWater} from '../src/pond-layout';

test('shore stones have land beneath their footprint even at river confluences',()=>{
 const scenery=createLandmarks(),matrix=new Matrix4(),position=new Vector3(),scale=new Vector3(),color=new Color();let stones=0;
 scenery.updateMatrixWorld(true);
 scenery.traverse(o=>{
  if(!(o instanceof InstancedMesh)||!(o.material instanceof MeshStandardMaterial))return;
  for(let i=0;i<o.count;i++){
   if(o.instanceColor)o.getColorAt(i,color);else color.set(0xffffff);
   if(color.multiply(o.material.color).getHexString()!=='838779')continue;
   o.getMatrixAt(i,matrix);matrix.premultiply(o.matrixWorld);position.setFromMatrixPosition(matrix);scale.setFromMatrixScale(matrix);
   assert(rockHasGround(position.x,position.z,1.3*Math.max(scale.x/1.2,scale.z)));
   stones++;
  }
 });
 assert(stones>20,'Keep decorative stones that have solid ground beneath them');
 const p=RIVERS[0][Math.floor(RIVERS[0].length/2)];assert(inWater(p.x,p.z));assert(!rockHasGround(p.x,p.z,.5));
});
