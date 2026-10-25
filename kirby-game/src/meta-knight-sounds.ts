/** Generated duel effects, also used as a fallback for sampled cosmic cues. */
import {cosmicSound,isCosmicSound,type CosmicSound} from './meta-knight-cosmic-sounds';
import {cosmicSpinSound,isCosmicSpinSound,type CosmicSpinSound} from './meta-knight-cosmic-spin-sounds';
import {meteorSound,isMeteorSound,type MeteorSound} from './meta-knight-cosmic-meteor-sounds';
import {refugeSound,isRefugeSound,type RefugeSound} from './meta-knight-cosmic-refuge-sounds';
import {finaleSound,isFinaleSound,type FinaleSound} from './meta-knight-cosmic-finale-sounds';
export type KnightSound=CosmicSound|CosmicSpinSound|MeteorSound|RefugeSound|FinaleSound|'count'|'start'|'warn'|'slash'|'dash'|'thrust'|'slam'|'shot'|'reflect'|'hit'|'hurt'|'phase'|'win'|'crystal'|'constellation'|'shield'|'wave'|'shatter';
export const KNIGHT_SOUND_RATE=44100;
export function knightSound(kind:KnightSound,rate=KNIGHT_SOUND_RATE){
 if(isCosmicSound(kind))return cosmicSound(kind,rate);
 if(isCosmicSpinSound(kind))return cosmicSpinSound(kind,rate);
 if(isMeteorSound(kind))return meteorSound(kind,rate);
 if(isRefugeSound(kind))return refugeSound(kind,rate);
 if(isFinaleSound(kind))return finaleSound(kind,rate);
 const duration={count:.24,start:1.35,warn:.85,slash:.6,dash:.9,thrust:1.35,slam:1.25,shot:1,reflect:1.2,hit:.8,hurt:.7,phase:1.8,win:3,crystal:1.4,constellation:1.8,shield:1.6,wave:1.2,shatter:1.5}[kind],n=Math.ceil(rate*duration);
 const left=new Float32Array(n),right=new Float32Array(n);let seed=907+kind.length*311,low=0,slow=0,phase=0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1;};
 const bell=(t:number,f:number)=>Math.sin(2*Math.PI*f*t)*Math.exp(-t*5)+.28*Math.sin(2*Math.PI*f*2.76*t)*Math.exp(-t*13)+.12*Math.sin(2*Math.PI*f*4.07*t)*Math.exp(-t*21);
 for(let i=0;i<n;i++){
  const t=i/rate,u=t/duration,noise=random();low+=(noise-low)*.14;slow+=(low-slow)*.035;const air=low-slow;let v=0;
  if(kind==='count')v=(Math.sin(2*Math.PI*176*t)+.45*Math.sin(2*Math.PI*352*t))*Math.exp(-t*32)*.38+air*Math.exp(-t*85)*.32;
  if(kind==='start')v=bell(t,1568)*.40+bell(t,2093)*.19+bell(t,3136)*.065+air*Math.exp(-t*75)*.12;
  if(kind==='crystal'){v=bell(t,1174.66)*.28+bell(t,1760)*.16+air*Math.exp(-t*4)*.22;phase+=2*Math.PI*(170+1200*Math.exp(-t*7))/rate;v+=Math.sin(phase)*Math.exp(-t*5)*.12;}
  if(kind==='shield')v=bell(t,293.66)*.24+bell(t,587.33)*.15+air*Math.sin(Math.PI*u)**2*.28+Math.sin(t*2*Math.PI*73.42)*Math.sin(Math.PI*u)*.12;
  if(kind==='wave'){phase+=2*Math.PI*(340+920*Math.exp(-t*6))/rate;v=air*Math.sin(Math.PI*u)**1.5*.65+Math.sin(phase)*Math.exp(-t*3)*.13+bell(t,880)*.08;}
  if(kind==='shatter'){for(let k=0;k<6;k++)if(t>k*.035)v+=bell(t-k*.035,1046.5+k*271)*.09;v+=air*Math.exp(-t*16)*.5+Math.sin(2*Math.PI*65*t)*Math.exp(-t*9)*.18;}
  if(kind==='constellation'){for(const [at,f] of [[0,587.33],[.12,880],[.24,1174.66],[.36,1760]])if(t>=at)v+=bell(t-at,f)*.14;v+=air*Math.sin(Math.PI*u)**1.4*.25;}
  if(kind==='warn')v=air*Math.sin(Math.PI*u)**1.6*.45+bell(t,440+160*u)*.1*(1-u)+Math.sin(t*2*Math.PI*110)*Math.sin(Math.PI*u)*.08;
  if(kind==='slash'){phase+=2*Math.PI*(1450*Math.exp(-t*11)+170)/rate;v=(air*.85+Math.sin(phase)*.13)*Math.sin(Math.PI*Math.min(1,t/.42))**1.5+bell(t,1800)*.045;}
  if(kind==='dash')v=air*Math.sin(Math.PI*u)**1.4*.8+Math.sin(2*Math.PI*(72*t+30*t*t))*.11*Math.sin(Math.PI*u);
  if(kind==='thrust'){
   const rush=Math.min(1,t/.035)*Math.exp(-t*2.8),shine=Math.min(1,t/.018);
   phase+=2*Math.PI*(110+1500*Math.exp(-t*5))/rate;
   v=air*rush*1.55+Math.sin(phase)*Math.exp(-t*8)*.17;
   v+=Math.sin(2*Math.PI*(56*t+1.4*(1-Math.exp(-t*24))))*Math.exp(-t*9)*.36;
   v+=(bell(t,587.33)*.22+bell(t,880)*.16+bell(t,1174.66)*.10)*shine;
   v+=(Math.sin(2*Math.PI*146.83*t)+.45*Math.sin(2*Math.PI*220*t))*.10*Math.sin(Math.PI*u)**1.6;
  }
  if(kind==='slam')v=Math.sin(2*Math.PI*(48*t+1.8*(1-Math.exp(-t*25))))*Math.exp(-t*6)*.55+air*Math.exp(-t*24)*.8+bell(t,163)*.15;
  if(kind==='shot'){const sweep=Math.sin(Math.PI*Math.min(1,t/.44))**1.25*Math.exp(-t*1.8);phase+=2*Math.PI*(260+1450*Math.exp(-t*8))/rate;v=air*sweep*.95+Math.sin(phase)*Math.exp(-t*9)*.10;}
  if(kind==='reflect')v=bell(t,1046.5)*.32+bell(Math.max(0,t-.055),1568)*.16*(t>.055?1:0)+air*Math.exp(-t*32)*.38;
  if(kind==='hit'){phase+=2*Math.PI*(145+195*Math.exp(-t*22))/rate;v=(Math.sin(phase)*.48+Math.sin(phase*2)*.12)*Math.exp(-t*12)+air*Math.exp(-t*48)*.65;}
  if(kind==='hurt')v=Math.sin(2*Math.PI*(310*t-125*t*t))*Math.exp(-t*6)*.28+air*Math.exp(-t*10)*.15;
  if(kind==='phase'){const env=Math.sin(Math.PI*u)**1.4;v=(Math.sin(t*2*Math.PI*146.83)+.45*Math.sin(t*2*Math.PI*220)+.28*Math.sin(t*2*Math.PI*293.66))*.12*env+air*env*.3;}
  if(kind==='win'){
   for(const [at,f] of [[0,587.33],[.18,698.46],[.36,880],[.62,1174.66],[1.15,880]])if(t>=at){const a=t-at;v+=(Math.sin(2*Math.PI*f*a)+.23*Math.sin(4*Math.PI*f*a))*Math.min(1,a/.025)*Math.exp(-a*2.6)*.14;}
   v+=(Math.sin(t*2*Math.PI*146.83)+Math.sin(t*2*Math.PI*220))*.055*Math.sin(Math.PI*u);
  }
  v*=Math.min(1,t/.009,(duration-t)/.04);const pan=kind==='thrust'?Math.sin((u-.5)*Math.PI)*.38:Math.sin(u*Math.PI)*.18;
  left[i]=v*(1-pan);right[i]=v*(1+pan);
 }
 const dryL=left.slice(),dryR=right.slice();
 for(const [seconds,gain] of [[.037,.18],[.083,.12],[.149,.075]]){const delay=Math.round(rate*seconds);for(let i=delay;i<n;i++){left[i]+=dryR[i-delay]*gain;right[i]+=dryL[i-delay]*gain;}}
 let peak=0;for(let i=0;i<n;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));const gain=Math.min(1,.68/Math.max(.001,peak));
 for(let i=0;i<n;i++){const tail=Math.min(1,(n-1-i)/(rate*.025));left[i]*=gain*tail;right[i]*=gain*tail;}
 return {left,right};
}
