import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {AssaultRibbon} from '../src/meta-knight-assault-ribbon';
import {knightWarningGlass,knightWarningArrow} from '../src/meta-knight-warning-material';
import {KNIGHT_WARNING_STYLE} from '../src/meta-knight-warning-style';

test('phase three paths use the exact dash glass shader and solid arrow geometry and material',()=>{
 const dash=knightWarningGlass(KNIGHT_WARNING_STYLE.gold,true),arrow=knightWarningArrow(),ribbon=new AssaultRibbon('test',4.5);
 ribbon.setPath([[0,0,0],[0,0,28]]);ribbon.update(.4,false,1000);
 assert.equal(ribbon.mesh.material.vertexShader,dash.vertexShader);assert.equal(ribbon.mesh.material.fragmentShader,dash.fragmentShader);
 assert.equal(ribbon.mesh.material.uniforms.tint.value.getHex(),dash.uniforms.tint.value.getHex());
 assert.equal(ribbon.mesh.material.uniforms.baseOpacity.value,dash.uniforms.baseOpacity.value);
 assert.deepEqual(ribbon.arrows.geometry.getAttribute('position').array,arrow.geometry.getAttribute('position').array);
 assert.equal(ribbon.arrows.material.color.getHex(),arrow.material.color.getHex());assert.equal(ribbon.arrows.material.opacity,arrow.material.opacity);
 const m=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3();
 ribbon.arrows.getMatrixAt(0,m);m.decompose(p,q,scale);assert(Math.abs(p.z-28/16)<.0001);assert.deepEqual(scale.toArray(),[3,3,3]);
 const geometry=ribbon.mesh.geometry;ribbon.update(1,true,1200);assert.equal(ribbon.mesh.geometry,geometry);
 assert.equal(ribbon.arrows.material.color.getHex(),KNIGHT_WARNING_STYLE.red);assert.equal(ribbon.mesh.material.uniforms.tint.value.getHex(),KNIGHT_WARNING_STYLE.red);
 ribbon.dispose();dash.dispose();arrow.geometry.dispose();arrow.material.dispose();
});

test('path UVs preserve the dash material’s rounded caps and the timer’s start-to-end direction',()=>{
 const ribbon=new AssaultRibbon('curve',4.5);ribbon.setPath([[0,0,0],[0,0,14],[14,0,14]]);
 const uv=ribbon.mesh.geometry.getAttribute('uv');assert.equal(uv.getY(0),1);assert.equal(uv.getY(uv.count-1),0);
 for(let i=0;i<uv.count;i+=2){assert.equal(uv.getX(i),0);assert.equal(uv.getX(i+1),1);if(i)assert(uv.getY(i)<=uv.getY(i-2));}
 assert.equal(ribbon.arrows.count,8);ribbon.dispose();
});
