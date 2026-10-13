/** Shared placement and reach; no rendering dependencies in the Worker. */
export const FLOWER_SOUND_SECONDS=2.05;
export const FLOWER_NOTE_COOLDOWN_MS=180;
export const MUSICAL_FLOWER_SITE={x:10,z:-70,radius:12.5} as const;
const FLOWER_ARC_RADIUS=9.2;
export const MUSICAL_FLOWERS=[
 {note:'До',color:'#ec7589',midi:72},
 {note:'Ре',color:'#efa060',midi:74},
 {note:'Ми',color:'#e8ce68',midi:76},
 {note:'Фа',color:'#80c18b',midi:77},
 {note:'Соль',color:'#73c5dc',midi:79},
 {note:'Ля',color:'#8998ec',midi:81},
 {note:'Си',color:'#b591e4',midi:83},
].map((flower,i)=>{
 const angle=-Math.PI/2+i*Math.PI/6;
 return {...flower,x:MUSICAL_FLOWER_SITE.x+Math.sin(angle)*FLOWER_ARC_RADIUS,z:MUSICAL_FLOWER_SITE.z-Math.cos(angle)*FLOWER_ARC_RADIUS,yaw:-angle,height:2.5+[.05,.25,-.08,.12,.28,-.04,.15][i]};
});
export function validFlowerIndex(value:unknown):value is number{return Number.isInteger(value)&&Number(value)>=0&&Number(value)<MUSICAL_FLOWERS.length;}
export function canPlayFlower(index:unknown,p:{x:number;y:number;z:number},size:number){
 if(!validFlowerIndex(index)||!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.z)||!Number.isFinite(size))return false;
 const f=MUSICAL_FLOWERS[index],reach=2.05+.45*Math.max(.3,Math.min(3,size));
 return p.y>=-.8&&p.y<3.6&&(p.x-f.x)**2+(p.z-f.z)**2<=reach*reach;
}
export function outsideMusicalFlowers(x:number,z:number,padding=0){return (x-MUSICAL_FLOWER_SITE.x)**2+(z-MUSICAL_FLOWER_SITE.z)**2>(1.4+padding)**2&&MUSICAL_FLOWERS.every(f=>(x-f.x)**2+(z-f.z)**2>(1.3+padding)**2);}
/** Keep a real lawn between the blooms; crowns and trails stay around its edge. */
export function outsideMusicalFlowerClearing(x:number,z:number,padding=0){return (x-MUSICAL_FLOWER_SITE.x)**2+(z-MUSICAL_FLOWER_SITE.z)**2>(MUSICAL_FLOWER_SITE.radius+padding)**2;}
