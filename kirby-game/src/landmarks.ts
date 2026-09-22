import * as T from 'three';
import { BALLOON_SITES } from './balloon-sites';

export const LANDMARKS = Array.from({length:25},(_,i) => ({
  x: i===12 ? 32 : (i%5-2)*94 + Math.sin(i*8)*9,
  z: i===12 ? 34 : (Math.floor(i/5)-2)*94 + Math.cos(i*5)*9,
  kind: (i===12 ? 0 : i%6), radius: (i===12 || i%6===0) ? 25 : 15,
}));
export function sceneryClearance(x:number,z:number,padding=0) {
  return BALLOON_SITES.every(p=>Math.hypot(x-p.x,z-p.z)>22+padding) && Math.hypot(x-135,z-45)>25+padding && LANDMARKS.every(p=>Math.hypot(x-p.x,z-p.z)>p.radius+padding);
}
export function outsideLandmarks(x:number,z:number,padding=0) {
  for(const p of [...LANDMARKS,{x:135,z:45,radius:25},...BALLOON_SITES.map(p=>({...p,radius:22}))]) {
    const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz),r=p.radius+padding;
    if(d<=r) { const a=d>.001?Math.atan2(dz,dx):0; x=p.x+Math.cos(a)*(r+.1);z=p.z+Math.sin(a)*(r+.1); }
  }
  return {x,z};
}

