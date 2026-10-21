import * as T from 'three';
import {CraftedProps} from './crafted-props';

let picnic:T.Group|undefined,ruins:T.Group|undefined;
const limestone=['#b5b29a','#c3bfa5','#aaa98f','#bcb89c','#cfcaaf'];

function picnicCloth(){
 const positions:number[]=[],colors:number[]=[],uvs:number[]=[];
 const red=new T.Color('#be7774'),cream=new T.Color('#f2e4c6');
 const point=(i:number,j:number)=>{
  const x=(i/16-.5)*4.8,z=(j/12-.5)*3.6,edge=Math.max(Math.abs(x)/2.4,Math.abs(z)/1.8);
  return [x,.065+Math.pow(edge,5)*(.025+.023*Math.sin(x*6+z*5))+.012*Math.sin(x*3-z*2),z];
 };
 for(let i=0;i<16;i++)for(let j=0;j<12;j++){
  const color=(Math.floor(i/2)+Math.floor(j/2))%2?red:cream;
  for(const [x,z] of [[i,j],[i,j+1],[i+1,j+1],[i,j],[i+1,j+1],[i+1,j]]){positions.push(...point(x,z));colors.push(color.r,color.g,color.b);uvs.push(x/5,z/5);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.computeVertexNormals();return g;
}

export function makePicnic(){
 if(picnic)return picnic.clone();const b=new CraftedProps();
 const cloth=b.mesh(picnicCloth(),'#ffffff',0,0,0,1,1,1,'linen');(cloth.material as T.MeshStandardMaterial).vertexColors=true;
 for(const z of [-1.83,1.83])for(let i=0;i<31;i++)b.box('#e3cdab',-2.25+i*.15,.055,z,.025,.014,.16,'linen');
 // Open woven basket, alternating reeds and a real arched carrying handle.
 b.box('#ad824c',1,.19,.65,1.15,.17,.8,'wicker',true);
 for(const z of [.25,1.05])b.box('#bb9258',1,.55,z,1.2,.64,.08,'wicker',true);
 for(const x of [.42,1.58])b.box('#bb9258',x,.55,.65,.08,.64,.8,'wicker',true);
 for(let i=0;i<5;i++){
  for(const z of [.2,1.1])b.box(i%2?'#c9a66c':'#a77b47',1,.29+i*.122,z,1.22,.028,.025,'wicker');
  for(const x of [.38,1.62])b.box(i%2?'#c9a66c':'#a77b47',x,.29+i*.122,.65,.025,.028,.9,'wicker');
 }
 for(let i=0;i<12;i++)for(const z of [.192,1.108])b.box(i%2?'#d1af76':'#bd965f',.46+i*.098,.55,z,.025,.62,.018,'wicker');
 for(const z of [.19,1.11])b.box('#d0aa6e',1,.9,z,1.26,.07,.065,'wicker',true);
 for(const x of [.37,1.63])b.box('#d0aa6e',x,.9,.65,.065,.07,.91,'wicker',true);
 const handle=b.mesh(new T.TorusGeometry(.57,.045,4,20,Math.PI),'#a97e48',1,.88,.65,1,1,.8,'wicker');handle.name='Basket woven handle';
 const lid=b.box('#c7a16a',1,.98,.08,1.22,.075,.73,'wicker',true);lid.rotation.x=-.6;
 for(let i=0;i<7;i++){const seam=b.box('#a87f4d',.49+i*.17,1,.07,.015,.018,.72,'wicker');seam.rotation.x=-.6;}
 b.box('#eee0c0',.86,.94,.74,.52,.035,.47,'linen');
 // Porcelain with a raised rim, concentric glaze bands and food.
 const plate=(x:number,z:number)=>{
  b.lathe('#f5e5c7',x,.09,z,[[0,0],[.25,0],[.39,.025],[.44,.055],[.45,.08],[.42,.095],[.35,.04],[0,.035]]);
  const rim=b.ring('#6c9c91',x,.16,z,.398,.013,'ceramic');rim.rotation.x=Math.PI/2;
 };
 plate(-1.35,-.48);plate(-.46,.78);
 b.lathe('#6e9a8c',-.45,.11,-.67,[[0,0],[.14,0],[.18,.29],[.17,.33],[.145,.31],[.115,.06],[0,.06]]);
 const cup=b.ring('#6e9a8c',-.24,.3,-.67,.11,.027,'ceramic');cup.scale.x=.75;
 b.lathe('#d4a16a',-.45,.392,-.67,[[0,0],[.145,0],[.145,.005],[0,.005]],'paint');
 b.lathe('#d9bd8b',.17,.1,-.7,[[0,0],[.23,0],[.25,.04],[.26,.42],[.18,.55],[.12,.57],[.12,.66],[.15,.67],[.15,.72],[.1,.74]],'ceramic');
 b.cylinder('#b57658',.17,.86,-.7,.1,.1,.09,'oak');
 b.box('#f1dfb8',.17,.47,-.451,.28,.2,.018,'linen',true);
 // Bread on a small board; shallow diagonal cuts catch the sunlight.
 b.box('#bf985e',-1.27,.16,-.46,.67,.065,.51,'oak',true);
 b.ball('#c48b4a',-1.27,.31,-.46,.36,.17,.19,'paint');
 for(let i=0;i<3;i++){const cut=b.box('#efca8b',-1.43+i*.15,.467,-.46,.025,.012,.17,'paint',true);cut.rotation.y=-.45;}
 b.box('#e2bb68',-.51,.2,.78,.38,.12,.28,'paint',true);
 for(const [x,z,c,s] of [[.77,.62,'#c8624b',.19],[1.16,.65,'#d5ae52',.2],[1.39,.58,'#8da45b',.16]] as const){
  b.ball(c,x,.93,z,s,s*.9,s,'paint');b.stem('#765c3c',new T.Vector3(x,1.05,z),new T.Vector3(x+.025,1.17,z),.018,'oak');b.leaf('#63874e',x,1.1,z,.14,2);
 }
 for(let i=0;i<8;i++)b.ball(i%2?'#6e688b':'#807798',-.35+(i%3)*.09,.27+Math.floor(i/3)*.07,.8+(i%2)*.1,.065,.064,.065,'paint');
 // Folded napkin, simple stainless cutlery and a tied cloth corner.
 b.box('#73958a',-1.3,.12,.69,.51,.045,.52,'linen',true).rotation.y=.15;
 for(const x of [-1.42,-1.23]){b.box('#c9cbbd',x,.16,.72,.032,.018,.4,'metal',true);b.ball('#c9cbbd',x,.16,.47,.065,.018,.08,'metal');}
 picnic=b.finish('Woven picnic with porcelain and lunch');return picnic.clone();
}

export function makeRuins(){
 if(ruins)return ruins.clone();const b=new CraftedProps();
 // Weathered ashlar, recessed joints and stepped footings.
 for(const side of [-1,1]){
  const x=side*3;
  b.box('#9a9e87',x,.16,0,1.94,.3,2.04,'stone',true);b.box('#c1bca0',x,.38,0,1.66,.16,1.8,'stone',true);
  for(let j=0;j<5;j++){
   const m=b.box(limestone[(j+(side>0?2:0))%5],x,.86+j*.72,0,1.27,.685,1.48,'stone',true);m.rotation.y=(j%3-1)*.012;
   // Separate front faces read as masonry without cutting deep silhouettes.
   if(j%2===0)b.box('#969984',x+.2,.86+j*.72,.747,.018,.59,.008,'stone');
  }
  b.box('#969b82',x,4.18,0,1.44,.22,1.68,'stone',true);b.box('#c9c3a5',x,4.34,0,1.68,.13,1.85,'stone',true);
 }
 // Actual radial voussoirs keep the inner opening smooth and continuous.
 for(let j=0;j<13;j++){
  const a0=j*Math.PI/13+.012,a1=(j+1)*Math.PI/13-.012,inside=2.36,outside=3.65;
  const s=new T.Shape();s.moveTo(Math.cos(a0)*inside,4.3+Math.sin(a0)*inside);s.lineTo(Math.cos(a0)*outside,4.3+Math.sin(a0)*outside);s.absarc(0,4.3,outside,a0,a1,false);s.lineTo(Math.cos(a1)*inside,4.3+Math.sin(a1)*inside);s.absarc(0,4.3,inside,a1,a0,true);s.closePath();
  const g=new T.ExtrudeGeometry(s,{depth:1.5,curveSegments:2,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.035,bevelThickness:.035});g.translate(0,0,-.75);
  b.mesh(g,limestone[j%5],0,0,0,1,1,1,'stone');
 }
 b.box('#d6cba7',0,7.23,.81,.52,.6,.11,'stone',true);
 const emblem=b.ring('#9caa8b',0,7.22,.88,.14,.027,'stone');emblem.scale.y=1.12;
 // Companion columns: plinths, torus mouldings, fluted drums and capitals.
 for(const x of [-6,6]){
  b.box('#999c86',x,.15,3,2,.3,2,'stone',true);b.box('#c8c2a4',x,.36,3,1.72,.13,1.72,'stone',true);
  b.cylinder('#aaa991',x,.54,3,.7,.76,.22,'stone',16);
  b.cylinder('#c4bea1',x,.71,3,.58,.68,.14,'stone',16);
  const points:number[]=[],uv:number[]=[],idx:number[]=[];const sides=48;
  for(let row=0;row<2;row++)for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2,rr=.49+.025*Math.cos(a*12);points.push(Math.cos(a)*rr,.8+row*1.76,Math.sin(a)*rr);uv.push(i/sides*2,row);}
  for(let i=0;i<sides;i++){const t=i+sides+1;idx.push(i,t,i+1,i+1,t,t+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();b.mesh(g,'#b9b69b',x,0,3,1,1,1,'stone');
  for(const y of [1.37,1.96]){const r=b.ring('#a3a78f',x,y,3,.502,.018,'stone');r.rotation.x=Math.PI/2;}
  b.cylinder('#c6c1a3',x,2.62,3,.68,.52,.19,'stone',16);b.box('#b2b096',x,2.81,3,1.5,.2,1.5,'stone',true);b.box('#d0c9aa',x,2.95,3,1.64,.1,1.64,'stone',true);
  // Small chips seated in the ground around the plinth.
  for(let i=0;i<4;i++){const m=b.box(limestone[i],x+Math.sin(i*2.7)*1.3,.09,3+Math.cos(i*2.7)*1.3,.23+i*.035,.15,.32,'stone',true);m.rotation.y=i*.9;}
 }
 // Stems follow the masonry; folded leaves have physical depth from all sides.
 const vineX=(i:number)=>-Math.sqrt(3.1**2-Math.max(0,.42+i*.18-4.3)**2)+Math.sin(i*.38)*.16;
 for(let i=0;i<34;i++){
  const y=.42+i*.18,x=vineX(i),z=.85;
  if(i)b.stem('#627147',new T.Vector3(vineX(i-1),y-.18,z),new T.Vector3(x,y,z),.024);
  for(const side of [-1,1]){const leaf=b.leaf(i%3?'#5d7e4c':'#7e9458',x+side*.04,y,z,.34+i%3*.04,side*.9, -.55);leaf.rotation.z=side*.5;}
 }
 for(let i=0;i<18;i++){
  const x=-6+Math.sin(i*2.4)*.75,z=3+Math.cos(i*2.4)*.7;b.leaf('#6e8250',x,.48,z,.26,i*2.4,-.35);
 }
 ruins=b.finish('Mossy ashlar arch and fluted columns');return ruins.clone();
}
