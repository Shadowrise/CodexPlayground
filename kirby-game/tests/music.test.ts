import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BackgroundMusic, MUSIC_TRACKS } from '../src/music';
import { readFileSync } from 'node:fs';

test('all fifteen stereo tracks exist, first two use approved arrangements, audio has headroom', () => {
  assert.equal(MUSIC_TRACKS.length,15);
  for (const [index, [file]] of MUSIC_TRACKS.entries()) {
    const wav = readFileSync(new URL(`../public/audio/${file}.wav`, import.meta.url));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.readUInt16LE(22), 2);
    const duration = wav.readUInt32LE(40) / wav.readUInt32LE(28);
    assert(duration > 100 && duration < 130);
    if (index === 0) {
      assert(Math.abs(duration - 118.4) < .001);
      assert.equal(wav.readUInt32LE(24), 44100);
      assert.equal(wav.readUInt16LE(34), 16);
    }
    if (file === 'citrus-walk') {
      assert(Math.abs(duration - 118.555555556) < .001, 'approved soft version begins with the theme and keeps its ending');
      assert.equal(wav.readUInt32LE(24), 44100);
      assert.equal(wav.readUInt16LE(34), 16);
    }
    let peak = 0;
    for (let i = 44; i < wav.length; i += 2) peak = Math.max(peak, Math.abs(wav.readInt16LE(i)));
    assert(peak > 10000 && peak < 30000);
  }
});

