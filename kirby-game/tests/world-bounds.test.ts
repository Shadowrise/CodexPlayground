import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MEADOW_HALF_SIZE, constrainToMeadow, insideMeadow } from '../src/world-bounds';
import { createMountains } from '../src/mountains';
import {MOUNTAIN_ALONG,MOUNTAIN_ACROSS,mountainSurfaceHeight} from '../src/mountain-surface';
import {MOUNTAIN_STEPS,MOUNTAIN_SUMMIT,MOUNTAIN_PEAK,mountainLocal} from '../src/mountain-ledges-layout';

test('meadow area is eight times larger and boundary contains large steps, corners and enlarged actors', () => {
  assert(Math.abs((2 * MEADOW_HALF_SIZE) ** 2 / 180 ** 2 - 8) < 1e-10);
  for (const size of [1, 5, 30, 1000]) for (const x of [-10000, 0, 10000]) for (const z of [-10000, 0, 10000]) {
    const p = { x, z }; constrainToMeadow(p, size); assert(insideMeadow(p, size));
  }
});
test('mountain range has a continuous square inner border, matching corners and upward faces', () => {
  const mesh = createMountains(), p = mesh.geometry.getAttribute('position'), n = mesh.geometry.getAttribute('normal');
  const uv=mesh.geometry.getAttribute('uv');
  assert.equal(uv.count,p.count);
  const row = MOUNTAIN_ALONG+1, side = row * (MOUNTAIN_ACROSS+1);
  for (let s = 0; s < 4; s++) {
    for (let i = 0; i < row; i++) {
      const id = s * side + i;
      assert(Math.abs(Math.max(Math.abs(p.getX(id)), Math.abs(p.getZ(id))) - MEADOW_HALF_SIZE) < .001);
      assert(Math.abs(p.getY(id) + .025) < .001);
    }
    for (let j = 0; j <= MOUNTAIN_ACROSS; j++) {
      const a = s * side + j * row + MOUNTAIN_ALONG, b = ((s + 1) % 4) * side + j * row;
      assert(Math.abs(p.getX(a) - p.getX(b)) < .001);
      assert(Math.abs(p.getY(a) - p.getY(b)) < .001);
      assert(Math.abs(p.getZ(a) - p.getZ(b)) < .001);
      const uDifference=uv.getX(a)-uv.getX(b);
      assert(Math.abs(uDifference-Math.round(uDifference))<.001);
      assert(Math.abs(uv.getY(a)-uv.getY(b))<.001);
      assert(Math.abs(n.getX(a)-n.getX(b))<.001&&Math.abs(n.getY(a)-n.getY(b))<.001&&Math.abs(n.getZ(a)-n.getZ(b))<.001,'corner lighting joins without a hard seam');
    }
  }
  assert(n.getY(side / 2 | 0) > 0);
});

test('mountain woodland grows on the rendered slopes and leaves the complete ascent and both permanent landings clear',()=>{
 const mesh=createMountains(),trees=mesh.children[0].userData.treePositions as {x:number;y:number;z:number;radius:number}[];
 assert(trees.length>3000);
 for(const tree of trees){
  assert(Math.abs(mountainSurfaceHeight(tree.x,tree.z)-tree.y)<.001,'trees are rooted on the actual mountain triangles');
  const p=mountainLocal(tree.x,tree.z);
  for(const ledge of [...MOUNTAIN_STEPS,MOUNTAIN_SUMMIT,MOUNTAIN_PEAK]){
   const gap=Math.hypot(Math.max(0,Math.abs(p.tangent-ledge.tangent)-ledge.width/2),Math.max(0,Math.abs(p.radial-ledge.radial)-ledge.depth/2));
   assert(gap>tree.radius+3,'canopies leave room beside the landing for jumps and camera movement');
  }
 }
 const p=mesh.geometry.getAttribute('position'),c=mesh.geometry.getAttribute('color');let whiteSummits=0,greenSlopes=0;
 for(let i=0;i<p.count;i++){
  if(p.getY(i)>75&&Math.min(c.getX(i),c.getY(i),c.getZ(i))>.65)whiteSummits++;
  if(p.getY(i)>4&&p.getY(i)<35&&c.getY(i)>c.getX(i)*1.2&&c.getY(i)>c.getZ(i)*1.1)greenSlopes++;
 }
 assert(whiteSummits>100&&greenSlopes>1000,'snow caps and woodland remain distinct terrain belts');
});
