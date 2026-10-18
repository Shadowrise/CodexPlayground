import * as T from 'three';
import polygonClipping from 'polygon-clipping';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createKnightFist,createGalaxia} from './meta-knight-equipment';
import {META_KNIGHT_CLIPS,type MetaKnightClipName} from './meta-knight-clips';

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

  // Keep gameplay heading on the outer root. This inner pivot supplies native
  // reclining and tumbling without the controller stripping their rotation.
  const motion=group(root,'MetaKnight_motion');
  const body=group(motion,'Body_motion',[0,1.17,0]);
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

  // Embroidered shoulder yoke bridges the straight attachment edge. Project
  // every stitch onto the folded cloth and inherit the cape's animation.
  const embroidery=new T.Group();embroidery.name='Cape_embroidered_yoke';cape.add(embroidery);
  const yokeMaterial=material('Cape · embroidered indigo satin','#292f68',.12,.65);
  const stitchPoint=(x:number,y:number,lift=.023)=>{
    const v=(.40-y)/1.12,u=x/(.51+.33*v);
    return [x,y,capePoint(u,v)[2]-lift];
  };
  function embroideredPatch(outline:T.Shape,mat:T.Material,lift:number) {
    const geometry=surfaceGrid(outline,.025),positions=geometry.getAttribute('position');
    const normals=new Float32Array(positions.count*3);
    for(let i=0;i<positions.count;i++) {
      const x=positions.getX(i),y=positions.getY(i);
      positions.setXYZ(i,...stitchPoint(x,y,lift) as [number,number,number]);
      const dx=(stitchPoint(x+.001,y)[2]-stitchPoint(x-.001,y)[2])/.002;
      const dy=(stitchPoint(x,y+.001)[2]-stitchPoint(x,y-.001)[2])/.002;
      normals.set(new T.Vector3(dx,dy,-1).normalize().toArray(),i*3);
    }
    geometry.setAttribute('normal',new T.BufferAttribute(normals,3));
    geometry.setIndex(Array.from({length:positions.count},(_,i)=>i-i%3+[0,2,1][i%3]));
    add(embroidery,geometry,mat);geometry.dispose();
  }
  const yoke=new T.Shape();yoke.moveTo(0,.515);
  yoke.bezierCurveTo(.22,.515,.43,.475,.55,.415);
  yoke.quadraticCurveTo(.55,.36,.50,.33);
  yoke.quadraticCurveTo(.39,.38,.28,.28);
  yoke.quadraticCurveTo(.17,.31,0,.16);
  yoke.quadraticCurveTo(-.17,.31,-.28,.28);
  yoke.quadraticCurveTo(-.39,.38,-.50,.33);
  yoke.quadraticCurveTo(-.55,.36,-.55,.415);
  yoke.bezierCurveTo(-.43,.475,-.22,.515,0,.515);
  yoke.closePath();embroideredPatch(yoke,yokeMaterial,.014);
  tube(embroidery,gold,yoke.getPoints(18).map(p=>stitchPoint(p.x,p.y)),.007,96);
  for(const side of [-1,1])for(const path of [
    [[.07,.36],[.19,.445],[.34,.44],[.47,.405]],
    [[.08,.34],[.21,.39],[.33,.39],[.42,.375]],
    [[.07,.32],[.17,.325],[.25,.35],[.34,.345]],
  ]) {
    const curve=new T.CatmullRomCurve3(path.map(([x,y])=>new T.Vector3(side*x,y,0)));
    tube(embroidery,gold,curve.getPoints(24).map(p=>stitchPoint(p.x,p.y)),.0055,24);
  }
  const star=new T.Shape();
  [[0,.475],[.025,.385],[.09,.355],[.025,.33],[0,.225],[-.025,.33],[-.09,.355],[-.025,.385]]
    .forEach(([x,y],i)=>{if(i===0)star.moveTo(x,y);else star.lineTo(x,y);});
  star.closePath();embroideredPatch(star,silver,.024);
  tube(embroidery,gold,star.getPoints().map(p=>stitchPoint(p.x,p.y,.031)),.005,40);

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
    if(side<0)group(hand,'Left_hand_attachment',[0,-.10,.18]);
    ell(hand,silver,[0,.10,-.005],[.215,.095,.195]);
    if(side<0) {
      const fist=createKnightFist(false);fist.name='Left_fist';hand.add(fist);
    }

    const foot=group(motion,`${label}_foot_pivot`,[side*.48,.245,.11]);feet.push(foot);
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
  const waveWrist=shoulders[0].getObjectByName('Left_gauntlet')!;
  // The blade's authored length runs along local +Y. At the lunge it points
  // along gameplay +Z, with its broad faces remaining vertical.
  const lungeOrientation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(
    new T.Vector3(0,1,0),new T.Vector3(0,0,1),new T.Vector3(1,0,0)));

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
  const smooth=T.MathUtils.smoothstep;
  const pulse=(u:number,center:number,width:number)=>Math.max(0,1-Math.abs(u-center)/width)**2;
  const active=(u:number)=>smooth(u,0,.12)*(1-smooth(u,.82,1));
  function spreadWings(spread:number,flap=0) {
    wings.forEach((wing,i)=>{const side=i===0?-1:1;wing.rotation.y=side*spread;wing.rotation.z=side*flap;});
  }
  function tuckFeet(amount:number) {
    feet.forEach((foot,i)=>{foot.position.y+=.25*amount;foot.position.z-=.15*amount;foot.rotation.x=-.6*amount;foot.rotation.z=(i===0?-1:1)*.06*amount;});
  }
  function recline(amount:number,breath:number) {
    const pivot=new T.Vector3(0,1.12,0);
    motion.rotation.x=-Math.PI/2*amount;
    motion.position.copy(pivot).sub(pivot.clone().applyQuaternion(motion.quaternion));
    body.position.y+=.007*breath*amount;
    // Fold across the back in its own plane. Sweeping wings backwards here
    // would send them through the mattress when the whole body reclines.
    spreadWings(.47*(1-amount),.025*(1-amount)-2.6*amount);
    shoulders[0].rotation.set(-.22*amount,0,-.045-.055*amount);
    shoulders[1].rotation.set(-.12*amount,0,.045-.225*amount);
    eyeRig.scale.y=1-.94*amount;
    cape.rotation.x=-.06*amount;
    cape.scale.z=1-.45*amount;cape.position.z+=.10*amount;
  }
  function pose(name:MetaKnightClipName,t:number,duration:number) {
    for(const rig of rigs){rig.node.position.copy(rig.p);rig.node.quaternion.copy(rig.q);rig.node.scale.copy(rig.s);}
    root.quaternion.identity();
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
    } else if(name==='Run'||name==='WalkBackward'||name==='RotateLeft'||name==='RotateRight') {
      const running=name==='Run',backward=name==='WalkBackward';
      const stepPhase=(name.startsWith('Rotate')?u*2:u)*Math.PI*2,wave=Math.sin(stepPhase);
      const stride=running?.36:backward?.18:.11,lift=running?.24:.13,direction=backward?-1:1;
      body.position.y+=(running?.07:.025)*Math.sin(stepPhase)**2;
      body.rotation.set(running?.13:backward?-.045:.025,.025*wave,(running?.055:.025)*wave);
      feet.forEach((foot,i)=>{
        const step=(i===0?1:-1)*wave;
        foot.position.z+=direction*stride*step;foot.position.y+=lift*Math.max(0,step);
        foot.rotation.x=-direction*.24*step;
      });
      shoulders[0].rotation.x=-.32*wave;
      // The sword remains outside the pauldron and never crosses the visor.
      shoulders[1].rotation.x=.055*wave;shoulders[1].rotation.z=-.045;
      spreadWings(running?.76:.59,.025+.025*wave);
      cape.rotation.set(running?-.11:-.025,0,.035*wave);
      if(name==='RotateLeft'||name==='RotateRight')root.rotation.y=(name==='RotateLeft'?1:-1)*Math.PI/2*smooth(u,.06,.94);
    } else if(name==='Jump') {
      const crouch=pulse(u,.10,.12)+pulse(u,.90,.10),air=smooth(u,.13,.32)*(1-smooth(u,.72,.92));
      body.position.y-=.11*crouch;body.rotation.x=.06*air;
      tuckFeet(air);spreadWings(.48-.32*air,.32*Math.sin(Math.PI*u)*air);
      shoulders[0].rotation.z=-.24*air;shoulders[1].rotation.z=-.09*air;
      cape.rotation.x=-.13*air;
    } else if(name==='Fly') {
      body.position.y+=.025*Math.sin(phase*2);body.rotation.x=.055;
      tuckFeet(1);spreadWings(.12+.065*Math.cos(phase),.58*Math.sin(phase));
      shoulders[0].rotation.set(-.15,0,-.20);shoulders[1].rotation.set(-.08,0,-.13);
      cape.rotation.x=-.19+.035*Math.sin(phase);
    } else if(name==='Swim') {
      body.position.y-=.18-.015*breathe;body.rotation.x=.10;body.rotation.z=.025*breathe;
      feet.forEach((foot,i)=>{const step=Math.sin(phase+(i===0?0:Math.PI));foot.position.z+=.12*step;foot.position.y+=.07;foot.rotation.x=.36*step;});
      shoulders[0].rotation.set(-.22+.22*breathe,.15*breathe,-.15);
      shoulders[1].rotation.set(-.08,0,-.12);spreadWings(.9,.04);
      cape.rotation.x=-.14;
    } else if(name==='Push') {
      // Settle into the front foot, drive Galaxia forwards at the gameplay
      // contact time (.23 s), then recover the original guarded stance.
      const wind=pulse(u,.10,.10),strike=smooth(u,.08,.34)*(1-smooth(u,.49,1));
      body.position.y-=.055*strike+.025*wind;body.position.z+=.18*strike-.045*wind;
      body.rotation.set(.105*strike,-.065*strike,0);
      feet[1].position.z+=.31*strike;feet[1].position.y+=.075*pulse(u,.19,.17);
      feet[1].rotation.x=-.08*strike;feet[0].position.z-=.13*strike;
      shoulders[0].rotation.set(.20*strike,0,-.045-.16*strike);
      shoulders[1].rotation.set(-1.05*strike,-.08*strike,.045-.08*strike);
      const swordParent=body.quaternion.clone().multiply(shoulders[1].quaternion);
      gripRig.quaternion.slerp(swordParent.invert().multiply(lungeOrientation),strike);
      spreadWings(.47+.19*strike,.025+.025*strike);cape.rotation.x=-.15*strike;
      eyeRig.scale.y=1-.15*strike;
    } else if(name==='Attack') {
      const wind=pulse(u,.19,.19),strike=smooth(u,.25,.43)*(1-smooth(u,.55,.95));
      body.position.y-=.055*wind+.045*strike;body.position.z+=.14*strike-.04*wind;
      body.rotation.x=.09*strike;body.rotation.y=(name==='Attack'?-.14:.04)*strike;
      shoulders[0].position.z+=.33*strike;shoulders[0].rotation.set(-.18*strike,.10*strike,-.48*strike);
      shoulders[1].rotation.set(-.06*strike,0,-.045-.08*strike);
      if(name==='Attack'){gripRig.rotation.z-=.75*strike;gripRig.rotation.y-=.20*strike;}
      spreadWings(.55+.12*strike,.025);cape.rotation.x=-.08*strike;
    } else if(name==='Eat') {
      const reach=smooth(u,.06,.20)*(1-smooth(u,.70,.96)),bite=pulse(u,.63,.13);
      shoulders[0].rotation.set(-1.03*reach,-.13*reach,-.33*reach);
      shoulders[0].position.z+=.11*reach;
      body.rotation.x=-.06*bite;body.position.y+=.024*bite;
      eyeRig.scale.y=1-.35*bite;cape.rotation.x=.015*breathe;
    } else if(name==='Boat'||name==='Cart'||name==='FireflyRide'||name==='Swing') {
      body.position.y=.94+.009*breathe;body.position.z=-.10;body.rotation.x=-.045;
      feet.forEach((foot,i)=>{foot.position.set((i===0?-1:1)*.46,.22,.48);foot.rotation.x=-.16;foot.rotation.z=(i===0?-1:1)*.06;});
      shoulders.forEach((arm,i)=>{const side=i===0?-1:1;arm.rotation.x=-.14;arm.rotation.z=side*.21;});
      spreadWings(.91+.02*breathe,.07);gripRig.rotation.z=-.29;gripRig.rotation.x=.28;
      if(name==='Swing'){shoulders[0].rotation.set(-.65,0,-.55);feet.forEach(foot=>foot.rotation.x-=.18*breathe);}
      if(name==='FireflyRide'){body.rotation.x=.10;shoulders[0].rotation.x=-.55;feet.forEach(foot=>foot.position.z-=.10);}
      if(name==='Cart'){shoulders[0].rotation.x=-.36;body.rotation.z=.012*breathe;}
    } else if(name==='Balloon'||name==='Lookout') {
      body.position.y+=.009*breathe;body.rotation.y=.09*Math.sin(phase);
      shoulders[0].rotation.set(-.22,0,-.21);shoulders[1].rotation.set(-.09,0,-.10);
      spreadWings(.77,.02);cape.rotation.z=.018*breathe;
    } else if(name==='Sleep'||name==='Wake') {
      recline(name==='Sleep'?1:1-smooth(u,.12,.93),breathe);
      if(name==='Wake'){const stretch=Math.sin(Math.PI*u);shoulders[0].rotation.z-=.42*stretch;eyeRig.scale.y=Math.max(.06,smooth(u,.10,.75));}
    } else if(name==='Climb') {
      body.rotation.x=.13;body.position.y+=.026*Math.sin(phase*2);
      shoulders[0].rotation.x=-.72-.45*breathe;shoulders[0].rotation.z=-.14;
      shoulders[1].rotation.x=-.13;shoulders[1].rotation.z=-.22;
      feet.forEach((foot,i)=>{const step=(i===0?1:-1)*breathe;foot.position.y+=.11+.10*step;foot.position.z-=.09*step;foot.rotation.x=.20*step;});
      spreadWings(.97,.03);cape.rotation.x=-.12;
    } else if(name==='LeafDive'||name==='Trampoline') {
      const launch=.5+.5*Math.sin(phase),squash=Math.max(0,-breathe);
      body.position.y-=.07*squash;body.scale.set(1+.035*squash,1-.05*squash,1+.035*squash);
      tuckFeet(.35+.55*launch);spreadWings(.38,.16+.16*launch);
      shoulders[0].rotation.z=-.52*launch;shoulders[1].rotation.z=-.16;
      cape.rotation.x=-.16*launch;
    } else if(name==='Roll'||name==='Death') {
      const fall=name==='Death'?smooth(u,.08,.82):1;
      tuckFeet(.75*fall);spreadWings(0,-2.6);
      shoulders[0].rotation.set(-.15,0,-.12);shoulders[1].rotation.set(-.13,0,-.23);
      // Tuck the blade along the roll axis beside the body, retaining the
      // common wrist/finger grip instead of sweeping its tip into the floor.
      gripRig.rotation.x=-1.35;
      // Rotate around the centre of the body, retaining the sword in its grip.
      const pivot=new T.Vector3(0,1.12,0),angle=name==='Roll'?phase:Math.PI/2*fall;
      motion.rotation.z=angle;motion.position.copy(pivot).sub(pivot.clone().applyQuaternion(motion.quaternion));
      if(name==='Death')eyeRig.scale.y=1-.88*fall;
      cape.rotation.x=-.09*fall;
    } else {
      const e=active(u);
      // His mask stays solid: luminous eyes, posture, cloak and wings convey
      // the five emotions without replacing the face with Kirby's mouth.
      if(name==='Hello') {
        // Hold the free fist above the visor beside the forehead. Most of the
        // greeting oscillation belongs to the raised wrist, not a low arm swing.
        const wave=Math.sin((t-.32)*Math.PI*2*2.2);
        shoulders[0].rotation.set(-.12*e,0,(-2.25+.10*wave)*e);
        waveWrist.rotation.set(-.16*e,.10*wave*e,.48*wave*e);
        body.position.y+=.025*(.5+.5*Math.sin(t*7))*e;
        body.rotation.z=(.022+.012*Math.sin(t*5))*e;
        eyeRig.scale.set(1+.08*e,1-.42*e,1);eyeRig.position.y+=.024*e;
        spreadWings(.47-.09*e,.025+.045*e);
      } else if(name==='Joy') {
        motion.position.y+=Math.abs(Math.sin(t*Math.PI*2.2))*.25*e;
        shoulders[0].rotation.z=-.95*e;shoulders[1].rotation.z=-.17*e;
        body.rotation.z=.055*Math.sin(t*8)*e;spreadWings(.47-.25*e,.20*e);
        eyeRig.scale.set(1+.10*e,1-.62*e,1);eyeRig.position.y+=.022*e;
      } else if(name==='Fear') {
        body.rotation.set(-.10*e,0,.024*Math.sin(t*35)*e);body.position.z-=.07*e;
        shoulders[0].rotation.set(-.48*e,0,-.42*e);shoulders[1].rotation.z=-.16*e;
        spreadWings(.47-.28*e,.19*e);eyeRig.scale.set(1+.12*e,1+.18*e,1);
      } else if(name==='Anger') {
        body.rotation.x=.10*e;body.position.y+=.018*Math.abs(Math.sin(t*12))*e;
        shoulders[0].rotation.set(-.14*e,0,-.38*e);shoulders[1].rotation.z=-.20*e;
        feet.forEach((foot,i)=>foot.position.y+=Math.max(0,(i===0?1:-1)*Math.sin(t*12))*.13*e);
        eyeRig.scale.set(1+.08*e,1-.40*e,1);eyeRig.position.y-=.018*e;
        spreadWings(.47-.12*e,.07*e);
      } else if(name==='Sad') {
        body.rotation.x=.18*e;body.position.y-=.07*e;body.rotation.z=-.04*e;
        shoulders[0].rotation.z=.10*e;shoulders[1].rotation.z=-.04*e;
        eyeRig.scale.set(1-.06*e,1-.30*e,1);eyeRig.position.y-=.035*e;
        spreadWings(.47+.40*e,-.08*e);cape.rotation.x=.055*e;
      }
    }
    root.updateMatrixWorld(true);
    // Correct only sole contact, preserving foot-lift and the body's seated height.
    for(const foot of ['Sleep','Wake','Roll','Death'].includes(name)?[]:feet) {
      const box=new T.Box3().setFromObject(foot,true);
      if(box.min.y<0)foot.position.y-=box.min.y;
    }
    root.updateMatrixWorld(true);
    if(['Wake','Roll','Death'].includes(name)) {
      const bottom=new T.Box3().setFromObject(root,true).min.y;
      if(bottom<0)motion.position.y-=bottom;
      root.updateMatrixWorld(true);
    }
  }
  const clips:T.AnimationClip[]=[];
  for(const {name,duration,loop} of META_KNIGHT_CLIPS) {
    const count=Math.ceil(duration*30),times=Array.from({length:count+1},(_,i)=>i/count*duration);
    const samples=rigs.map(()=>({p:[] as number[],q:[] as number[],s:[] as number[]}));
    const rootRotations:number[]=[];
    times.forEach(t=>{pose(name,loop&&t===duration?0:t,duration);rigs.forEach(({node},i)=>{
      samples[i].p.push(...node.position.toArray());samples[i].q.push(...node.quaternion.toArray());samples[i].s.push(...node.scale.toArray());
    });if(name==='RotateLeft'||name==='RotateRight')rootRotations.push(...root.quaternion.toArray());});
    const tracks:T.KeyframeTrack[]=[];
    rigs.forEach(({node},i)=>{
      tracks.push(new T.VectorKeyframeTrack(`${node.name}.position`,times,samples[i].p));
      tracks.push(new T.QuaternionKeyframeTrack(`${node.name}.quaternion`,times,samples[i].q));
      tracks.push(new T.VectorKeyframeTrack(`${node.name}.scale`,times,samples[i].s));
    });
    if(rootRotations.length)tracks.push(new T.QuaternionKeyframeTrack(`${root.name}.quaternion`,times,rootRotations));
    const clip=new T.AnimationClip(name,duration,tracks);clip.optimize();clips.push(clip);
  }
  pose('Idle',0,2.8);
  return {root,clips};
}

function material(name:string,color:string,metalness:number,roughness:number) {
  const result=new T.MeshStandardMaterial({color,metalness,roughness});result.name=name;return result;
}