test('tracks and event soundtracks preserve mute and the configured volume', async () => {
  class FakeElement extends EventTarget {
    value = ''; textContent = ''; title = ''; hidden = false;
    attributes = new Map<string, string>();
    setAttribute(k: string, v: string) { this.attributes.set(k, v); }
  }
  let audio: FakeAudio;
  class FakeAudio extends EventTarget {
    src = ''; loop = false; preload = ''; volume = 1; paused = true;playbackRate=1;preservesPitch=true;
    constructor() { super(); audio = this; }
    pause() { this.paused = true; }
    async play() { this.paused = false; }
  }
  const originalAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new Map<string,string>();
  const doc = new FakeElement(), button = new FakeElement(), volume = new FakeElement();
  const previous = new FakeElement(), next = new FakeElement(), label = new FakeElement();
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: FakeAudio });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)} });
  try {
    const music = new BackgroundMusic(button as unknown as HTMLButtonElement, volume as unknown as HTMLInputElement,
      previous as unknown as HTMLButtonElement, next as unknown as HTMLButtonElement, label as unknown as HTMLElement);
    assert(audio!.paused); assert(!audio!.loop);
    music.start(); await Promise.resolve(); assert(!audio!.paused);
    volume.value = '37'; volume.dispatchEvent(new Event('input'));
    const first = MUSIC_TRACKS.findIndex(([file]) => audio!.src.split('?')[0].endsWith(`${file}.wav`));
    assert.equal(first,0,'every page starts with День на поляне');assert(label.textContent.includes('/ 15 ·'));
    for (let i = 0; i < MUSIC_TRACKS.length; i++) {
      assert(audio!.src.split('?')[0].endsWith(`${MUSIC_TRACKS[(first + i) % MUSIC_TRACKS.length][0]}.wav`));
      if (MUSIC_TRACKS[(first + i) % MUSIC_TRACKS.length][0] === 'meadow-day') {
        assert(audio!.src.endsWith('?v=acoustic-20261021'), 'load the approved arrangement instead of cached legacy audio');
      }
      if (MUSIC_TRACKS[(first + i) % MUSIC_TRACKS.length][0] === 'citrus-walk') {
        assert(audio!.src.endsWith('?v=acoustic-soft-20261024'), 'load the approved soft arrangement without the removed introduction');
      }
      audio!.dispatchEvent(new Event('ended'));
    }
    assert(audio!.src.split('?')[0].endsWith(`${MUSIC_TRACKS[first][0]}.wav`));
    previous.dispatchEvent(new Event('click'));
    assert(audio!.src.split('?')[0].endsWith(`${MUSIC_TRACKS[(first + MUSIC_TRACKS.length - 1) % MUSIC_TRACKS.length][0]}.wav`));
    next.dispatchEvent(new Event('click'));
    assert(audio!.src.split('?')[0].endsWith(`${MUSIC_TRACKS[first][0]}.wav`));
    button.dispatchEvent(new Event('click')); assert(audio!.paused);
    next.dispatchEvent(new Event('click'));
    assert(audio!.paused); assert(!audio!.loop); assert.equal(audio!.volume, .37);
    button.dispatchEvent(new Event('click')); await Promise.resolve(); assert(!audio!.paused);
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); assert(audio!.paused);
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); assert(!audio!.paused);
    const background=audio!;music.setEvent(true);await Promise.resolve();const event=audio!;
    assert(background.paused);assert(event.loop);assert(!event.paused);assert(event.src.endsWith('/audio/topotushka-play.wav'));assert.equal(event.volume,.37);
    volume.value='29';volume.dispatchEvent(new Event('input'));assert.equal(event.volume,.29);assert.equal(background.volume,.29);
    music.setEvent('celebrate');await Promise.resolve();assert(!event.loop);assert(event.src.endsWith('/audio/topotushka-victory.wav'));assert.equal(event.volume,.29);assert(!event.paused);
    music.setEvent('knight');await Promise.resolve();assert(event.loop);assert(event.src.endsWith('/audio/meta-knight-duel.wav?v=orchestral-muted-20261023'),'load the approved muted-violin recording instead of cached legacy audio');assert(background.paused);assert(!event.paused);assert.equal(event.volume,.29);assert.match(label.textContent,/Галаксия/);
    music.updateKnightPhase(3,.1);assert(event.playbackRate>1&&event.playbackRate<1.1);
    for(let i=0;i<180;i++)music.updateKnightPhase(3,1/60);assert(Math.abs(event.playbackRate-1.1)<.001);assert(event.preservesPitch);
    button.dispatchEvent(new Event('click'));assert(event.paused);button.dispatchEvent(new Event('click'));await Promise.resolve();assert(!event.paused);
    assert.equal(background.volume,.29);assert.equal(event.volume,.29);
    volume.value='65';volume.dispatchEvent(new Event('input'));
    assert.equal(background.volume,.65);assert.equal(event.volume,.65);
    button.dispatchEvent(new Event('click'));assert(event.paused);button.dispatchEvent(new Event('click'));await Promise.resolve();assert(!event.paused);
    assert.deepEqual(JSON.parse(storage.get('kirby.audio.music')!),{enabled:true,volume:.65});
    music.setEvent('celebrate');await Promise.resolve();
    assert(event.src.endsWith('/audio/topotushka-victory.wav'),'the duel ends with the same cheerful victory music as Topotushka');
    assert(!event.loop);assert(!event.paused);assert(background.paused);assert.equal(event.volume,.65);assert.equal(event.playbackRate,1);
    music.updateKnightPhase(3,1);assert.equal(event.playbackRate,1,'victory music uses its original tempo');
    button.dispatchEvent(new Event('click'));assert(event.paused);
    music.setEvent('knight');music.setEvent('celebrate');assert(event.paused,'winning respects the music toggle');
    button.dispatchEvent(new Event('click'));await Promise.resolve();assert(!event.paused);assert.equal(event.volume,.65);
    music.setEvent(false);await Promise.resolve();assert(event.paused);assert(!background.paused);assert.equal(event.playbackRate,1);
    next.dispatchEvent(new Event('click'));assert.equal(background.volume,.65,'changing tracks keeps the configured volume');
    assert.equal(background.volume,.65);assert.equal(event.volume,.65);
    music.stop();assert(background.paused);assert.equal(background.volume,.65);
  } finally {
    if (originalAudio) Object.defineProperty(globalThis, 'Audio', originalAudio); else Reflect.deleteProperty(globalThis, 'Audio');
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document');
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage); else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('menu autoplay keeps the music preference and retries on activation without restarting on game entry',async()=>{
 class Element extends EventTarget{value='';textContent='';title='';hidden=false;attributes=new Map<string,string>();setAttribute(k:string,v:string){this.attributes.set(k,v);}}
 let allowed=false;const audios:AudioStub[]=[];
 class AudioStub extends EventTarget{
  private source='';currentTime=0;paused=true;preload='';volume=1;loop=false;playCalls=0;loads=0;playbackRate=1;
  constructor(){super();audios.push(this);}
  get src(){return this.source;}set src(value:string){this.source=value;this.currentTime=0;this.loads++;}
  pause(){this.paused=true;}
  async play(){this.playCalls++;if(!allowed)throw new DOMException('User activation required','NotAllowedError');this.paused=false;}
 }
 const saved=new Map(['Audio','document','localStorage'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const storage=new Map<string,string>(),doc=new Element(),button=new Element(),slider=new Element(),previous=new Element(),next=new Element(),label=new Element();
 Object.defineProperty(globalThis,'Audio',{configurable:true,value:AudioStub});
 Object.defineProperty(globalThis,'document',{configurable:true,value:doc});
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)}});
 try{
  const music=new BackgroundMusic(button as unknown as HTMLButtonElement,slider as unknown as HTMLInputElement,previous as unknown as HTMLButtonElement,next as unknown as HTMLButtonElement,label as unknown as HTMLElement),background=audios[0];
  music.enterMenu();await Promise.resolve();
  assert(background.paused);assert(background.src.includes('/audio/meadow-day.wav'));assert.equal(button.attributes.get('aria-pressed'),'true','autoplay denial must not mute the user setting');
  assert.equal(storage.size,0);
  allowed=true;doc.dispatchEvent(new Event('pointerup'));await Promise.resolve();assert(!background.paused);
  background.currentTime=17.25;const plays=background.playCalls;
  music.start();assert.equal(background.playCalls,plays);assert.equal(background.currentTime,17.25);assert.equal(background.loads,1,'entering the game must not reload the menu track');
  doc.dispatchEvent(new Event('keydown'));await Promise.resolve();assert.equal(background.playCalls,plays,'gesture retries are removed after playback starts');
  music.setEvent('knight');await Promise.resolve();assert(background.paused);
  music.enterMenu();await Promise.resolve();assert(!background.paused);assert.equal(background.currentTime,17.25);assert.equal(background.volume,.25);assert(audios[1].paused);
  button.dispatchEvent(new Event('click'));assert(background.paused);music.enterMenu();doc.dispatchEvent(new Event('pointerup'));await Promise.resolve();assert(background.paused,'menu entry respects mute');
  music.stop();
 }finally{for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
});

