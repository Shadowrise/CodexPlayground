import {test} from 'node:test';
import assert from 'node:assert/strict';
import {roundedRunWarning,roundedBallWarning} from '../src/centipede-warning-geometry';

test('run warnings have semicircular ends and a continuous bend within one small mesh',()=>{
 const line=roundedRunWarning(u=>[u*20,0],1.35);line.computeBoundingBox();const box=line.boundingBox!;
 assert(Math.abs(box.min.x+1.55)<.001);assert(Math.abs(box.max.x-21.55)<.001);
 const positions=line.getAttribute('position');
 const uv=line.getAttribute('uv');assert.equal(uv.count,positions.count);assert.equal(line.userData.span,20);
 for(let i=0;i<uv.count;i++)assert(Math.abs(uv.getY(i)-positions.getX(i))<.0001,'countdown follows travelled metres, including round caps');
 for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i);if(x<0||x>20)assert(Math.hypot(x<0?x:x-20,z)<=1.5501,'end caps are circular');}
 assert(positions.count<1000);assert(line.index!.count<4000);line.dispose();
 const bend=roundedRunWarning(u=>[Math.sin(u*Math.PI/2)*10,Math.cos(u*Math.PI/2)*10],1.35),p=bend.getAttribute('position');
 for(let i=0;i<p.count;i++)assert(Number.isFinite(p.getX(i))&&Number.isFinite(p.getZ(i)));
 bend.dispose();
});
test('instanced ball warnings keep true round ends at their displayed width and length',()=>{
 const geometry=roundedBallWarning();geometry.computeBoundingBox();const b=geometry.boundingBox!;
 assert(Math.abs(b.max.x-.325)<.001);assert(Math.abs(b.min.x+.325)<.001);
 assert(Math.abs(b.max.y-6)<.001);assert(Math.abs(b.min.y+6)<.001);
 const positions=geometry.getAttribute('position');for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),y=positions.getY(i);if(Math.abs(y)>5.675)assert(Math.hypot(x,Math.abs(y)-5.675)<=.3251);
  const uv=geometry.getAttribute('uv');assert(Math.abs(uv.getX(i)-x)<.00001);assert(Math.abs(uv.getY(i)-(5.675-y))<.00001,'timer and arrows point toward local -Y, the launch direction');
 }assert(positions.count<80);geometry.dispose();
});
