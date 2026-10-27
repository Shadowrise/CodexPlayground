import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deadZone, devices, GamepadInput, INPUT_STORAGE, stickSteering, type Pad } from '../src/gamepad';

test('forward corridor ignores sideways drift but intentional tilt steers proportionally',()=>{
  for(const y of [-1,1])for(const x of [-.5,-.3,0,.3,.5])assert.equal(Math.abs(stickSteering(deadZone(x),deadZone(y))),0);
  const diagonal=stickSteering(deadZone(.71),deadZone(-.71));
  assert(diagonal<0 && diagonal>-1);
  assert.equal(stickSteering(1,0),-1);assert.equal(stickSteering(-1,0),1);
  assert(Math.abs(stickSteering(.51,-1))<.01);
  assert(Math.abs(stickSteering(.8,-1))>Math.abs(stickSteering(.6,-1)));
});
const pad=(index=0,id='Xbox')=>({index,id,connected:true,mapping:'standard' as const,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0}))});
const rawXbox=()=>({
  ...pad(0,'Unknown Gamepad (Vendor: 045e Product: 0b13)'),mapping:'' as const,
  axes:[.055161356925964355,-.045059919357299805,-.038712143898010254,-1,-1,-.0021820664405822754,0,0,0,1227133568],
  buttons:Array.from({length:15},():GamepadButton=>({pressed:false,touched:false,value:0})),
} satisfies Pad);
test('unmapped Xbox Series controller is selectable while unsupported raw devices stay excluded',()=>{
  const raw=rawXbox(),standard=pad(2);
  const available=devices([null,raw,standard,{...raw,id:'Other controller'}, {...raw,connected:false}]);
  assert.equal(available.length,2);
  assert.equal(available[0].key,JSON.stringify([raw.id,raw.index]));
  assert.match(available[0].label,/Xbox/);
  assert.equal(available[0].pad.mapping,'standard');
  assert.equal(available[1].pad,standard);
  assert.deepEqual(devices([{...raw,axes:[0,0,0,0]},{...raw,buttons:raw.buttons.slice(0,4)}]),[]);
  // A browser that already supplies a standard mapping must not be remapped again.
  const mapped={...pad(1,raw.id)};
  assert.equal(devices([mapped])[0].pad,mapped);
});
test('raw Xbox buttons, sticks and triggers reach the same game actions as a standard pad',()=>{
  const raw=rawXbox(),input=new GamepadInput();input.select(devices([raw])[0].key);
  const idle=input.poll([raw]);
  assert.equal(idle.held.size,0);assert.equal(idle.x,0);assert.equal(idle.y,0);
  assert.equal(idle.cameraX,0);assert.equal(idle.cameraY,0);
  for(const [rawIndex,standardIndex] of [[0,0],[1,1],[3,2],[4,3],[6,4],[7,5],[10,8],[11,9],[13,10],[14,11],[12,16]]){
    raw.buttons[rawIndex]={pressed:true,touched:true,value:1};
    const state=input.poll([raw]);assert.deepEqual([...state.pressed],[standardIndex]);
    assert.deepEqual([...state.held],[standardIndex]);
    assert.equal(input.poll([raw]).pressed.size,0);
    raw.buttons[rawIndex]={pressed:false,touched:false,value:0};input.poll([raw]);
  }
  raw.axes=[-.6,-1,.7,1,.2,-.8,0,0,0,9/7];
  const state=input.poll([raw]);
  assert.equal(state.x,deadZone(-.6));assert.equal(state.y,-1);
  assert.equal(state.cameraX,deadZone(.7));assert.equal(state.cameraY,deadZone(-.8));
  assert(state.held.has(6));assert(state.held.has(7));
  const normalized=state.available[0].pad;
  assert.equal(normalized.buttons[6].value,1);assert.equal(normalized.buttons[7].value,.6);
  assert.equal(raw.mapping,'');assert.equal(raw.axes.length,10);assert.equal(raw.buttons.length,15);
  assert.equal(normalized.buttons.length,17);
  raw.buttons.push({pressed:true,touched:true,value:1});
  assert(input.poll([raw]).pressed.has(17));
});
test('raw Xbox hat switch handles all directions, diagonals and neutral without stuck menu input',()=>{
  const raw=rawXbox(),input=new GamepadInput();input.select(devices([raw])[0].key);input.poll([raw]);
  const directions=[[12],[12,15],[15],[13,15],[13],[13,14],[14],[12,14]];
  directions.forEach((expected,direction)=>{
    raw.axes[9]=-1+direction*2/7;
    assert.deepEqual([...input.poll([raw]).held],expected.slice().sort((a,b)=>a-b));
  });
  for(const neutral of [0,9/7,3.2857142857142856,1227133568]){
    raw.axes[9]=neutral;assert.equal(input.poll([raw]).held.size,0);
  }
});
test('raw Xbox selection restores after disconnect and suppresses button edges on focus restoration',()=>{
  const raw=rawXbox(),input=new GamepadInput();input.select(devices([raw])[0].key);input.poll([raw]);
  raw.buttons[3]={pressed:true,touched:true,value:1};assert(input.poll([raw]).pressed.has(2));
  assert.equal(input.poll([raw],false).held.size,0);assert.equal(input.poll([raw],true).pressed.size,0);
  input.poll([]);assert.equal(input.active,'keyboard');
  const restored=input.poll([raw]);assert.equal(input.active,JSON.stringify([raw.id,raw.index]));
  assert(restored.held.has(2));assert.equal(restored.pressed.size,0);
});
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
  const input=new GamepadInput();first.axes=[1,1,1,1];input.poll([first,second],true,false);input.select(available[1].key);
  input.poll([first,second]);assert.equal(input.poll([first,second]).x,0);
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

