import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createPigeonAnimations,PIGEON_PECK_CORRECTION_PHASES} from './pigeon-animation';

/** Original pigeon sculpt based on the approved character sketch. +Z is forward. */
export function createPigeon(featherPaint?:{width:number;height:number;pixels:Uint8Array}){
  const root=new T.Group();root.name='GoofyPigeon';
  root.userData={character:'pigeon',forward:'+Z',units:'metres',author:'Original character based on the approved pigeon sketch',animation:'In-place native pigeon movements, interactions and emotions',walkSpeed:.40};
  const satin=new T.MeshStandardMaterial({vertexColors:true,roughness:.93});satin.name='Soft painted plumage';
  const eyeMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.67});eyeMaterial.name='Warm ivory eyes';
  const smooth=T.MathUtils.smoothstep;
  let featherTexture:T.DataTexture|undefined;
  if(featherPaint){
    featherTexture=new T.DataTexture(featherPaint.pixels,featherPaint.width,featherPaint.height);featherTexture.colorSpace=T.SRGBColorSpace;featherTexture.magFilter=T.LinearFilter;featherTexture.minFilter=T.LinearMipmapLinearFilter;featherTexture.generateMipmaps=true;featherTexture.needsUpdate=true;
  }
  satin.map=eyeMaterial.map=featherTexture??null;
  const wingMaterial=new T.MeshStandardMaterial({map:featherTexture??null,color:featherTexture?'#ffffff':'#949dab',roughness:.93});wingMaterial.name='Sketch feather paint';
  // Sixteen texels of duplicated paint protect every tile from mipmap bleed.
  const atlasUV=(x:number,y:number,w:number,h:number,u:number,v:number)=>[(x+16.5+T.MathUtils.clamp(u,0,1)*(w-33))/2048,(y+16.5+T.MathUtils.clamp(v,0,1)*(h-33))/2048];
  const batches=new Map<T.Object3D,Map<T.Material,T.BufferGeometry[]>>();
  const sphere=new T.SphereGeometry(1,20,14),smallSphere=new T.SphereGeometry(1,12,8);
  const rigs:T.Object3D[]=[];
  function pivot(parent:T.Object3D,name:string,pos:number[]=[0,0,0]){
    const node=new T.Group();node.name=name;node.position.fromArray(pos);parent.add(node);rigs.push(node);return node;
  }
  function paint(g:T.BufferGeometry,color:string,fn?:(p:T.Vector3,c:T.Color)=>void){
    const p=g.getAttribute('position'),rgb=new T.Color(color),c=rgb.clone(),v=new T.Vector3(),colors=new Float32Array(p.count*3);
    for(let i=0;i<p.count;i++){c.copy(rgb);v.fromBufferAttribute(p,i);fn?.(v,c);c.toArray(colors,i*3);}
    g.setAttribute('color',new T.BufferAttribute(colors,3));return g;
  }
  function part(parent:T.Object3D,g:T.BufferGeometry,color:string,pos:number[],scale=[1,1,1],rotation=[0,0,0],gloss=false,fn?:(p:T.Vector3,c:T.Color)=>void){
    const copy=paint(g.clone(),color,fn),p=copy.getAttribute('position'),oldUV=copy.getAttribute('uv'),uv=new Float32Array(p.count*2);
    copy.computeBoundingBox();const bounds=copy.boundingBox!,size=bounds.getSize(new T.Vector3());
    for(let i=0;i<p.count;i++){
      const u=oldUV?oldUV.getX(i):(p.getZ(i)-bounds.min.z)/(size.z||1),v=oldUV?oldUV.getY(i):(p.getY(i)-bounds.min.y)/(size.y||1);
      const coordinates=atlasUV(1536,gloss?1536:1024,512,512,u,v);uv[i*2]=coordinates[0];uv[i*2+1]=coordinates[1];
    }
    copy.setAttribute('uv',new T.BufferAttribute(uv,2));copy.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...pos),new T.Quaternion().setFromEuler(new T.Euler(...rotation)),new T.Vector3(...scale)));
    if(!batches.has(parent))batches.set(parent,new Map());const groups=batches.get(parent)!,mat=gloss?eyeMaterial:satin;
    if(!groups.has(mat))groups.set(mat,[]);groups.get(mat)!.push(copy);
  }
  function ell(parent:T.Object3D,c:string,pos:number[],scale:number[],rotation=[0,0,0],small=false,gloss=false){part(parent,small?smallSphere:sphere,c,pos,scale,rotation,gloss);}
  function tube(parent:T.Object3D,c:string,points:number[][],r:number){
    const g=new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),10,r,7,false);
    part(parent,g,c,[0,0,0]);g.dispose();
  }
  const motion=pivot(root,'Motion');
  const body=new T.Bone();body.name='Body';body.position.y=.65;motion.add(body);rigs.push(body);
  const neck=new T.Bone();neck.name='Neck';neck.position.set(0,1.15,.45);body.add(neck);rigs.push(neck);
  const head=new T.Bone();head.name='Head';head.position.set(0,.68,.04);neck.add(head);rigs.push(head);

  // Landmarks traced from the bottom-right view of the approved 1536×1024
  // sketch. Back and chest are interpolated independently, preserving its
  // sloping back and continuous rounded chest rather than an invented oval.
  const pixelScale=1/155,groundPixel=955,originPixel=1270;
  const ref=(x:number,y:number)=>new T.Vector3(0,(groundPixel-y)*pixelScale,(x-originPixel)*pixelScale);
  const tracedSections=[ // pixel Y, back X, front X, transverse half-width
    [895,1274,1274,0],[888,1234,1330,.34],[876,1200,1370,.52],
    [855,1157,1410,.70],[828,1125,1430,.80],[799,1110,1441,.84],
    [768,1114,1444,.83],[741,1124,1441,.78],[711,1150,1429,.70],
    [683,1185,1417,.61],[658,1222,1405,.50],[638,1260,1399,.40],
    [616,1275,1396,.34],[593,1287,1396,.31],[573,1293,1395,.32],
    [553,1300,1389,.32],[538,1314,1377,.27],[530,1330,1360,.17],
    [526,1344,1344,0],
  ];
  const sections=tracedSections.map(([py,back,front,rx])=>[(groundPixel-py)*pixelScale,rx,(front-back)*pixelScale/2,((front+back)/2-originPixel)*pixelScale]);
  const fields=[sections.map(s=>s[1]),sections.map(s=>s[3]-s[2]),sections.map(s=>s[3]+s[2])];
  function profile(y:number){
    let index=0;while(index<sections.length-2&&y>sections[index+1][0])index++;
    const a=sections[index],b=sections[index+1],u=(y-a[0])/(b[0]-a[0]);
    const interpolate=(k:number)=>{
      // Shape-preserving cubic Hermite interpolation (no bulb seams).
      const before=sections[Math.max(0,index-1)],after=sections[Math.min(sections.length-1,index+2)];
      const field=fields[k],av=field[index],bv=field[index+1],pv=field[Math.max(0,index-1)],nv=field[Math.min(sections.length-1,index+2)];
      const slope=(bv-av)/(b[0]-a[0]);
      const prev=(av-pv)/(a[0]-before[0]||1),next=(nv-bv)/(after[0]-b[0]||1);
      const m0=prev*slope>0?2/(1/prev+1/slope):0,m1=next*slope>0?2/(1/next+1/slope):0;
      return (2*u**3-3*u*u+1)*av+(u**3-2*u*u+u)*m0*(b[0]-a[0])+(-2*u**3+3*u*u)*bv+(u**3-u*u)*m1*(b[0]-a[0]);
    };
    const back=interpolate(1),front=interpolate(2);return [interpolate(0),(front-back)/2,(front+back)/2];
  }
  const positions:number[]=[],indices:number[]=[],weights:number[]=[],boneIndices:number[]=[],bodyUV:number[]=[],rows=86,cols=64;
  for(let j=0;j<=rows;j++){
    // Cosine spacing rounds both caps rather than making a cone at the forehead.
    const bottom=sections[0][0],top=sections.at(-1)![0],y=bottom+(top-bottom)*(1-Math.cos(Math.PI*j/rows))/2,[rx,rz,z]=profile(y);
    for(let i=0;i<=cols;i++){
      const angle=i/cols*Math.PI*2;positions.push(rx*Math.cos(angle),y,z+rz*Math.sin(angle));
      bodyUV.push(...atlasUV(0,0,1536,1536,i/cols,(top-y)/(top-bottom)));
      const neckWeight=smooth(y,1.55,2.20),headWeight=smooth(y,2.18,2.62)*neckWeight;
      boneIndices.push(0,1,2,0);weights.push(1-neckWeight,neckWeight-headWeight,headWeight,0);
      if(j<rows&&i<cols){const a=j*(cols+1)+i,b=a+cols+1;if(j)indices.push(a,b,a+1);if(j<rows-1)indices.push(a+1,b,b+1);}
    }
  }
  const bodyGeometry=new T.BufferGeometry();bodyGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));bodyGeometry.setIndex(indices);bodyGeometry.computeVertexNormals();
  paint(bodyGeometry,featherPaint?'#ffffff':'#89919e');bodyGeometry.setAttribute('uv',new T.Float32BufferAttribute(bodyUV,2));
  bodyGeometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(boneIndices,4));bodyGeometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
  // Pull the belly inward while keeping the approved compact peck pose.
  // Keep small feathered supports around the hips so tucking the abdomen
  // cannot pull the body away from the planted legs.
  const bellyDelta=new T.Float32BufferAttribute(new Float32Array(positions.length),3);bellyDelta.name='Belly_tuck';
  const tuckedShape=bodyGeometry.clone(),tuckedPositions=tuckedShape.getAttribute('position');
  for(let vertex=0;vertex<tuckedPositions.count;vertex++){
    const x=tuckedPositions.getX(vertex),y=tuckedPositions.getY(vertex),z=tuckedPositions.getZ(vertex);
    const hipSupport=(1-smooth(Math.abs(Math.abs(x)-.345),.07,.26))*(1-smooth(Math.abs(z-.02),.10,.34))*(1-smooth(y,.56,.95));
    const amount=(1-smooth(y,1.10,1.75))*smooth(z,-.35,.65)*(1-hipSupport);
    const dx=-x*.18*amount,dy=.28*amount,dz=-.38*amount;
    bellyDelta.setXYZ(vertex,dx,dy,dz);tuckedPositions.setXYZ(vertex,x+dx,y+dy,z+dz);
  }
  tuckedShape.computeVertexNormals();
  const normals=bodyGeometry.getAttribute('normal'),tuckedNormals=tuckedShape.getAttribute('normal');
  const bellyNormals=new T.Float32BufferAttribute(new Float32Array(positions.length),3);
  for(let vertex=0;vertex<normals.count;vertex++)bellyNormals.setXYZ(vertex,tuckedNormals.getX(vertex)-normals.getX(vertex),tuckedNormals.getY(vertex)-normals.getY(vertex),tuckedNormals.getZ(vertex)-normals.getZ(vertex));
  bodyGeometry.morphTargetsRelative=true;bodyGeometry.morphAttributes.position=[bellyDelta];bodyGeometry.morphAttributes.normal=[bellyNormals];tuckedShape.dispose();
  const sculpt=new T.SkinnedMesh(bodyGeometry,satin);sculpt.name='Continuous pigeon body';root.add(sculpt);root.updateMatrixWorld(true);sculpt.bind(new T.Skeleton([body,neck,head]));
  sculpt.castShadow=sculpt.receiveShadow=true;
  // Correct just the compressed inside of the neck through the existing peck
  // motion. Smoothing in posed space avoids changing the neck's width, length
  // or the head trajectory to hide a skinning crease.
  const tucked=positions.map((value,i)=>value+bellyDelta.array[i]);
  for(const peck of PIGEON_PECK_CORRECTION_PHASES){
    body.rotation.x=.60+.20*peck;neck.position.y=1.15-.10*peck;neck.rotation.x=.85+.70*peck;
    head.rotation.x=-.35-.30*peck;head.position.z=.04+.025*peck;root.updateMatrixWorld(true);
    const skinMatrices=sculpt.skeleton.bones.map((bone,i)=>bone.matrixWorld.clone().multiply(sculpt.skeleton.boneInverses[i]));
    const transforms=Array.from({length:positions.length/3},(_,vertex)=>{
      const matrix=new T.Matrix4();matrix.elements.fill(0);
      for(let bone=0;bone<3;bone++)for(let element=0;element<16;element++)matrix.elements[element]+=skinMatrices[bone].elements[element]*weights[vertex*4+bone];
      return matrix;
    });
    let surface=transforms.map((matrix,vertex)=>new T.Vector3().fromArray(tucked,vertex*3).applyMatrix4(matrix));
    for(let pass=0;pass<192;pass++)surface=surface.map((point,vertex)=>{
      const y=positions[vertex*3+1],front=Math.sin(vertex%(cols+1)/cols*Math.PI*2);
      const blend=.5*smooth(y,1.15,1.60)*(1-smooth(y,2.02,2.28))*smooth(front,-.25,.65);
      if(!blend)return point;
      const average=surface[vertex-cols-1].clone().add(surface[vertex+cols+1]).multiplyScalar(.5);
      average.x=point.x;return point.clone().lerp(average,blend);
    });
    const correction=new T.Float32BufferAttribute(new Float32Array(positions.length),3);correction.name=`Neck_smooth_${peck*4}`;
    const correctedShape=bodyGeometry.clone(),corrected=correctedShape.getAttribute('position');
    for(let vertex=0;vertex<surface.length;vertex++){
      const original=new T.Vector3().fromArray(tucked,vertex*3),delta=surface[vertex].clone().applyMatrix4(transforms[vertex].clone().invert()).sub(original);
      correction.setXYZ(vertex,delta.x,delta.y,delta.z);corrected.setXYZ(vertex,original.x+delta.x,original.y+delta.y,original.z+delta.z);
    }
    correctedShape.computeVertexNormals();const correctedNormals=correctedShape.getAttribute('normal'),normalCorrection=new T.Float32BufferAttribute(new Float32Array(positions.length),3);
    for(let vertex=0;vertex<normals.count;vertex++)normalCorrection.setXYZ(vertex,correctedNormals.getX(vertex)-normals.getX(vertex)-bellyNormals.getX(vertex),correctedNormals.getY(vertex)-normals.getY(vertex)-bellyNormals.getY(vertex),correctedNormals.getZ(vertex)-normals.getZ(vertex)-bellyNormals.getZ(vertex));
    bodyGeometry.morphAttributes.position.push(correction);bodyGeometry.morphAttributes.normal.push(normalCorrection);correctedShape.dispose();
  }
  body.rotation.set(0,0,0);neck.rotation.set(0,0,0);neck.position.y=1.15;head.rotation.set(0,0,0);head.position.z=.04;
  sculpt.updateMorphTargets();root.updateMatrixWorld(true);

  const eyelids:T.Group[]=[],pupils:T.Group[]=[];
  for(const side of [-1,1]){
    const label=side<0?'Left':'Right';
    const eyePoint=ref(1356,571),eye=pivot(head,`${label}_eye`,[side*.305,eyePoint.y-2.48,eyePoint.z-.49]);eye.rotation.y=side*Math.PI/2;
    // Keep the eye centres on the same head landmarks. The entire assembly
    // is 20% larger than revision 6, including pupils, highlights and lids.
    eye.scale.setScalar(.6);
    ell(eye,'#536071',[0,0,-.013],[.173,.179,.050],[0,0,0],false);
    ell(eye,'#f3ecdd',[0,0,.010],[.160,.165,.063],[0,0,0],false,true);
    const pupil=pivot(eye,`${label}_pupil`,[-side*.053,.032,.066]);
    pupils.push(pupil);
    pupil.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(-side*.12,.06,1).normalize());
    ell(pupil,'#262833',[0,0,.003],[.025,.030,.010],[0,0,side*.06],true,true);
    ell(pupil,'#fff9ed',[-.006,.011,.011],[.004,.005,.002],[0,0,0],true,true);
    // Feather-coloured lids disappear completely in the approved open-eyed
    // rest pose. Scaling and lowering their dome gives blinks and expressions.
    const lid=pivot(eye,`${label}_eyelid`,[0,.17,0]);eyelids.push(lid);
    ell(lid,'#818b9b',[0,0,.048],[.169,.174,.079]);lid.scale.set(0,0,0);
  }
  // A domed surface whose Y/Z silhouette is the traced drawing. This keeps
  // folded wings flush against the body, with painted feather bars, not tiles.
  function sideShell(points:number[][],center:number[],origin:T.Vector3,depth:(y:number,z:number)=>number,thickness:number,side=1){
    const curve=new T.CatmullRomCurve3(points.map(([x,y])=>ref(x,y)),true,'centripetal'),c=ref(center[0],center[1]);
    const p:number[]=[],ix:number[]=[],rows=20,cols=128;
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const theta=j/rows*Math.PI,edge=curve.getPoint(i/cols),y=c.y+(edge.y-c.y)*Math.sin(theta),z=c.z+(edge.z-c.z)*Math.sin(theta);
      p.push(side*(depth(y,z)+thickness*Math.cos(theta))-origin.x,y-origin.y,z-origin.z);
      if(j<rows&&i<cols){const a=j*(cols+1)+i,b=a+cols+1;if(j)ix.push(a,b,a+1);if(j<rows-1)ix.push(a+1,b,b+1);}
    }
    // The traced contour is clockwise in screen space; correct winding using
    // its outward-facing cap, including mirrored left/right surfaces.
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();
    const normal=g.getAttribute('normal');let capNormal=0;for(let i=0;i<=cols;i++)capNormal+=normal.getX(i);
    if(capNormal*side<0){for(let i=0;i<ix.length;i+=3)[ix[i+1],ix[i+2]]=[ix[i+2],ix[i+1]];g.setIndex(ix);g.computeVertexNormals();}
    return g;
  }
  const beakOrigin=new T.Vector3(0,2.48,.49),beak=pivot(head,'Beak');
  const upper=sideShell([[1390,573],[1394,561],[1403,557],[1412,562],[1421,568],[1426,577],[1415,574],[1403,574],[1394,576]],[1404,568],beakOrigin,()=>0,.091);
  const lower=sideShell([[1392,580],[1402,579],[1412,583],[1414,588],[1404,588],[1395,584],[1390,584]],[1402,583],beakOrigin,()=>0,.064);
  const jaw=pivot(beak,'Lower_beak',[0,-.07,.282]);
  part(beak,upper,'#767c84',[0,0,0]);part(jaw,lower,'#646c78',[0,.07,-.282]);upper.dispose();lower.dispose();
  const mouthPoint=ref(1400,579);ell(beak,'#353541',[0,mouthPoint.y-2.48,mouthPoint.z-.49],[.060,.022,.066]);
  ell(beak,'#d9a0a5',[0,mouthPoint.y-2.493,mouthPoint.z-.47],[.045,.012,.036],[0,0,0],true);
  const cere=ref(1396,562);for(const s of [-1,1])ell(beak,'#b9b8ac',[s*.040,cere.y-2.48,cere.z-.49],[.047,.043,.043],[0,0,s*.12],true);
  const wings:T.Group[]=[],wingVanes:T.Group[]=[];
  for(const side of [-1,1]){
    const center=ref(1220,750),origin=new T.Vector3(side*.66,center.y,center.z),shoulder=new T.Vector3(side*.62,1.075,.29);
    const wing=pivot(body,`${side<0?'Left':'Right'}_wing`,shoulder.toArray()),vaneRig=pivot(wing,`${wing.name}_vane`);wings.push(wing);wingVanes.push(vaneRig);
    const outline=[[1220,680],[1255,670],[1283,671],[1317,686],[1333,718],[1329,748],[1312,781],[1284,806],[1242,821],[1202,829],[1163,829],[1136,821],[1125,815],[1110,805],[1100,795],[1103,789],[1096,784],[1109,776],[1106,769],[1113,758],[1135,738],[1160,718],[1188,698]];
    const vane=sideShell(outline,[1220,750],origin,(y,z)=>{
      const [rx,rz,zc]=profile(T.MathUtils.clamp(y,sections[0][0],sections.at(-1)![0]));return Math.max(.18,rx*Math.sqrt(Math.max(0,1-((z-zc)/(rz||1))**2)))+.026;
    },.055,side);
    // Translating the unchanged shell into shoulder coordinates preserves its
    // approved rest silhouette while giving sweep and unfold separate joints.
    part(vaneRig,vane,'#ffffff',[origin.x-shoulder.x,origin.y-.65-shoulder.y,origin.z-shoulder.z]);vane.dispose();
  }
  const tailCenter=ref(1110,766),tail=pivot(body,'Tail',[0,tailCenter.y-.65,tailCenter.z]);
  const tailGeometry=sideShell([[1142,733],[1129,732],[1109,727],[1085,724],[1068,723],[1060,728],[1060,735],[1078,742],[1058,742],[1043,746],[1034,752],[1035,759],[1054,774],[1081,785],[1101,791],[1120,798],[1144,793]],[1110,766],tailCenter,()=>0,.24);
  part(tail,tailGeometry,featherPaint?'#ffffff':'#627084',[0,0,0]);tailGeometry.dispose();
  const tuft=pivot(head,'Forehead_tuft',[0,.285,-.05]);
  for(const [x,length] of [[-.08,.13],[.025,.14],[.085,.10]])tube(tuft,'#657387',[[x,0,0],[x-.03,.013,-.03],[x-.05,length*.2,-length]],.012);

  const legs:{hip:T.Group;knee:T.Group;foot:T.Group;side:number}[]=[];
  const upperLength=.185,lowerLength=.20;
  for(const side of [-1,1]){
    const label=side<0?'Left':'Right',hip=pivot(motion,`${label}_hip`,[side*.345,.52,-.12]);
    const knee=pivot(hip,`${label}_knee`,[0,-upperLength,0]);
    const foot=pivot(knee,`${label}_foot`,[0,-lowerLength,0]);legs.push({hip,knee,foot,side});
    ell(hip,'#b98080',[0,-upperLength/2,0],[.081,upperLength/2+.035,.084]);
    ell(knee,'#c58e8b',[0,-lowerLength/2,0],[.061,lowerLength/2+.029,.064]);
    ell(knee,'#c38a87',[0,0,0],[.070,.073,.070],[0,0,0],true);
    ell(foot,'#ce9590',[0,-.034,.029],[.106,.109,.112]);
    ell(foot,'#d39a92',[0,-.087,.104],[.158,.049,.170]);
    for(let toe=0;toe<3;toe++){
      const angle=(toe-1)*.43+side*.10,start=new T.Vector3((toe-1)*.064,-.084,.105),end=new T.Vector3(Math.sin(angle)*.22,-.084,.105+Math.cos(angle)*(toe===1?.38:.29));
      const mid=start.clone().lerp(end,.5);mid.y+=.016;
      tube(foot,'#d79d93',[start.toArray(),mid.toArray(),end.toArray()],toe===1?.051:.047);
      ell(foot,'#d69a91',end.toArray(),[.051,.045,.059],[0,angle,0],true);
      ell(foot,'#676575',[end.x,-.082,end.z+.033],[.030,.026,.051],[0,angle,0],true);
      // Sparse softened toe folds instead of photoreal skin texture.
      for(let fold=0;fold<2;fold++){
        const p=start.clone().lerp(end,.40+fold*.20);p.y=-.039;
        tube(foot,'#ae7980',[[p.x-.027,p.y,p.z],[p.x,p.y+.006,p.z-.004],[p.x+.027,p.y,p.z]],.0045);
      }
    }
    tube(foot,'#c88d89',[[0,-.088,-.025],[side*.03,-.085,-.15],[side*.045,-.083,-.205]],.038);
    ell(foot,'#696574',[side*.045,-.079,-.224],[.023,.022,.044],[0,0,0],true);
  }
  function legPose(leg:typeof legs[number],z:number,lift:number,pitch:number){
    const hip=leg.hip.position.clone(),ankle=new T.Vector3(leg.side*.345,.14+lift,z-.12),line=ankle.clone().sub(hip),distance=line.length();
    const axis=line.clone().normalize(),along=(upperLength**2-lowerLength**2+distance**2)/(2*distance),height=Math.sqrt(Math.max(0,upperLength**2-along**2));
    const bend=new T.Vector3(0,-axis.z,axis.y).normalize();
    const knee=hip.clone().addScaledVector(axis,along).addScaledVector(bend,height);
    const down=new T.Vector3(0,-1,0),qHip=new T.Quaternion().setFromUnitVectors(down,knee.clone().sub(hip).normalize()),qShin=new T.Quaternion().setFromUnitVectors(down,ankle.clone().sub(knee).normalize());
    leg.hip.quaternion.copy(qHip);leg.knee.quaternion.copy(qHip.clone().invert().multiply(qShin));
    leg.foot.quaternion.copy(qShin.clone().invert().multiply(new T.Quaternion().setFromEuler(new T.Euler(pitch,leg.side*.085,0))));
  }
  for(const leg of legs)legPose(leg,0,0,0);
  for(const [parent,materials] of batches)for(const [material,geometries] of materials){
    const geometry=mergeGeometries(geometries,false);if(!geometry)throw Error('Pigeon geometry merge failed');
    const isWing=wingVanes.includes(parent as T.Group);
    if(isWing){
      const shoulder=parent.parent!.position;
      const p=geometry.getAttribute('position'),uv=new Float32Array(p.count*2);
      for(let i=0;i<p.count;i++){const px=(p.getZ(i)+shoulder.z)/pixelScale+originPixel,py=groundPixel-(p.getY(i)+shoulder.y+.65)/pixelScale;const a=atlasUV(1536,0,512,512,(px-1090)/250,(py-665)/170);uv[i*2]=a[0];uv[i*2+1]=a[1];}
      geometry.setAttribute('uv',new T.BufferAttribute(uv,2));
    }else if(parent===tail){
      const p=geometry.getAttribute('position'),uv=new Float32Array(p.count*2);
      for(let i=0;i<p.count;i++){const px=(p.getZ(i)+tailCenter.z)/pixelScale+originPixel,py=groundPixel-(p.getY(i)+tailCenter.y)/pixelScale;const a=atlasUV(1536,512,512,512,(px-1030)/120,(py-718)/86);uv[i*2]=a[0];uv[i*2+1]=a[1];}
      geometry.setAttribute('uv',new T.BufferAttribute(uv,2));
    }
    const mesh=new T.Mesh(geometry,isWing?wingMaterial:material);mesh.name=`${parent.name}_sculpt_${material===eyeMaterial?'eyes':'paint'}`;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);geometries.forEach(g=>g.dispose());
  }
  sphere.dispose();smallSphere.dispose();root.updateMatrixWorld(true);
  const clips=createPigeonAnimations({root,rigs,motion,body,neck,head,sculpt,wings,wingVanes,tail,tuft,eyelids,pupils,jaw,legs,legPose});
  root.animations=clips;root.updateMatrixWorld(true);
  return {root,clips,paintMaterials:[satin,eyeMaterial,wingMaterial]};
}
