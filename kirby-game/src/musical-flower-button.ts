import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {musicalNoteGeometry} from './musical-flowers';
import {MUSICAL_FLOWER_SITE as SITE,MUSICAL_FLOWERS} from './musical-flower-site';

/** A rounded garden music button, two matte draws and no extra lighting. */
export class MusicalFlowerButton {
 readonly group=new T.Group();
 private cap:T.Mesh;
 private material=new T.MeshLambertMaterial({vertexColors:true,emissive:'#3c8c68'});
 constructor(){
  this.group.name='Flower melody start button';this.group.position.set(SITE.x,0,SITE.z);
  const pieces:T.BufferGeometry[]=[],top:T.BufferGeometry[]=[];
  const add=(parts:T.BufferGeometry[],g:T.BufferGeometry,color:string,x=0,y=0,z=0,rx=0)=>{
   if(g.index){const indexed=g;g=indexed.toNonIndexed();indexed.dispose();}
   g.rotateX(rx);g.translate(x,y,z);const c=new T.Color(color),data=new Float32Array(g.attributes.position.count*3);
   for(let i=0;i<data.length;i+=3)data.set([c.r,c.g,c.b],i);g.setAttribute('color',new T.BufferAttribute(data,3));g.deleteAttribute('uv');parts.push(g);
  };
  add(pieces,new T.LatheGeometry([[0,0],[1.25,0],[1.42,.09],[1.42,.2],[1.32,.28],[1.15,.36],[1.04,.43],[0,.43]].map(([x,y])=>new T.Vector2(x,y)),40),'#d4c7a8');
  add(pieces,new T.TorusGeometry(1.18,.055,6,40),'#f1ddb1',0,.34,0,Math.PI/2);
  for(let i=0;i<7;i++){const angle=i*Math.PI*2/7,g=new T.SphereGeometry(.11,9,6);g.scale(1,.35,1);add(pieces,g,MUSICAL_FLOWERS[i].color,Math.sin(angle)*1.28,.28,Math.cos(angle)*1.28);}
  add(top,new T.LatheGeometry([[0,0],[.84,0],[.99,.07],[1,.15],[.92,.23],[0,.23]].map(([x,y])=>new T.Vector2(x,y)),40),'#7dccaa');
  add(top,new T.TorusGeometry(.84,.025,5,40),'#eff0c1',0,.234,0,Math.PI/2);
  const note=musicalNoteGeometry();note.scale(.8,.8,.8);add(top,note,'#fff2bb',.04,.242,0,-Math.PI/2);
  const merge=(parts:T.BufferGeometry[])=>{const g=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());return g;};
  const base=new T.Mesh(merge(pieces),new T.MeshLambertMaterial({vertexColors:true}));base.receiveShadow=true;this.group.add(base);
  this.cap=new T.Mesh(merge(top),this.material);this.cap.position.y=.43;this.group.add(this.cap);
 }
 update(active:boolean,now:number){this.cap.position.y=active?.40:.43;this.material.emissiveIntensity=active?.16:.08+.025*Math.sin(now/650);}
 constrain(p:T.Vector3,size:number){
  if(p.y>.75)return;const dx=p.x-SITE.x,dz=p.z-SITE.z,d=Math.hypot(dx,dz),r=1.42+.5*Math.min(3,size);
  if(d<r){p.x=SITE.x+(d>.001?dx/d:0)*r;p.z=SITE.z+(d>.001?dz/d:1)*r;}
 }
}
