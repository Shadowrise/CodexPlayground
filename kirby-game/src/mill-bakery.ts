import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {batchRigidMeshes} from './rigid-batch';
import {MILL_BAKERY_TABLE,MILL_BAKERY_OVEN,MILL_BAKERY_FOOTPRINTS} from './mill-bakery-site';
import {MILL_BAKE_MS,MILL_HOPPER,type MillQuest} from './mill-quest';

/** Handcrafted baking props. Separate named groups retain future interaction pivots. */
export class MillBakery {
 readonly group=new T.Group();
 readonly table=new T.Group();
 readonly bowl=new T.Group();
 readonly pitcher=new T.Group();
 readonly oven=new T.Group();
 private readonly fire=new T.Group();
 private elapsed=0;
 private readonly flour=new T.Group();
 private readonly mixture=new T.Mesh(new T.SphereGeometry(1,24,12),new T.MeshStandardMaterial({color:'#f3e1ba',roughness:.95}));
 private readonly dough=new T.Group();
 private readonly ovenBread=new T.Group();
 private readonly steam:T.InstancedMesh;
 private readonly scratch=new T.Vector3();
 private readonly dummy=new T.Object3D();
 private readonly pitcherRest=new T.Vector3();

 constructor(){
  this.group.name='Watermill bakery';this.table.name='Oak kneading table';
  this.bowl.name='Turquoise mixing bowl';this.pitcher.name='Glazed water pitcher';this.oven.name='Vaulted bread oven';this.fire.name='Bread oven fire';
  this.table.position.set(MILL_BAKERY_TABLE.x,0,MILL_BAKERY_TABLE.z);
  this.oven.position.set(MILL_BAKERY_OVEN.x,0,MILL_BAKERY_OVEN.z);
  this.group.add(this.table,this.oven);
  const grain=createSurfaceTexture(true),speckle=createSurfaceTexture(false);
  const materials=new Map<string,T.MeshStandardMaterial>();
  const material=(color:string,finish:'wood'|'plaster'|'glaze'|'iron'|'plain'|'ember'='plain')=>{
   const key=color+finish;
   if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,
    roughness:finish==='glaze'?.26:finish==='iron'?.48:.87,metalness:finish==='iron'?.45:0,
    userData:{bakeryFinish:finish},
    ...(finish==='ember'?{emissive:color,emissiveIntensity:1.2}:{}),
   }));
   return materials.get(key)!;
  };
  const mesh=(parent:T.Group,g:T.BufferGeometry,c:string,x:number,y:number,z:number,finish:Parameters<typeof material>[1]='plain')=>{
   const m=new T.Mesh(g,material(c,finish));m.position.set(x,y,z);m.receiveShadow=true;m.castShadow=finish!=='ember';parent.add(m);return m;
  };
  const box=(parent:T.Group,c:string,x:number,y:number,z:number,w:number,h:number,d:number,finish:Parameters<typeof material>[1]='plain',r=.035)=>mesh(parent,new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)),c,x,y,z,finish);
  const ball=(parent:T.Group,c:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,finish:Parameters<typeof material>[1]='plain')=>{
   const m=mesh(parent,new T.SphereGeometry(1,12,8),c,x,y,z,finish);m.scale.set(sx,sy,sz);return m;
  };
  const ring=(parent:T.Group,c:string,x:number,y:number,z:number,r:number,t:number,finish:Parameters<typeof material>[1]='plain')=>{
   const m=mesh(parent,new T.TorusGeometry(r,t,8,40),c,x,y,z,finish);m.rotation.x=Math.PI/2;return m;
  };
  const rod=(parent:T.Group,c:string,a:number[],b:number[],r:number,finish:Parameters<typeof material>[1]='plain',r2=r)=>{
   const from=new T.Vector3(...a),to=new T.Vector3(...b);
   const m=mesh(parent,new T.CylinderGeometry(r2,r,from.distanceTo(to),12),c,0,0,0,finish);
   m.position.copy(from).add(to).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),to.sub(from).normalize());return m;
  };
  const lathe=(parent:T.Group,c:string,points:number[][],x:number,y:number,z:number,finish:Parameters<typeof material>[1]='glaze')=>mesh(parent,new T.LatheGeometry(points.map(p=>new T.Vector2(...p)),48),c,x,y,z,finish);

  // Five thick oak boards, visible joinery, rounded legs and an open lower shelf.
  for(let i=0;i<5;i++)box(this.table,['#b38651','#bb915d','#b68a55','#c09865','#b68b59'][i],0,1.68,(i-2)*.51,5.55,.24,.49,'wood',.065);
  for(const x of [-2.18,2.18])for(const z of [-.92,.92]){
   box(this.table,'#765235',x,.78,z,.32,1.56,.34,'wood',.045);
   box(this.table,'#86613e',x,.15,z,.43,.26,.44,'wood',.045);
   for(const y of [1.34,1.46])ball(this.table,'#563e2b',x,y,z+Math.sign(z)*.18,.035,.035,.018);
  }
  for(const z of [-1.02,1.02])box(this.table,'#916b43',0,1.39,z,4.75,.36,.16,'wood');
  for(const x of [-2.24,2.24])box(this.table,'#916b43',x,1.39,0,.16,.36,2.05,'wood');
  for(let i=0;i<4;i++)box(this.table,i%2?'#a77b4c':'#967045',0,.4,(i-1.5)*.43,4.7,.12,.4,'wood');
  for(const x of [-2.18,2.18])box(this.table,'#765235',x,.3,0,.18,.2,2.15,'wood');
  // End-grain knots and small recessed dowels are geometry, so they survive oblique views.
  for(const [x,z] of [[-1.9,-.5],[1.65,.52],[-.15,1.03]]){
   const knot=ring(this.table,'#926b42',x,1.804,z,.085,.012);knot.scale.set(1.65,1,1);
   ball(this.table,'#8c653f',x,1.805,z,.045,.003,.022);
  }

  // A gently folded linen towel drapes over the front, rather than intersecting the boards.
  const cloth=new T.Group();cloth.name='Woven baker linen';this.table.add(cloth);
  const clothGeometry=createLinenGeometry();mesh(cloth,clothGeometry,'#eee1bf',-1.8,0,0,'plaster');
  for(const x of [-2.35,-2.23,-1.38,-1.26]){
   const curve=new T.CatmullRomCurve3(linenProfile().map(p=>new T.Vector3(x,p[1]+.008,p[0])));
   mesh(cloth,new T.TubeGeometry(curve,28,.012,4,false),'#59968d',0,0,0);
  }
  for(let i=0;i<12;i++)rod(cloth,'#e5d4ae',[-2.37+i*.102,1.23,1.41],[-2.37+i*.102,1.15,1.425],.008);

  this.bowl.position.set(-.65,1.81,-.08);this.table.add(this.bowl);
  lathe(this.bowl,'#4c968e',[[0,0],[.23,0],[.35,.035],[.45,.11],[.57,.28],[.69,.56],[.7,.61],[.67,.65],[.62,.63],[.6,.55],[.5,.32],[.36,.17],[.18,.12],[0,.12]],0,0,0);
  ring(this.bowl,'#eee1b9',0,.625,0,.665,.034,'glaze');ring(this.bowl,'#d7bc87',0,.047,0,.31,.027,'glaze');
  ring(this.bowl,'#b8dbbd',0,.49,0,.656,.012,'glaze');
  for(const a of [-.55,0,.55]){
   const r=.59,x=Math.sin(a)*r,z=Math.cos(a)*r;
   for(let p=0;p<5;p++){const t=p*Math.PI*2/5;ball(this.bowl,'#f2e5bf',x+Math.cos(t)*.058,.36+Math.sin(t)*.058,z,.037,.027,.012,'glaze');}
   ball(this.bowl,'#dca35d',x,.36,z+.014,.021,.021,.01,'glaze');
  }

  // Hollow wheel-thrown pitcher with a pulled pouring lip and a continuous curved handle.
  this.pitcher.position.set(1.18,1.81,-.33);this.pitcher.rotation.y=-.6;this.table.add(this.pitcher);
  const jug=lathe(this.pitcher,'#eedcba',[[0,0],[.24,0],[.33,.05],[.43,.22],[.48,.49],[.45,.76],[.34,.98],[.25,1.12],[.24,1.33],[.28,1.42],[.28,1.46],[.23,1.46],[.2,1.39],[.19,1.14],[.28,.97],[.37,.73],[.4,.47],[.35,.23],[.23,.13],[0,.13]],0,0,0);
  const positions=jug.geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++){
   const y=positions.getY(i),z=positions.getZ(i),x=positions.getX(i);
   const lip=T.MathUtils.smoothstep(y,1.24,1.46)*Math.pow(Math.max(0,z/Math.max(.001,Math.hypot(x,z))),8);
   positions.setXYZ(i,x,y+lip*.06,z+lip*.2);
  }
  jug.geometry.computeVertexNormals();
  const handle=new T.CubicBezierCurve3(new T.Vector3(.29,1.18,0),new T.Vector3(1.16,1.42,0),new T.Vector3(1.12,.22,0),new T.Vector3(.42,.35,0));
  mesh(this.pitcher,new T.TubeGeometry(handle,32,.075,10,false),'#d7c39e',0,0,0,'glaze');
  for(const [x,y] of [[.29,1.18],[.42,.35]])ball(this.pitcher,'#eedcba',x,y,0,.13,.1,.1,'glaze');
  for(const y of [.18,.23])ring(this.pitcher,'#629d95',0,y,0,y===.18?.409:.432,.022,'glaze');
  ring(this.pitcher,'#c49456',0,1.355,0,.249,.018,'glaze');
  const water=mesh(this.pitcher,new T.CircleGeometry(.19,32),'#548e90',0,1.15,0,'glaze');water.rotation.x=-Math.PI/2;
  rod(this.pitcher,'#c6985c',[0,.38,.48],[0,.78,.45],.011);
  for(let i=0;i<4;i++)for(const side of [-1,1]){const seed=ball(this.pitcher,'#c6985c',side*.055,.43+i*.085,.476-i*.003,.055,.022,.012,'glaze');seed.rotation.z=side*.55;}

  // A rolling pin, a scattering of flour and a flour crock on the lower shelf.
  rod(this.table,'#bd955e',[-.05,1.91,.85],[1.13,1.91,.85],.11,'wood');
  for(const side of [-1,1])rod(this.table,'#8d643b',[.54+side*.59,1.91,.85],[.54+side*.85,1.91,.85],.049,'wood');
  for(let i=0;i<14;i++){const a=i*2.399,r=.22+(i%4)*.09;ball(this.table,'#f3e5c6',-.65+Math.sin(a)*r,1.805,.17+Math.cos(a)*r,.025+(i%3)*.012,.003,.019);}
  lathe(this.table,'#c39e6c',[[0,0],[.3,0],[.37,.12],[.39,.5],[.32,.67],[.33,.72],[.28,.74],[.27,.67],[0,.65]],-1.2,.47,0,'plaster');
  ring(this.table,'#eee0bb',-1.2,1.19,0,.305,.026);box(this.table,'#f2e6c9',.75,.55,.05,1.15,.16,.72,'plaster',.065);

  // Stone piers leave a real open log store below the broad hearth slab.
  for(let row=0;row<3;row++)for(const side of [-1,1]){
   box(this.oven,['#aaa28b','#b9af96','#a09780'][row],side*2,.28+row*.43,0,.82,.4,3.4,'plaster',.065);
   for(const z of [-1.12,0,1.12])box(this.oven,'#c0b59d',side*2.04,.28+row*.43,z,.86,.39,1.08,'plaster',.055);
  }
  box(this.oven,'#897e68',0,.65,-1.48,3.6,1.1,.28,'plaster');
  box(this.oven,'#c9baa0',0,1.52,0,5.2,.3,4.05,'plaster',.085);
  box(this.oven,'#ddcaa5',0,1.69,.12,4.98,.1,4.12,'plaster');
  for(let i=0;i<8;i++){
   const x=(i%4-1.5)*.64,y=.32+Math.floor(i/4)*.4;
   const wood=rod(this.oven,i%2?'#775139':'#8b6040',[x,y,-1.15],[x+(i%2)*.08,y,.95-(i%3)*.13],.22,'wood');wood.rotation.z+=(i%3-1)*.04;
   const end=mesh(this.oven,new T.CircleGeometry(.19,16),'#d0ac72',x+(i%2)*.08,y,.96-(i%3)*.13);end.rotation.z=i*.6;
   for(const radius of [.075,.135]){const growth=ring(this.oven,'#a17a4f',end.position.x,y,end.position.z+.004,radius,.008);growth.rotation.x=0;growth.scale.y=.9;}
  }
  // The vaulted shell has an actual arched hole. No dark decal over a solid dome.
  const shell=new T.Shape();shell.moveTo(-2.32,1.75);shell.lineTo(2.32,1.75);shell.lineTo(2.32,2.2);shell.absarc(0,2.2,2.32,0,Math.PI,false);shell.closePath();
  const opening=new T.Path();opening.moveTo(-1.04,1.76);opening.lineTo(-1.04,2.52);opening.absarc(0,2.52,1.04,Math.PI,0,true);opening.lineTo(1.04,1.76);opening.closePath();shell.holes.push(opening);
  mesh(this.oven,new T.ExtrudeGeometry(shell,{depth:3.4,steps:1,curveSegments:32,bevelEnabled:true,bevelSegments:2,bevelSize:.065,bevelThickness:.05}),'#e6d2aa',0,0,-1.65,'plaster');
  const back=new T.Shape();back.moveTo(-1.02,1.75);back.lineTo(1.02,1.75);back.lineTo(1.02,2.52);back.absarc(0,2.52,1.02,0,Math.PI,false);back.closePath();
  mesh(this.oven,new T.ShapeGeometry(back,24),'#4b342c',0,0,-1.61,'plaster');
  const backCover=mesh(this.oven,new T.ShapeGeometry(back,24),'#e6d2aa',0,0,-1.76,'plaster');backCover.rotation.y=Math.PI;
  // Soot-darkened firebrick lines the cavity, leaving a warm, readable depth.
  mesh(this.oven,createInnerVault(),'#6f4935',0,0,0,'plaster');
  for(const side of [-1,1])box(this.oven,'#704b39',side*1.025,2.12,.05,.025,.72,3.25,'plaster',.005);
  box(this.oven,'#604432',0,1.78,.04,2.03,.035,3.25,'plaster',.01);
  for(let row=0;row<4;row++)for(let i=0;i<4;i++){
   const x=(i-1.5)*.49+(row%2)*.12,y=1.94+row*.35;
   if(Math.abs(x)+.23>1.02||y>2.52&&x*x+(y-2.52)**2>.9**2)continue;
   box(this.oven,(i+row)%2?'#77513b':'#6b4433',x,y,-1.57,.465,.325,.04,'plaster',.012);
  }
  // Individually fitted terracotta voussoirs and jambs, with narrow mortar seams.
  for(let i=0;i<13;i++){
   const a=i*Math.PI/13+.014,b=(i+1)*Math.PI/13-.014,s=new T.Shape();
   s.absarc(0,0,1.41,a,b,false);s.absarc(0,0,1.055,b,a,true);s.closePath();
   mesh(this.oven,new T.ExtrudeGeometry(s,{depth:.27,curveSegments:3,bevelEnabled:true,bevelSegments:1,bevelSize:.022,bevelThickness:.018}),['#b56a4b','#c47c54','#a95e43','#cd8960'][i%4],0,2.52,1.74,'plaster');
  }
  for(const side of [-1,1])for(let row=0;row<3;row++)box(this.oven,['#b76d4d','#c47c54','#ad6044'][row],side*1.24,1.87+row*.255,1.88,.36,.235,.3,'plaster',.024);
  // Low side ledges and brick courses wrap the spring of the pale vault.
  for(const side of [-1,1])for(let i=0;i<5;i++)box(this.oven,i%2?'#b66c4b':'#c17a54',side*2.3,1.92,-1.35+i*.66,.22,.29,.63,'plaster',.03);
  box(this.oven,'#b9aa8e',0,1.73,2.05,3.25,.15,.65,'plaster',.05);
  // Brick chimney grows directly out of the rear vault; cap, throat and dark flue are separate.
  box(this.oven,'#c29b76',-.87,4.68,-.92,1.05,2.45,1.04,'plaster',.035);
  for(let row=0;row<8;row++)for(let i=0;i<2;i++)for(const side of [-1,1]){
   const x=-.87+(i-.5)*.52;
   box(this.oven,['#b56c4e','#c7825c','#b97551'][(row+i)%3],x,3.63+row*.29,-.92+side*.535,.49,.26,.08,'plaster',.012);
   box(this.oven,['#b56c4e','#c7825c','#b97551'][(row+i+1)%3],-.87+side*.535,3.63+row*.29,-.92+(i-.5)*.52,.08,.26,.49,'plaster',.012);
  }
  box(this.oven,'#c9ac83',-.87,5.99,-.92,1.3,.17,1.29,'plaster');
  box(this.oven,'#322c27',-.87,6.085,-.92,.83,.025,.82);
  for(const x of [-1.36,-.38])for(const z of [-1.41,-.43])box(this.oven,'#a36a4c',x,6.24,z,.15,.44,.15,'plaster');
  box(this.oven,'#ba7955',-.87,6.5,-.92,1.55,.19,1.55,'plaster',.045);
  box(this.oven,'#d29a6e',-.87,6.62,-.92,1.3,.08,1.3,'plaster');

  // Iron fittings, a wheat medallion and a peel leaning against the right side.
  for(const side of [-1,1]){
   box(this.oven,'#4d5148',side*1.9,1.6,2.053,.15,.35,.04,'iron',.01);
   for(const y of [1.48,1.72])ball(this.oven,'#7b7760',side*1.9,y,2.08,.031,.031,.02,'iron');
  }
  const badge=mesh(this.oven,new T.CylinderGeometry(.32,.32,.065,32),'#61988b',0,4.08,1.87,'glaze');badge.rotation.x=Math.PI/2;
  rod(this.oven,'#f0d3a0',[0,3.88,1.917],[0,4.28,1.917],.013);
  for(let i=0;i<4;i++)for(const side of [-1,1]){const seed=ball(this.oven,'#f0d3a0',side*.07,3.96+i*.072,1.92,.064,.025,.015);seed.rotation.z=side*.65;}
  const peel=new T.Group();peel.name='Wooden bread peel';peel.position.set(2.72,.13,1.1);peel.rotation.set(-.16,0,-.13);this.oven.add(peel);
  box(peel,'#c39b62',0,.58,0,.9,1.05,.105,'wood',.16);
  rod(peel,'#9c7547',[0,1,0],[0,3.75,0],.066,'wood',.052);
  ring(peel,'#6c5940',0,3.73,.005,.085,.018).rotation.x=0;
  box(this.oven,'#8a6b45',2.38,.14,-1.02,.55,.22,.85,'wood');

  // Warm coals and a few small sculpted flame tongues illuminate themselves only.
  this.fire.position.set(-.33,1.82,.15);this.oven.add(this.fire);
  rod(this.fire,'#49362d',[-.44,.08,0],[.47,.08,0],.09,'plain');
  rod(this.fire,'#594032',[-.32,.1,-.18],[.28,.1,.2],.075,'plain');
  for(let i=0;i<11;i++)ball(this.fire,i%2?'#e89a3e':'#b85e2d',Math.sin(i*5)*.43,.08,Math.cos(i*3)*.24,.08,.035,.06,'ember');
  for(let i=0;i<4;i++){
   const flame=lathe(this.fire,i%2?'#ffc26a':'#ed8d38',[[0,0],[.13,.05],[.16,.17],[.1,.38],[.04,.55],[0,.7]],(i-1.5)*.2,.08,(i%2)*.1,'ember');
   flame.scale.set(.7,.65+(i%3)*.17,.65);flame.rotation.z=(i-1.5)*.15;
  }
  // A quiet pad of irregular stone flags connects the oven feet to the grass.
  for(let x=0;x<5;x++)for(let z=0;z<5;z++){
   const stone=box(this.oven,['#aaa18a','#b4ab93','#a59b84'][(x+z*2)%3],(x-2)*1.08,.045,(z-1.8)*1.03,1.045,.12,.995,'plaster',.09);stone.rotation.y=Math.sin(x*7+z*3)*.018;
  }

  // Batch compatible details once. Glaze, oak, plaster, iron and embers keep their finishes.
  const parents:T.Group[]=[];this.group.traverse(o=>{if(o instanceof T.Group)parents.push(o);});
  for(const parent of parents)batchRigidMeshes(parent);
  // Attach surface maps after batching: serializing texture pixels per tiny source
  // part would add seconds to startup. Cloned materials retain the finish marker.
  this.group.traverse(o=>{
   if(!(o instanceof T.Mesh)||!(o.material instanceof T.MeshStandardMaterial))return;
   const m=o.material,finish=m.userData.bakeryFinish;
   if(finish==='wood'||finish==='plaster'){
    m.map=m.bumpMap=finish==='wood'?grain:speckle;m.bumpScale=finish==='wood'?.028:.045;
   }
  });
  // Quest contents stay outside the static batches so their silhouettes can change.
  this.flour.name='Freshly milled flour sack';this.group.add(this.flour);
  lathe(this.flour,'#d6bc8b',[[0,0],[.23,0],[.37,.12],[.4,.49],[.32,.76],[.35,.83],[.29,.86],[.25,.8],[0,.77]],0,0,0,'plaster');
  ring(this.flour,'#8d754d',0,.77,0,.31,.025);ball(this.flour,'#faf0d5',0,.79,0,.29,.08,.29);
  this.mixture.name='Flour and kneaded dough in bowl';this.mixture.position.set(0,.24,0);this.bowl.add(this.mixture);
  this.dough.name='Carried dough';ball(this.dough,'#f3dfb1',0,0,0,.55,.32,.45,'plaster');this.group.add(this.dough);
  this.ovenBread.name='Baking bread';this.ovenBread.position.set(0,1.97,.8);this.oven.add(this.ovenBread);
  this.pitcherRest.copy(this.pitcher.position);
  this.steam=new T.InstancedMesh(new T.SphereGeometry(1,8,6),new T.MeshBasicMaterial({color:'#fff2db',transparent:true,opacity:.18,depthWrite:false}),8);this.steam.name='Fresh bread steam';this.steam.frustumCulled=false;this.group.add(this.steam);
  this.flour.visible=this.mixture.visible=this.dough.visible=this.ovenBread.visible=this.steam.visible=false;
 }

 setBreadModel(source:T.Object3D){
  source.traverse(o=>{if(o instanceof T.Mesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();o.castShadow=o.receiveShadow=true;}});
  const box=new T.Box3().setFromObject(source),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
  source.position.sub(center);const normalized=new T.Group();normalized.add(source);normalized.scale.setScalar(1.15/size.y);normalized.rotation.x=-Math.PI/2;this.ovenBread.clear();this.ovenBread.add(normalized);
 }
 update(dt:number,q?:MillQuest,now=0,owner?:T.Object3D){
  this.elapsed+=dt;
  this.fire.scale.y=.96+Math.sin(this.elapsed*5.2)*.025+Math.sin(this.elapsed*8.7)*.018;
  if(!q)return;
  this.flour.visible=q.stage==='knead'&&q.kneadStep<2;
  this.flour.position.set(MILL_HOPPER[0]+1.2,0,MILL_HOPPER[2]+.7);
  this.mixture.visible=q.stage==='knead'&&q.kneadStep>=2;
  const kneads=Math.max(0,q.kneadStep-2),pulse=Math.exp(-Math.max(0,now-q.updatedAt)/180)*Math.sin(Math.max(0,now-q.updatedAt)/80);
  this.mixture.scale.set(.49+Math.abs(pulse)*.05,.1+kneads*.035-pulse*.025,.45+Math.abs(pulse)*.04);
  (this.mixture.material as T.MeshStandardMaterial).color.set(q.kneadStep===2?'#f4ead3':'#edd5a4');
  this.dough.visible=q.stage==='bake'&&!q.bakeAt;
  const carry=q.stage==='knead'&&q.kneadStep===1?this.flour:this.dough.visible?this.dough:undefined;
  if(carry){
   carry.visible=!!owner;
   if(owner){
    const hand=owner.getObjectByName('Left_hand_attachment')??owner.getObjectByName('Right_arm')??owner.getObjectByName('Right_wing');
    const shoulder=owner.getObjectByName(owner.getObjectByName('Left_hand_attachment')?'Left_shoulder':'Right_shoulder');if(shoulder)shoulder.rotation.set(-.38,-.3,.24);
    owner.updateWorldMatrix(true,true);
    if(hand){this.scratch.set(.24,0,0);hand.localToWorld(this.scratch);}else this.scratch.set(1.1,.9,.25).multiplyScalar(owner.scale.x).applyQuaternion(owner.quaternion).add(owner.position);
    this.group.worldToLocal(this.scratch);carry.position.copy(this.scratch);carry.quaternion.copy(owner.quaternion);carry.scale.setScalar(Math.max(.65,owner.scale.x*.55));
   }
  }else{this.flour.scale.setScalar(1);this.flour.quaternion.identity();}
  // Short pouring gesture, followed by a gentle bowl squash with each knead.
  const pouring=q.stage==='knead'&&q.kneadStep===2?Math.max(0,1-(now-q.updatedAt)/700):0;
  this.pitcher.position.copy(this.pitcherRest);this.pitcher.position.x-=pouring*.8;this.pitcher.position.y+=pouring*.3;this.pitcher.rotation.z=pouring*.65;
  this.ovenBread.visible=q.stage==='bake'&&q.bakeAt>0;
  const baked=q.bakeAt>0?T.MathUtils.clamp((now-q.bakeAt)/MILL_BAKE_MS,0,1):0;
  this.ovenBread.scale.set(1,.65+baked*.35,.85+baked*.15);
  this.ovenBread.traverse(o=>{if(o instanceof T.Mesh){const m=o.material as T.MeshStandardMaterial;if(m.color)m.color.setRGB(1,.83+baked*.17,.6+baked*.4);}});
  this.steam.visible=this.ovenBread.visible&&baked>.6;
  if(this.steam.visible){for(let i=0;i<8;i++){const t=(this.elapsed*.35+i/8)%1;this.dummy.position.set(MILL_BAKERY_OVEN.x+Math.sin(i*4+t)*.3,2.2+t*1.6,MILL_BAKERY_OVEN.z+1.3+Math.cos(i*3)*.2);this.dummy.scale.setScalar(Math.sin(t*Math.PI)*.12);this.dummy.updateMatrix();this.steam.setMatrixAt(i,this.dummy.matrix);}this.steam.instanceMatrix.needsUpdate=true;}
 }

 constrain(position:T.Vector3,size:number){
  const padding=.65*size;
  for(const p of MILL_BAKERY_FOOTPRINTS){
   if(position.y>p.height+.1)continue;
   const dx=position.x-p.x,dz=position.z-p.z,hx=p.halfX+padding,hz=p.halfZ+padding;
   if(Math.abs(dx)>=hx||Math.abs(dz)>=hz)continue;
   if(hx-Math.abs(dx)<hz-Math.abs(dz))position.x=p.x+(dx<0?-hx:hx);
   else position.z=p.z+(dz<0?-hz:hz);
  }
 }
}