test('shuffle persists, plays complete random passes, supports navigation and returns to sequential playback',async()=>{
 class Element extends EventTarget{value='';textContent='';title='';hidden=false;checked=false;setAttribute(){} }
 const audios:AudioStub[]=[];
 class AudioStub extends EventTarget{
  src='';preload='';volume=1;loop=false;paused=true;plays=0;
  constructor(){super();audios.push(this);}
  pause(){this.paused=true;}
  async play(){this.paused=false;this.plays++;}
 }
 const saved=new Map(['Audio','document','localStorage'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)])),random=Math.random;
 const storage=new Map<string,string>(),doc=new Element();
 Object.defineProperty(globalThis,'Audio',{configurable:true,value:AudioStub});
 Object.defineProperty(globalThis,'document',{configurable:true,value:doc});
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)}});
 Math.random=()=>0;
 const create=()=>{
  const button=new Element(),volume=new Element(),previous=new Element(),next=new Element(),label=new Element(),shuffle=new Element();
  const music=new BackgroundMusic(button as unknown as HTMLButtonElement,volume as unknown as HTMLInputElement,previous as unknown as HTMLButtonElement,next as unknown as HTMLButtonElement,label as unknown as HTMLElement,shuffle as unknown as HTMLInputElement);
  return {music,button,volume,previous,next,shuffle,audio:audios.at(-1)!};
 };
 const track=(audio:AudioStub)=>MUSIC_TRACKS.findIndex(([file])=>audio.src.split('?')[0].endsWith(`${file}.wav`));
 try{
  const {music,button,volume,previous,next,shuffle,audio}=create();music.start();
  assert.equal(shuffle.checked,false);assert.equal(track(audio),0);
  const plays=audio.plays,source=audio.src;
  shuffle.checked=true;shuffle.dispatchEvent(new Event('change'));
  assert.equal(storage.get('kirby.audio.shuffle'),'true');assert.equal(audio.plays,plays);assert.equal(audio.src,source,'changing the order keeps the current song playing');
  const first=[track(audio)];
  for(let i=1;i<MUSIC_TRACKS.length;i++){audio.dispatchEvent(new Event('ended'));first.push(track(audio));}
  assert.equal(new Set(first).size,MUSIC_TRACKS.length);assert.notDeepEqual(first,MUSIC_TRACKS.map((_,i)=>i));
  previous.dispatchEvent(new Event('click'));assert.equal(track(audio),first.at(-2));
  next.dispatchEvent(new Event('click'));assert.equal(track(audio),first.at(-1));
  const second:number[]=[];
  for(let i=0;i<MUSIC_TRACKS.length;i++){audio.dispatchEvent(new Event('ended'));second.push(track(audio));}
  assert.equal(new Set(second).size,MUSIC_TRACKS.length);assert.notEqual(first.at(-1),second[0],'the cycle boundary cannot immediately repeat a song');
  volume.value='42';volume.dispatchEvent(new Event('input'));button.dispatchEvent(new Event('click'));
  assert.equal(storage.get('kirby.audio.shuffle'),'true');assert(audio.paused);
  next.dispatchEvent(new Event('click'));assert(audio.paused,'shuffle respects mute');
  music.stop();const restored=create();assert.equal(restored.shuffle.checked,true);assert.notEqual(track(restored.audio),0,'saved shuffle also randomizes the first menu song');
  restored.shuffle.checked=false;restored.shuffle.dispatchEvent(new Event('change'));
  const current=track(restored.audio);restored.next.dispatchEvent(new Event('click'));assert.equal(track(restored.audio),(current+1)%MUSIC_TRACKS.length);
  restored.previous.dispatchEvent(new Event('click'));assert.equal(track(restored.audio),current);
  assert.equal(storage.get('kirby.audio.shuffle'),'false');restored.music.stop();
  const sequential=create();assert.equal(sequential.shuffle.checked,false);assert.equal(track(sequential.audio),0);sequential.music.stop();
 }finally{
  Math.random=random;for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
 }
});

