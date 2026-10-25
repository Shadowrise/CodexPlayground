import {COSMIC,cosmicHeight,cosmicDescent,easeCosmic} from './meta-knight-cosmic';

/** Separate orbital radii/heights include atmospheres and the giant's entire ring. */
export const COSMIC_WORLDS=[
 {name:'Turquoise ocean world',kind:0,radius:75,extent:78,orbit:360,height:110,angle:-2,low:'#1a4971',high:'#65b9af',atmosphere:'#2961e0'},
 {name:'Ringed copper giant',kind:1,radius:100,extent:175,orbit:870,height:65,angle:-.8,low:'#71462b',high:'#e8ca8a',atmosphere:'#c69561',rings:['#e3bb76','#b87741','#f4dca2']},
 {name:'Violet crater moon',kind:2,radius:36,extent:38,orbit:560,height:270,angle:.25,low:'#483257',high:'#b29caa',atmosphere:'#7278b6'},
 {name:'Crimson lava world',kind:3,radius:120,extent:125,orbit:1280,height:100,angle:-3.05,low:'#1d0c14',high:'#8a2820',atmosphere:'#ff4824'},
 {name:'Cobalt ice world',kind:4,radius:65,extent:68,orbit:1600,height:430,angle:2.30,low:'#102c79',high:'#9ce8ff',atmosphere:'#5ed6ff'},
 {name:'Ochre dune world',kind:5,radius:29,extent:31,orbit:480,height:260,angle:1.05,low:'#69352b',high:'#e4b570',atmosphere:'#e8a96c'},
 {name:'Sapphire storm world',kind:6,radius:83,extent:86,orbit:1040,height:260,angle:-1.4,low:'#10163f',high:'#686de3',atmosphere:'#778dff'},
 {name:'Verdigris canyon world',kind:7,radius:65,extent:68,orbit:940,height:190,angle:-.25,low:'#164c45',high:'#9bb37a',atmosphere:'#6bd3b4'},
 {name:'Violet crystal world',kind:8,radius:95,extent:99,orbit:1050,height:90,angle:.80,low:'#422064',high:'#dc9ae8',atmosphere:'#c378ff'},
 {name:'Ember volcanic moon',kind:9,radius:55,extent:57,orbit:860,height:110,angle:1.85,low:'#251210',high:'#ae4826',atmosphere:'#ff8235'},
 {name:'Pearl cloud world',kind:10,radius:70,extent:73,orbit:1000,height:220,angle:2.80,low:'#43567c',high:'#d0e8eb',atmosphere:'#b1e3ff'},
 {name:'Rose ringed world',kind:11,radius:66,extent:116,orbit:820,height:340,angle:-2.57,low:'#6c334f',high:'#edae9e',atmosphere:'#ed98b5',rings:['#9259a7','#da86b1','#f6bfba']},
] as const;
export function cosmicWorldPosition(index:number,seconds:number){
 // A common slow orbit preserves the open sectors and separation indefinitely.
 const w=COSMIC_WORLDS[index],a=w.angle+seconds*.0007;
 return [Math.sin(a)*w.orbit,w.height,Math.cos(a)*w.orbit] as const;
}
/** The whole formation travels through the existing world, leaving the arena below. */
export function cosmicTravel(s:Parameters<typeof cosmicHeight>[0],now:number,heading:number){
 const fall=cosmicDescent(s,now),distance=fall?240*(1-easeCosmic(fall.progress)):240*cosmicHeight(s,now)/COSMIC.height;
 return [Math.sin(heading)*distance,0,Math.cos(heading)*distance] as const;
}
