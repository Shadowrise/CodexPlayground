import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FpsCounter} from '../src/fps';
test('FPS counts real frame intervals, including slow frames, and resets across hidden tabs',()=>{
 for(const expected of [10,30,60,120]){
  const counter=new FpsCounter();let result:number|undefined;counter.sample(0);
  for(let i=1;i<=expected;i++)result=counter.sample(i*1000/expected)??result;
  assert.equal(result,expected);
  counter.sample(5000,false);assert.equal(counter.sample(10000),undefined);
  for(let i=1;i<=expected;i++)result=counter.sample(10000+i*1000/expected)??result;
  assert.equal(result,expected);
 }
});
