import * as T from 'three';

type Section=readonly [z:number,width:number,top:number,bottom:number];
type PaintTone='upper'|'lower'|'cere';
const basePaint={upper:'#767c84',lower:'#646c78',cere:'#d3d0c5'};
const tipZ=(1426-1270)/155-.49,tipY=(955-577)/155-2.48;
const upperProfile:Section[]=[
 [.225,0,.015,.015],[.245,.066,.060,-.030],[.275,.086,.077,-.030],
 [.315,.081,.064,-.029],[.360,.068,.045,-.029],[.410,.048,.026,-.032],
 [.455,.029,.008,-.035],[.490,.013,-.012,-.039],[tipZ,0,tipY,tipY],
];
const lowerProfile:Section[]=[
 [.242,0,-.059,-.059],[.264,.055,-.043,-.086],[.305,.064,-.040,-.090],
 [.360,.055,-.040,-.084],[.415,.038,-.043,-.073],[.463,.019,-.045,-.061],
 [.497,0,-.049,-.049],
];
const nostrilZ=.340,nostrilAngle=.48;

/** Monotone cubic sections keep the bill smooth while retaining its small hook. */
function section(profile:Section[],z:number){
 z=T.MathUtils.clamp(z,profile[0][0],profile.at(-1)![0]);
 let i=0;while(i<profile.length-2&&z>profile[i+1][0])i++;
 const a=profile[i],b=profile[i+1],p=profile[Math.max(0,i-1)],n=profile[Math.min(profile.length-1,i+2)],h=b[0]-a[0],u=(z-a[0])/h;
 return [1,2,3].map(k=>{
  const slope=(b[k]-a[k])/h,prev=i?(a[k]-p[k])/(a[0]-p[0]):slope,next=i<profile.length-2?(n[k]-b[k])/(n[0]-b[0]):slope;
  const m0=prev*slope>0?2/(1/prev+1/slope):0,m1=next*slope>0?2/(1/next+1/slope):0;
  return (2*u**3-3*u*u+1)*a[k]+(u**3-2*u*u+u)*h*m0+(-2*u**3+3*u*u)*b[k]+(u**3-u*u)*h*m1;
 });
}
function point(profile:Section[],z:number,phi:number,upper:boolean){
 const [width,top,bottom]=section(profile,z),s=Math.sin(phi);
 const y=upper?bottom+(s>=0?(top-bottom)*s:.006*s):(top+bottom)/2+(top-bottom)/2*s;
 return new T.Vector3(Math.max(0,width)*Math.cos(phi),y,z);
}
function normal(z:number,phi:number){
 const dz=point(upperProfile,z+.0001,phi,true).sub(point(upperProfile,z-.0001,phi,true));
 const dp=point(upperProfile,z,phi+.0001,true).sub(point(upperProfile,z,phi-.0001,true));
 return dp.cross(dz).normalize();
}
function surface(z:number,phi:number,offset=0){return point(upperProfile,z,phi,true).addScaledVector(normal(z,phi),offset);}
function noseDistance(z:number,phi:number){
 return Math.min(...[nostrilAngle,Math.PI-nostrilAngle].map(a=>{
  const delta=Math.atan2(Math.sin(phi-a),Math.cos(phi-a));
  return Math.hypot((z-nostrilZ)/.025,delta/.15);
 }));
}

function mesh(parent:T.Object3D,name:string,vertices:number[],indices:number[],colors:number[],material:T.Material,tone?:PaintTone,normalAliases?:number[]){
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);
 // Use the clean detail/eye island: keratin and powder detail is authored in
 // vertex paint, independent of the different feather atlases.
 const uv:number[]=[];
 for(let i=0;i<vertices.length;i+=3){const u=T.MathUtils.clamp((vertices[i+2]-.225)/.30,0,1),v=T.MathUtils.clamp((vertices[i+1]+.10)/.19,0,1);uv.push((1552.5+u*479)/2048,(1552.5+v*479)/2048);}
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 if(normalAliases){
  const original=g.index;g.setIndex(indices.map(i=>normalAliases[i]));g.computeVertexNormals();g.setIndex(original);
  const n=g.getAttribute('normal');normalAliases.forEach((from,to)=>{if(from!==to)n.setXYZ(to,n.getX(from),n.getY(from),n.getZ(from));});
 }else g.computeVertexNormals();
 const result=new T.Mesh(g,material);result.name=name;result.castShadow=result.receiveShadow=true;
 if(tone)result.userData.beakPaint={tone,base:basePaint[tone]};
 parent.add(result);return result;
}

