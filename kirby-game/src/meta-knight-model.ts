import * as T from 'three';
import polygonClipping from 'polygon-clipping';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createKnightFist,createGalaxia} from './meta-knight-equipment';

/** Clip a regular grid to a silhouette before curving it. Long earcut slivers
 * can fold across their neighbours when projected onto a nonlinear surface. */
function surfaceGrid(outline:T.Shape,step:number) {
  const ring=outline.getPoints(80).map(v=>[v.x,v.y] as [number,number]);
  const xMin=Math.min(...ring.map(p=>p[0])),xMax=Math.max(...ring.map(p=>p[0]));
  const yMin=Math.min(...ring.map(p=>p[1])),yMax=Math.max(...ring.map(p=>p[1]));
  const positions:number[]=[];
  for(let ix=Math.floor(xMin/step);ix<Math.ceil(xMax/step);ix++)for(let iy=Math.floor(yMin/step);iy<Math.ceil(yMax/step);iy++) {
    const x=ix*step,y=iy*step;
    const clipped=polygonClipping.intersection([ring],[[[x,y],[x+step,y],[x+step,y+step],[x,y+step],[x,y]]]);
    for(const polygon of clipped) {
      const loops=polygon.map(loop=>loop.slice(0,-1).map(p=>new T.Vector2(...p)));
      const triangles=T.ShapeUtils.triangulateShape(loops[0],loops.slice(1)),vertices=loops.flat();
      for(const indices of triangles) {
        const [a,b,c]=indices.map(i=>vertices[i]);
        const area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
        if(Math.abs(area)<1e-12)continue;
        for(const p of area>0?[a,b,c]:[a,c,b])positions.push(p.x,p.y,0);
      }
    }
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  return geometry;
}

/** Native, editable game asset. +Z faces forward and the soles rest on Y=0. */
export function createMetaKnight() {
  const root = new T.Group();
  root.name = 'MetaKnight_root';
  root.userData = {character:'meta-knight', forward:'+Z', units:'metres', inPlace:true,
    notes:'Original model based on the supplied Meta Knight reference. Rigid articulated mesh; mask and sword remain attached to their pivots.'};
  const silver = material('Mask · brushed moon silver', '#dce3ef', .78, .25);
  const edge = material('Armour · midnight blue', '#222e57', .55, .32);
  const purple = material('Body · indigo velvet', '#3f3278', .12, .53);
  const boot = material('Boots · violet leather', '#69448f', .15, .39);
  const sole = material('Soles · deep plum', '#25203e', .10, .60);
  const gold = material('Galaxia · warm gold', '#f8c548', .79, .24);
  const dark = material('Visor · recessed shadow', '#090c22', .14, .52);
  const eyes = material('Eyes · golden glow', '#ffe12f', .05, .30);
  eyes.emissive.set('#ffc900'); eyes.emissiveIntensity = .65;
  const membrane = material('Wings · violet silk', '#ffffff', .13, .46);
  membrane.vertexColors = true; membrane.side = T.DoubleSide;
  const rib = material('Wings · indigo ribs', '#343058', .30, .36);

  type Rig = {node:T.Group; p:T.Vector3; q:T.Quaternion; s:T.Vector3};
  const rigs:Rig[] = [];
  const batches = new Map<T.Object3D, Map<T.Material,T.BufferGeometry[]>>();
  const sphere = new T.SphereGeometry(1, 32, 20);
  function group(parent:T.Object3D,name:string,p:number[]=[0,0,0]) {
    const g = new T.Group(); g.name=name; g.position.fromArray(p); parent.add(g);
    rigs.push({node:g,p:g.position.clone(),q:g.quaternion.clone(),s:g.scale.clone()}); return g;
  }
  function add(parent:T.Object3D,geo:T.BufferGeometry,mat:T.Material,p:number[]=[0,0,0],s:number[]=[1,1,1],r:number[]=[0,0,0]) {
    let geometry = geo.clone();
    if (geometry.index) geometry = geometry.toNonIndexed();
    geometry.deleteAttribute('uv');
    geometry.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...p),new T.Quaternion().setFromEuler(new T.Euler(...r)),new T.Vector3(...s)));
    if (!batches.has(parent)) batches.set(parent,new Map());
    const list=batches.get(parent)!; if(!list.has(mat))list.set(mat,[]); list.get(mat)!.push(geometry);
  }
  const ell=(parent:T.Object3D,mat:T.Material,p:number[],s:number[],r:number[]=[0,0,0])=>add(parent,sphere,mat,p,s,r);
  function tube(parent:T.Object3D,mat:T.Material,points:number[][],radius:number,segments=28) {
    const geo=new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),segments,radius,8,false);
    add(parent,geo,mat); geo.dispose();
  }
  function torus(parent:T.Object3D,mat:T.Material,p:number[],radius:number,thickness:number,s=[1,1,1],r=[0,0,0]) {
    const geo=new T.TorusGeometry(radius,thickness,10,48); add(parent,geo,mat,p,s,r); geo.dispose();
  }
  function horn(parent:T.Object3D,points:number[][],radius:number) {
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    const geo=new T.TubeGeometry(curve,32,radius,14,false),positions=geo.getAttribute('position');
    for(let row=0;row<=32;row++) {
      const t=row/32,c=curve.getPointAt(t),taper=Math.pow(1-t,.72)*.96+.04;
      for(let col=0;col<=14;col++) {
        const i=row*15+col,v=new T.Vector3().fromBufferAttribute(positions,i).sub(c).multiplyScalar(taper).add(c);
        positions.setXYZ(i,v.x,v.y,v.z);
      }
    }
    geo.computeVertexNormals();add(parent,geo,silver);geo.dispose();
  }

  const body=group(root,'Body_motion',[0,1.17,0]);
  ell(body,purple,[0,0,0],[.91,.91,.79]);
  const mask=group(body,'Mask_shell');
  // A thin half-round shell follows the body's own face surface. It has no
  // independent ellipsoid dome or flat plate floating ahead of the cheeks.
  const faceZ=(x:number,y:number,offset=0)=>.79*Math.sqrt(Math.max(.001,1-(x/.91)**2-(y/.91)**2))+.032+offset;
  function facePatch(parent:T.Object3D,outline:T.Shape,mat:T.Material,offset:number,back=false) {
    const geo=surfaceGrid(outline,.04),p=geo.getAttribute('position');
    const normals=new Float32Array(p.count*3);
    for(let i=0;i<p.count;i++) {
      const x=p.getX(i),y=p.getY(i),depth=Math.sqrt(Math.max(.001,1-(x/.91)**2-(y/.91)**2));
      p.setZ(i,faceZ(x,y,offset));
      const normal=new T.Vector3(.79*x/(.91*.91*depth),.79*y/(.91*.91*depth),1).normalize().multiplyScalar(back?-1:1);
      normals.set(normal.toArray(),i*3);
    }
    // Earcut's thin triangles become ill-conditioned after a curved projection.
    // Analytic normals keep the entire shell smooth across those triangles.
    geo.setAttribute('normal',new T.BufferAttribute(normals,3));
    if(back)geo.setIndex(Array.from({length:p.count},(_,i)=>i-i%3+[0,2,1][i%3]));
    add(parent,geo,mat);geo.dispose();
  }
  const maskOutline=new T.Shape();maskOutline.absellipse(0,.04,.782,.832,0,Math.PI*2,false,0);
  const outerOutline=new T.Shape();outerOutline.absellipse(0,.04,.807,.858,0,Math.PI*2,false,0);
  facePatch(mask,outerOutline,edge,-.015);
  facePatch(mask,maskOutline,silver,0);
  facePatch(mask,maskOutline,silver,-.025,true);
  // Close the thin shell at its curved silhouette rather than using a round pad.
  const border=outerOutline.getPoints(160),rimPositions:number[]=[],rimIndices:number[]=[];
  border.forEach(p=>{rimPositions.push(p.x,p.y,faceZ(p.x,p.y,-.015),p.x,p.y,faceZ(p.x,p.y,-.040));});
  for(let i=0;i<border.length-1;i++){const a=i*2;rimIndices.push(a,a+1,a+2,a+1,a+3,a+2);}
  const maskRim=new T.BufferGeometry();maskRim.setAttribute('position',new T.Float32BufferAttribute(rimPositions,3));maskRim.setIndex(rimIndices);maskRim.computeVertexNormals();add(mask,maskRim,edge);maskRim.dispose();
  const visor=new T.Shape();
  visor.moveTo(-.657,.325);visor.quadraticCurveTo(-.34,.195,0,.015);
  visor.quadraticCurveTo(.34,.195,.657,.325);visor.lineTo(.535,-.125);
  visor.quadraticCurveTo(.25,-.29,0,-.35);visor.quadraticCurveTo(-.25,-.29,-.535,-.125);visor.closePath();
  facePatch(mask,visor,edge,.013);
  const inset=new T.Shape();
  inset.moveTo(-.609,.262);inset.quadraticCurveTo(-.31,.152,0,-.038);
  inset.quadraticCurveTo(.31,.152,.609,.262);inset.lineTo(.49,-.095);
  inset.quadraticCurveTo(.25,-.24,0,-.292);inset.quadraticCurveTo(-.25,-.24,-.49,-.095);inset.closePath();
  facePatch(mask,inset,dark,.022);
  // The eyes keep the reference's sharp brow and warm luminous lower edge.
  const eyeRig=group(mask,'Eyes_glow');
  for(const side of [-1,1]) {
    const eye=new T.Shape();
    eye.moveTo(side*.405,.145);eye.lineTo(side*.198,.052);
    eye.quadraticCurveTo(side*.195,-.105,side*.278,-.118);
    eye.quadraticCurveTo(side*.376,-.11,side*.405,.145);eye.closePath();
    facePatch(eyeRig,eye,eyes,.037);
    // Two raised, outward-splayed forehead flutes on each side, no holes.
    for(let ridge=0;ridge<2;ridge++) {
      const flute=group(mask,`Mask_ridge_${side<0?'L':'R'}_${ridge}`),vertices:number[]=[],indices:number[]=[];
      const topX=side*(ridge===0?.23:.54),topY=ridge===0?.84:.67;
      const lowX=side*(ridge===0?.105:.39),lowY=ridge===0?.125:.275;
      for(let row=0;row<=18;row++) {
        const t=row/18,x=T.MathUtils.lerp(topX,lowX,t),y=T.MathUtils.lerp(topY,lowY,t);
        const width=Math.max(.001,(ridge===0?.046:.039)*Math.sin(Math.PI*t)**.45);
        for(const lane of [-1,0,1]) {
          const xx=x+lane*width,raised=lane===0?.027*Math.sin(Math.PI*t)**.55:0;
          vertices.push(xx,y,faceZ(xx,y,.009+raised));
        }
        if(row<18)for(let lane=0;lane<2;lane++) {
          const a=row*3+lane,b=a+1,c=a+3,d=a+4;
          indices.push(a,c,b,b,c,d);
        }
      }
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
      add(flute,geometry,silver);geometry.dispose();
    }
  }
  // A thin draped cloak follows the back, flares at the hem and has real folds.
  const cape=group(body,'Cape'),capeMaterial=material('Cape · midnight cloth','#20265c',.04,.85);
  capeMaterial.side=T.DoubleSide;
  const capePoint=(u:number,v:number)=>{
    const x=u*(.51+.33*v),y=.40-1.12*v-.025*Math.cos(u*Math.PI*3)*v**5;
    const back=-.79*Math.sqrt(Math.max(.10,1-(x/.96)**2-(y/.98)**2));
    const z=back-.075-.30*v*v-.026*Math.cos(u*Math.PI*4)*(.25+.75*v);
    return [x,y,z];
  };
  const capePositions:number[]=[],capeIndices:number[]=[],columns=32,rows=28;
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++)capePositions.push(...capePoint(col/columns*2-1,row/rows));
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++) {
    const a=row*(columns+1)+col,b=a+1,c=a+columns+1,d=c+1;capeIndices.push(a,b,c,b,d,c);
  }
  const cloth=new T.BufferGeometry();cloth.setAttribute('position',new T.Float32BufferAttribute(capePositions,3));cloth.setIndex(capeIndices);cloth.computeVertexNormals();add(cape,cloth,capeMaterial);cloth.dispose();
  tube(cape,gold,Array.from({length:49},(_,i)=>capePoint(i/48*2-1,1)),.013,64);

  const shoulders:T.Group[]=[],feet:T.Group[]=[],wings:T.Group[]=[];
  for(const side of [-1,1]) {
    const label=side<0?'Left':'Right';
    const shoulder=group(body,`${label}_shoulder`,[side*.84,-.025,-.005]); shoulders.push(shoulder);
    const armour=group(shoulder,`${label}_shoulder_armour`);
    ell(armour,edge,[side*.06,.10,0],[.37,.31,.36]);
    ell(armour,silver,[side*.08,.155,.035],[.325,.245,.33]);
    torus(armour,gold,[side*.075,.15,.026],.278,.037,[1,.83,1]);
    horn(armour,[[side*.12,.21,.06],[side*.28,.32,.05],[side*.30,.51,.0],[side*.22,.68,-.02]],.15);
    ell(shoulder,purple,[side*.16,-.185,.075],[.20,.27,.22]);
    const hand=group(shoulder,`${label}_gauntlet`,[side*.29,-.34,.29]);
    ell(hand,silver,[0,.10,-.005],[.215,.095,.195]);
    if(side<0) {
      const fist=createKnightFist(false);fist.name='Left_fist';hand.add(fist);
    }

    const foot=group(root,`${label}_foot_pivot`,[side*.48,.245,.11]);feet.push(foot);
    ell(foot,sole,[0,-.114,.075],[.432,.13,.585]);
    ell(foot,boot,[0,-.015,.10],[.435,.23,.585]);
    ell(foot,boot,[0,.045,-.17],[.285,.27,.31]);
    ell(foot,edge,[0,-.11,.47],[.34,.075,.15]);
    tube(foot,silver,[[side*.30,.094,.19],[side*.325,.059,.35],[side*.25,.022,.49]],.012,12);

    const wing=group(body,`${label}_wing_pivot`,[side*.56,.24,-.48]);wings.push(wing);
    const outline=new T.Shape();outline.moveTo(0,0);
    outline.bezierCurveTo(.33,.42,.72,.72,1.59,1.22);
    outline.bezierCurveTo(1.40,.69,1.32,.13,1.34,-.17);
    outline.quadraticCurveTo(.91,.12,.74,-.37);
    outline.quadraticCurveTo(.39,-.10,.19,-.55);outline.quadraticCurveTo(.18,-.21,0,0);
    const geo=surfaceGrid(outline,.065),p=geo.getAttribute('position');
    const colors=new Float32Array(p.count*3),normals=new Float32Array(p.count*3),lo=new T.Color('#322359'),hi=new T.Color('#8c69b9');
    const wingZ=(x:number,y:number)=>-.09-.105*Math.sin(Math.max(0,x)*Math.PI/1.65)+.035*y;
    for(let i=0;i<p.count;i++) {
      const x=p.getX(i),y=p.getY(i);p.setXYZ(i,side*x,y,wingZ(x,y));
      const tone=T.MathUtils.clamp(.27+.5*Math.sin((x/1.65)*Math.PI)+.14*y,0,1),c=lo.clone().lerp(hi,tone);
      colors.set([c.r,c.g,c.b],i*3);
      const normal=new T.Vector3(.105*Math.PI/1.65*Math.cos(x*Math.PI/1.65),-side*.035,side).normalize();
      normals.set(normal.toArray(),i*3);
    }
    geo.setAttribute('color',new T.BufferAttribute(colors,3));geo.setAttribute('normal',new T.BufferAttribute(normals,3));
    add(wing,geo,membrane);geo.dispose();
    const paths=[[[0,0],[.42,.47],[.9,.81],[1.59,1.22]],[[0,0],[.55,.31],[1.05,.14],[1.34,-.17]],[[0,0],[.35,.13],[.62,-.10],[.74,-.37]],[[0,0],[.19,-.12],[.19,-.55]]];
    paths.forEach((points,i)=>tube(wing,rib,points.map(([x,y])=>[side*x,y,wingZ(x,y)+.008]),i===0?.036:.023,24));
    const border=outline.getPoints(100).map(v=>[side*v.x,v.y,wingZ(v.x,v.y)]);
    tube(wing,rib,border,.014,100);
    ell(wing,silver,[side*1.59,1.22,wingZ(1.59,1.22)],[.043,.067,.043],[0,0,-side*.55]);
  }

  // Both closed fists share one sculpt. The sword wrist is forward/outward of
  // the pauldron, so its inward hooks cannot sweep through the shoulder.
  const gripRig=group(shoulders[1].getObjectByName('Right_gauntlet')!,'Right_grip',[.14,.015,.18]);
  gripRig.rotation.set(.16,.10,-.42);
  const sword=createGalaxia();sword.name='Galaxia';gripRig.add(sword);
  const fingers=createKnightFist(true);fingers.name='Right_grip_fingers';gripRig.add(fingers);

  // Merge by material within each articulated part to keep draw calls bounded.
  let meshIndex=0;
  for(const [parent,materials] of batches)for(const [mat,geometries] of materials) {
    const merged=mergeGeometries(geometries,false);
    if(!merged)throw Error(`Unable to merge ${parent.name}`);
    const mesh=new T.Mesh(merged,mat);mesh.name=`${parent.name}_surface_${meshIndex++}`;
    mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);geometries.forEach(g=>g.dispose());
  }
  sphere.dispose();
  // Capture the sword's authored diagonal before every animation sample.
  for(const rig of rigs){rig.p.copy(rig.node.position);rig.q.copy(rig.node.quaternion);rig.s.copy(rig.node.scale);}
  function pose(name:string,t:number,duration:number) {
    for(const rig of rigs){rig.node.position.copy(rig.p);rig.node.quaternion.copy(rig.q);rig.node.scale.copy(rig.s);}
    const u=t/duration,phase=u*Math.PI*2,breathe=Math.sin(phase);
    wings.forEach((wing,i)=>{const side=i===0?-1:1;wing.rotation.y=side*.47;wing.rotation.z=side*(.025+.020*breathe);});
    shoulders.forEach((arm,i)=>{const side=i===0?-1:1;arm.rotation.z=side*.045;});
    cape.rotation.x=.012*breathe;
    if(name==='Idle') {
      body.position.y+=.012*breathe;body.rotation.z=.012*Math.sin(phase);
      shoulders[0].rotation.x=.025*breathe;shoulders[1].rotation.x=-.018*breathe;
      wings.forEach((wing,i)=>{wing.rotation.y+=(i===0?-1:1)*.025*breathe;});
    } else if(name==='Walk') {
      const wave=Math.sin(phase),bounce=Math.sin(phase)**2;
      body.position.y+=.033*bounce;body.rotation.z=.038*wave;body.rotation.x=.035;
      body.rotation.y=.035*wave;
      feet.forEach((foot,i)=>{
        const step=(i===0?1:-1)*wave,lift=Math.max(0,step);
        foot.position.z+=.235*step;foot.position.y+=.145*lift;
        foot.rotation.x=-.19*step;foot.rotation.z=(i===0?-1:1)*.025*lift;
      });
      shoulders[0].rotation.x=-.20*wave;shoulders[1].rotation.x=.09*wave;
      cape.rotation.x=-.018+.014*bounce;cape.rotation.z=.025*wave;
      wings.forEach((wing,i)=>{const side=i===0?-1:1;wing.rotation.y=side*(.56+.045*Math.sin(phase-.4));wing.rotation.z=side*(.018+.025*wave);});
    } else if(name==='Sitting') {
      body.position.y=.94+.009*breathe;body.position.z=-.10;body.rotation.x=-.045;
      feet.forEach((foot,i)=>{foot.position.set((i===0?-1:1)*.46,.22,.48);foot.rotation.x=-.16;foot.rotation.z=(i===0?-1:1)*.06;});
      shoulders.forEach((arm,i)=>{const side=i===0?-1:1;arm.rotation.x=-.14;arm.rotation.z=side*.21;});
      wings.forEach((wing,i)=>{const side=i===0?-1:1;wing.rotation.y=side*(.91+.02*breathe);wing.rotation.z=side*.07;});
      // Keep the blade upright and clear of the ground while resting.
      gripRig.rotation.z=-.29;gripRig.rotation.x=.28;
    }
    root.updateMatrixWorld(true);
    // Correct only sole contact, preserving foot-lift and the body's seated height.
    for(const foot of feet) {
      const box=new T.Box3().setFromObject(foot,true);
      if(box.min.y<0)foot.position.y-=box.min.y;
    }
    root.updateMatrixWorld(true);
  }
  const clips:T.AnimationClip[]=[];
  for(const [name,duration] of [['Idle',2.8],['Walk',1.04],['Sitting',3.2]] as const) {
    const count=Math.ceil(duration*30),times=Array.from({length:count+1},(_,i)=>i/count*duration);
    const samples=rigs.map(()=>({p:[] as number[],q:[] as number[],s:[] as number[]}));
    times.forEach(t=>{pose(name,t===duration?0:t,duration);rigs.forEach(({node},i)=>{
      samples[i].p.push(...node.position.toArray());samples[i].q.push(...node.quaternion.toArray());samples[i].s.push(...node.scale.toArray());
    });});
    const tracks:T.KeyframeTrack[]=[];
    rigs.forEach(({node},i)=>{
      tracks.push(new T.VectorKeyframeTrack(`${node.name}.position`,times,samples[i].p));
      tracks.push(new T.QuaternionKeyframeTrack(`${node.name}.quaternion`,times,samples[i].q));
      tracks.push(new T.VectorKeyframeTrack(`${node.name}.scale`,times,samples[i].s));
    });
    const clip=new T.AnimationClip(name,duration,tracks);clip.optimize();clips.push(clip);
  }
  pose('Idle',0,2.8);
  return {root,clips};
}

function material(name:string,color:string,metalness:number,roughness:number) {
  const result=new T.MeshStandardMaterial({color,metalness,roughness});result.name=name;return result;
}
