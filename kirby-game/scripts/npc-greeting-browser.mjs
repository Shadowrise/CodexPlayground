import {chromium} from 'playwright';
// An isolated WebAudio regression; does not open the game or use its save data.
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/greeting-test',r=>r.fulfill({contentType:'text/html',body:'<button id="sound"></button><input id="volume" type="range">'}));
 await page.goto((process.env.KIRBY_URL??'http://127.0.0.1:5174/')+'greeting-test');
 const report=await page.evaluate(async()=>{
  const {SoundEffects}=await import('/src/sfx.ts'),sounds=new SoundEffects(document.querySelector('#sound'),document.querySelector('#volume'));
  sounds.start();const ctx=sounds.context;await ctx.resume();
  const player={state:'Walk',fruitsEaten:0,actor:{position:{x:0,z:0},scale:{x:1}}};
  const npc={state:'Idle',isDown:false,fruitsEaten:0,actor:{uuid:'test-npc',position:{x:20,z:0},scale:{x:1}}};
  sounds.update(.016,player,[npc],0);await ctx.suspend();npc.state='Hello';sounds.update(.016,player,[npc],0);
  if(sounds.active.size)throw Error('Greeting consumed while audio is suspended');
  await ctx.resume();sounds.update(.016,player,[npc],0);
  const voices=[...sounds.active],voice=voices.find(v=>v.protected),buffer=voice?.source.buffer,phrase=buffer?.getChannelData(0),intro=sounds.buffers.get('cheer'),hello=sounds.buffers.get('hello');
  if(voices.length!==1||!voice)throw Error('Missing single protected greeting');
  const helloAt=(intro.length+Math.round(22050*.06))/22050;
  if(helloAt>1||buffer.duration>1.8)throw Error('Unexpected greeting delay');
  for(let i=0;i<hello.length;i++)if(phrase[intro.length+Math.round(22050*.06)+i]!==hello.getChannelData(0)[i])throw Error('Hello waveform missing or changed');
  let repeats=0;
  for(let i=0;i<60;i++){player.actor.position.z+=.04;sounds.update(1/60,player,[npc],0);repeats=Math.max(repeats,[...sounds.active].filter(v=>v.protected).length);}
  if(repeats!==1||!sounds.active.has(voice))throw Error('Steps cancelled or repeated the greeting');
  sounds.playEmote('Hello');const playerVoice=[...sounds.active].find(v=>v!==voice&&v.protected);
  if(playerVoice?.source.buffer!==hello)throw Error('Player greeting unexpectedly changed');
  const result={helloAt,duration:buffer.duration,protectedFromSteps:sounds.active.has(voice),suspendedGreetingRecovered:true,playerHelloUnchanged:true};sounds.stopAll();await ctx.close();return result;
 });
 console.log(JSON.stringify({report,errors}));if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
