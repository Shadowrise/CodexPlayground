import {Float32BufferAttribute,Mesh,Object3D,Vector3} from 'three';
import type {Emote} from './emotes';
const kinds:Emote[]=['Hello','Joy','Fear','Anger','Sad'];
type FacePart={mesh:Mesh;indices:number[]};
const faces=new WeakMap<Object3D,FacePart[]>();
/** Deform the surface itself, keeping every facial feature on Kirby's curved body. */
function prepare(root:Object3D){
 const parts:FacePart[]=[];
 root.traverse(object=>{
  if(!(object instanceof Mesh))return;
  const name=object.name.replaceAll('_',' '),eye=name.includes(' eye '),mouth=name==='Open smiling mouth',tongue=name==='Rounded tongue';
  if(!eye&&!mouth&&!tongue)return;
  const geometry=object.geometry.clone();object.geometry=geometry;
  const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');
  const baseCount=geometry.morphAttributes.position?.length??0;
  geometry.morphAttributes.position=[...(geometry.morphAttributes.position??[])];geometry.morphAttributes.normal=[...(geometry.morphAttributes.normal??[])];
  const relative=geometry.morphTargetsRelative;
  for(const kind of kinds){
   const values:number[]=[],normals:number[]=[];
   for(let i=0;i<position.count;i++){
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i);let nx=x,ny=y;
    if(eye){
     const side=name.startsWith('Left')?-1:1,cx=side*.255,u=(x-cx)/.103,v=(y-1.54)/.239;
     if(kind==='Hello'){nx=cx+(x-cx)*1.08;ny=1.555+(y-1.54)*1.04;}
     if(kind==='Joy'){nx=cx+(x-cx)*1.12;ny=1.54+.065*(1-u*u)+(y-1.54)*.22;}
     if(kind==='Fear'){nx=cx+(x-cx)*1.25;ny=1.56+(y-1.54)*1.12;}
     if(kind==='Anger'){ny=1.51+(y-1.54)*.62+side*u*.065;}
     if(kind==='Sad'){ny=1.51+v*.17-side*u*.065;}
    }else{
     const u=x/(tongue?.095:.165),v=tongue?(y-.996)/.035:(y-1.087)/(y>=1.087?.023:.145);
     if(tongue){
      const factor=kind==='Hello'?1.05:kind==='Joy'?1.2:.015;nx=x*factor;ny=(kind==='Joy'?.94:.996)+(y-.996)*factor;
     }else if(kind==='Hello'){nx=x*1.12;ny=1.09+v*(v>0?.035:.17);}
     else if(kind==='Joy'){nx=x*1.35;ny=1.09+v*(v>0?.045:.23);}
     else if(kind==='Fear'){nx=u*.12;ny=1.06+v*.16;}
     else if(kind==='Anger'){nx=u*.095;ny=1.055+v*.085;}
     else if(kind==='Sad'){nx=x*.88;ny=1.00+.07*(1-u*u)+v*.017;}
    }
    const oldFront=.84*Math.sqrt(Math.max(.001,1-x*x-((y-1.17)/.96)**2));
    const front=.84*Math.sqrt(Math.max(.001,1-nx*nx-((ny-1.17)/.96)**2));
    const nz=front+(z-oldFront),n=new Vector3(nx,(ny-1.17)/(.96*.96),front/(.84*.84)).normalize();
    values.push(nx-(relative?x:0),ny-(relative?y:0),nz-(relative?z:0));
    normals.push(n.x-(relative?normal.getX(i):0),n.y-(relative?normal.getY(i):0),n.z-(relative?normal.getZ(i):0));
   }
   geometry.morphAttributes.position.push(new Float32BufferAttribute(values,3));geometry.morphAttributes.normal.push(new Float32BufferAttribute(normals,3));
  }
  const previous=object.morphTargetInfluences;object.updateMorphTargets();
  // AnimationMixer bindings retain this array: keep it so Eat continues to animate.
  if(previous){while(previous.length<object.morphTargetInfluences!.length)previous.push(0);object.morphTargetInfluences=previous;}
  const indices=kinds.map((kind,i)=>{object.morphTargetDictionary![`Emotion ${kind}`]=baseCount+i;return baseCount+i;});
  geometry.computeBoundingSphere();parts.push({mesh:object,indices});
 });
 faces.set(root,parts);return parts;
}
export function poseFace(root:Object3D,kind:Emote,weight:number,restore:(()=>void)[]){
 const parts=faces.get(root)??prepare(root);
 for(const {mesh,indices} of parts){
  const weights=mesh.morphTargetInfluences!,previous=weights.slice();restore.push(()=>{previous.forEach((v,i)=>weights[i]=v);});
  // Suspend the eating mouth blend while an emotional expression is active.
  for(let i=0;i<weights.length;i++)weights[i]*=1-weight;
  weights[indices[kinds.indexOf(kind)]]=weight;
 }
}