function linenProfile(){return [[-.72,1.82],[-.25,1.829],[.25,1.827],[.72,1.82],[1.16,1.818],[1.28,1.79],[1.36,1.68],[1.39,1.47],[1.41,1.23]];}
function createInnerVault(){
 const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
 for(let i=0;i<=40;i++)for(let j=0;j<2;j++){
  const a=i/40*Math.PI;positions.push(Math.cos(a)*1.025,2.52+Math.sin(a)*1.025,j?1.72:-1.59);uvs.push(i/40,j);
  if(i<40){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function createLinenGeometry(){
 const profile=linenProfile(),positions:number[]=[],uvs:number[]=[],indices:number[]=[];
 for(let j=0;j<profile.length;j++)for(let i=0;i<=12;i++){
  const x=(i/12-.5)*1.22,fold=Math.sin(i/12*Math.PI*6)*.008;
  positions.push(x,profile[j][1]+fold,profile[j][0]+Math.sin(i)*.004);uvs.push(i/12,j/(profile.length-1));
  if(j<profile.length-1&&i<12){const a=j*13+i;indices.push(a,a+13,a+1,a+1,a+13,a+14);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

/** Tiny deterministic surface maps; all fine detail is baked once, never per frame. */
function createSurfaceTexture(wood:boolean){
 const size=256,data=new Uint8Array(size*size*4);let seed=wood?7129:517;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,warp=Math.sin(u*Math.PI*2)*.7+Math.sin(u*Math.PI*6)*.16;
  const lines=Math.sin(v*Math.PI*48+warp+Math.sin(u*Math.PI*4)*Math.sin(v*Math.PI*8)*.4);
  const value=wood?239+lines*6-Math.pow(Math.max(0,lines),12)*7+(random()-.5)*6:246+(random()-.5)*15;
  const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=Math.round(value);data[i+3]=255;
 }
 const texture=new T.DataTexture(data,size,size);texture.name=wood?'Soft oak fibres':'Fine ceramic and limewash grain';texture.colorSpace=T.SRGBColorSpace;
 texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}
