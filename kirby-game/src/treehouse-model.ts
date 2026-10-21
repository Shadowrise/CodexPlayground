import * as T from 'three';
import {CraftedProps} from './crafted-props';
import {makeGreatOak,greatOakBark} from './great-oak';
import {treeLeafMaterial} from './broadleaf-tree';
import {makeOakBench} from './bench-model';
import {treeShadows} from './tree-shadows';
import {roofTilePitch,roofTileSpan,roofTileLength} from './roof-tiles';
import {OAK_TONES} from './crafted-surfaces';
import {TREEHOUSE_DECK_HEIGHT as DECK} from './treehouse-site';

const v=(p:readonly number[])=>new T.Vector3(...p);
function timber(b:CraftedProps,a:number[],end:number[],r:number,c='#8e6944'){
 const from=v(a),to=v(end),m=b.cylinder(c,(from.x+to.x)/2,(from.y+to.y)/2,(from.z+to.z)/2,r,r,from.distanceTo(to),'oak',10);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),to.sub(from).normalize());return m;
}
function rope(b:CraftedProps,points:T.Vector3[],r=.043){
 const curve=points.length===2?new T.LineCurve3(points[0],points[1]):new T.CatmullRomCurve3(points),g=new T.TubeGeometry(curve,points.length===2?1:16,r,6,false);
 return b.mesh(g,'#c8b38a',0,0,0,1,1,1,'rope');
}

/** Static building parts use a handful of merged finishes. Swing ropes, knots
 * and planks share the existing pivot and exact rider contact surface. */
