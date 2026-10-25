import {META_KNIGHT_ARENA} from './meta-knight-arena-site';

export type ElectricSegment={a:readonly number[];b:readonly number[];at:number;duration:number;width:number;seed:number};
export type ElectricTip={p:readonly number[];at:number;seed:number};
const noise=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};

/** Fixed world-space paths. Only the growing tip moves; the old path never scales. */
export function buildCosmicSurface(seed:number,radius=META_KNIGHT_ARENA.radius){
 const segments:ElectricSegment[]=[],tips:ElectricTip[]=[];
 for(let ray=0;ray<36;ray++){
  const key=seed%100003+ray*719,angle=ray*Math.PI/18+(noise(key)-.5)*.13,speed=38+noise(key+3)*21,delay=noise(key+6)*140;
  const points:number[][]=[[0,.18,0]],times=[delay];let at=delay;
  for(let i=1;i<=64;i++){
   const f=i/64,r=radius*f,envelope=Math.sin(Math.PI*f),bend=(Math.sin(f*7+key)*3.4+Math.sin(f*17+key*2)*1.2+(noise(key+i*31)-.5)*1.8)*envelope;
   const heading=angle+bend/(r+3),p=[Math.sin(heading)*r,.16+noise(key+i*11)*.16,Math.cos(heading)*r],a=points[i-1],duration=Math.hypot(p[0]-a[0],p[2]-a[2])/speed*1000;
   segments.push({a,b:p,at,duration,width:(.06+noise(key+5)*.04)*(1-.35*f),seed:key+i});at+=duration;points.push(p);times.push(at);
  }
  tips.push({p:points[64],at,seed:key});
  for(let fork=0;fork<4;fork++){
   const index=12+fork*11+Math.floor(noise(key+fork)*5),sign=noise(key+fork*7)>.5?1:-1,heading=angle+sign*(.5+noise(key+fork*17)*.65),length=7+noise(key+fork*19)*14;
   let a=points[index],born=times[index]+25;
   for(let i=1;i<=18;i++){
    const distance=length/18,turn=heading+(noise(key+fork*53+i)-.5)*1.4,p=[a[0]+Math.sin(turn)*distance,.17+noise(key+i+fork*47)*.15,a[2]+Math.cos(turn)*distance];
    const outside=Math.hypot(p[0],p[2])>radius;
    if(outside){const dx=p[0]-a[0],dz=p[2]-a[2],dot=a[0]*dx+a[2]*dz,d2=dx*dx+dz*dz,t=(-dot+Math.sqrt(dot*dot+d2*(radius*radius-a[0]*a[0]-a[2]*a[2])))/d2;p[0]=a[0]+dx*t;p[2]=a[2]+dz*t;}
    const duration=Math.hypot(p[0]-a[0],p[2]-a[2])/(speed*.8)*1000;
    segments.push({a,b:p,at:born,duration,width:.04*(1-i/25),seed:key+fork*79+i});born+=duration;a=p;
    if(outside){tips.push({p,at:born,seed:key+fork*31});break;}
   }
  }
 }
 return {segments,tips,radius};
}

/** Leading flash, faint charged trail, then two restrikes travelling along the path. */
export function surfaceEnergy(age:number,seed:number,clock:number){
 const flash=Math.exp(-Math.max(0,age)/115),echo=Math.exp(-(((age-330)/65)**2))*.6+Math.exp(-(((age-660)/75)**2))*.45;
 return Math.min(1,.16+flash*.84+echo+Math.sin(clock*43+seed)**12*.05);
}
