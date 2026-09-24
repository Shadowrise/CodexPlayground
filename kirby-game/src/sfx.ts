import { WaterSoundEvents, waterSamples } from './water-sounds';
import type { Emote } from './emotes';
import { SoundEvents, type SoundActor, type SoundKind } from './sound-events';
import { readAudioSettings, saveAudioSettings } from './audio-settings';
import type { CharacterController } from './controller';
import type { KirbyNpc } from './npcs';
import { footstepProfile } from './footsteps';

function T_smoothstep(value: number) {
  const t=Math.max(0,Math.min(1,value));
  return t*t*(3-2*t);
}

export class SoundEffects {
  private context?: AudioContext;
  private master?: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private active = new Set<AudioBufferSourceNode>();
  private events = new SoundEvents();
  private waterEvents=new WaterSoundEvents();
  private enabled = true;
  private volume = .45;
  private npcEffectAfter = 0;
  private voiceAfter = 0;
  private wheelAfter = 0;
  private cheerAfter = 0;
  private rewardAfter = 0;
  private buzz?: {source: AudioBufferSourceNode;gain: GainNode};
  constructor(private button: HTMLButtonElement, slider: HTMLInputElement) {
    const saved = readAudioSettings('sounds', .45);
    this.enabled = saved.enabled;
    this.volume = saved.volume;
    button.addEventListener('click', () => {
      this.enabled = !this.enabled;
      saveAudioSettings('sounds', this.enabled, this.volume);
      if (this.enabled) this.start();
      else this.stopAll();
      this.sync();
    });
    slider.value = String(Math.round(this.volume * 100));
    slider.addEventListener('input', () => {
      this.volume = Number(slider.value) / 100;
      saveAudioSettings('sounds', this.enabled, this.volume);
      this.sync();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.stopAll(); void this.context?.suspend(); }
      else if (this.enabled) void this.context?.resume().catch(() => {});
    });
    this.sync();
  }
  start() {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -12; limiter.ratio.value = 5;
        this.master.connect(limiter); limiter.connect(this.context.destination);
        for (const kind of ['jump', 'attack', 'death', 'revive', 'grow', 'step'] as SoundKind[]) this.buffers.set(kind, this.synthesize(kind, 0));
        for (let i = 0; i < 4; i++) this.buffers.set(`voice${i}`, this.synthesize('voice', i));
        this.buffers.set('hello', this.synthesize('voice', 4));
        this.buffers.set('wheel',this.rideBuffer(false));
        this.buffers.set('cheer',this.rideBuffer(true));
      }
      void this.context.resume().catch(() => { this.enabled = false; this.sync(); });
      this.sync();
    } catch { this.enabled = false; this.sync(); }
  }
  private sync() {
    this.button.textContent = this.enabled ? '♪ Звуки: вкл' : '♪ Звуки: выкл';
    this.button.setAttribute('aria-pressed', String(this.enabled));
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.context.currentTime, .03);
  }
  private stopAll() { for (const source of this.active) source.stop(); this.active.clear(); this.buzz=undefined; this.rewardAfter=0; }

  updateWater(dt:number,swimming:boolean,moving:boolean,available=true){
    const kind=this.waterEvents.update(dt,swimming,moving,available),ctx=this.context;
    if(!kind || !ctx || !this.enabled || document.hidden || ctx.state!=='running')return;
    const key=`water-${kind}`;
    if(!this.buffers.has(key)){
      const samples=waterSamples(kind),buffer=ctx.createBuffer(1,samples.length,22050);
      buffer.getChannelData(0).set(samples);this.buffers.set(key,buffer);
    }
    const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=this.buffers.get(key)!;
    source.playbackRate.value=.96+Math.random()*.08;
    gain.gain.value=kind==='enter'?.85:kind==='exit'?.6:kind==='paddle'?.18:.08;
    source.connect(gain);gain.connect(this.master!);this.active.add(source);
    source.onended=()=>{this.active.delete(source);source.disconnect();gain.disconnect();};source.start();
  }

  updateFireflyBuzz(level:number) {
    const ctx=this.context;
    if(!ctx || !this.enabled || document.hidden || ctx.state!=='running')return;
    const volume=Math.max(0,Math.min(1,level))*.075;
    if(!this.buzz && volume>0){
      // Integer periods make a seamless, gently modulated wing hum.
      let buffer=this.buffers.get('firefly-buzz');
      if(!buffer){
        const rate=22050;buffer=ctx.createBuffer(1,rate*2,rate);
        const data=buffer.getChannelData(0);
        for(let i=0;i<data.length;i++){
          const t=i/rate,phase=2*Math.PI*155*t+.7*Math.sin(2*Math.PI*3*t);
          data[i]=(Math.sin(phase)*.65+Math.sin(phase*2)*.22+Math.sin(phase*3)*.08)*(.8+.2*Math.sin(2*Math.PI*7*t));
        }
        this.buffers.set('firefly-buzz',buffer);
      }
      const source=ctx.createBufferSource(),gain=ctx.createGain();
      source.buffer=buffer;source.loop=true;gain.gain.value=0;
      source.connect(gain);gain.connect(this.master!);this.active.add(source);
      this.buzz={source,gain};
      source.onended=()=>{this.active.delete(source);source.disconnect();gain.disconnect();if(this.buzz?.source===source)this.buzz=undefined;};
      source.start();
    }
    this.buzz?.gain.gain.setTargetAtTime(volume,ctx.currentTime,.18);
  }

  playStarPickup(){
    const ctx=this.context;if(!ctx||!this.enabled||document.hidden||ctx.state!=='running')return;
    const source=ctx.createOscillator(),gain=ctx.createGain();source.type='sine';source.frequency.setValueAtTime(1046.5,ctx.currentTime);source.frequency.exponentialRampToValueAtTime(1568,ctx.currentTime+.14);
    gain.gain.setValueAtTime(0,ctx.currentTime);gain.gain.linearRampToValueAtTime(.12,ctx.currentTime+.012);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.35);
    source.connect(gain);gain.connect(this.master!);source.start();source.stop(ctx.currentTime+.36);source.onended=()=>{source.disconnect();gain.disconnect();};
  }
  playTaskComplete(count=1){
    const ctx=this.context;
    if(!ctx || !this.enabled || document.hidden || ctx.state!=='running')return;
    const key='task-complete';
    if(!this.buffers.has(key)){
      const rate=22050,duration=1.25,buffer=ctx.createBuffer(1,Math.ceil(rate*duration),rate);
      const data=buffer.getChannelData(0),notes=[523.25,659.25,783.99,1046.5];
      for(let i=0;i<data.length;i++){
        const t=i/rate;let value=0;
        notes.forEach((frequency,n)=>{
          const age=t-n*.14;if(age<0)return;
          const envelope=T_smoothstep(age/.025)*Math.exp(-age*(n===3?4:7))*T_smoothstep((duration-t)/.2);
          const phase=2*Math.PI*frequency*age;
          value+=(Math.sin(phase)+.16*Math.sin(phase*2)*Math.exp(-age*5))*envelope*.18;
        });
        data[i]=value;
      }
      this.buffers.set(key,buffer);
    }
    for(let i=0;i<count;i++){
      const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=this.buffers.get(key)!;gain.gain.value=.55;
      source.connect(gain);gain.connect(this.master!);this.active.add(source);
      source.onended=()=>{this.active.delete(source);source.disconnect();gain.disconnect();};
      const start=Math.max(ctx.currentTime,this.rewardAfter);source.start(start);this.rewardAfter=start+1.25;
    }
  }

  playEmote(kind:Emote){
    if(kind==='Hello'){this.sayHello();return;}
    const ctx=this.context;if(!ctx || !this.enabled || document.hidden || ctx.state!=='running')return;
    const key=`emote-${kind}`;
    if(!this.buffers.has(key)){
      const rate=22050,duration=kind==='Fear'?.65:kind==='Joy'?1.2:1.4;
      const buffer=ctx.createBuffer(1,Math.ceil(rate*duration),rate),data=buffer.getChannelData(0);let phase=0,noise=0;
      for(let i=0;i<data.length;i++){
        const t=i/rate,u=t/duration;
        const f=kind==='Joy'?620+150*Math.sin(t*15):kind==='Fear'?850-260*u:kind==='Anger'?380+18*Math.sin(t*23):530-230*u;
        phase+=2*Math.PI*f/rate;noise=noise*.8+(Math.random()*2-1)*.2;
        const edge=T_smoothstep(t/.06)*T_smoothstep((duration-t)/.2);
        const voice=Math.sin(phase)*.6+Math.sin(phase*2)*(kind==='Anger'?.08:.23)+Math.sin(phase*3)*(kind==='Sad'?.19:.045);
        const pulse=kind==='Joy'?.55+.45*Math.sin(t*15)**2:1;
        // Rounded "oo" for anger, falling "eh" with a breathy ending for sadness.
        const breath=kind==='Sad'?T_smoothstep((u-.55)/.4)*.7:kind==='Fear'?.17:0;
        data[i]=(voice*(1-breath)+noise*breath)*edge*pulse*.19;
      }
      this.buffers.set(key,buffer);
    }
    const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=this.buffers.get(key)!;gain.gain.value=.8;
    source.connect(gain);gain.connect(this.master!);this.active.add(source);
    source.onended=()=>{this.active.delete(source);source.disconnect();gain.disconnect();};source.start();this.voiceAfter=ctx.currentTime+2;
  }

  sayHello() {
    const ctx=this.context;
    if(!ctx || !this.enabled || document.hidden || ctx.state!=='running')return;
    const source=ctx.createBufferSource(),gain=ctx.createGain();
    source.buffer=this.buffers.get('hello')!;
    source.playbackRate.value=.97+Math.random()*.06;
    gain.gain.value=.65;
    source.connect(gain);gain.connect(this.master!);this.active.add(source);
    source.onended=()=>{this.active.delete(source);source.disconnect();gain.disconnect();};
    source.start();
    this.voiceAfter=ctx.currentTime+1.5;
  }

  playTreehouse(kind:'ladder'|'creak'|'leaves'|'cheer') {
    const ctx=this.context;
    if(!ctx || !this.enabled || document.hidden || ctx.state!=='running' || this.active.size>=8)return;
    const key=`tree-${kind}`;
    if(!this.buffers.has(key)){
      const duration=kind==='leaves'?1.1:kind==='creak'?.5:.15,rate=22050;
      if(kind==='cheer')this.buffers.set(key,this.buffers.get('cheer')!);
      else {
        const buffer=ctx.createBuffer(1,Math.ceil(duration*rate),rate),data=buffer.getChannelData(0);let noise=0,phase=0;
        for(let i=0;i<data.length;i++){
          const t=i/rate,u=t/duration;noise=noise*.7+(Math.random()*2-1)*.3;
          phase+=2*Math.PI*(kind==='creak'?190+50*Math.sin(u*Math.PI):125)/rate;
          const envelope=Math.sin(Math.PI*u)**.7*Math.exp(-u*(kind==='ladder'?5:1.5));
          data[i]=(kind==='leaves'?noise*(.6+.4*Math.sin(t*37)):kind==='creak'?Math.sin(phase)*.2+noise*.08:noise*.2+Math.sin(phase)*.22)*envelope;
        }
        this.buffers.set(key,buffer);
      }
    }
    const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=this.buffers.get(key)!;
    gain.gain.value=kind==='leaves'?.65:kind==='cheer'?.45:.25;
    source.connect(gain);gain.connect(this.master!);this.active.add(source);
    source.onended=()=>{this.active.delete(source);source.disconnect();gain.disconnect();};source.start();
  }

  playBalloon(kind:'burner'|'arrival'|'departure',volume:number) {
    const ctx=this.context;
    if(!ctx || !this.enabled || document.hidden || ctx.state!=='running' || this.active.size>=8)return;
    const key=`balloon-${kind}`;
    if(!this.buffers.has(key)){
      const rate=22050,duration=kind==='burner'?1.1:.65,buffer=ctx.createBuffer(1,Math.ceil(rate*duration),rate),data=buffer.getChannelData(0);
      let noise=0,phase=0;
      for(let i=0;i<data.length;i++){
        const t=i/rate,u=t/duration;noise=noise*.92+(Math.random()*2-1)*.08;
        phase+=2*Math.PI*(kind==='departure'?480+240*u:kind==='arrival'?440+220*Math.floor(u*3):75)/rate;
        const env=Math.sin(Math.PI*u)**1.2;
        data[i]=(kind==='burner'?noise*.8+Math.sin(phase)*.025:Math.sin(phase)*.12+Math.sin(phase*2)*.025)*env;
      }
      this.buffers.set(key,buffer);
    }
    const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=this.buffers.get(key)!;gain.gain.value=volume*(kind==='burner'?.48:.45);
    source.connect(gain);gain.connect(this.master!);this.active.add(source);
    source.onended=()=>{this.active.delete(source);source.disconnect();gain.disconnect();};source.start();
  }

  private rideBuffer(cheer:boolean) {
    const rate=22050,duration=cheer?.9:.16;
    const buffer=this.context!.createBuffer(1,Math.ceil(rate*duration),rate),data=buffer.getChannelData(0);
    let phase=0,noise=0,seed=279;
    for(let i=0;i<data.length;i++) {
      const t=i/rate,u=t/duration;
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      noise=noise*.72+(seed/4294967296*2-1)*.28;
      phase+=2*Math.PI*(cheer?620+430*Math.sin(Math.PI*u)+25*Math.sin(t*48):180-70*u)/rate;
      const env=Math.sin(Math.PI*u)**(cheer?.7:1.2);
      data[i]=cheer ? (Math.sin(phase)+.22*Math.sin(2*phase)+.08*Math.sin(3*phase))*env*.16
        : (noise*.7+Math.sin(phase)*.3)*env*Math.exp(-u*9)*.5;
    }
    return buffer;
  }

  updateRide(riding:boolean,motion:{speed:number;slope:number;inverted:boolean;turn?:number}) {
    const ctx=this.context;
    if(!ctx || !this.enabled || document.hidden || ctx.state!=='running')return;
    if(!riding){this.wheelAfter=0;return;}
    const play=(name:string,volume:number,rate:number)=>{
      if(this.active.size>=6)return;
      const source=ctx.createBufferSource(),gain=ctx.createGain();
      source.buffer=this.buffers.get(name)!;source.playbackRate.value=rate;gain.gain.value=volume;
      source.connect(gain);gain.connect(this.master!);this.active.add(source);
      source.onended=()=>{this.active.delete(source);source.disconnect();gain.disconnect();};source.start();
    };
    if(motion.speed>1 && ctx.currentTime>=this.wheelAfter) {
      play('wheel',.56,.92+Math.random()*.16);
      this.wheelAfter=ctx.currentTime+Math.max(.09,Math.min(.32,4.8/motion.speed));
    }
    if(motion.speed>8 && (motion.slope<-.38 || motion.inverted || (motion.turn??0)>.035) && ctx.currentTime>=this.cheerAfter) {
      play('cheer',.65,.95+Math.random()*.12);this.cheerAfter=ctx.currentTime+4.5;
    }
  }

  private synthesize(kind: SoundKind, variant: number) {
    const ctx = this.context!, rate = 22050;
    const duration = { jump: .32, attack: .22, death: .85, revive: .8, grow: .62, voice: .78, step: .15 }[kind];
    const buffer = ctx.createBuffer(1, Math.ceil(rate * duration), rate), data = buffer.getChannelData(0);
    let phase = 0, seed = 97 + variant * 113, lowNoise = 0, softNoise = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / rate, u = t / duration;
      const edge = Math.min(1, t / .012) * Math.min(1, (duration - t) / .05);
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 4294967296 * 2 - 1;
      lowNoise = lowNoise * .8 + noise * .2;
      softNoise = softNoise * .86 + lowNoise * .14;
      let freq = 440, value = 0;
      if (kind === 'jump') freq = 230 + 740 * Math.sin(u * Math.PI / 2);
      if (kind === 'attack') freq = 380 * Math.exp(-u * 4) + 70;
      if (kind === 'death') freq = 420 * (1 - u) + 95 + 16 * Math.sin(t * 44);
      if (kind === 'grow' || kind === 'revive') {
        const notes = kind === 'grow' ? [523.25, 659.25, 783.99, 1046.5] : [587.33, 739.99, 880, 1174.66];
        freq = notes[Math.min(3, Math.floor(u * 4))];
      }
      if (kind === 'voice') {
        const hello=variant===4;
        // Original two-syllable creature chirp with vowel-like harmonics.
        const syllable = u < .42 ? u / .42 : (u - .47) / .53;
        freq = (540 + (hello ? 1 : variant) * 55) * (1 + .3 * Math.sin(syllable * Math.PI)) + 15 * Math.sin(t * 65);
        if(hello)freq=595*(1+.22*Math.sin(Math.PI*u)) + 5*Math.sin(t*32);
        const vowel = u < .42 ? 0 : 1;
        phase += 2 * Math.PI * freq / rate;
        const env = u > .42 && u < .47 ? 0 : Math.sin(Math.PI * Math.max(0, Math.min(1, syllable))) ** .65;
        value = (.55 * Math.sin(phase) + (vowel ? .24 : .12) * Math.sin(phase * 2) + .10 * Math.sin(phase * (vowel ? 3 : 4))) * env * .22;
        if(hello) {
          // Join the vowels continuously instead of cutting the voice to silence.
          const blend=T_smoothstep((u-.32)/.26);
          const h=(1-T_smoothstep(t/.1))*.12;
          const voiced=.55*Math.sin(phase)+(.18-.04*blend)*Math.sin(phase*2)
            +(.10-.065*blend)*Math.sin(phase*3)+(.035-.02*blend)*Math.sin(phase*4);
          const envelope=T_smoothstep(t/.055)*T_smoothstep((duration-t)/.13)
            *(1-.32*Math.exp(-(((u-.44)/.09)**2)));
          value=(voiced*(1-h)+softNoise*h)*envelope*.22;
        }
      } else {
        phase += 2 * Math.PI * freq / rate;
        // Rounded, low-pass grass rustle: no pitched thump or sharp transient.
        if (kind === 'step') value = (softNoise*.7 + Math.sin(2*Math.PI*115*t)*.075) * Math.sin(Math.PI * u) ** 2 * Math.exp(-u * 1.5);
        else if (kind === 'attack') value = (.65 * lowNoise + .25 * Math.sin(phase)) * Math.exp(-u * 5) * .6;
        else if (kind === 'jump') value = (Math.sin(phase) + .12 * Math.sin(phase * 2)) * Math.exp(-u * 2) * .3;
        else if (kind === 'death') value = (Math.sin(phase) + .16 * Math.sin(phase * 2)) * (1 - u) * .23;
        else if (kind === 'grow') {
          const bell=2*Math.PI*1046.5*t;
          value=(Math.sin(bell)+.32*Math.sin(bell*2.76)*Math.exp(-t*7)+.12*Math.sin(bell*4.07)*Math.exp(-t*12))*Math.exp(-t*6)*.3;
        }
        else { const pulse = (u * 4) % 1; value = (Math.sin(phase) + .2 * Math.sin(phase * 2)) * Math.sin(Math.PI * pulse) * .23; }
      }
      data[i] = value * edge;
    }
    return buffer;
  }

  update(dt: number, player: CharacterController, npcs: readonly KirbyNpc[], cameraAzimuth: number) {
    const actors: SoundActor[] = [
      { id: 'player', player: true, state: player.state, down: false, size: player.actor.scale.x, fruitsEaten: player.fruitsEaten, x: player.actor.position.x, z: player.actor.position.z },
      ...npcs.map(n => ({ id: n.actor.uuid, state: n.state, down: n.isDown, size: n.actor.scale.x, fruitsEaten:n.fruitsEaten, x: n.actor.position.x, z: n.actor.position.z })),
    ];
    const events = this.events.update(dt, actors, player.actor.position);
    const ctx = this.context;
    if (!ctx || !this.enabled || document.hidden || ctx.state !== 'running') return;
    // Player and important life-cycle events take precedence over ambient chatter.
    events.sort((a, b) => Number(a.kind === 'step') - Number(b.kind === 'step') || Number(!!b.actor.player) - Number(!!a.actor.player));
    for (const event of events) {
      const dx = event.actor.x - player.actor.position.x, dz = event.actor.z - player.actor.position.z;
      const distance = Math.hypot(dx, dz);
      if (!event.actor.player && distance > 18) continue;
      if (event.kind === 'voice' && ctx.currentTime < this.voiceAfter) continue;
      if (!event.actor.player && event.kind !== 'voice' && event.kind !== 'step' && ctx.currentTime < this.npcEffectAfter) continue;
      if (event.kind === 'step' && !event.actor.player && this.active.size >= 3) continue;
      if (this.active.size >= 4) { if (!event.actor.player) continue; const oldest = this.active.values().next().value; oldest?.stop(); if (oldest) this.active.delete(oldest); }
      const source = ctx.createBufferSource(), gain = ctx.createGain(), pan = ctx.createStereoPanner();
      source.buffer = this.buffers.get(event.kind === 'voice' ? `voice${Math.floor(Math.random() * 4)}` : event.kind)!;
      source.playbackRate.value = event.kind === 'voice' || event.kind === 'step' ? .94 + Math.random() * .12 : 1;
      gain.gain.value = event.actor.player ? .8 : .36 * (1 - distance / 18);
      let stepFilter: BiquadFilterNode | undefined;
      if (event.kind === 'step') {
        const profile=footstepProfile(event.actor.size);
        source.playbackRate.value=profile.rate*(.98+Math.random()*.04);
        gain.gain.value=profile.gain*(event.actor.player?1:.47*Math.max(0,1-distance/9));
        stepFilter=ctx.createBiquadFilter();stepFilter.type='lowpass';stepFilter.frequency.value=profile.cutoff;stepFilter.Q.value=.5;
      }
      pan.pan.value = event.actor.player ? 0 : Math.max(-.8, Math.min(.8, (-Math.cos(cameraAzimuth) * dx + Math.sin(cameraAzimuth) * dz) / 12));
      if(stepFilter){source.connect(stepFilter);stepFilter.connect(gain);}else source.connect(gain);
      gain.connect(pan); pan.connect(this.master!);
      this.active.add(source);
      source.onended = () => { this.active.delete(source); source.disconnect(); stepFilter?.disconnect(); gain.disconnect(); pan.disconnect(); };
      source.start();
      if (event.kind === 'voice') this.voiceAfter = ctx.currentTime + 1.5;
      else if (!event.actor.player && event.kind !== 'step') this.npcEffectAfter = ctx.currentTime + .4;
    }
  }
}
