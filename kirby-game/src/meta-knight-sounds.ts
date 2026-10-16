/** Original layered duel effects. No downloads; cached stereo PCM on the sound bus. */
export type KnightSound='warn'|'slash'|'dash'|'slam'|'shot'|'reflect'|'hit'|'hurt'|'phase'|'win';
export const KNIGHT_SOUND_RATE=44100;
export function knightSound(kind:KnightSound,rate=KNIGHT_SOUND_RATE){
 const duration={warn:.85,slash:.6,dash:.9,slam:1.25,shot:1,reflect:1.2,hit:.8,hurt:.7,phase:1.8,win:3}[kind],n=Math.ceil(rate*duration);
 const left=new Float32Array(n),right=new Float32Array(n);let seed=907+kind.length*311,low=0,slow=0,phase=0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1;};
 const bell=(t:number,f:number)=>Math.sin(2*Math.PI*f*t)*Math.exp(-t*5)+.28*Math.sin(2*Math.PI*f*2.76*t)*Math.exp(-t*13)+.12*Math.sin(2*Math.PI*f*4.07*t)*Math.exp(-t*21);
 for(let i=0;i<n;i++){
  const t=i/rate,u=t/duration,noise=random();low+=(noise-low)*.14;slow+=(low-slow)*.035;const air=low-slow;let v=0;
  if(kind==='warn')v=air*Math.sin(Math.PI*u)**1.6*.45+bell(t,440+160*u)*.1*(1-u)+Math.sin(t*2*Math.PI*110)*Math.sin(Math.PI*u)*.08;
  if(kind==='slash'){phase+=2*Math.PI*(1450*Math.exp(-t*11)+170)/rate;v=(air*.85+Math.sin(phase)*.13)*Math.sin(Math.PI*Math.min(1,t/.42))**1.5+bell(t,1800)*.045;}
  if(kind==='dash')v=air*Math.sin(Math.PI*u)**1.4*.8+Math.sin(2*Math.PI*(72*t+30*t*t))*.11*Math.sin(Math.PI*u);
  if(kind==='slam')v=Math.sin(2*Math.PI*(48*t+1.8*(1-Math.exp(-t*25))))*Math.exp(-t*6)*.55+air*Math.exp(-t*24)*.8+bell(t,163)*.15;
  if(kind==='shot')v=bell(t,587.33)*.23+bell(Math.max(0,t-.045),880)*.13*(t>.045?1:0)+air*Math.sin(Math.PI*u)*.17;
  if(kind==='reflect')v=bell(t,1046.5)*.32+bell(Math.max(0,t-.055),1568)*.16*(t>.055?1:0)+air*Math.exp(-t*32)*.38;
  if(kind==='hit')v=bell(t,659.25)*.27+bell(t,218)*.18+air*Math.exp(-t*30)*.45;
  if(kind==='hurt')v=Math.sin(2*Math.PI*(310*t-125*t*t))*Math.exp(-t*6)*.28+air*Math.exp(-t*10)*.15;
  if(kind==='phase'){const env=Math.sin(Math.PI*u)**1.4;v=(Math.sin(t*2*Math.PI*146.83)+.45*Math.sin(t*2*Math.PI*220)+.28*Math.sin(t*2*Math.PI*293.66))*.12*env+air*env*.3;}
  if(kind==='win'){
   for(const [at,f] of [[0,587.33],[.18,698.46],[.36,880],[.62,1174.66],[1.15,880]])if(t>=at){const a=t-at;v+=(Math.sin(2*Math.PI*f*a)+.23*Math.sin(4*Math.PI*f*a))*Math.min(1,a/.025)*Math.exp(-a*2.6)*.14;}
   v+=(Math.sin(t*2*Math.PI*146.83)+Math.sin(t*2*Math.PI*220))*.055*Math.sin(Math.PI*u);
  }
  v*=Math.min(1,t/.009,(duration-t)/.04);const pan=Math.sin(u*Math.PI)*.18;
  left[i]=v*(1-pan);right[i]=v*(1+pan);
 }
 const dryL=left.slice(),dryR=right.slice();
 for(const [seconds,gain] of [[.037,.18],[.083,.12],[.149,.075]]){const delay=Math.round(rate*seconds);for(let i=delay;i<n;i++){left[i]+=dryR[i-delay]*gain;right[i]+=dryL[i-delay]*gain;}}
 let peak=0;for(let i=0;i<n;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));const gain=Math.min(1,.68/Math.max(.001,peak));
 for(let i=0;i<n;i++){const tail=Math.min(1,(n-1-i)/(rate*.025));left[i]*=gain*tail;right[i]*=gain*tail;}
 return {left,right};
}
