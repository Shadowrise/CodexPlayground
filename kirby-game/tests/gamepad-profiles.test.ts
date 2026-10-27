import assert from 'node:assert/strict';
import {test} from 'node:test';
import {devices,GamepadInput,type Pad} from '../src/gamepad';

const raw=(id:string,count:number)=>({
  id:`Unknown Gamepad (Vendor: ${id.slice(0,4)} Product: ${id.slice(5)})`,
  index:2,connected:true,mapping:'' as const,axes:[0,0,0,-1,-1,0,0,0,0,1227133568],
  buttons:Array.from({length:count},():GamepadButton=>({pressed:false,touched:false,value:0})),
});
const press=(p:ReturnType<typeof raw>,index:number,pressed=true)=>p.buttons[index]={pressed,touched:pressed,value:Number(pressed)};

test('preloaded model and connection IDs resolve without accepting arbitrary devices',()=>{
  const cases:[string,number,string][]=[
    ['045e:0b13',15,'Xbox'],['045e:0b20',15,'Xbox'],['045e:0b21',15,'Xbox'],['045e:0b22',15,'Xbox'],
    ['054c:05c4',14,'DualShock 4'],['054c:09cc',14,'DualShock 4'],['054c:0ba0',14,'DualShock 4'],
    ['054c:0ce6',14,'DualSense'],['054c:0df2',14,'DualSense Edge'],
    ['046d:c216',12,'Logitech F310'],['046d:c218',12,'Logitech F510'],['046d:c219',12,'Logitech F710'],
  ];
  for(const [id,count,name] of cases){
    const source=raw(id,count),available=devices([null,source]);assert.equal(available.length,1,id);
    assert(available[0].label.includes(name),id);assert.equal(available[0].pad.id,source.id);
    const input=new GamepadInput();input.select(available[0].key);
    const idle=input.poll([source]);assert.equal(idle.held.size,0,id);
    assert.deepEqual([idle.x,idle.y,idle.cameraX,idle.cameraY],[0,0,0,0]);
    const standard:Pad={...source,mapping:'standard',axes:[0,0,0,0]};
    assert.equal(devices([standard])[0].pad,standard,id);
  }
  assert.equal(devices([raw('1234:05c4',14),raw('054c:ffff',14),raw('046d:c217',12)]).length,0);
  assert.equal(devices([{...raw('054c:05c4',14),id:'Unknown Gamepad (Vendor: 054c Product: 05c40)'}]).length,0);
  assert.equal(devices([raw('054C:0CE6',14)]).length,1);
});

test('PlayStation face buttons supply cross-confirm, circle-back, square-attack and triangle-interact',()=>{
  for(const id of ['054c:05c4','054c:09cc','054c:0ba0','054c:0ce6','054c:0df2']){
    const source=raw(id,14),input=new GamepadInput();input.select(devices([source])[0].key);input.poll([source]);
    for(const [physical,action] of [[1,0],[2,1],[0,2],[3,3],[4,4],[5,5],[8,8],[9,9],[10,10],[11,11],[12,16],[13,17]]){
      press(source,physical);assert.deepEqual([...input.poll([source]).pressed],[action],`${id} button ${physical}`);
      press(source,physical,false);assert.equal(input.poll([source]).held.size,0);
    }
    // The hardware's extra digital trigger flags must not masquerade as standard buttons.
    press(source,6);press(source,7);assert.equal(input.poll([source]).held.size,0);
    source.axes=[-.8,.6,.4,.8,-1,-.6,0,0,0,1];
    const state=input.poll([source]);assert.deepEqual([...state.held],[6,12,14]);
    assert(state.x<0);assert(state.y>0);assert(state.cameraX>0);assert(state.cameraY<0);
    assert.equal(state.available[0].pad.buttons[6].value,.9);
    assert.equal(state.available[0].pad.buttons[7].value,0);
    assert.equal(source.mapping,'');assert.equal(source.axes.length,10);assert.equal(source.buttons.length,14);
  }
});

test('Logitech D-mode maps the face buttons and digital triggers without phantom analog input',()=>{
  for(const id of ['046d:c216','046d:c218','046d:c219']){
    const source=raw(id,12),input=new GamepadInput();input.select(devices([source])[0].key);input.poll([source]);
    for(const [physical,action] of [[1,0],[2,1],[0,2],[3,3],[4,4],[5,5],[6,6],[7,7],[8,8],[9,9],[10,10],[11,11]]){
      press(source,physical);assert.deepEqual([...input.poll([source]).pressed],[action],id);
      press(source,physical,false);input.poll([source]);
    }
    source.axes=[0,0,.8,1,1,-1,0,0,0,-3/7];
    const state=input.poll([source]);assert.deepEqual([...state.held],[15]);
    assert(state.cameraX>0);assert.equal(state.cameraY,-1);
    assert.equal(state.available[0].pad.buttons[16].pressed,false);
  }
});

test('a known model with a different report shape never receives a guessed raw layout',()=>{
  for(const [id,count] of [['045e:0b13',15],['054c:05c4',14],['054c:0ce6',14],['046d:c216',12]] as const){
    const source=raw(id,count);
    assert.deepEqual(devices([{...source,axes:source.axes.slice(0,6)}]),[]);
    assert.deepEqual(devices([{...source,buttons:source.buttons.slice(0,8)}]),[]);
    assert.deepEqual(devices([{...source,buttons:[...source.buttons,...source.buttons]}]),[]);
    assert.deepEqual(devices([{...source,mapping:'xr-standard'}]),[]);
    assert.deepEqual(devices([{...source,connected:false}]),[]);
  }
});

test('native prototype getters retain identity, input state and selection key',()=>{
  const source=raw('054c:0ce6',14);press(source,1);
  // Recreate WebIDL properties on the prototype rather than own enumerable fields.
  const prototype={};for(const [key,value] of Object.entries(source))Object.defineProperty(prototype,key,{get:()=>value});
  const pad=Object.create(prototype) as Pad;
  assert.deepEqual(Object.keys(pad),[]);
  const available=devices([pad]);assert.equal(available[0].key,JSON.stringify([source.id,source.index]));
  assert.equal(available[0].pad.connected,true);assert.equal(available[0].pad.buttons[0].pressed,true);
});