/** Detailed native pigeon bill; the existing animated lower-jaw pivot is retained. */
export function buildPigeonBeak(beak:T.Group,jaw:T.Group,keratin:T.Material,powder:T.Material,mucosa:T.Material,showCere=true){
 function loft(profile:Section[],upper:boolean,parent:T.Group,name:string,tone:PaintTone){
  const rows=upper?72:40,cols=64,vertices:number[]=[],indices:number[]=[],colors:number[]=[],aliases:number[]=[];
  const base=new T.Color(basePaint[tone]);
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
   const u=j/rows,z=T.MathUtils.lerp(profile[0][0],profile.at(-1)![0],u),phi=i/cols*Math.PI*2,p=point(profile,z,phi,upper);
   if(upper){const depression=.017*(1-T.MathUtils.smoothstep(noseDistance(z,phi),.45,1.45));if(depression)p.addScaledVector(normal(z,phi),-depression);}
   if(!upper)p.sub(jaw.position);
   vertices.push(...p.toArray());
   const grain=.012*Math.sin(u*178+phi*4)+.008*Math.sin(u*411-phi*9),ridge=.065*Math.max(0,Math.sin(phi));
   const shade=(upper?1.02-.25*T.MathUtils.smoothstep(u,.25,1):.96-.18*u)+ridge+grain;
   colors.push(...base.clone().multiplyScalar(shade).toArray());
   const vertex=j*(cols+1)+i;aliases.push(j===0?0:j===rows?rows*(cols+1):i===cols?vertex-cols:vertex);
   if(j<rows&&i<cols){const a=vertex,b=a+cols+1;if(j)indices.push(a,a+1,b);if(j<rows-1)indices.push(a+1,b+1,b);}
  }
  return mesh(parent,name,vertices,indices,colors,keratin,tone,aliases);
 }
 loft(upperProfile,true,beak,'Beak_sculpt_paint','upper');
 loft(lowerProfile,false,jaw,'Lower_beak_sculpt_paint','lower');

 for(const side of [-1,1]){
  const label=side<0?'Left':'Right',angle=side<0?Math.PI-nostrilAngle:nostrilAngle;
  // Annular powdery cere and lip surround an actual recessed nasal cup.
  // These are thin fitted patches, rather than the former round nasal blobs.
  function patch(name:string,inner:[number,number],outer:[number,number],height:(r:number)=>number,base:string,mat:T.Material,tone?:PaintTone){
   const rings=8,cols=48,vertices:number[]=[],indices:number[]=[],colors:number[]=[];
   for(let j=0;j<=rings;j++)for(let i=0;i<=cols;i++){
    const r=j/rings,t=i/cols*Math.PI*2,rz=T.MathUtils.lerp(inner[0],outer[0],r),rp=T.MathUtils.lerp(inner[1],outer[1],r);
    const z=nostrilZ+rz*Math.cos(t)-(name==='cere'?.012*r:0),phi=angle+rp*Math.sin(t),p=surface(z,phi,height(r));
    vertices.push(...p.toArray());
    const speck=.025*Math.sin(t*19+r*39)*Math.sin(t*11-r*51),shade=name==='nostril'?.62+.38*r:.98+speck+.055*Math.sin(r*Math.PI);
    colors.push(...new T.Color(base).multiplyScalar(shade).toArray());
    if(j<rings&&i<cols){const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,a+1,b,a+1,b+1,b);}
   }
   return mesh(beak,`${label}_beak_${name}`,vertices,indices,colors,mat,tone);
  }
  if(showCere)patch('cere',[.018,.069],[.044,.35],r=>.001+.0035*Math.sin(Math.PI*r)**.8,basePaint.cere,powder,'cere');
  const lip=patch('nostril_lip',[.016,.060],[.019,.098],r=>.0008+.0014*Math.sin(Math.PI*r),showCere?basePaint.cere:basePaint.upper,showCere?powder:keratin,showCere?'cere':'upper');
  const nostril=patch('nostril',[0,0],[.016,.060],r=>-.012*(1-T.MathUtils.smoothstep(r,.15,1))+.0005,'#343945',keratin);
  lip.userData.beakFeature='nostril-rim';nostril.userData.beakFeature='recessed-nostril';
 }

 // The bill surrounds a complete oral cavity. Its rear diaphragm sits in
 // front of the feathered skull; palate, floor and flexible mouth corners
 // enclose it, including when the mandible opens for calls and feeding.
 const mouthBack=.329,mouthFront=.491;
 function roofPoint(z:number,u:number){
  const [width,,bottom]=section(upperProfile,z);
  return new T.Vector3(width*.98*u,bottom-.006*Math.sqrt(Math.max(0,1-(.98*u)**2))-.0007,z);
 }
 function floorPoint(z:number,u:number){
  const [width,top,bottom]=section(lowerProfile,z),x=width*.98*u;
  return new T.Vector3(x,(top+bottom)/2+(top-bottom)/2*Math.sqrt(Math.max(0,1-(.98*u)**2))+.0006,z);
 }
 function oralSheet(upper:boolean){
  const rows=40,cols=32,vertices:number[]=[],colors:number[]=[],indices:number[]=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
   const z=T.MathUtils.lerp(mouthBack,mouthFront,j/rows),u=i/cols*2-1,p=upper?roofPoint(z,u):floorPoint(z,u);
   if(!upper)p.sub(jaw.position);vertices.push(...p.toArray());
   const shade=.72+.22*j/rows+.06*Math.abs(u);colors.push(...new T.Color(upper?'#664550':'#956472').multiplyScalar(shade).toArray());
   if(j<rows&&i<cols){const a=j*(cols+1)+i,b=a+cols+1;indices.push(...(upper?[a,a+1,b,a+1,b+1,b]:[a,b,a+1,a+1,b,b+1]));}
  }
  const result=mesh(upper?beak:jaw,upper?'Pigeon_oral_palate':'Pigeon_oral_floor',vertices,indices,colors,mucosa);
  result.userData.beakFeature=upper?'oral-palate':'oral-floor';
 }
 oralSheet(true);oralSheet(false);

 const palateBone=new T.Bone();palateBone.name='Pigeon_mouth_head';beak.add(palateBone);
 const jawBone=new T.Bone();jawBone.name='Pigeon_mouth_jaw';jaw.add(jawBone);
 function flexibleLining(name:string,side=0){
  const rows=12,cols=24,vertices:number[]=[],colors:number[]=[],indices:number[]=[],weights:number[]=[],bones:number[]=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
   const v=j/rows,u=i/cols*2-1,cornerFront=.338+.041*Math.abs(2*v-1)**.8;
   const z=side?T.MathUtils.lerp(mouthBack-.016,cornerFront,i/cols):mouthBack;
   const top=roofPoint(z,side||u),bottom=floorPoint(z,side||u),p=top.lerp(bottom,v);
   if(side)p.x+=side*.0007;else p.z+=.006*Math.sin(Math.PI*v)*(1-u*u);
   vertices.push(...p.toArray());weights.push(1-v,v,0,0);bones.push(0,1,0,0);
   const shade=.66+.12*Math.abs(u)+.06*v;colors.push(...new T.Color('#77505d').multiplyScalar(shade).toArray());
   if(j<rows&&i<cols){const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);}
  }
  const initial=mesh(beak,name,vertices,indices,colors,mucosa),g=initial.geometry;initial.removeFromParent();
  g.setAttribute('skinIndex',new T.Uint16BufferAttribute(bones,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
  const result=new T.SkinnedMesh(g,mucosa);result.name=name;result.castShadow=result.receiveShadow=true;beak.add(result);
  beak.updateWorldMatrix(true,true);result.bind(new T.Skeleton([palateBone,jawBone]));result.userData.beakFeature=side?'oral-cheek':'oral-throat';
 }
 flexibleLining('Pigeon_oral_throat');flexibleLining('Left_oral_corner',-1);flexibleLining('Right_oral_corner',1);

 // A low, softly grooved tongue lies on the floor and moves with the jaw.
 const tongue=new T.SphereGeometry(1,32,16),tp=tongue.attributes.position,tongueColors:number[]=[];
 for(let i=0;i<tp.count;i++){
  const x=tp.getX(i)*.015*(1-.18*tp.getZ(i)),z=.390+tp.getZ(i)*.052,y=floorPoint(z,0).y+tp.getY(i)*.0018+.0005;
  const groove=(1-T.MathUtils.smoothstep(Math.abs(x),.001,.005))*Math.max(0,tp.getY(i));
  tp.setXYZ(i,x-jaw.position.x,y-jaw.position.y,z-jaw.position.z);
  tongueColors.push(...new T.Color('#ad737f').multiplyScalar(1-.12*groove).toArray());
 }
 const tongueMesh=mesh(jaw,'Pigeon_tongue',Array.from(tp.array),Array.from(tongue.index!.array),tongueColors,mucosa);tongue.dispose();tongueMesh.userData.beakFeature='tongue';
}
