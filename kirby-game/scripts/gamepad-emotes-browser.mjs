import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url)),publicDir=resolve(root,'public');
const compiled=await build({root,configFile:false,logLevel:'error',plugins:[{
  name:'emote-gameplay-probe',transform(source,id){
    if(!id.replaceAll('\\','/').endsWith('/src/main.ts'))return;
    assert(source.includes('renderer.setAnimationLoop('));
    return source.replace('renderer.setAnimationLoop(','renderer.setAnimationLoop(window.emoteQAFrame=')+`
window.emoteQA={renderer,wheel:emoteWheel,get c(){return character},
 stop(){renderer.setAnimationLoop(null);renderer.render=()=>{}},
 step(dt=1/60){window.emoteQAFrame(previousTime+dt*1000)},
 reset(){emoteWheel.close();character.setActivity('Idle');character.actor.position.set(140,0,15);character.yaw=0;character.actor.rotation.y=0},
 sample(){return {state:character.state,position:character.actor.position.toArray(),open:emoteWheel.open,selected:emoteWheel.selected,blocked:emoteWheel.blocksMovement}},
};`;
  },
}],build:{write:false,minify:false,target:'es2022',rollupOptions:{input:resolve(root,'index.html')}}});
const output=Array.isArray(compiled)?compiled[0]:compiled;
const files=new Map(output.output.map(item=>['/'+item.fileName,Buffer.from(item.type==='chunk'?item.code:item.source)]));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
  '.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
  const context=await browser.newContext({viewport:{width:1280,height:800}}),errors=[];
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='http://127.0.0.1:5195')return route.fulfill({json:{ok:true,id:'emote-qa',players:0,occupiedVariants:[],capacity:14}});
    if(url.pathname.endsWith('.mp4'))return route.fulfill({status:204});
    const name=url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname);
    let body=files.get(name);
    if(!body){
      const path=resolve(publicDir,'.'+name);if(!path.startsWith(publicDir+sep))return route.abort();
      try{body=await readFile(path);}catch(error){if(error.code==='ENOENT')return route.fulfill({status:404});throw error;}
    }
    await route.fulfill({contentType:types[extname(name)]??'application/octet-stream',body});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    localStorage.clear();localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');
    window.qaPad={id:'Emote QA controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],
      buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0}))};
    Object.defineProperty(navigator,'getGamepads',{value:()=>[qaPad]});
  });
  await page.goto('http://127.0.0.1:5195/',{waitUntil:'commit'});
  await page.locator('#new-game').waitFor({state:'visible',timeout:120000});
  await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Эмоции');await page.locator('#start-game').click();
  await page.waitForFunction(()=>!!window.emoteQA?.c&&!document.body.classList.contains('choosing'),{},{timeout:180000});
  await page.evaluate(()=>{
    emoteQA.stop();window.qaStarts=[];const start=emoteQA.c.startEmote.bind(emoteQA.c);
    emoteQA.c.startEmote=kind=>{const accepted=start(kind);if(accepted)qaStarts.push(kind);return accepted;};
  });
  const checks=[];
  for(const recenter of [false,true])for(const [index,emote] of ['Hello','Joy','Fear','Anger','Sad'].entries()){
    const result=await page.evaluate(({index,recenter})=>{
      const q=emoteQA;qaPad.axes=[0,0,0,0];qaPad.buttons=qaPad.buttons.map(()=>({pressed:false,touched:false,value:0}));q.reset();q.step();qaStarts=[];
      qaPad.buttons[4]={pressed:true,touched:true,value:1};q.step();
      const angle=index*Math.PI*2/5;qaPad.axes=[Math.sin(angle),-Math.cos(angle),0,0];q.step();
      const chosen=q.sample();if(recenter){qaPad.axes=[0,0,0,0];q.step();}
      qaPad.buttons[4]={pressed:false,touched:false,value:0};q.step();const released=q.sample();
      for(let i=0;i<45;i++)q.step();const held=q.sample();
      const starts=[...qaStarts];qaPad.axes=[0,0,0,0];q.step();qaPad.axes=[0,-1,0,0];q.step();
      return {chosen,released,held,starts,resumed:q.sample()};
    },{index,recenter});
    assert.equal(result.chosen.selected,index);assert.equal(result.released.state,emote);
    assert.equal(result.released.open,false);assert.equal(result.held.state,emote);
    assert.deepEqual(result.starts,[emote]);assert.equal(result.resumed.state,'Run');
    if(emote==='Hello')assert.deepEqual(result.held.position,result.released.position,'the held selection stick cannot cause walking');
    checks.push({emote,recenter,playsOnLBRelease:true,doesNotWalk:true,resumesAfterNeutral:true});
  }
  const cancelled=await page.evaluate(()=>{
    const q=emoteQA;qaPad.axes=[0,0,0,0];qaPad.buttons=qaPad.buttons.map(()=>({pressed:false,touched:false,value:0}));q.reset();q.step();qaStarts=[];
    qaPad.buttons[4]={pressed:true,touched:true,value:1};qaPad.axes=[0,-1,0,0];q.step();
    qaPad.buttons[1]={pressed:true,touched:true,value:1};q.step();qaPad.buttons[1]={pressed:false,touched:false,value:0};q.step();
    const holding=q.sample();qaPad.buttons[4]={pressed:false,touched:false,value:0};q.step();
    return {holding,released:q.sample(),starts:qaStarts};
  });
  assert.equal(cancelled.holding.open,false);assert.equal(cancelled.holding.state,'Idle');
  assert.equal(cancelled.released.state,'Idle');assert.deepEqual(cancelled.starts,[]);
  assert.deepEqual(errors,[]);
  await writeFile(new URL('../.cache/gamepad-emotes-checks.json',import.meta.url),JSON.stringify({checks,cancelled,errors},null,2));
  console.log('PASS: real gameplay plays all five emotes exactly once on LB release, preserves recentered selections, blocks held-stick movement, resumes after neutral and cancels with B.');
}finally{await browser.close();}
