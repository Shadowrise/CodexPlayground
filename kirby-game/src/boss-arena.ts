import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import polygonClipping from 'polygon-clipping';
import {BOSS_ARENA,ARENA_POSTS} from './boss-arena-site';

const COLORS=['#df6064','#eea45a','#e4cf6c','#82b975','#59bdbd','#6b91cf','#ae86c7'];
/** Static arena: merged opaque decoration, tiled ground, no update loop/lights. */
export function createBossArena(){
 const root=new T.Group();root.name='Арена Топотушки';root.position.set(BOSS_ARENA.x,0,BOSS_ARENA.z);
 const batches:T.BufferGeometry[][]=[[],[],[]];
 const sphere=new T.SphereGeometry(1,12,8),cylinder=new T.CylinderGeometry(1,1,1,10),box=new T.BoxGeometry(1,1,1),stone=new T.IcosahedronGeometry(1,0);
 const dummy=new T.Object3D(),color=new T.Color();
 function part(geo:T.BufferGeometry,c:string,pos:number[],scale=[1,1,1],rotation=[0,0,0],batch=0){
  const g=geo.index?geo.toNonIndexed():geo.clone();g.deleteAttribute('uv');dummy.position.fromArray(pos);dummy.scale.fromArray(scale);dummy.rotation.set(rotation[0],rotation[1],rotation[2]);dummy.updateMatrix();g.applyMatrix4(dummy.matrix);
  color.set(c);const a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=color.r;a[i+1]=color.g;a[i+2]=color.b;}g.setAttribute('color',new T.BufferAttribute(a,3));batches[batch].push(g);
 }
 function tube(points:T.Vector3[],radius:number,c:string,batch=0){const g=new T.TubeGeometry(new T.CatmullRomCurve3(points),Math.max(12,points.length*8),radius,5,false);part(g,c,[0,0,0],[1,1,1],[0,0,0],batch);g.dispose();}
 function band(inner:number,outer:number,c:string,start=0,length=Math.PI*2){const g=new T.RingGeometry(inner,outer,Math.max(4,Math.ceil(length*24)),1,start,length);part(g,c,[0,.025,0],[1,1,1],[-Math.PI/2,0,0],2);g.dispose();}
 const inlays:{c:string;y:number;polygon:polygonClipping.Polygon}[]=[];
 function oval(c:string,x:number,z:number,sx:number,sz:number,y=.055){
  const ring:polygonClipping.Ring=Array.from({length:24},(_,i)=>{const a=i*Math.PI/12;return [x+Math.cos(a)*sx,z+Math.sin(a)*sz];});ring.push([...ring[0]]);
  inlays.push({c,y,polygon:[ring]});
 }
 // Mipmapped repeating turf: close-up detail without a giant arena-sized texture.
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d')!;let seed=9271;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 ctx.fillStyle='#849f66';ctx.fillRect(0,0,256,256);
 for(let i=0;i<7000;i++){ctx.fillStyle=['#79955e','#8ca76b','#94ac75','#809961'][i%4];ctx.fillRect(random()*256,random()*256,1+random()*2,1+random()*4);}
 const turf=new T.CanvasTexture(canvas);turf.colorSpace=T.SRGBColorSpace;turf.wrapS=turf.wrapT=T.RepeatWrapping;turf.repeat.set(24,24);turf.anisotropy=2;
 const floorGeo=new T.RingGeometry(8.25,35.7,128);floorGeo.rotateX(-Math.PI/2);
 const floor=new T.Mesh(floorGeo,new T.MeshStandardMaterial({map:turf,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));floor.name='Arena short turf';floor.position.y=.025;floor.receiveShadow=true;root.add(floor);
 band(35.7,36,'#e7dcb2');band(36,37.1,'#c9b48b');band(38.2,40.6,'#c9b48b');band(40.6,40.85,'#e2d8b8');band(8,8.25,'#e6d4a0');
 oval('#b3c58e',0,0,8,8,.025);
 // An inlaid centipede emblem, not a collectible star.
 for(let i=0;i<7;i++){
  const z=3.6-i*1.12,x=Math.sin(i*.55)*.55;
  oval(COLORS[i],x,z,i===0?1.18:.83,i===0?1.05:.68);
  if(i>0)for(const side of [-1,1])oval('#f1e4bd',x+side*1.18,z-.08,.32,.43);
 }
 for(const side of [-1,1]){oval('#fff5d9',side*.42,3.94,.26,.32,.063);oval('#3c5353',side*.42,4.02,.105,.16,.07);oval('#ce7885',side*.88,3.56,.19,.12,.07);}
 // Keep the inlay flat, but give adjacent colours disjoint faces. Polygon offset
 // cannot fix overlapping circles in the same merged mesh at the same height.
 for(let i=0;i<inlays.length;i++){
  const layer=inlays[i],overlaps=inlays.slice(0,i).filter(p=>p.y===layer.y).map(p=>p.polygon);
  const regions=overlaps.length?polygonClipping.difference(layer.polygon,...overlaps):[layer.polygon];
  for(const region of regions){
   const points=(ring:polygonClipping.Ring)=>ring.map(([x,z])=>new T.Vector2(x,-z));
   const shape=new T.Shape(points(region[0]));for(const hole of region.slice(1))shape.holes.push(new T.Path(points(hole)));
   const g=new T.ShapeGeometry(shape);part(g,layer.c,[0,layer.y,0],[1,1,1],[-Math.PI/2,0,0],2);g.dispose();
  }
 }
 // Rainbow edging is flush, with four 12-m-wide approaches kept obstacle-free.
 for(let i=0;i<112;i++){
  const a=i*Math.PI*2/112,da=Math.PI*2/112;
  band(37.1,38.2,COLORS[Math.floor(i/16)],a+.005,da-.01);
  if(Math.abs(Math.sin(a*2))<.3)continue;
  const r=40.4;
  part(stone,i%3?'#b5b8a5':'#d4c9ad',[Math.sin(a)*r,.18,Math.cos(a)*r],[.75,.32,.72],[0,a,0]);
  if(i%2===0)part(sphere,'#729264',[Math.sin(a)*(r+.3),.25,Math.cos(a)*(r+.3)],[.43,.12,.45]);
 }
 // Four threshold carpets mark the entrances without walls or steps.
 for(let gate=0;gate<4;gate++){
  const a=gate*Math.PI/2;
  for(let j=0;j<7;j++)part(box,COLORS[j],[Math.sin(a)*(39+j*.64),.075,Math.cos(a)*(39+j*.64)],[9.6,.018,.47],[0,a,0],2);
 }
 // Birch-and-brass gate. Broad entrance and all decoration outside play radius.
 for(const side of [-1,1]){
  const x=side*7.6;
  part(cylinder,'#70634f',[x,.28,40],[1,.56,1]);part(cylinder,'#e3debd',[x,3.7,40],[.43,7.1,.43]);
  for(let j=0;j<9;j++)part(box,'#766957',[x+(j%2?-.12:.12),.9+j*.65,40+.427],[.28,.08,.025],[0,0,side*.15]);
  for(const y of [.7,6.8])part(cylinder,'#d8b966',[x,y,40],[.5,.16,.5], [0,0,0],1);
  part(sphere,COLORS[side<0?1:5],[x,7.4,40],[.58,.65,.58]);
 }
 const arch=Array.from({length:13},(_,i)=>{const x=-7.6+i*15.2/12;return new T.Vector3(x,7.35+2.15*(1-(x/7.6)**2),40);});tube(arch,.26,'#74583d');tube(arch.map(p=>p.clone().add(new T.Vector3(0,.12,.1))),.085,'#e1c580',1);
 for(let i=0;i<7;i++){const x=(i-3)*1.05;part(sphere,COLORS[i],[x,9.3+.4*(1-(x/4)**2),40],[.66,.64,.52]);}
 part(sphere,'#edbb78',[0,9.68,40.38],[.94,.84,.62]);
 for(const side of [-1,1]){
  part(sphere,'#fff4d4',[side*.34,9.91,40.93],[.23,.3,.095]);part(sphere,'#345159',[side*.34,9.91,41.01],[.105,.18,.035]);
  part(sphere,'#e89699',[side*.63,9.4,40.87],[.16,.10,.04]);
  tube([new T.Vector3(side*.5,10.27,40.35),new T.Vector3(side*.75,10.75,40.3),new T.Vector3(side*1.05,10.8,40.4)],.055,'#79618b');
  part(sphere,COLORS[side<0?4:6],[side*1.05,10.8,40.4],[.2,.2,.2]);
 }
 tube([new T.Vector3(-.24,9.35,40.96),new T.Vector3(0,9.25,41),new T.Vector3(.24,9.35,40.96)],.045,'#8e5260');
 // Readable sign on a physical wooden board, suspended from the arch.
 for(const side of [-1,1])tube([new T.Vector3(side*5,8.53,40),new T.Vector3(side*5,7.75,40)],.055,'#9c8051',1);
 part(box,'#74583d',[0,7.23,40],[12.3,1.05,.38]);part(box,'#285b61',[0,7.23,40.22],[11.9,.83,.12]);
 const signCanvas=document.createElement('canvas');signCanvas.width=1024;signCanvas.height=128;const sc=signCanvas.getContext('2d')!;
 sc.fillStyle='#285b61';sc.fillRect(0,0,1024,128);sc.fillStyle='#fff0c6';sc.font='bold 69px "Segoe UI", sans-serif';sc.textAlign='center';sc.textBaseline='middle';sc.fillText('АРЕНА ТОПОТУШКИ',512,67);
 const signTexture=new T.CanvasTexture(signCanvas);signTexture.colorSpace=T.SRGBColorSpace;signTexture.anisotropy=2;
 const sign=new T.Mesh(new T.PlaneGeometry(11.5,.74),new T.MeshStandardMaterial({map:signTexture,roughness:1}));sign.position.set(0,7.23,40.289);root.add(sign);
 // Eight planting tubs support short runs of bunting, clear of every entrance.
 for(let i=0;i<8;i++){
  const post=ARENA_POSTS[i+2],{x,z}=post;
  part(cylinder,'#867a5b',[x,.33,z],[1.18,.66,1.18]);part(cylinder,'#bba779',[x,.63,z],[1.25,.14,1.25]);part(cylinder,'#597445',[x,.72,z],[1.08,.09,1.08]);
  part(cylinder,'#e6d7b4',[x,3.72,z],[.17,6,.17]);part(sphere,COLORS[i%7],[x,6.9,z],[.35,.42,.35]);
  for(let flower=0;flower<12;flower++){
   const a=flower*2.399,r=.35+(flower%3)*.25,fx=x+Math.sin(a)*r,fz=z+Math.cos(a)*r,h=.95+(flower%3)*.14;
   part(cylinder,'#527b4b',[fx,(h+.76)/2,fz],[.025,h-.76,.025]);
   for(let petal=0;petal<5;petal++){const p=petal*Math.PI*2/5;part(stone,COLORS[(i+flower)%7],[fx+Math.sin(p)*.11,h,fz+Math.cos(p)*.11],[.105,.045,.105]);}
   part(stone,'#f2d078',[fx,h+.025,fz],[.06,.04,.06]);
  }
 }
 for(let run=0;run<4;run++){
  const a=ARENA_POSTS[2+run*2],b=ARENA_POSTS[3+run*2];
  const at=(u:number)=>new T.Vector3(T.MathUtils.lerp(a.x,b.x,u),6.6-1.2*Math.sin(u*Math.PI),T.MathUtils.lerp(a.z,b.z,u));
  tube(Array.from({length:9},(_,i)=>at(i/8)),.045,'#c2a875');
  for(let flag=0;flag<13;flag++){
   const u=(flag+.6)/13.2,c=at(u),tangent=at(Math.min(1,u+.01)).sub(c).normalize(),left=c.clone().addScaledVector(tangent,-.55),right=c.clone().addScaledVector(tangent,.55),tip=c.clone().add(new T.Vector3(.07,-1.15,.03));
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([...left.toArray(),...right.toArray(),...tip.toArray(),...right.toArray(),...left.toArray(),...tip.toArray()],3));geo.computeVertexNormals();part(geo,COLORS[(flag+run)%7],[0,0,0]);geo.dispose();
  }
 }
 for(let i=0;i<batches.length;i++){
  const geometry=mergeGeometries(batches[i]);batches[i].forEach(g=>g.dispose());
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:i===1?.35:.91,metalness:i===1?.4:0,polygonOffset:i===2,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const mesh=new T.Mesh(geometry,material);mesh.name=['Arena merged decorations','Arena brass details','Arena inlaid paths'][i];mesh.receiveShadow=i!==1;root.add(mesh);
 }
 // Deliberately no fine flag/flower shadows: static detail adds no shadow draws.
 for(const geo of [sphere,cylinder,box,stone])geo.dispose();
 root.userData.playRadius=BOSS_ARENA.playRadius;
 return root;
}
