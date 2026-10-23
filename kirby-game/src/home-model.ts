import * as T from 'three';
import {CraftedProps} from './crafted-props';
import {roofTilePitch,roofTileSpan,roofTileLength} from './roof-tiles';
import {OAK_TONES} from './crafted-surfaces';

/** The mattress, pillow and open doorway retain the sleeping animation's
 * contact points. Everything else here is static, with one draw per finish. */
export function makeHomeModel(windows:T.MeshStandardMaterial,roof:T.Group){
 const b=new CraftedProps(),r=new CraftedProps();
 const wood=(x:number,y:number,z:number,w:number,h:number,d:number,c='#a77b50',round=false)=>b.box(c,x,y,z,w,h,d,'oak',round);
 const stone=['#a99b81','#b9aa8e','#c6b89b','#b2a78b'];
 b.box('#8f8771',0,.09,0,11,.18,10,'stone',true);
 for(const x of [-4.8,-3.2,-1.6,0,1.6,3.2,4.8])b.box(stone[(Math.round(x*10)+49)%4],x,.2,4.65,1.54,.24,.52,'stone',true);
 for(const x of [-5.2,5.2])for(let i=0;i<6;i++)b.box(stone[i%4],x,.2,-3.8+i*1.5,.48,.24,1.44,'stone',true);
 // Keep the floor inside the stone edging: both top faces sit at y=.32.
 for(let i=0;i<24;i++)wood((i-11.5)*.41,.26,0,.39,.12,8.7,OAK_TONES[i%6]);
 b.box('#f2dfba',0,2.7,-4.2,10,5.3,.28,'plaster');
 for(const x of [-5,5]){
  b.box('#f2dfba',x,2.7,-.5,.28,5.3,7.5,'plaster');
  const inner=x>0?4.81:-4.81;
  wood(inner,1.05,-.5,.08,1.38,7.4,'#c09b70');wood(inner,1.79,-.5,.15,.12,7.5,'#9b714d');wood(inner,.41,-.5,.19,.17,7.5,'#976b47');
  for(let i=0;i<19;i++)wood(inner-(x>0?.045:-.045),1.04,-4+i*.39,.025,1.25,.025,'#98764f');
  for(const z of [-4.2,3.2]){wood(x,2.7,z,.32,5.5,.32,'#976848',true);wood(x,.6,z,.43,.5,.43,'#79593f',true);}
  wood(x,5.18,-.5,.3,.22,7.5,'#a77b50');
 }
 wood(0,.42,-3.99,10,.18,.2,'#976b47');wood(0,1.78,-4,10,.12,.12,'#b18b60');
 for(let i=0;i<26;i++)wood(-4.8+i*.38,1.05,-4.035,.035,1.28,.035,'#bc9b70');
 wood(0,5.4,3.25,10.4,.3,.3,'#a4734d',true);
 // Braces, pegs and a framed enamel house sign.
 for(const side of [-1,1]){
  const brace=wood(side*4.55,4.96,3.24,1.25,.17,.2,'#bf9662');brace.rotation.z=side*Math.PI/4;
  for(const y of [.8,4.9])b.cylinder('#6c5840',side*5, y,3.377,.055,.055,.024,'metal',8).rotation.x=Math.PI/2;
 }
 b.box('#9b6f50',0,4.7,3.35,4.91,1.38,.14,'oak',true);
 for(const x of [-2.3,2.3])for(const y of [4.18,5.22])b.ball('#d6b372',x,y,3.44,.045,.045,.025,'metal');
 for(const x of [-3,3]){
  b.box('#71583f',x,3.2,-4.01,1.94,1.97,.13,'oak',true);
  const pane=new T.Mesh(new T.BoxGeometry(1.55,1.6,.08),windows);pane.position.set(x,3.2,-3.91);b.group.add(pane);
  for(const side of [-1,1])wood(x+side*.84,3.2,-3.84,.12,1.86,.14,'#e0ba7e',true);
  wood(x,3.2,-3.83,.07,1.7,.12,'#d6af73');wood(x,3.2,-3.82,1.7,.08,.12,'#d6af73');
  wood(x,2.27,-3.76,2.03,.14,.5,'#bb9466',true);wood(x,4.19,-3.81,2,.16,.22,'#9a724f',true);
  b.box('#b77054',x,2.12,-3.68,1.9,.32,.53,'paint',true);wood(x,2.32,-3.68,2,.07,.59,'#d19d77',true);
  b.box('#5b503b',x,2.335,-3.68,1.78,.025,.38,'plaster');
  for(let j=0;j<7;j++){
   const xx=x-.7+j*.23,yy=2.56+(j%3)*.07;
   b.stem('#5d7546',new T.Vector3(xx,2.33,-3.68),new T.Vector3(xx,yy,-3.68),.018);
   b.leaf('#688d52',xx,2.43,-3.68,.2,j*1.8);
   for(let k=0;k<5;k++){const a=k*Math.PI*2/5;b.ball(j%2?'#e4a4aa':'#f3d978',xx+Math.cos(a)*.066,yy+Math.sin(a)*.066,-3.67,.064,.064,.039,'paint');}
   b.ball('#a97e3e',xx,yy,-3.625,.032,.032,.015,'paint');
  }
 }
 // Raised oak bed with slatted headboard, turned feet and linen piping.
 wood(0,.48,-.6,3.7,.45,4.6,'#865d41',true);
 for(const x of [-1.8,1.8]){wood(x,.53,-.6,.14,.2,4.6,'#bb945f');wood(x,.72,-.6,.1,.07,4.6,'#d0ad76');}
 b.box('#f5e7ce',0,.83,-.6,3.5,.4,4.4,'linen',true);
 for(const x of [-1.72,1.72])b.box('#d9c7a7',x,.94,-.6,.035,.025,4.18,'linen');
 const pillow=b.ball('#fff5df',0,1.23,-1.8,1.35,.2,.57,'linen');pillow.name='Bed pillow';
 for(const x of [-1.8,1.8])for(const z of [-2.9,1.7]){
  b.cylinder('#9c704b',x,.78,z,.09,.12,1.48);b.cylinder('#c09b64',x,1.48,z,.12,.09,.15);b.ball('#d3b376',x,1.65,z,.15,.15,.15,'oak');
 }
 wood(0,1.75,-2.9,3.8,.18,.19,'#bc935e',true);wood(0,.97,-2.9,3.8,.16,.18,'#966b48');
 for(let i=0;i<11;i++)wood(-1.57+i*.314,1.35,-2.9,.19,.64,.11,'#ac8153',true);
 wood(0,.98,1.7,3.7,.17,.17,'#ad8054',true);
 b.box('#ba7f8f',0,.34,3,4,.045,1.6,'linen',true);
 for(const x of [-1.88,1.88])b.box('#f2d8b3',x,.367,3,.1,.012,1.43,'linen');
 for(const z of [2.31,3.69])b.box('#f2d8b3',0,.368,z,3.8,.012,.08,'linen');
 for(let i=0;i<21;i++)for(const z of [2.16,3.84])b.box('#e4c39c',-1.85+i*.185,.346,z,.035,.015,.16,'linen');
 // Bedside cabinet, ceramic lamp, a book and a little saucer.
 for(const x of [2.62,3.58])for(const z of [-2.18,-1.42])wood(x,.48,z,.11,.38,.11,'#8a6243',true);
 wood(3.1,.96,-1.8,1.25,.8,1,'#ae885a',true);wood(3.1,1.41,-1.8,1.39,.14,1.12,'#c7a16d',true);
 for(const y of [.77,1.13]){wood(3.1,y,-1.274,1.1,.3,.05,'#b99567',true);b.ball('#d6b66c',3.1,y,-1.23,.055,.055,.045,'metal');}
 b.lathe('#6f9c92',3.27,1.48,-1.91,[[0,0],[.22,0],[.23,.07],[.13,.15],[.17,.28],[.08,.43],[.07,.53]]);
 b.lathe('#f6dfad',3.27,1.98,-1.91,[[.34,0],[.35,.035],[.22,.48],[.2,.5],[.18,.46],[.31,.03]],'linen');
 b.ball('#c49e5e',3.27,2.52,-1.91,.045,.055,.045,'metal');
 b.box('#60827c',2.77,1.52,-1.64,.42,.09,.58,'paint',true);b.box('#f3e3c0',2.77,1.53,-1.63,.38,.05,.53,'linen');
 // Writing nook: a drawer desk, stool, notebook, pencil and pottery.
 for(const x of [-4.25,-2.45])for(const z of [-.71,.15])wood(x,.8,z,.12,.96,.12,'#9b734e',true);
 wood(-3.35,1.31,-.28,2.2,.17,1.28,'#c7a16d',true);wood(-3.35,1.12,-.28,1.98,.25,1.08,'#a87c53');
 wood(-3.35,1.12,.28,.8,.21,.04,'#c6a06d',true);b.ball('#bda265',-3.35,1.12,.33,.04,.04,.035,'metal');
 b.box('#f5e5c4',-3.28,1.411,-.18,.72,.025,.55,'linen');b.box('#826652',-3.28,1.428,-.18,.013,.008,.49,'paint');
 b.box('#d2a35e',-2.83,1.43,-.11,.035,.03,.5,'paint').rotation.y=.3;
 b.lathe('#bd785e',-4.02,1.4,-.49,[[0,0],[.14,0],[.16,.22],[.12,.25],[.105,.23],[.12,.05]],'ceramic');
 for(let i=0;i<3;i++)b.stem('#617f4a',new T.Vector3(-4.02,1.53,-.49),new T.Vector3(-4.02+(i-1)*.08,2.01+i*.06,-.49),.014);
 b.leaf('#6f9858',-4.02,1.76,-.49,.3,1);b.leaf('#779d5d',-4.02,1.82,-.49,.33,4);
 for(const x of [-3.67,-3.03])for(const z of [.91,1.49])wood(x,.62,z,.1,.6,.1,'#936b48');
 b.cylinder('#b99566',-3.35,.96,1.2,.48,.44,.13,'oak',16);b.cylinder('#c9929b',-3.35,1.06,1.2,.4,.41,.09,'linen',16);
 wood(-4.72,3.19,-.5,.52,.12,2.9,'#b99261',true);
 for(let i=0;i<7;i++)b.box(['#bd7a78','#708e88','#d8ad68'][i%3],-4.67,3.49,-1.52+i*.22,.31,.46+i%3*.09,.16,'linen',true);
 for(const z of [-1.5,.5])wood(-4.81,2.97,z,.19,.35,.12,'#946e4b');
 // A low woven chest and folded blankets fill the otherwise empty corner.
 b.box('#b28a56',3.55,.65,1.52,1.73,.61,1.11,'wicker',true);b.box('#c5a46e',3.55,.99,1.52,1.82,.12,1.18,'wicker',true);
 // The straps end under the lid instead of sharing its top face.
 for(const x of [2.89,4.21])b.box('#8c6844',x,.65,1.52,.11,.61,1.13,'oak');
 b.box('#c18f9b',3.52,1.11,1.51,1.36,.13,.85,'linen',true);b.box('#ede0be',3.57,1.23,1.51,1.27,.13,.81,'linen',true);
 // Roof geometry keeps the existing separated tile courses (no flickering).
 for(const side of [-1,1]){
  r.box('#a4734d',side*2.75,6.54,-.465,6.27,.08,9.22,'oak').rotation.z=-side*Math.atan2(.27,.55);
  for(let row=0;row<10;row++)for(let col=0;col<18;col++){
   r.box(['#b9516b','#c7687d','#b35b73','#bc697d'][(row+col)%4],side*(row+.5)*.55,7.9-row*.27,-4.8+col*.51,roofTileLength(.55,.27,.15,row===0?.55:undefined),.15,roofTileSpan(.51),'paint').rotation.z=-side*roofTilePitch(.55,.27);
  }
  for(const z of [-5.12,4.25])r.box('#dbb77f',side*2.81,6.63,z,6.24,.21,.19,'oak',true).rotation.z=-side*Math.atan2(.27,.55);
  r.box('#9b714d',side*5.43,5.3,-.45,.18,.22,9.55,'oak',true);
 }
 for(let i=0;i<19;i++)r.cylinder('#d5949b',0,8,-4.9+i*.5,.21,.21,.48,'paint',10).rotation.x=Math.PI/2;
 for(let j=0;j<5;j++)r.box(stone[j%4],3,6.59+j*.29,-2.35,.8,.27,.82,'stone',true);
 r.box('#d9c5a2',3,8.05,-2.35,1.04,.19,1.08,'stone',true);r.box('#574e42',3,8.155,-2.35,.59,.025,.6,'stone');
 roof.add(...r.finish('Warm tiled roof').children.slice());roof.name='Kirby home tiled roof';
 const panes=new Set<T.Object3D>([pillow]);for(const o of b.group.children)if(o instanceof T.Mesh&&o.material===windows)panes.add(o);
 const result=b.finish('Crafted cottage interior',panes);result.add(roof);return result;
}
