import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { makeLuigi, updateLuigiIdle } from '../src/luigi';

test('Luigi blinks and moves his head while both palms remain resting on thighs',()=>{
  const model=makeLuigi(),head=model.getObjectByName('Luigi head pivot')!,eyes=model.getObjectByName('Luigi blinking eyes')!;
  const palms=model.children.filter(o=>o.name==='Gloved palm');
  assert.equal(palms.length,2);
  const initial=palms.map(p=>p.position.clone());
  let closed=false,reopened=false,moved=false;
  for(let i=0;i<600;i++) {
    updateLuigiIdle(model,1/60);
    closed ||= eyes.scale.y<.1;
    reopened ||= closed && eyes.scale.y>.99;
    moved ||= Math.abs(head.rotation.y)>.28;
    palms.forEach((p,j)=>assert(p.position.distanceTo(initial[j])<1e-9));
  }
  assert(closed && reopened && moved);
  for(const palm of palms){
    const thigh=model.children.find(o=>o.name==='Bent trouser thigh' && Math.sign(o.position.x)===Math.sign(palm.position.x))!;
    const z=(palm.position.z-thigh.position.z)/.41;
    const top=thigh.position.y+.22*Math.sqrt(1-z*z);
    assert(Math.abs(palm.position.y-palm.scale.y-top)<.035);
  }
  assert(model.position.equals(new Vector3()));
});