/** Shared primitive meshes are batched into instances after composing each scene. */
export function createLandmarks() {
  const root=new T.Group(); root.name='Ponds, flowers, mushrooms, rocks, picnics and ruins';
  const geo={box:new T.BoxGeometry(1,1,1),ball:new T.SphereGeometry(1,12,8),rock:new T.IcosahedronGeometry(1,1),
    pole:new T.CylinderGeometry(1,1,1,10),cap:new T.SphereGeometry(1,16,8,0,Math.PI*2,0,Math.PI/2),
    ring:new T.TorusGeometry(1,.025,4,32)};
  const materials=new Map<string,T.MeshStandardMaterial>();
  function put(g:T.Group,k:keyof typeof geo,c:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,rx=0,ry=0,rz=0) {
    if(!materials.has(c)) materials.set(c,new T.MeshStandardMaterial({color:c,roughness:c==='#51b7cc'?.22:.92}));
    const m=new T.Mesh(geo[k],materials.get(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.set(rx,ry,rz);g.add(m);return m;
  }
  const rock=(g:T.Group,x:number,z:number,s=1)=>{
    put(g,'rock','#838779',x,.6*s,z,1.2*s,.85*s,s,0,x, .14);
    put(g,'rock','#526846',x-.15*s,1.19*s,z,.8*s,.17*s,.65*s);
    put(g,'box','#585f53',x,.93*s,z+.79*s,.045*s,.42*s,.04*s,0,.3,.45);
  };
  function flowers(g:T.Group,cx:number,cz:number,count:number) {
    for(let i=0;i<count;i++) {
      const a=i*2.399,r=Math.sqrt((i+.5)/count)*5,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;
      const h=.4+(i%5)*.12;
      put(g,'pole','#477447',x,h/2,z,.025,h,.025);
      put(g,'ball','#639b47',x+.12,h*.5,z,.18,.045,.09,0,.4,.4);
      for(let j=0;j<5;j++) {const b=j*Math.PI*2/5;put(g,'ball',['#fff4dc','#9f91d9','#f5ce53'][i%3],x+Math.cos(b)*.15,h,z+Math.sin(b)*.15,.13,.06,.09,0,-b);}
      put(g,'ball','#e5aa35',x,h+.025,z,.085,.06,.085);
    }
  }
  function bench(g:T.Group,x:number,z:number) {
    for(let i=0;i<3;i++) put(g,'box','#a57a50',x,1.0,z+(i-1)*.25,3,.14,.22);
    for(const side of [-1,1]) put(g,'box','#6e513b',x+side, .48,z,.2,.95,.65);
    put(g,'box','#ad8458',x,1.65,z+.48,3,.4,.12);
    for(const side of [-1,1]) put(g,'box','#6e513b',x+side,1.15,z+.48,.13,1.4,.13);
  }
  for(const site of LANDMARKS) {
    const g=new T.Group();g.position.set(site.x,0,site.z);root.add(g);
    if(site.kind===0) {
      // Shallow decorative pond, an enclosed stream and a low arched boardwalk.
      put(g,'ball','#b5a982',0,-.18,0,12,.28,8.5);
      put(g,'ball','#51b7cc',0,-.12,0,11.3,.22,7.8);
      for(let i=0;i<11;i++) {
        const z=6+i*1.35,x=Math.sin(i*.45)*1.2;
        put(g,'ball','#b5a982',x,-.09,z,2.4,.16,1.5);
        put(g,'ball','#51b7cc',x,-.05,z,1.8,.14,1.45);
      }
      for(let i=0;i<36;i++) {const a=i*Math.PI*2/36;rock(g,Math.cos(a)*11.8,Math.sin(a)*8.2,.4+(i%4)*.12);}
      for(let i=0;i<18;i++) {
        const x=(i-8.5)*.36,y=.22+.28*Math.cos(x/3.5*Math.PI/2);
        put(g,'box','#a37a4c',x,y,12,.33,.14,2.6);
      }
      for(const z of [10.55,13.45]) {
        for(const x of [-3,-1.5,0,1.5,3]) put(g,'pole','#77553b',x,.9,z,.07,1.65,.07);
        put(g,'box','#bd935f',0,1.65,z,6.5,.09,.09);
      }
      for(let i=0;i<8;i++) {
        const a=i*2.4,x=Math.cos(a)*7,z=Math.sin(a)*4;
        put(g,'ball','#4b8c53',x,.12,z,.7,.055,.55);
        for(let j=0;j<5;j++) {const b=j*1.256;put(g,'ball','#f4b6ca',x+Math.cos(b)*.16,.23,z+Math.sin(b)*.16,.2,.12,.1,0,-b);}
        put(g,'ring','#95d8d6',x,.12,z,1.1,1.1,1.1,Math.PI/2);
      }
      for(let i=0;i<24;i++) {const a=i*.8,x=Math.cos(a)*12.3,z=Math.sin(a)*8.6,h=1.1+i%4*.2;
        put(g,'pole','#5b7846',x,h/2,z,.035,h,.035);put(g,'pole','#795535',x,h,z,.09,.35,.09);}
      flowers(g,-15,-3,38);
    } else if(site.kind===1) flowers(g,0,0,120);
    else if(site.kind===2) {
      put(g,'pole','#75503b',-2,.65,0,1.2,1.3,1.2);
      put(g,'pole','#c9a574',-2,1.31,0,1.08,.04,1.08);
      for(const r of [.4,.7,.95])put(g,'ring','#8c6646',-2,1.34,0,r,r,r,Math.PI/2);
      put(g,'pole','#75503b',3,.65,1,.65,6,.65,0,0,Math.PI/2);
      for(const x of [0,6])put(g,'pole','#c9a574',x,.65,1,.57,.04,.57,0,0,Math.PI/2);
      for(let i=0;i<30;i++) {const a=i*2.4,r=2+Math.sqrt(i/30)*6,x=Math.cos(a)*r,z=Math.sin(a)*r,h=.25+(i%4)*.16;
        put(g,'pole','#ebdab4',x,h/2,z,.09,h,.09);
        put(g,'cap',i%3?'#b34035':'#9b744d',x,h,z,h*.8,h*.45,h*.8);
        for(let j=0;j<4;j++) {const b=j*1.57;put(g,'ball','#f7e5cf',x+Math.cos(b)*h*.4,h+h*.34,z+Math.sin(b)*h*.4,.055,.025,.055);}
      }
      for(let i=0;i<6;i++)put(g,'rock','#607949',Math.sin(i*2)*4,.1,Math.cos(i*2)*4,1.1,.15,.7);
    } else if(site.kind===3) {
      for(let i=0;i<10;i++)rock(g,Math.sin(i*2.4)*(2+i*.5),Math.cos(i*2.4)*(2+i*.5),.5+(i%4)*.5);
      flowers(g,4,-4,25);
    } else if(site.kind===4) {
      for(let i=0;i<8;i++)for(let j=0;j<6;j++)put(g,'box',(i+j)%2?'#fff0da':'#c97773',(i-3.5)*.6,.025,(j-2.5)*.6,.6,.045,.6);
      put(g,'box','#aa7945',1,.48,.7,1.1,.8,.75);
      for(let i=0;i<5;i++)put(g,'box','#d0a46b',1,.16+i*.15,.7,1.16,.05,.79);
      put(g,'ring','#8f623b',1,1.04,.7,.5,.48,.4);
      for(let i=0;i<3;i++)put(g,'ball',['#d4573e','#e5a836','#8eaa47'][i],.7+i*.27,.94,.7,.2,.19,.2);
      bench(g,0,4);bench(g,-5,-2);flowers(g,5,-5,32);
    } else {
      const stone='#a3a48d';
      for(const x of [-3,3])for(let j=0;j<5;j++)put(g,'box',stone,x,.48+j*.91,0,1.3,.85,1.5,0,j%2*.03);
      for(let j=0;j<11;j++) {const a=j*Math.PI/10;put(g,'box',stone,Math.cos(a)*3,4.15+Math.sin(a)*3,0,.96,.9,1.5,0,0,a-Math.PI/2);}
      for(const x of [-6,6]) {put(g,'box',stone,x,.18,3,2,.36,2);put(g,'pole',stone,x,1.35,3,.55,2.4,.55);put(g,'box',stone,x,2.6,3,1.5,.3,1.5);}
      for(let i=0;i<6;i++)rock(g,Math.sin(i*2)*7,4+Math.cos(i*2)*3,.45);
      for(let i=0;i<26;i++)put(g,'ball','#487947',-3+Math.sin(i*.7)*.5,.3+i*.19,-.84,.25,.19,.07,0,0,i);
      flowers(g,6,-4,30);
    }
  }
  root.updateMatrixWorld(true);
  const batches=new Map<string,{geometry:T.BufferGeometry; material:T.Material; matrices:T.Matrix4[]}>();
  root.traverse(o=>{if(o instanceof T.Mesh){const key=o.geometry.uuid+(o.material as T.Material).uuid;
    if(!batches.has(key))batches.set(key,{geometry:o.geometry,material:o.material as T.Material,matrices:[]});
    batches.get(key)!.matrices.push(o.matrixWorld.clone());}});
  root.clear();
  for(const b of batches.values()){const m=new T.InstancedMesh(b.geometry,b.material,b.matrices.length);b.matrices.forEach((v,i)=>m.setMatrixAt(i,v));m.castShadow=true;m.receiveShadow=true;root.add(m);}
  return root;
}
