import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SoundEffects} from '../src/sfx';
import type {Emote} from '../src/emotes';

/** Isolate the real shared-voice lifecycle without unlocking audio or fetching files. */
function harness(){
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'document');
 const page={hidden:false};Object.defineProperty(globalThis,'document',{configurable:true,value:page});
 const nodes:{kind:string;connections:unknown[];disconnected:boolean;started?:boolean;stopped?:boolean;onended?:()=>void;buffer?:AudioBuffer;gain?:{value:number};pan?:{value:number}}[]=[];
 const node=(kind:string)=>{
  const result={kind,connections:[] as unknown[],disconnected:false,started:false,stopped:false,onended:undefined as (()=>void)|undefined,buffer:undefined as AudioBuffer|undefined,
   connect(target:unknown){this.connections.push(target);},disconnect(){this.disconnected=true;},start(){this.started=true;},stop(){this.stopped=true;this.onended?.();},
   gain:{value:1,cancelScheduledValues(){},setValueAtTime(value:number){this.value=value;},linearRampToValueAtTime(value:number){this.value=value;}},pan:{value:0}};
  nodes.push(result);return result;
 };
 const context={state:'running',currentTime:3,createBufferSource:()=>node('source'),createGain:()=>node('gain'),createStereoPanner:()=>node('pan')};
 const fear={duration:1.54} as AudioBuffer,master={name:'existing shared master'};
 const sounds=Object.create(SoundEffects.prototype) as SoundEffects;
 const internal=sounds as unknown as {context:unknown;master:unknown;enabled:boolean;buffers:Map<string,AudioBuffer>;active:Set<{source:{stop():void}}>;pigeonVoices:Promise<Map<Emote,AudioBuffer>>;pigeonVoiceToken:number;pigeonSoundGeneration:number;stopAll():void};
 Object.assign(internal,{context,master,enabled:true,buffers:new Map(),active:new Set(),pigeonVoices:Promise.resolve(new Map<Emote,AudioBuffer>([['Fear',fear]])),pigeonVoiceToken:0,pigeonSoundGeneration:0});
 return {sounds,internal,context,fear,master,page,nodes,restore(){if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else Reflect.deleteProperty(globalThis,'document');}};
}

test('NPC fear coo uses the native buffer, shared master, distance falloff, camera panning and tracked cleanup',async()=>{
 const h=harness();
 try{
  await h.sounds.playPigeonEmoteAt('Fear',12,0,0);
  const [source,gain,pan]=h.nodes;
  assert.equal(source.buffer,h.fear);assert(source.started);
  assert.equal(gain.gain!.value,.72*.25,'half hearing radius uses quadratic falloff');
  assert.equal(pan.pan!.value,-.8);assert.deepEqual(source.connections,[gain]);assert.deepEqual(gain.connections,[pan]);assert.deepEqual(pan.connections,[h.master]);
  assert.equal(h.internal.active.size,1);source.onended!();assert.equal(h.internal.active.size,0);
  assert(h.nodes.every(node=>node.disconnected),'ended source, gain and panner are disconnected');
  await h.sounds.playPigeonEmoteAt('Fear',12,0,Math.PI);assert.equal(h.nodes.at(-1)!.pan!.value,.8,'pan follows camera orientation');
  assert.equal(h.internal.buffers.get('pigeon-emote-Fear'),h.fear,'decoded voice joins the existing buffer cache');
  h.internal.stopAll();assert.equal(h.internal.active.size,0);assert(h.nodes[3].stopped);
 }finally{h.restore();}
});

test('positional coos obey mute, visibility, unlocked context, hearing radius and voice limits',async()=>{
 const h=harness();
 try{
  h.internal.enabled=false;await h.sounds.playPigeonEmoteAt('Fear',0,0,0);h.internal.enabled=true;
  h.page.hidden=true;await h.sounds.playPigeonEmoteAt('Fear',0,0,0);h.page.hidden=false;
  h.context.state='suspended';await h.sounds.playPigeonEmoteAt('Fear',0,0,0);h.context.state='running';
  for(const [dx,dz,azimuth] of [[24,0,0],[0,30,0],[NaN,0,0],[0,0,NaN]])await h.sounds.playPigeonEmoteAt('Fear',dx,dz,azimuth);
  await h.sounds.playPigeonEmoteAt('Joy',0,0,0); // A missing optional voice must not become a generic beep.
  for(let i=0;i<12;i++)h.internal.active.add({source:{stop(){}}});
  await h.sounds.playPigeonEmoteAt('Fear',0,0,0);
  assert.equal(h.nodes.length,0);
 }finally{h.restore();}
});

test('reset cancels pending NPC decode, while another player emote cannot cancel the positional fear event',async()=>{
 const h=harness();
 try{
  let resolve!:(buffers:Map<Emote,AudioBuffer>)=>void;
  h.internal.pigeonVoices=new Promise(done=>{resolve=done;});
  const pending=h.sounds.playPigeonEmoteAt('Fear',0,0,0);
  h.internal.stopAll();resolve(new Map([['Fear',h.fear]]));await pending;assert.equal(h.nodes.length,0,'stale coo must not play after leaving/reset');
  h.internal.pigeonVoices=new Promise(done=>{resolve=done;});
  const current=h.sounds.playPigeonEmoteAt('Fear',0,0,0);
  h.internal.pigeonVoiceToken++; // The player starts an unrelated emotion while NPC audio loads.
  resolve(new Map([['Fear',h.fear]]));await current;assert.equal(h.nodes.length,3);
 }finally{h.restore();}
});
