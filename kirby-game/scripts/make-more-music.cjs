const fs=require('node:fs'),path=require('node:path');
// Independently composed themes: distinct metre, phrasing, harmony and instrumentation.
const themes=[
 {id:'lagoon-bossa',bpm:104,meter:4,bars:48,key:60,voice:'piano',back:'guitar',style:'bossa',roots:[0,9,2,7,4,9,5,7],minor:[1,2,4,5],motif:[7,9,7,4,2,4],rhythm:[0,.75,1.5,2.5,3,3.5]},
 {id:'carousel-waltz',bpm:88,meter:3,bars:56,key:65,voice:'reed',back:'pizz',style:'waltz',roots:[0,5,0,7,9,2,7,0],minor:[4,5],motif:[4,7,12,11,7],rhythm:[0,1,1.5,2,2.5]},
 {id:'button-swing',bpm:108,meter:4,bars:56,key:60,voice:'vibes',back:'piano',style:'swing',roots:[0,9,2,7,0,5,2,7],minor:[1,2,6],motif:[0,7,9,12,9,4],rhythm:[0,.67,1.67,2,2.67,3.67]},
 {id:'kite-festival',bpm:150,meter:6,bars:48,key:62,voice:'pizz',back:'harp',style:'folk',roots:[0,7,5,0,9,5,7,0],minor:[4],motif:[0,2,4,7,4,2,0],rhythm:[0,1,2,3,4,4.5,5]},
 {id:'coconut-bay',bpm:82,meter:4,bars:40,key:67,voice:'steel',back:'reed',style:'reggae',roots:[0,5,0,7,9,5,2,7],minor:[4,6],motif:[7,4,0,2,7],rhythm:[.5,1.25,2,2.75,3.5]},
 {id:'roller-disco',bpm:122,meter:4,bars:60,key:59,voice:'synth',back:'piano',style:'disco',roots:[0,9,5,7,4,9,2,7],minor:[1,4,5,6],motif:[0,0,7,12,9,7,4],rhythm:[0,.5,1.25,1.75,2.5,3,3.75]},
 {id:'wish-lanterns',bpm:72,meter:4,bars:36,key:60,voice:'celesta',back:'harp',style:'box',roots:[0,4,5,0,9,2,7,0],minor:[1,4,5],motif:[12,7,4,9,7],rhythm:[0,1,1.5,2.5,3.25]},
];
const selectedTrack=process.argv[2];
if(selectedTrack&&!themes.some(t=>t.id===selectedTrack))throw Error('Unknown track: '+selectedTrack);
for(const [index,c] of themes.entries()){
 if(selectedTrack&&c.id!==selectedTrack)continue;
 const rate=22050,beat=60/c.bpm,seconds=c.bars*c.meter*beat,length=Math.round(seconds*rate),L=new Float32Array(length),R=new Float32Array(length);
 let seed=781+index*391;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 function mix(start,duration,fn,volume,pan=0,echo=false){const offset=Math.round(start*rate),n=Math.ceil(duration*rate),lg=Math.sqrt((1-pan)/2),rg=Math.sqrt((1+pan)/2);
  for(let i=0;i<n;i++){const t=i/rate,v=fn(t,duration)*volume,j=offset+i;if(j>=length)break;L[j]+=v*lg;R[j]+=v*rg;if(echo){const k=j+Math.round(beat*.75*rate);if(k<length){L[k]+=v*rg*.12;R[k]+=v*lg*.12;}}}
 }
 function note(midi,start,duration,kind,volume,pan=0){const f=440*2**((midi-69)/12),w=2*Math.PI*f;
  mix(start,duration,(t,d)=>{const attack=Math.min(1,t/.012),release=Math.min(1,(d-t)/.08),s=Math.sin(w*t);let tone=0,env=1;
   switch(kind){
    case 'piano':tone=s+.26*Math.sin(w*2*t)+.09*Math.sin(w*3*t);env=Math.exp(-t*3);break;
    case 'guitar':tone=s+.32*Math.sin(w*2*t)+.16*Math.sin(w*3*t)+.05*Math.sin(w*5*t);env=Math.exp(-t*5);break;
    case 'reed':tone=s+.27*Math.sin(w*2*t)+.2*Math.sin(w*3*t)+.07*Math.sin(w*4*t);env=Math.min(1,t/.06)*(.94+.06*Math.sin(t*29));break;
    case 'pizz':tone=s+.4*Math.sin(w*2*t)*Math.exp(-t*8)+.2*Math.sin(w*3*t);env=Math.exp(-t*7);break;
    case 'harp':tone=s+.24*Math.sin(w*2*t)+.1*Math.sin(w*3*t);env=Math.exp(-t*2.8);break;
    case 'vibes':tone=s+.12*Math.sin(w*2*t)*Math.exp(-t*4)+.035*Math.sin(w*4*t)*Math.exp(-t*7);env=Math.exp(-t*2.6)*(.97+.03*Math.cos(t*24));break;
    case 'steel':tone=s+.38*Math.sin(w*2*t)*Math.exp(-t*7)+.16*Math.sin(w*3.03*t)*Math.exp(-t*12);env=Math.exp(-t*3.7);break;
    case 'synth':tone=s+.23*Math.sin(w*2*t+.1*Math.sin(t*24))+.12*Math.sin(w*3*t);env=Math.exp(-t*2);break;
    case 'celesta':tone=s+.27*Math.sin(w*2.76*t)*Math.exp(-t*4)+.07*Math.sin(w*5.4*t)*Math.exp(-t*9);env=Math.exp(-t*1.8);break;
    case 'bass':tone=s+.22*Math.sin(w*2*t);env=Math.exp(-t*4);break;
   }return tone*env*attack*release;
  },volume,pan,c.style!=='swing');
 }
 function drum(at,type,volume){mix(at,type==='kick'?.18:.1,(t,d)=>{const fade=Math.min(1,t*500)*Math.min(1,(d-t)*70);return fade*Math.exp(-t*(type==='hat'?55:28))*(type==='kick'?Math.sin(2*Math.PI*(47*t+1.1*(1-Math.exp(-t*32)))):type==='rim'?(.6*Math.sin(2*Math.PI*780*t)+.4*(random()*2-1)):random()*2-1);},volume,type==='hat'?.45:-.15);}
 // Hand-voiced eight-bar C-major swing: melody, bass and chords share one score.
 const swingChords=[[60,64,67],[60,64,69],[62,65,69],[59,62,67],[60,65,69],[60,64,67],[59,62,67],[60,64,67]];
 const swingBass=[48,45,50,43,41,48,43,48];
 const swingA=[[76,79,76,74,72,76],[76,72,69,72,76,72],[74,77,76,74,72,69],[71,74,77,76,74,71],[72,77,76,74,72,69],[72,76,79,76,74,72],[74,71,67,71,74,71],[72,76,74,72]];
 const swingB=[[79,76,72,74,76,79],[81,79,76,72,69,72],[77,74,69,72,74,77],[79,77,74,71,74,71],[77,81,79,77,76,72],[76,79,76,74,72,76],[77,74,71,74,71,67],[72,74,76,72]];
 for(let bar=0;bar<c.bars;bar++){
  if(c.style==='swing'){
   const start=bar*4*beat,ci=bar%8,section=Math.floor(bar/8),ending=bar===c.bars-1;
   const melody=(section===2||section===3?swingB:swingA)[ci];
   const rhythm=ci===7?[0,1,2,8/3]:[0,2/3,1,2,8/3,3];
   const phrase=ending?[72]:melody;
   phrase.forEach((pitch,n)=>{
    if(section===0&&bar<2&&n%2===1)return;
    const at=ending?0:rhythm[n],next=ending?3.6:(rhythm[n+1]??3.85);
    note(pitch,start+at*beat,(next-at)*beat*.84,'vibes',.082,-.12);
   });
   // Soft offbeat chords leave space for the lead; no delayed notes cross harmonies.
   for(const at of ending?[0]:[2/3,8/3])swingChords[ci].forEach((pitch,j)=>note(pitch,start+(at+j*.015)*beat,.46*beat,'piano',.022,(j-1)*.28));
   const bass=swingBass[ci];
   for(const [n,at] of (ending?[0]:[0,2]).entries())note(bass+(n?7:0),start+at*beat,beat*1.1,'bass',.075,.05);
   if(!ending)for(let b=0;b<4;b++){
    if(b===0||b===2)drum(start+b*beat,'kick',.018);
    drum(start+(b+2/3)*beat,'hat',.004);
   }
   continue;
  }
  const section=Math.floor(bar/(c.bars/4)),ci=bar%8,root=c.key+c.roots[ci],third=c.minor.includes(ci)?3:4,chord=[root,root+third,root+7,root+ (third===3?10:11)],start=bar*c.meter*beat;
  // Breathing space and a contrasting middle register, then a fuller final return.
  const leadGain=section===0?.085:section===3?.1:.09;
  if(bar%8!==7 || section===3)for(let n=0;n<c.motif.length;n++){
   if(section===0 && bar<4 && n%2)continue;
   let interval=c.motif[(n+(section===2?2:0)+(bar%4===3?1:0))%c.motif.length];if(third===3 && interval===4)interval=3;if(third===3 && interval===11)interval=10;
   const at=c.rhythm[n],next=c.rhythm[n+1]??c.meter;
   note(root+interval+(c.style==='box'?12:0)+(section===2?-12:0),start+at*beat,Math.max(.16,(next-at)*beat*.85)+.16,c.voice,leadGain,-.15);
  }
  const strums=c.style==='waltz'?[1,2]:c.style==='reggae'?[.5,1.5,2.5,3.5]:c.style==='bossa'?[0,1.5,2.5]:c.style==='folk'?[0,3]:c.style==='box'?[0,2]:[.5,1.5,2.5,3.5];
  for(const b of strums)for(let j=0;j<3;j++)note(chord[j],start+(b+j*.025)*beat,c.style==='reggae'?.18:beat*.9,c.back,.027,(j-1)*.5);
  const bassBeats=c.style==='swing'?[0,1,2,3]:c.style==='folk'?[0,3]:c.style==='waltz'?[0]:[0,2];
  bassBeats.forEach((b,j)=>note(root-24+(j%2?7:0),start+b*beat,beat*.85,'bass',.105,0));
  if(c.style==='box'){
   for(let n=0;n<8;n++)note(chord[n%4]+12,start+n*.5*beat,1.1,'harp',.024,.55);
  }else{
   for(let b=0;b<c.meter;b++){
    if(c.style==='disco'||b===0||(c.style==='reggae'?b===2:c.style==='folk'?b===3:b===2))drum(start+b*beat,'kick',c.style==='disco'?.075:.045);
    if(c.style==='reggae'?b===2:b%2===1)drum(start+b*beat,'rim',.019);
    drum(start+(b+(c.style==='swing'?.67:.5))*beat,'hat',.011);
   }
  }
  if(section===1||section===3){const offset=c.style==='folk'?3:Math.max(1,c.meter-1);note(chord[2]+12,start+offset*beat,beat*.75,'harp',.032,.65);}
 }
 // Soft entrances/endings for sequential playback; same headroom as the first collection.
 let meanL=0,meanR=0;for(let i=0;i<length;i++){meanL+=L[i];meanR+=R[i];}meanL/=length;meanR/=length;
 let peak=0;for(let i=0;i<length;i++){const fade=Math.min(1,i/(rate*.12),(length-1-i)/(rate*1.3));L[i]=Math.tanh((L[i]-meanL)*1.2)*fade;R[i]=Math.tanh((R[i]-meanR)*1.2)*fade;peak=Math.max(peak,Math.abs(L[i]),Math.abs(R[i]));}
 const gain=.68/peak,data=Buffer.alloc(length*4);let energy=0;
 for(let i=0;i<length;i++){const l=L[i]*gain,r=R[i]*gain;energy+=(l*l+r*r)/2;data.writeInt16LE(Math.round(l*32767),i*4);data.writeInt16LE(Math.round(r*32767),i*4+2);}
 const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(36+data.length,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(2,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*4,28);h.writeUInt16LE(4,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(data.length,40);
 fs.writeFileSync(path.resolve(__dirname,`../public/audio/${c.id}.wav`),Buffer.concat([h,data]));console.log(JSON.stringify({track:c.id,style:c.style,seconds,rms:Math.sqrt(energy/length),peak:.68}));
}
