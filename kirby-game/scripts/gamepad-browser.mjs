import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {build} from 'vite';

const bundle=await build({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,logLevel:'error',
  build:{write:false,minify:false,lib:{entry:fileURLToPath(new URL('../src/gamepad.ts',import.meta.url)),name:'gamepadModule',formats:['iife']}}});
const output=Array.isArray(bundle)?bundle[0]:bundle;
let browser;
try{
  browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<!doctype html><p class="selection-description">Choose controls</p><div id="audio-panel"></div>');
  await page.addScriptTag({content:output.output.find(asset=>asset.type==='chunk').code});
  const keys=await page.evaluate(()=>{
    const {createGamepadInput}=gamepadModule;
    const buttons=count=>Array.from({length:count},()=>({pressed:false,touched:false,value:0}));
    window.qaRaw={id:'Unknown Gamepad (Vendor: 045e Product: 0b13)',index:0,connected:true,mapping:'',
      axes:[.055161356925964355,-.045059919357299805,-.038712143898010254,-1,-1,-.0021820664405822754,0,0,0,1227133568],buttons:buttons(15)};
    const standard={id:'Xbox standard',index:2,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:buttons(17)};
    window.qaPads=[qaRaw,{...qaRaw,id:'Unsupported raw pad',index:1},standard];
    Object.defineProperty(navigator,'getGamepads',{value:()=>qaPads});
    window.qaInput=createGamepadInput();
    window.qaPoll=()=>{
      const state=qaInput.poll();
      return {active:qaInput.input.active,held:[...state.held],pressed:[...state.pressed],
        x:state.x,y:state.y,cameraX:state.cameraX,cameraY:state.cameraY,
        selectors:[...document.querySelectorAll('select')].map(s=>({value:s.value,labels:[...s.options].map(o=>o.text)}))};
    };
    qaPoll();return {raw:JSON.stringify([qaRaw.id,0]),standard:JSON.stringify([standard.id,2])};
  });
  const menu=page.locator('.selection-input-row select'),settings=page.locator('#audio-panel select');
  assert.deepEqual(await menu.locator('option').allTextContents(),[
    'Клавиатура и мышь','Геймпад 1 · Xbox Wireless Controller','Геймпад 3 · Xbox standard']);
  await menu.selectOption(keys.raw);
  const idle=await page.evaluate(()=>qaPoll());
  assert.equal(idle.active,keys.raw);assert.equal(idle.held.length,0);
  assert.deepEqual([idle.x,idle.y,idle.cameraX,idle.cameraY],[0,0,0,0]);
  assert(idle.selectors.every(s=>s.value===keys.raw));
  const active=await page.evaluate(()=>{
    qaRaw.buttons[3]={pressed:true,touched:true,value:1};qaRaw.axes[5]=1;qaRaw.axes[9]=-1;
    return qaPoll();
  });
  assert.deepEqual(active.pressed,[2,12]);assert.equal(active.cameraY,1);
  const disconnected=await page.evaluate(()=>{qaRaw.connected=false;return qaPoll();});
  assert.equal(disconnected.active,'keyboard');assert(disconnected.selectors.every(s=>s.labels.length===2));
  const reconnected=await page.evaluate(()=>{qaRaw.connected=true;return qaPoll();});
  assert.equal(reconnected.active,keys.raw);assert.deepEqual(reconnected.pressed,[]);
  await settings.selectOption(keys.standard);
  const switched=await page.evaluate(()=>qaPoll());
  assert(switched.selectors.every(s=>s.value===keys.standard));assert.deepEqual(switched.held,[]);
  const additional=await page.evaluate(()=>{
    window.qaAdditional=[['054c','05c4',14,'DualShock 4'],['054c','0ce6',14,'DualSense'],['046d','c216',12,'Logitech F310']].map(([vendor,product,count,name],i)=>({
      name,pad:{id:`Unknown Gamepad (Vendor: ${vendor} Product: ${product})`,index:3+i,connected:true,mapping:'',
        axes:[0,0,0,-1,-1,0,0,0,0,1227133568],buttons:Array.from({length:count},()=>({pressed:false,touched:false,value:0}))},
    }));
    qaPads.push(...qaAdditional.map(item=>item.pad));qaPoll();
    return qaAdditional.map(({name,pad})=>({name,key:JSON.stringify([pad.id,pad.index])}));
  });
  for(const [i,{name,key}] of additional.entries()){
    assert((await menu.locator('option').allTextContents()).some(label=>label.includes(name)));
    await menu.selectOption(key);assert.deepEqual((await page.evaluate(()=>qaPoll())).held,[]);
    const state=await page.evaluate(i=>{
      const p=qaAdditional[i].pad;p.buttons[1]={pressed:true,touched:true,value:1};p.axes[5]=1;p.axes[9]=-1;return qaPoll();
    },i);
    assert.deepEqual(state.pressed,[0,12]);assert.equal(state.cameraY,1);
    assert(state.selectors.every(s=>s.value===key));
  }
  await page.evaluate(()=>{
    window.qaKeys=new Set();qaInput.onChange(()=>qaKeys.clear());
    window.addEventListener('keydown',event=>{if(qaInput.input.active==='keyboard')qaKeys.add(event.code);});
  });
  await page.keyboard.press('w');
  const keyboard=await page.evaluate(()=>({...qaPoll(),keys:[...qaKeys]}));
  assert.equal(keyboard.active,'keyboard');assert.deepEqual(keyboard.keys,['KeyW']);
  assert(keyboard.selectors.every(s=>s.value==='keyboard'));
  const automatic=await page.evaluate(()=>{
    qaRaw.buttons[0]={pressed:true,touched:true,value:1};
    return {...qaPoll(),keys:[...qaKeys]};
  });
  assert.equal(automatic.active,keys.raw);assert.deepEqual(automatic.pressed,[0]);assert.deepEqual(automatic.keys,[]);
  await page.keyboard.press('s');
  assert.equal((await page.evaluate(()=>qaPoll())).active,'keyboard');
  const afterHold=await page.evaluate(()=>qaPoll());
  assert.equal(afterHold.active,'keyboard');assert.deepEqual(afterHold.pressed,[]);
  // Repeat events from a key already held must not take control back from the pad.
  await page.keyboard.down('d');
  await page.evaluate(()=>{qaRaw.buttons[1]={pressed:true,touched:true,value:1};qaPoll();});
  await page.keyboard.down('d');assert.equal((await page.evaluate(()=>qaPoll())).active,keys.raw);
  await page.keyboard.up('d');
  const internal=await page.evaluate(()=>{
    document.querySelector('select').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    document.body.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'mouse',bubbles:true}));
    return qaPoll();
  });
  assert.equal(internal.active,keys.raw,'gamepad-driven synthetic UI events are not physical keyboard/mouse activity');
  await page.mouse.click(1,1);assert.equal((await page.evaluate(()=>qaPoll())).active,'keyboard');
  assert.deepEqual(errors,[]);
  console.log('PASS: controller profiles, both selectors, automatic keyboard/gamepad/mouse switching, first-press actions, held buttons and key repeat work in Chrome.');
}finally{
  await browser?.close();
}