test('first controller button automatically selects it and performs the action once, including discovery',()=>{
  for(const alreadyVisible of [false,true]){
    const p=pad(),writes:string[]=[],input=new GamepadInput({getItem:()=>null,setItem:(_,value)=>writes.push(value)});
    if(alreadyVisible)input.poll([p]);
    p.buttons[0]={pressed:true,touched:true,value:1};
    const state=input.poll([p]),key=devices([p])[0].key;
    assert.equal(input.active,key);assert.equal(input.preferred,key);assert(state.changed);
    assert.deepEqual([...state.pressed],[0]);assert.deepEqual(writes,[key]);
    assert.equal(input.poll([p]).pressed.size,0);assert.deepEqual(writes,[key]);
  }
});

test('keyboard takeover is not undone by a held pad button or stick drift',()=>{
  const p=pad(),input=new GamepadInput();input.poll([p]);
  p.buttons[0]={pressed:true,touched:true,value:1};input.poll([p]);
  input.select('keyboard');input.poll([p],true,false);
  for(const axes of [[.03,-.06,.02,-.01],[.3,-.2,1,-1]]){
    p.axes=axes;const state=input.poll([p]);
    assert.equal(input.active,'keyboard');assert.equal(state.held.size,0);assert.equal(state.pressed.size,0);
    assert.deepEqual([state.x,state.y,state.cameraX,state.cameraY],[0,0,0,0]);
  }
  p.buttons[2]={pressed:true,touched:true,value:1};
  assert.deepEqual([...input.poll([p]).pressed],[2]);assert.notEqual(input.active,'keyboard');
});

test('a fresh press can switch between controllers without replaying another held button',()=>{
  const first=pad(),second=pad(1),input=new GamepadInput();input.poll([first,second]);
  first.buttons[0]={pressed:true,touched:true,value:1};input.poll([first,second]);
  second.buttons[2]={pressed:true,touched:true,value:1};
  const switched=input.poll([first,second]);assert.equal(input.active,devices([second])[0].key);
  assert.deepEqual([...switched.pressed],[2]);
  for(let i=0;i<3;i++)assert.equal(input.poll([first,second]).pressed.size,0);
  first.buttons[1]={pressed:true,touched:true,value:1};
  const returned=input.poll([first,second]);assert.equal(input.active,devices([first])[0].key);
  assert.deepEqual([...returned.pressed],[1]);assert.deepEqual([...returned.held],[0,1]);
});

test('presses while unfocused neither select a pad nor become actions when focus returns',()=>{
  const p=pad(),input=new GamepadInput();input.poll([p]);input.poll([p],false);
  p.buttons[0]={pressed:true,touched:true,value:1};
  assert.equal(input.poll([p],false).held.size,0);assert.equal(input.active,'keyboard');
  assert.equal(input.poll([p],true).pressed.size,0);assert.equal(input.active,'keyboard');
  p.buttons[0]={pressed:false,touched:false,value:0};input.poll([p]);
  p.buttons[0]={pressed:true,touched:true,value:1};assert(input.poll([p]).pressed.has(0));
});

test('raw Xbox automatically selects through its normalized buttons and ignores its neutral hat',()=>{
  const p=rawXbox(),input=new GamepadInput();input.poll([p]);assert.equal(input.active,'keyboard');
  p.buttons[3]={pressed:true,touched:true,value:1};
  const state=input.poll([p]);assert.equal(input.active,devices([p])[0].key);assert.deepEqual([...state.pressed],[2]);
});

test('a deliberate left-stick tilt selects a controller without confirming a menu choice',()=>{
  const p=pad(),input=new GamepadInput();input.poll([p]);p.axes[1]=.9;
  const activated=input.poll([p]);assert.equal(input.active,devices([p])[0].key);
  assert(activated.changed);assert(activated.y>0);assert.equal(activated.pressed.size,0);
  input.select('keyboard');input.poll([p],true,false);
  for(const y of [.8,.5,.64,.9]){
    p.axes[1]=y;input.poll([p]);assert.equal(input.active,'keyboard','a held tilt stays latched across keyboard takeover');
  }
  p.axes[1]=.2;input.poll([p]);p.axes[1]=-.9;
  assert(input.poll([p]).y<0);assert.notEqual(input.active,'keyboard');
});

test('a stick held while unfocused must return to neutral before claiming control',()=>{
  const p=pad(),input=new GamepadInput();input.poll([p]);input.poll([p],false);
  p.axes[0]=1;input.poll([p],false);input.poll([p],true);
  assert.equal(input.active,'keyboard');p.axes[0]=0;input.poll([p]);p.axes[0]=1;
  assert(input.poll([p]).x>0);assert.notEqual(input.active,'keyboard');
});
