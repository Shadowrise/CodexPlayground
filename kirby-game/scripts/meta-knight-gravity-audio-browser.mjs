import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const output=fileURLToPath(new URL('../node_modules/.cache/meta-knight-gravity-audio/',import.meta.url));await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];page.setDefaultTimeout(180000);
 page.on('pageerror',e=>{errors.push(e.stack);console.error(e.stack);});page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');localStorage.setItem('kirby.audio.sounds',JSON.stringify({enabled:true,volume:.45}));});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.chargeQA={THREE,travel:cosmicArena,renderer,sounds,get c(){return character}};'});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5173/');await page.locator('#startup-loader').waitFor({state:'hidden'});await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Заряд молний');await page.locator('#start-game').click();await page.waitForFunction(()=>!!window.chargeQA?.c);
 console.log('Game loaded');
 await page.evaluate(async()=>{
  const q=chargeQA;await q.travel.enter(q.c);q.renderer.setAnimationLoop(null);await q.sounds.context.resume();
  q.state=await import('/src/meta-knight-gravity-charge-state.ts');q.ref=await import('/src/meta-knight-cosmic-refuge.ts');q.cosmic=await import('/src/meta-knight-cosmic.ts');q.spin=await import('/src/meta-knight-cosmic-spin.ts');
  q.prepared=q.sounds.buffers.has('knight-gravity-crackle');q.bufferCount=q.sounds.buffers.size;q.cues=[];q.sources=new Set();q.level=0;
  // Keep the continuous charge isolated while the encounter clock advances faster than real audio time.
  q.sounds.playKnight=kind=>q.cues.push({kind,at:q.travel.soloNow});const update=q.sounds.updateKnightGravityCharge.bind(q.sounds);
  q.sounds.updateKnightGravityCharge=level=>{q.level=level;update(level);if(q.sounds.knightCharge)q.sources.add(q.sounds.knightCharge.source);};
  q.input={forward:false,backward:false,left:false,right:false,jump:false,attack:false};q.step=(dt=1/60,paused=false)=>q.travel.update(dt,q.travel.soloNow/1000,q.c,q.input,0,0,false,paused);
  q.go=(stage,f)=>{let steps=0;while(q.travel.battle.stage!==stage&&steps++<3000)q.step();if(q.travel.battle.stage!==stage)throw Error(`Missing ${stage}`);const s=q.travel.battle,target=s.since+(s.until-s.since)*f;while(q.travel.soloNow<target-.001)q.step(Math.min(1/60,(target-q.travel.soloNow)/1000));q.travel.render();};
  q.c.actor.position.set(2000,0,-2);q.travel.soloNow=1000000;q.travel.startBattle();q.travel.setGodMode(true);q.travel.setPhase(4);
  q.initialGlErrors=[];for(let i=0;i<8;i++){const e=q.renderer.getContext().getError();if(!e)break;q.initialGlErrors.push(e);}
 });console.log('Arena and audio prepared');
 const timing=await page.evaluate(()=>{
  const q=chargeQA;q.go('cosmic-flight',0);const arrived=q.travel.battle.since,wait=q.travel.battle.until-arrived;q.go('cosmic-spin-warn',0);const warning=q.travel.battle.since;q.go('cosmic-spin',0);return {wait,prepareAfterArrival:warning-arrived,spinAfterArrival:q.travel.battle.since-arrived,orbs:q.spin.cosmicOrbs(q.travel.battle,q.travel.soloNow).length};
 });assert.equal(timing.wait,1000);assert.equal(timing.prepareAfterArrival,1000);assert.equal(timing.spinAfterArrival,3800);assert(timing.orbs>0);console.log(JSON.stringify({timing}));
 await page.evaluate(()=>{const q=chargeQA;q.travel.setPhase(4,3);q.step(0);});
 const levels=[];
 for(const [stage,f,label] of [['cosmic-star-draw',.1,'small'],['cosmic-star-open',.35,'middle'],['cosmic-star-open',.98,'large'],['cosmic-planet-draw',.9,'maximum']]){
  await page.evaluate(({stage,f})=>chargeQA.go(stage,f),{stage,f});await page.waitForTimeout(250);
  const metrics=await page.evaluate(()=>{const q=chargeQA,voice=q.sounds.knightCharge;return {stage:q.travel.battle.stage,radius:q.travel.battleView.refuge.charge.radius,level:q.level,gain:voice?.gain.gain.value,loop:voice?.source.loop,sources:q.sources.size,bufferPrepared:q.prepared,bufferCount:q.sounds.buffers.size,glError:q.renderer.getContext().getError()};});
  assert.equal(metrics.glError,0);assert(metrics.loop&&metrics.bufferPrepared);assert.equal(metrics.sources,1);assert(Math.abs(metrics.gain-metrics.level)<.02);if(levels.length)assert(metrics.gain>levels.at(-1).gain);levels.push({label,...metrics});console.log(JSON.stringify(levels.at(-1)));
 }
 await page.screenshot({path:output+'charge-with-crackle.png'});
 const stable=await page.evaluate(()=>{const q=chargeQA,source=q.sounds.knightCharge.source;for(let i=0;i<120;i++)q.step(0);return {sameSource:q.sounds.knightCharge.source===source,sameBuffers:q.sounds.buffers.size===q.bufferCount};});assert(stable.sameSource&&stable.sameBuffers);
 const speed=await page.evaluate(()=>{const q=chargeQA;q.go('cosmic-planet-sweep',.2);const s=q.travel.battle,before=q.ref.refugePlanetAngle(s,q.travel.soloNow),after=q.ref.refugePlanetAngle(s,q.travel.soloNow+1000),old=q.ref.COSMIC_REFUGE.starSpeed+(2*Math.PI-2*q.ref.refugeContactAngle)/9;return {duration:s.until-s.since,multiplier:Math.abs(after-before)/old};});assert(Math.abs(speed.multiplier-1.2)<1e-8);
 await page.evaluate(()=>chargeQA.step(0,true));assert(!await page.evaluate(()=>chargeQA.sounds.knightCharge));await page.waitForTimeout(80);
 await page.evaluate(()=>chargeQA.step(0));assert(await page.evaluate(()=>!!chargeQA.sounds.knightCharge));
 await page.evaluate(()=>chargeQA.sounds.button.click());await page.evaluate(()=>chargeQA.step(0));assert(!await page.evaluate(()=>chargeQA.sounds.knightCharge));await page.evaluate(()=>{chargeQA.sounds.button.click();chargeQA.step(0);});assert(await page.evaluate(()=>!!chargeQA.sounds.knightCharge));
 await page.evaluate(()=>{chargeQA.travel.setPhase(1);chargeQA.step(0);});assert(!await page.evaluate(()=>chargeQA.sounds.knightCharge));
 const rendered=await page.evaluate(async()=>{
  const q=chargeQA,buffer=q.sounds.buffers.get('knight-gravity-crackle'),rate=buffer.sampleRate,context=new OfflineAudioContext(2,Math.ceil(rate*10),rate),source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.loop=true;source.connect(gain);gain.connect(context.destination);
  const r=q.ref.COSMIC_REFUGE,state={phase:4,stage:'cosmic-star-draw',since:0,until:r.drawMs,cosmicRefuge:{at:0}};
  for(let ms=0;ms<=9600;ms+=20){if(ms>=r.drawMs+r.openMs+r.pullMs)Object.assign(state,{stage:'cosmic-planet-sweep',since:r.drawMs+r.openMs+r.pullMs,until:r.drawMs+r.openMs+r.pullMs+r.sweepMs});else if(ms>=r.drawMs+r.openMs)Object.assign(state,{stage:'cosmic-planet-draw',since:r.drawMs+r.openMs,until:r.drawMs+r.openMs+r.pullMs});else if(ms>=r.drawMs)Object.assign(state,{stage:'cosmic-star-open',since:r.drawMs,until:r.drawMs+r.openMs});gain.gain.linearRampToValueAtTime(q.state.gravityChargeVolume(state,ms),ms/1000);}
  gain.gain.linearRampToValueAtTime(0,9.75);source.start();source.stop(9.8);const audio=await context.startRendering();let peak=0;const rms=(from,to)=>{let energy=0,count=0;for(let i=Math.round(from*rate);i<Math.round(to*rate);i++)for(let ch=0;ch<2;ch++){energy+=audio.getChannelData(ch)[i]**2;count++;}return Math.sqrt(energy/count);};
  const bytes=new Uint8Array(audio.length*4),view=new DataView(bytes.buffer);for(let i=0;i<audio.length;i++)for(let ch=0;ch<2;ch++){const v=audio.getChannelData(ch)[i];peak=Math.max(peak,Math.abs(v));view.setInt16(i*4+ch*2,Math.round(v*32767),true);}
  let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return {pcm:btoa(binary),rate,early:rms(.4,1.2),later:rms(.4+buffer.duration,1.2+buffer.duration),peak,duration:audio.duration};
 });assert(rendered.later>rendered.early*4);assert(rendered.peak<.5);
 const pcm=Buffer.from(rendered.pcm,'base64'),wav=Buffer.alloc(44+pcm.length);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(rendered.rate,24);wav.writeUInt32LE(rendered.rate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(pcm.length,40);pcm.copy(wav,44);await writeFile(output+'growing-crackle.wav',wav);delete rendered.pcm;
 await page.evaluate(()=>{const q=chargeQA;q.travel.setPhase(4,3);q.step(0);q.travel.leave();});const cleared=await page.evaluate(()=>!chargeQA.sounds.knightCharge&&chargeQA.sounds.knightCosmicSources.size===0);assert(cleared);assert.deepEqual(errors,[]);
 const report={timing,levels,stable,speed,rendered,cleared,errors};await writeFile(output+'report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report}));
}finally{await browser.close();}
