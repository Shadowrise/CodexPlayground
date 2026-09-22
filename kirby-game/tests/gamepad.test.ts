import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deadZone, devices, GamepadInput, INPUT_STORAGE, stickSteering } from '../src/gamepad';

test('forward corridor ignores sideways drift but intentional tilt steers proportionally',()=>{
  for(const y of [-1,1])for(const x of [-.5,-.3,0,.3,.5])assert.equal(Math.abs(stickSteering(deadZone(x),deadZone(y))),0);
  const diagonal=stickSteering(deadZone(.71),deadZone(-.71));
  assert(diagonal<0 && diagonal>-1);
  assert.equal(stickSteering(1,0),-1);assert.equal(stickSteering(-1,0),1);
  assert(Math.abs(stickSteering(.51,-1))<.01);
  assert(Math.abs(stickSteering(.8,-1))>Math.abs(stickSteering(.6,-1)));
});
const pad=(index=0,id='Xbox')=>({index,id,connected:true,mapping:'standard' as const,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0}))});
test('selection persists, disconnect falls back and reconnect restores controller',()=>{
  const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
  const first=pad(0),second=pad(2,'Xbox 2'),key=devices([first,null,second])[1].key;
  const input=new GamepadInput(storage);input.select(key);assert.equal(values.get(INPUT_STORAGE),key);
  const restored=new GamepadInput(storage);restored.poll([first,null,second]);assert.equal(restored.active,key);
  restored.poll([first]);assert.equal(restored.active,'keyboard');
  restored.poll([first,null,second]);assert.equal(restored.active,key);
  restored.select('keyboard');restored.poll([first,second]);assert.equal(restored.active,'keyboard');
});
test('identical controllers are selectable separately and only selected pad supplies input',()=>{
  const first=pad(),second=pad(1),available=devices([first,second]);
  assert.notEqual(available[0].key,available[1].key);
  const input=new GamepadInput();input.select(available[1].key);
  first.axes=[1,1,1,1];input.poll([first,second]);assert.equal(input.poll([first,second]).x,0);
  second.axes=[.1,-1,.6,0];const state=input.poll([first,second]);
  assert.equal(state.x,0);assert.equal(state.y,-1);assert(state.cameraX>0);
});
test('buttons trigger once, not on selection or focus restoration',()=>{
  const p=pad(),input=new GamepadInput();input.select(devices([p])[0].key);
  input.poll([p]);p.buttons[0]={pressed:true,touched:true,value:1};
  assert(input.poll([p]).pressed.has(0));assert(!input.poll([p]).pressed.has(0));
  assert.equal(input.poll([p],false).held.size,0);assert(!input.poll([p],true).pressed.has(0));
  assert.equal(input.poll([]).held.size,0);
});
test('dead zone and unavailable storage are safe',()=>{
  assert.equal(deadZone(.19),0);assert.equal(deadZone(-1),-1);assert.equal(deadZone(1),1);
  const input=new GamepadInput({getItem:()=>{throw Error();},setItem:()=>{throw Error();}});
  input.select('keyboard');assert.equal(input.poll([]).x,0);
});
