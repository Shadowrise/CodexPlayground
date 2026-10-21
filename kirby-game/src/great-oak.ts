import * as T from 'three';
import {createBroadleafTree,treeBranchPoint} from './broadleaf-tree';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export {treeBarkMaterial as greatOakBark} from './tree-bark';

/** Parallel transported frames avoid twisted rings at crooked branch joints.
 * Physical bark ridges affect the silhouette; fine fissures stay in the map. */
function branchGeometry(points:T.Vector3[],start:number,end:number,sides=10,radiusAt?:(t:number)=>number,colour='#86664c',smooth=true){
 const curve=new T.CatmullRomCurve3(points,false,'centripetal'),segments=smooth?Math.max(8,points.length*(start>.7?3:2)):points.length-1,frames=curve.computeFrenetFrames(segments,false);
 const positions:number[]=[],uvs:number[]=[],colours:number[]=[],indices:number[]=[],c=new T.Color(colour);let length=0,previous=curve.getPointAt(0);
 for(let i=0;i<=segments;i++){
  const t=i/segments,p=smooth?curve.getPointAt(t):points[i];length+=p.distanceTo(previous);previous=p;
  const radius=radiusAt?radiusAt(t):T.MathUtils.lerp(start,end,t);
  for(let j=0;j<=sides;j++){
   const a=j/sides*Math.PI*2,r=radius*(1+.023*Math.sin(a*3+t*19)*Math.cos(t*7+a)+.012*Math.cos(a*7-t*13)),v=p.clone().addScaledVector(frames.normals[i],Math.cos(a)*r).addScaledVector(frames.binormals[i],Math.sin(a)*r);
   positions.push(v.x,v.y,v.z);uvs.push(j/sides*Math.max(1,Math.round(start*1.5)),length*.24);
   const damp=1-.12*Math.exp(-p.y*.35),shade=damp*(.95+.05*Math.sin(a+1));colours.push(c.r*shade,c.g*shade,c.b*shade);
  }
 }
 for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,a+1,b+1,b);}
 // Closed, tapered ends keep the supporting branch from looking like a pipe.
 for(const ring of [0,segments]){
  const point=curve.getPointAt(ring/segments),center=positions.length/3;positions.push(point.x,point.y,point.z);uvs.push(.5,.5);colours.push(c.r*.86,c.g*.86,c.b*.86);
  for(let j=0;j<sides;j++){const a=ring*(sides+1)+j;indices.push(...(ring?[center,a,a+1]:[center,a+1,a]));}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setAttribute('color',new T.Float32BufferAttribute(colours,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();return g;
}

function foldedOakLeaf(base:T.Vector3,direction:T.Vector3,size:number,shade:number){
 const forward=direction.clone().normalize(),side=new T.Vector3(0,1,0).cross(forward).normalize(),up=forward.clone().cross(side).normalize();
 const positions:number[]=[],colours:number[]=[],uvs:number[]=[],indices:number[]=[];
 const vertex=(point:T.Vector3,u:number,v:number,light:number)=>{const i=positions.length/3;positions.push(point.x,point.y,point.z);colours.push(shade*light*.94,shade*light,shade*light*.9);uvs.push(u,v);return i;};
 const first=vertex(base,0,.5,.83);let previous:number[]|undefined;
 for(let row=1;row<=3;row++){
  const t=row/4,width=Math.sin(t*Math.PI)*size*.32*(row===2?1.07:1),center=base.clone().addScaledVector(forward,size*t).addScaledVector(up,size*(.07*Math.sin(Math.PI*t)-.12*t*t));
  const ids=[vertex(center.clone().addScaledVector(side,-width),t,0,.94),vertex(center.clone().addScaledVector(up,size*.035),t,.5,1.05),vertex(center.clone().addScaledVector(side,width),t,1,.96)];
  if(previous)indices.push(previous[0],ids[0],previous[1],ids[0],ids[1],previous[1],previous[1],ids[1],previous[2],ids[1],ids[2],previous[2]);else indices.push(first,ids[0],ids[1],first,ids[1],ids[2]);previous=ids;
 }
 const last=vertex(base.clone().addScaledVector(forward,size).addScaledVector(up,-size*.12),1,.5,.9);indices.push(previous![0],last,previous![1],previous![1],last,previous![2]);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colours,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function makeGreatOak(){
 const oak=createBroadleafTree('oak'),pieces:T.BufferGeometry[]=[];
 for(const [i,branch] of oak.branches.entries()){
  const points=branch.points.map(p=>p.clone());
  if(i===0)for(const p of points){const t=p.y/18,envelope=Math.sin(Math.min(1,t)*Math.PI);if(t<1){p.x+=.48*envelope;p.z+=.3*Math.sin(t*Math.PI*2)*envelope;}}
  if(branch.parent>0){
   // Preserve the thin twig scaffold exactly, including every leaf attachment.
   pieces.push(branchGeometry(points,branch.radius,branch.radius*.2,4,undefined,'#86664c',false));
  }else pieces.push(branchGeometry(points,branch.radius,branch.radius*.2,i===0?16:8,i===0?t=>T.MathUtils.lerp(1.82,.364,t)*(1+.18*Math.exp(-t*18)):undefined));
 }
 // Reuse the original petiole triangles. Rebuilding only the woody tube
 // ranges leaves the approved crown and all its attachments unchanged.
 const source=oak.wood,idx=source.index!,p=source.attributes.position,col=source.attributes.color,uv=source.attributes.uv;
 const positions:number[]=[],colors:number[]=[],uvs:number[]=[];
 for(let i=0;i<idx.count;i+=3){
  const ids=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)];
  if(!ids.every(v=>uv.getX(v)===0&&uv.getY(v)===0))continue;
  for(const v of ids){positions.push(p.getX(v),p.getY(v),p.getZ(v));colors.push(col.getX(v),col.getY(v),col.getZ(v));uvs.push(0,0);}
 }
 const petioles=new T.BufferGeometry();petioles.setAttribute('position',new T.Float32BufferAttribute(positions,3));petioles.setAttribute('color',new T.Float32BufferAttribute(colors,3));petioles.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));petioles.setIndex(Array.from({length:positions.length/3},(_,i)=>i));petioles.computeVertexNormals();pieces.push(petioles);
 const wood=mergeGeometries(pieces)!;pieces.forEach(g=>g.dispose());wood.translate(0,0,-6);wood.computeBoundingSphere();wood.userData.treeKind='greatOak';
 const from=treeBranchPoint(oak.branches[0],.265).add(new T.Vector3(0,0,-6));
 const supportPoints=[from,new T.Vector3(-2.3,8.32,-4.9),new T.Vector3(-5.3,8.27,-2.3),new T.Vector3(-7.6,8.13,.75),new T.Vector3(-9.55,7.9,3),new T.Vector3(-11,7.86,3.06),new T.Vector3(-12.45,7.9,3),new T.Vector3(-13.85,8.08,3.15),new T.Vector3(-14.45,8.35,3.22)];
 const supportCurve=new T.CatmullRomCurve3(supportPoints,false,'centripetal');
 const lengths=supportCurve.getLengths(200),total=lengths.at(-1)!,right=lengths[100]/total,left=lengths[150]/total;
 const support=branchGeometry(supportPoints,.86,.13,12,t=>t<right?T.MathUtils.lerp(.86,.43,t/right):t<left?.43:T.MathUtils.lerp(.43,.13,(t-left)/(1-left)));
 support.userData.ropeAnchors=[[-12.45,7.9,3],[-9.55,7.9,3]];
 const limbs:T.BufferGeometry[]=[support],blades:T.BufferGeometry[]=[],forks:number[][]=[];
 // Spreading forks rise behind or beyond the rope span. Nothing curls back
 // towards the trunk, and each leaf grows from a real attached twig.
 const offsets=[[-1.5,1.7,-2.3],[-1.9,2,-1.6],[-1,1.6,-2.2],[-1.3,1.65,-1.1],[-.8,1.5,.9],[-1.1,.85,-.3]];
 for(const [i,t] of [.24,.4,.56,.89,.965,.995].entries()){
  const base=supportCurve.getPointAt(t),end=base.clone().add(new T.Vector3(...offsets[i])),control=base.clone().lerp(end,.5).add(new T.Vector3(.25*Math.sin(i*1.9),.22+(i%3)*.16,i%2?-.24:.24)),curve=new T.QuadraticBezierCurve3(base,control,end);
  limbs.push(branchGeometry(curve.getPoints(3),i<3?.17:.12,.023,7));forks.push(base.toArray());
  for(let j=0;j<2;j++){
   const anchor=curve.getPoint(.52+j*.38),tip=anchor.clone().add(new T.Vector3(-.48,.3+j*.24,(j?1:-1)*.55)),twig=new T.QuadraticBezierCurve3(anchor,anchor.clone().lerp(tip,.55).add(new T.Vector3(0,.12,0)),tip);
   limbs.push(branchGeometry(twig.getPoints(2),.037,.007,4));
   for(let k=0;k<5;k++){
    const leafAnchor=twig.getPoint(.22+k*.17),sign=k%2?1:-1,direction=new T.Vector3(-.25-(i%3)*.12,.16+.13*Math.sin(i*2+k*1.9),sign*.9).normalize(),base=leafAnchor.clone().addScaledVector(direction,.065),size=.72+(i%3)*.09+(k%2)*.08;
    limbs.push(branchGeometry([leafAnchor,base],.008,.004,3,undefined,'#86664c',false));blades.push(foldedOakLeaf(base,direction,size,.79+(i%3)*.07));
   }
  }
 }
 const knot=branchGeometry([new T.Vector3(-.7,4.3,-5.8),new T.Vector3(-1.4,4.5,-5.5),new T.Vector3(-1.6,4.8,-5.5)],.28,.08,8);
 limbs.push(knot);const bough=mergeGeometries(limbs)!;limbs.forEach(g=>g.dispose());bough.userData.ropeAnchors=[[-12.45,7.9,3],[-9.55,7.9,3]];bough.userData.forks=forks;bough.computeBoundingSphere();
 const boughLeaves=mergeGeometries(blades)!;blades.forEach(g=>g.dispose());boughLeaves.computeBoundingSphere();
 bough.userData.ropeTangents=[6,4].map(i=>supportCurve.getTangent(i/(supportPoints.length-1)).toArray());
 oak.wood.dispose();oak.fruit.dispose();oak.shadow.dispose();
 return {wood,leaves:oak.leaves,bough,boughLeaves};
}