export function makeTreehouseModel(swing:T.Group){
 const root=new T.Group(),b=new CraftedProps(),ladder=new CraftedProps(),s=new CraftedProps();
 const oak=makeGreatOak();
 for(const [name,g] of [['Great oak trunk and branches',oak.wood],['Organic oak swing bough',oak.bough]] as const){const m=new T.Mesh(g,greatOakBark());m.name=name;m.castShadow=m.receiveShadow=true;root.add(m);}
 const canopy=new T.Mesh(oak.leaves,treeLeafMaterial().clone());canopy.name='Oak leaf canopy';canopy.material.color.set('#518245');canopy.position.z=-6;root.add(canopy);
 const boughLeaves=new T.Mesh(oak.boughLeaves,canopy.material);boughLeaves.name='Leafy twigs on the swing bough';root.add(boughLeaves);
 root.add(treeShadows([new T.Matrix4().compose(new T.Vector3(0,.018,-6),new T.Quaternion(),new T.Vector3(10,1,10))]));
 // Deck: worn board edges, end grain, real joists, pegged braces and fascia.
 for(let i=0;i<30;i++){
  const x=-5.8+i*.4;b.box(OAK_TONES[i%6],x,DECK-.13,2,.37,.26,12,'oak');
  for(const z of [-3.6,1.8,7.6])b.cylinder('#68553e',x,DECK+.009,z,.026,.026,.016,'metal',6);
 }
 for(const x of [-5,0,5]){b.box('#765536',x,DECK-.46,2,.33,.6,12.4,'oak',true);timber(b,[x,DECK-.6,6],[0,13,-6],.18);}
 for(const z of [-4.15,8.15]){b.box('#9b734a',0,DECK-.2,z,12.3,.43,.19,'oak',true);b.box('#d0ac76',0,DECK+.01,z,12.37,.08,.22,'oak',true);}
 for(const x of [-6.1,6.1])b.box('#a27b4f',x,DECK-.2,2,.17,.43,12.4,'oak',true);
 const post=(x:number,z:number)=>{
  b.box('#a47c50',x,DECK+.77,z,.14,1.5,.14,'oak',true);
  b.box('#c3a06c',x,DECK+.16,z,.21,.18,.21,'oak');
  b.box('#d1ae78',x,DECK+1.59,z,.28,.11,.28,'oak');
 };
 for(const x of [-6,6]){
  for(let i=0;i<=12;i++)post(x,-4+i);
  b.box('#c6a16b',x,DECK+1.68,2,.24,.15,12.4,'oak',true);b.box('#946f49',x,DECK+.34,2,.12,.1,12,'oak');
 }
 for(const z of [-4,8])for(let i=0;i<=12;i++){
  const x=-6+i;if(z===8&&(x===-4||x===-3))continue;post(x,z);
  if(x<6&&!(z===8&&(x===-5||x===-4))){b.box('#c6a16b',x+.5,DECK+1.68,z,1.1,.15,.24,'oak',true);b.box('#946f49',x+.5,DECK+.34,z,1.05,.1,.12,'oak');}
 }
 // Cabin siding and mortised corners; roof courses keep their original gaps.
 for(let i=0;i<15;i++){
  const y=DECK+.3+i*.23;b.box(['#bc915e','#c8a06a','#b48a58'][i%3],0,y,-3.1,7,.21,.18,'oak');
  for(const x of [-3.5,3.5])b.box(['#bd935e','#c6a06c','#b58a56'][i%3],x,y,-1.4,.18,.21,3.5,'oak');
 }
 for(const x of [-3.5,3.5])for(const z of [-3.15,.4]){
  b.box('#765638',x,DECK+2,z,.26,4,.26,'oak',true);
  for(const y of [DECK+.35,DECK+3.55])b.cylinder('#66523a',x,y,z+.145,.04,.04,.02,'metal',6).rotation.x=Math.PI/2;
 }
 b.box('#997249',0,DECK+3.8,.4,7.3,.3,.25,'oak',true);
 for(const side of [-1,1]){
  const brace=b.box('#b08a57',side*3.07,DECK+3.38,.4,1.25,.13,.16,'oak',true);brace.rotation.z=side*Math.PI/4;
  b.box('#755235',side*1.935,DECK+4.48,-1.555,4.5,.08,4.72,'oak').rotation.z=-side*Math.atan2(.22,.43);
  for(let row=0;row<9;row++)for(let col=0;col<12;col++)b.box(['#477362','#587f65','#668b6c','#4e7d69'][(row+col)%4],side*(row+.5)*.43,DECK+5.5-row*.22,-3.7+col*.39,roofTileLength(.43,.22,.12,row===0?.43:undefined),.12,roofTileSpan(.39),'paint').rotation.z=-side*roofTilePitch(.43,.22);
  for(const z of [-3.96,1.04])b.box('#d5b17a',side*1.98,DECK+4.55,z,4.46,.19,.16,'oak',true).rotation.z=-side*Math.atan2(.22,.43);
  b.box('#a07b4f',side*3.94,DECK+3.68,-1.45,.17,.21,5.1,'oak',true);
 }
 for(let i=0;i<13;i++)b.cylinder('#a6aa78',0,DECK+5.64,-3.9+i*.39,.17,.17,.37,'paint',10).rotation.x=Math.PI/2;
 // Inset panes, louvered shutters, sills, planter rims and flowers.
 for(const x of [-2.1,2.1]){
  b.box('#694e36',x,DECK+2.3,-2.96,1.6,1.9,.14,'oak',true);b.box('#94b8b7',x,DECK+2.3,-2.86,1.3,1.6,.06,'ceramic');
  for(const dx of [-.72,0,.72])b.box('#dfbd86',x+dx,DECK+2.3,-2.79,.07,1.76,.09,'oak');
  for(const y of [DECK+1.44,DECK+2.3,DECK+3.17])b.box('#dfbd86',x,y,-2.78,1.51,.07,.1,'oak');
  for(const side of [-1,1]){
   b.box('#396c61',x+side*.98,DECK+2.3,-2.8,.43,1.8,.12,'paint',true);
   for(let j=0;j<6;j++)b.box(j%2?'#568b78':'#659781',x+side*.98,DECK+1.59+j*.28,-2.72,.39,.19,.07,'paint').rotation.x=-.15;
   for(const y of [DECK+1.69,DECK+2.92])b.box('#9d9d73',x+side*.8,y,-2.66,.16,.07,.025,'metal');
  }
  b.box('#b17d52',x,DECK+1.29,-2.5,1.75,.32,.5,'oak',true);b.box('#d0ab76',x,DECK+1.48,-2.5,1.87,.065,.59,'oak',true);b.box('#62533b',x,DECK+1.515,-2.5,1.66,.025,.38,'stone');
  for(let j=0;j<6;j++){
   const xx=x-.58+j*.23,yy=DECK+1.81+(j%2)*.08;b.stem('#587744',new T.Vector3(xx,DECK+1.53,-2.5),new T.Vector3(xx,yy,-2.5),.015);b.leaf('#6a8b51',xx,DECK+1.62,-2.5,.19,j*2);
   for(let k=0;k<5;k++){const a=k*Math.PI*2/5;b.ball(j%2?'#dfb866':'#da9fab',xx+Math.cos(a)*.065,yy+Math.sin(a)*.065,-2.5,.065,.065,.035,'paint');}
   b.ball('#ad894a',xx,yy,-2.455,.032,.032,.018,'paint');
  }
 }
 // A small writing nook and supplies inside, clear of the walking balcony.
 for(const x of [-2.85,-1.55])for(const z of [-1.8,-.9])b.box('#87623f',x,DECK+.6,z,.1,1.17,.1,'oak',true);
 b.box('#c4a06b',-2.2,DECK+1.25,-1.35,1.65,.15,1.22,'oak',true);b.box('#ad8050',-2.2,DECK+1.05,-.78,1.4,.23,.08,'oak',true);b.ball('#c2a66a',-2.2,DECK+1.06,-.72,.044,.044,.03,'metal');
 b.box('#ecddba',-2.25,DECK+1.342,-1.27,.64,.025,.53,'linen');b.box('#6c8b80',-1.78,DECK+1.38,-1.62,.38,.12,.51,'linen',true);
 b.lathe('#799e8d',-2.75,DECK+1.33,-1.62,[[0,0],[.12,0],[.15,.26],[.125,.28],[.105,.26],[.1,.04],[0,.04]]);
 const cup=b.ring('#799e8d',-2.59,DECK+1.5,-1.62,.09,.02,'ceramic');cup.scale.x=.75;
 for(const x of [-2.48,-1.92])for(const z of [-.15,.4])b.box('#9c774b',x,DECK+.47,z,.1,.85,.1,'oak');
 b.cylinder('#bb9962',-2.2,DECK+.94,.1,.4,.42,.15,'oak',12);
 b.box('#b28b56',2.35,DECK+.42,-1.53,1.42,.72,.93,'wicker',true);b.box('#c7a26b',2.35,DECK+.83,-1.53,1.54,.13,1.04,'oak',true);b.box('#7c9b89',2.35,DECK+.97,-1.53,1.24,.16,.85,'linen',true);
 b.box('#b28b56',3.24,DECK+2.47,-1.3,.5,.13,2.1,'oak',true);
 for(let i=0;i<6;i++)b.box(['#c18c74','#78988b','#cfb078'][i%3],3.2,DECK+2.77,-2.1+i*.28,.33,.46+i%3*.08,.19,'linen',true);
 // Deck rug and the shared interactive bench retain their authored positions.
 b.box('#718f7d',1,DECK+.027,2,3,.04,2,'linen');
 for(const z of [1.08,2.92])b.box('#d1c3a0',1,DECK+.052,z,2.9,.008,.07,'linen');
 const bench=makeOakBench(2.5,.72);bench.name='Oak lookout bench';bench.position.set(-2,DECK,1.36);root.add(bench);
 // Articulated brass telescope, focus rings, dark lens and pegged tripod.
 timber(b,[4,DECK,5],[4,DECK+1.3,5],.07,'#737463');
 for(let i=0;i<3;i++){const a=i*Math.PI*2/3;timber(b,[4,DECK+.9,5],[4+Math.cos(a)*.7,DECK,5+Math.sin(a)*.7],.045);}
 const axis=new T.Vector3(0,.4,1.3).normalize(),orientation=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),axis);
 for(const [t,radius,length,color] of [[0,.16,.53,'#b2955b'],[.46,.19,.66,'#c2a765'],[.96,.215,.18,'#d4b97b']] as const){const p=new T.Vector3(4,DECK+1.4,4.6).addScaledVector(axis,t);b.cylinder(color,p.x,p.y,p.z,radius,radius,length,'metal',16).quaternion.copy(orientation);}
 const lensPosition=new T.Vector3(4,DECK+1.4,4.6).addScaledVector(axis,1.061),lens=b.mesh(new T.CircleGeometry(.186,16),'#334f54',...lensPosition.toArray(),1,1,1,'ceramic');lens.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),axis);
 // Lantern housings, suspension eyes and framed sign backing.
 for(const x of [-5.5,5.5]){
  timber(b,[x,DECK+1.7,7],[x,DECK+2.5,7],.025,'#776144');
  b.box('#ead49c',x,DECK+2.15,7,.3,.43,.3,'paint',true);b.box('#6d7155',x,DECK+1.91,7,.4,.07,.4,'metal',true);b.cylinder('#6d7155',x,DECK+2.43,7,.1,.31,.17,'metal',4);
  for(const dx of [-.18,.18])for(const dz of [-.18,.18])b.box('#7d7956',x+dx,DECK+2.15,7+dz,.025,.46,.025,'metal');
 }
 b.box('#aa8a58',0,22.1,.57,3.8,.82,.12,'oak',true);
 for(const x of [-1.78,1.78])for(const y of [21.8,22.4])b.ball('#d0ba79',x,y,.65,.037,.037,.02,'metal');
 for(let i=0;i<15;i++){
  const x=-3.4+i*.48,y=21.65-.35*Math.sin(i/14*Math.PI);rope(b,[new T.Vector3(x,y,.6),new T.Vector3(x+.48,21.65-.35*Math.sin((i+1)/14*Math.PI),.6)],.014);
  const flag=new T.Shape();flag.moveTo(-.12,0);flag.lineTo(.12,0);flag.lineTo(0,-.34);flag.closePath();const pennant=b.mesh(new T.ShapeGeometry(flag),'#'+new T.Color(['#d5957e','#dec580','#77a69c'][i%3]).getHexString(),x,y,.6,1,1,1,'linen');(pennant.material as T.MeshStandardMaterial).side=T.DoubleSide;
 }
 // The long ladder keeps its interaction coordinates and a cheap shadow slab.
 for(const x of [-4.9,-3.1])timber(ladder,[x,0,11],[x,18.8,7.3],.11,'#9b764c');
 for(let i=0;i<50;i++){
  const y=.3+i*.37,z=11-y*3.7/18.8;timber(ladder,[-4.95,y,z],[-3.05,y,z],.095,'#c4a16d');
  for(const x of [-4.9,-3.1])ladder.cylinder('#c8b48c',x,y,z,.14,.14,.16,'rope',8).rotation.x=-.195;
 }
 const ladderGroup=ladder.finish('Bound oak ladder');ladderGroup.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=false;});root.add(ladderGroup);
 const ladderShadow=new T.Mesh(new T.BoxGeometry(2.1,Math.hypot(18.8,3.7),.22),new T.MeshBasicMaterial({colorWrite:false,depthWrite:false}));ladderShadow.name='Stable ladder shadow';ladderShadow.position.set(-4,9.4,9.15);ladderShadow.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(0,18.8,-3.7).normalize());ladderShadow.castShadow=true;root.add(ladderShadow);
 // Saddles sit on the organic limb; the rope pivot is unchanged for networking.
 for(const [i,x] of [-12.45,-9.55].entries()){
  const band=b.ring('#82724e',x,7.9,3,.46,.045,'metal');band.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),v(oak.bough.userData.ropeTangents[i]));
  const eye=b.ring('#a18b5c',x,7.45,3,.092,.027,'metal');eye.rotation.y=Math.PI/2;
 }
 swing.position.set(-11,7.5,3);
 for(const x of [-1.45,1.45]){
  rope(s,[new T.Vector3(x,0,0),new T.Vector3(x,-5.7,0)]);
  for(const y of [-.15,-.25,-5.49,-5.57]){const knot=s.ring('#c2ac7c',x,y,0,.074,.028,'rope');knot.rotation.x=Math.PI/2;}
  s.box('#967045',x,-5.87,0,.18,.16,1.7,'oak',true);s.ball('#b79b61',x,-5.596,.45,.035,.012,.035,'metal');
 }
 for(let i=0;i<5;i++)s.box(OAK_TONES[i%6],0,-5.7,-.65+i*.32,3.3,.18,.28,'oak',true);
 swing.add(s.finish('Worn oak swing seat and braided ropes'));root.add(swing);
 root.add(b.finish('Crafted oak lookout'));return root;
}
