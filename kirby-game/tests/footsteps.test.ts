import assert from 'node:assert/strict';
import {test} from 'node:test';
import {footstepProfile} from '../src/footsteps';
test('footsteps become louder and duller every fifty percent, stopping at 400%',()=>{
  let previous=footstepProfile(1);
  assert.deepEqual(footstepProfile(1.49),previous);
  for(let size=1.5;size<=4;size+=.5){
    const current=footstepProfile(size);
    assert(current.gain>previous.gain);assert(current.rate<previous.rate);assert(current.cutoff<previous.cutoff);
    assert.deepEqual(footstepProfile(size+.49),current);previous=current;
  }
  assert.deepEqual(footstepProfile(9),footstepProfile(4));
  assert.deepEqual(footstepProfile(.5),footstepProfile(1));
  assert.deepEqual(footstepProfile(1.49999999999),footstepProfile(1.5));
});
