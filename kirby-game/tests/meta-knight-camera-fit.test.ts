import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {fitKnightArenaCamera} from '../src/meta-knight-camera-fit';
import type {KnightPoint} from '../src/meta-knight-battle';

test('the whole arena fits tightly between the HUD and frame edges across monitor and phone shapes',()=>{
 for(const [width,height] of [[1920,1080],[2560,1440],[3440,1440],[5120,1440],[1280,1024],[1440,900],[1024,768],[844,390],[390,844]]){
  const top=96,bottom=24,actors:KnightPoint[]=[[35,8,0],[-35,8,0],[0,16,0]],fit=fitKnightArenaCamera(width,height,actors,top,bottom),camera=new T.PerspectiveCamera(fit.fov,width/height,.25,1400),focus=new T.Vector3().fromArray(fit.focus);
  camera.position.copy(focus).add(new T.Vector3(0,.68,.82).multiplyScalar(fit.distance));camera.lookAt(focus);camera.updateMatrixWorld();
  const points=[...actors,new T.Vector3(0,-16.5,0).toArray() as KnightPoint];
  for(let i=0;i<512;i++){const a=i*Math.PI/256;for(const y of [0,-2.2])points.push([Math.sin(a)*46.25,y,Math.cos(a)*46.25]);}
  for(let i=0;i<8;i++){const a=i*Math.PI/4;points.push([Math.sin(a)*44.6,4.7,Math.cos(a)*44.6]);}
  const projected=points.map(p=>new T.Vector3().fromArray(p).project(camera)),xs=projected.map(p=>p.x),ys=projected.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),upper=1-2*top/height,lower=-1+2*bottom/height;
  assert(minX>=-1+Math.min(40,width*.08)/width-.002&&maxX<=1-Math.min(40,width*.08)/width+.002,`${width}×${height}: sides`);
  assert(minY>=lower-.002&&maxY<=upper+.002,`${width}×${height}: top/bottom`);
  assert(Math.abs((maxY+minY)-(upper+lower))<.003,`${width}×${height}: balanced vertical space`);
  assert((maxY-minY)/(upper-lower)>.995||(maxX-minX)/(2-2*Math.min(40,width*.08)/width)>.995,`${width}×${height}: no avoidable zoom gap`);
 }
});
