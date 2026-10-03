import { depotFloorHeight } from './depot-floor';
import {FOUNTAIN_SITE,FOUNTAIN_WATER_Y,fountainDistance,inFountain} from './fountain-site';
import { POND_SCALE } from './landmark-sites';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import { WATER_Y, deckHeight, inWater, waterShapes, WATER_REGIONS, BRIDGES } from './pond-layout';
type Swimmer={actor:T.Group;swimming:boolean;surfaceY:number;flight:{active:boolean};roll:{active:boolean}};
let ringGeometry:T.BufferGeometry|undefined;
const ringMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.3,metalness:.08});

export function makeSwimRing(){
 const group=new T.Group();group.name='Rainbow swim ring';
 if(ringGeometry){group.add(new T.Mesh(ringGeometry,ringMaterial.clone()));group.position.y=.63;group.visible=false;return group;}
 const colors=['#ff546d','#ffab35','#ffe64a','#53da89','#45ccee','#8871ed','#ed6ccb','#ff875c'];
 for(let i=0;i<8;i++){
  const mesh=new T.Mesh(new T.TorusGeometry(1.05,.24,12,16,Math.PI/4),new T.MeshStandardMaterial({color:colors[i],roughness:.23,metalness:.08}));
  mesh.rotation.set(Math.PI/2,0,0);mesh.rotateZ(i*Math.PI/4);mesh.scale.z=.85;group.add(mesh);
 }
 const white=new T.MeshStandardMaterial({color:'#fff4df',roughness:.5});
 const rope=new T.Mesh(new T.TorusGeometry(1.34,.026,6,96),white);rope.rotation.x=Math.PI/2;group.add(rope);
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,x=Math.cos(a),z=Math.sin(a);
  const loop=new T.Mesh(new T.TorusGeometry(.09,.022,6,12),white);loop.position.set(x*1.29,0,z*1.29);loop.rotation.y=-a;group.add(loop);
  const star=new T.Shape();for(let j=0;j<10;j++){const b=j*Math.PI/5,r=j%2?.045:.095;if(j===0)star.moveTo(Math.cos(b)*r,Math.sin(b)*r);else star.lineTo(Math.cos(b)*r,Math.sin(b)*r);}star.closePath();
  const badge=new T.Mesh(new T.ShapeGeometry(star),white);badge.rotation.x=-Math.PI/2;badge.position.set(x*1.06,.241,z*1.06);group.add(badge);
 }
 for(const side of [-1,1]){
  const handle=new T.Mesh(new T.TorusGeometry(.17,.045,8,18,Math.PI),white);handle.position.set(side*1.06,.2,0);handle.rotation.y=Math.PI/2;group.add(handle);
 }
 const valve=new T.Mesh(new T.CylinderGeometry(.055,.07,.08,10),new T.MeshStandardMaterial({color:'#6845aa'}));valve.position.set(.75,.23,-.75);group.add(valve);
 // One shared geometry and one draw per swimmer, including rope and decoration.
 const parts:T.BufferGeometry[]=[],materials=new Set<T.Material>();
 group.updateMatrixWorld(true);
 group.traverse(o=>{if(!(o instanceof T.Mesh))return;const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);g.deleteAttribute('uv');const color=(o.material as T.MeshStandardMaterial).color,colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}g.setAttribute('color',new T.BufferAttribute(colors,3));parts.push(g);o.geometry.dispose();materials.add(o.material as T.Material);});
 ringGeometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.clear();group.add(new T.Mesh(ringGeometry,ringMaterial.clone()));
 group.position.y=.63;group.visible=false;return group;
}
export function showSwimRing(actor:T.Group,visible:boolean,time:number){
 let ring=actor.getObjectByName('Rainbow swim ring');
 if(!ring&&visible){ring=makeSwimRing();actor.add(ring);}if(!ring)return;
 ring.visible=visible;if(visible)ring.rotation.set(.035*Math.sin(time*2),0,.035*Math.cos(time*2.4));
}
export class Ponds {
 readonly group=new T.Group();
 private time=0;
 private texture:T.DataTexture;
 private supports=new WeakMap<Swimmer,{onBridge:boolean;base:number}>();
 constructor(){
  this.group.name='Swimmable lakes';
  const data=new Uint8Array(128*128*4);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
   const wave=Math.sin(x/128*Math.PI*8+Math.sin(y/128*Math.PI*4)*2)*Math.sin(y/128*Math.PI*6+x/128*Math.PI*4),v=Math.max(0,wave-.45)*50,i=(y*128+x)*4;
   data.set([44+v,148+v,174+v,255],i);
  }
  this.texture=new T.DataTexture(data,128,128);this.texture.colorSpace=T.SRGBColorSpace;this.texture.wrapS=this.texture.wrapT=T.RepeatWrapping;this.texture.repeat.set(.18,.18);this.texture.needsUpdate=true;
  const water=new T.MeshStandardMaterial({map:this.texture,roughness:.2,metalness:.22});
  const surface=new T.Mesh(new T.ShapeGeometry(waterShapes()),water);surface.rotation.x=-Math.PI/2;surface.position.y=WATER_Y;surface.receiveShadow=true;this.group.add(surface);
  const vertices:number[]=[],indices:number[]=[];
  for(const region of WATER_REGIONS)for(const ring of region){
   for(let i=0;i<ring.length-1;i++){
    const a=ring[i],b=ring[i+1],n=vertices.length/3;
    vertices.push(a[0],-.012,a[1],b[0],-.012,b[1],a[0],-1.3,a[1],b[0],-1.3,b[1]);indices.push(n,n+1,n+2,n+1,n+3,n+2);
   }
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
  const bank=new T.Mesh(geo,new T.MeshStandardMaterial({color:'#b4a379',roughness:1,side:T.DoubleSide}));bank.receiveShadow=true;this.group.add(bank);

 }
 update(dt:number){this.time+=dt;this.texture.offset.set(this.time*.015,this.time*.009);}
 apply(c:Swimmer,previous:T.Vector3,enabled=true){
  let support=this.supports.get(c);if(!support){support={onBridge:false,base:0};this.supports.set(c,support);}
  if(!enabled){showSwimRing(c.actor,false,this.time);c.swimming=false;c.surfaceY=0;support.base=0;support.onBridge=false;return;}
  const p=c.actor.position,size=c.actor.scale.x;
  const fountain=inFountain(p.x,p.z);
  if(fountain&&!c.flight.active){
    const dx=p.x-FOUNTAIN_SITE.x,dz=p.z-FOUNTAIN_SITE.z,d=Math.hypot(dx,dz),r=2.9+Math.min(size*.5,2);
    if(d<r){p.x=FOUNTAIN_SITE.x+(d>.001?dx/d:1)*r;p.z=FOUNTAIN_SITE.z+(d>.001?dz/d:0)*r;}
  }
  const site=BRIDGES.find(s=>Math.hypot(p.x-s.x,p.z-s.z)<8.7);
  let height=0,wet=false,bridge=false;
  if(site){
   const cos=Math.cos(site.yaw),sin=Math.sin(site.yaw);
   const local=(v:T.Vector3)=>({x:((v.x-site.x)*cos-(v.z-site.z)*sin)/POND_SCALE,z:((v.x-site.x)*sin+(v.z-site.z)*cos)/POND_SCALE});
   let {x,z}=local(p);const old=local(previous);
   const deck=Math.abs(x)<=5 && Math.abs(z)<1.3;
   bridge=deck && (support.onBridge || (Math.abs(old.x)>=4.8 && Math.abs(old.z)<1.3) || (c.flight.active && p.y>=deckHeight(x)-.12));
   if(bridge){
    const edge=Math.max(.1,1.28-Math.min(.8,size*.4/POND_SCALE));z=T.MathUtils.clamp(z,-edge,edge);
    p.x=site.x+(x*cos+z*sin)*POND_SCALE;p.z=site.z+(-x*sin+z*cos)*POND_SCALE;height=deckHeight(x);
   }else if(Math.abs(x)<5 && Math.abs(z)<1.45 && p.y+size*1.85>deckHeight(x)-.18 && p.y<deckHeight(x)){
    p.x=previous.x;p.z=previous.z;
   }
  }
  if(!bridge){wet=inWater(p.x,p.z);height=wet?WATER_Y-.63*size+.045*Math.sin(this.time*2.6):depotFloorHeight(p.x,p.z);}
  if(fountainDistance(p.x,p.z)<11.8){height=fountain?FOUNTAIN_WATER_Y-.63*size+.045*Math.sin(this.time*2.6):.12*T.MathUtils.smoothstep(11.8-fountainDistance(p.x,p.z),0,.8);wet=fountain;}
  support.onBridge=bridge;
  c.swimming=wet&&!c.flight.active&&!c.roll.active;
  // Preserve flight height relative to the support surface.
  if(c.flight.active)p.y+=height-support.base;else if(!c.roll.active)p.y=height;
  c.surfaceY=height;support.base=height;
  showSwimRing(c.actor,c.swimming,this.time);
 }
}
