import * as T from './kirby-game/node_modules/three/build/three.module.js';
import { GLTFExporter } from './kirby-game/node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import { writeFileSync } from 'node:fs';

globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}};
const root=new T.Group();root.name='Firefly';root.userData={glowMaterial:'Firefly_Glow',glowLight:'Firefly_Light',animations:['Sit','Fly'],forward:'+Z'};
const motion=new T.Group();motion.name='Motion';root.add(motion);
const material=(name,color,roughness=.45)=>{const m=new T.MeshStandardMaterial({color,roughness});m.name=name;return m;};
const shell=material('Velvety teal shell','#254a50'),headMat=material('Warm olive face','#6f8c55'),rim=material('Golden shell edging','#bd9855',.3),black=material('Glossy eyes','#10212d',.12),blue=material('Blue irises','#459cb5',.25),white=material('Eye highlights','#ffffff',.15),legMat=material('Soft brown legs','#5f6250');
const glow=material('Firefly_Glow','#deff89',.3);glow.emissive.set('#baff55');glow.emissiveIntensity=2.2;
const wingMat=new T.MeshStandardMaterial({color:'#d0edf3',roughness:.3,transparent:true,opacity:.48,side:T.DoubleSide,depthWrite:false});wingMat.name='Translucent wings';
const veinMat=new T.MeshStandardMaterial({color:'#a4c8be',transparent:true,opacity:.62,roughness:.6,depthWrite:false});veinMat.name='Wing veins';
function ell(parent,name,position,scale,mat){const mesh=new T.Mesh(new T.SphereGeometry(1,32,20),mat);mesh.name=name;mesh.position.set(...position);mesh.scale.set(...scale);parent.add(mesh);return mesh;}
function curve(parent,name,points,radius,mat){const mesh=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),24,radius,6,false),mat);mesh.name=name;parent.add(mesh);return mesh;}
function group(parent,name,position){const g=new T.Group();g.name=name;g.position.set(...position);parent.add(g);return g;}
ell(motion,'Thorax',[0,.8,.03],[.32,.32,.43],shell);
const abdomen=ell(motion,'Glow_Abdomen',[0,.74,-.6],[.4,.35,.65],glow);
const lamp=new T.PointLight('#baff55',.8,3.5,2);lamp.name='Firefly_Light';lamp.position.set(0,.69,-.92);motion.add(lamp);
for(let i=0;i<3;i++)curve(motion,`Abdomen_segment_${i}`,Array.from({length:17},(_,j)=>{const a=Math.PI+j/16*Math.PI;return [( .36-i*.015)*Math.cos(a),.74+(.3-i*.02)*Math.sin(a),-.25-i*.2];}),.015,rim);
const head=group(motion,'Head',[0,1.08,.47]);ell(head,'Face',[0,0,0],[.39,.35,.34],headMat);
const antennas=[],legs=[],wings=[],covers=[],eyes=[];
for(const side of [-1,1]){
  const label=side<0?'Left':'Right';
  const eye=group(head,`${label}_Eye`,[side*.17,.075,.275]);eyes.push(eye);
  ell(eye,`${label}_Eye_black`,[0,0,0],[.125,.17,.075],black);ell(eye,`${label}_Iris`,[side*.012,-.035,.066],[.072,.08,.018],blue);
  ell(eye,`${label}_Catchlight`,[-.027,.057,.072],[.039,.047,.017],white);ell(eye,`${label}_Small_glint`,[.035,-.06,.083],[.018,.018,.01],white);
  ell(head,`${label}_Cheek`,[side*.28,-.1,.22],[.07,.038,.025],rim);
  const antenna=group(head,`${label}_Antenna`,[side*.2,.25,.015]);antennas.push(antenna);
  curve(antenna,`${label}_Antenna_stem`,[[0,0,0],[side*.09,.22,.025],[side*.19,.4,.09],[side*.27,.36,.16]],.023,legMat);
  ell(antenna,`${label}_Antenna_tip`,[side*.27,.36,.16],[.055,.055,.055],rim);
  const cover=group(motion,`${label}_Wing_cover`,[side*.13,1.015,.03]);covers.push(cover);
  ell(cover,`${label}_Elytron`,[side*.14,0,-.4],[.24,.12,.56],shell);
  curve(cover,`${label}_Elytron_seam`,[[side*.015,.06,.03],[side*.02,.115,-.35],[side*.07,.035,-.86]],.014,rim);
  for(let j=0;j<3;j++)ell(cover,`${label}_Shell_spot_${j}`,[side*(.16+j*.015),.106,-.22-j*.17],[.027,.008,.037],rim);
  const wing=group(motion,`${label}_Wing`,[side*.21,1.03,.025]);wings.push(wing);
  ell(wing,`${label}_Membrane`,[side*.64,0,-.15],[.79,.017,.33],wingMat);
  curve(wing,`${label}_Leading_vein`,[[0,0,0],[side*.45,.019,.1],[side*1.05,.015,.055],[side*1.37,0,-.13]],.012,veinMat);
  for(let j=0;j<5;j++)curve(wing,`${label}_Vein_${j}`,[[side*.12,.019,-.02],[side*(.35+j*.14),.021,-.05],[side*(.45+j*.19),.015,-.4+Math.abs(j-2)*.045]],.006,veinMat);
  for(let i=0;i<3;i++){
    const leg=group(motion,`${label}_Leg_${i}`,[side*.24,.69,.23-i*.28]);legs.push({leg,side,i});
    curve(leg,`${label}_Leg_shape_${i}`,[[0,0,0],[side*.2,-.2,.04],[side*.32,-.57,.14],[side*.41,-.6,.25]],.031,legMat);
    ell(leg,`${label}_Foot_${i}`,[side*.4,-.6,.25],[.085,.035,.065],shell);
  }
}
curve(head,'Gentle_smile',[[-.105,-.14,.29],[0,-.18,.32],[.105,-.14,.29]],.016,black);
const clips=[];
function quaternionTrack(node,times,angles){const values=[];for(const a of angles){const q=new T.Quaternion().setFromEuler(new T.Euler(...a));values.push(q.x,q.y,q.z,q.w);}return new T.QuaternionKeyframeTrack(`${node.name}.quaternion`,times,values);}
for(const flying of [false,true]){
  const duration=flying?2:6,tracks=[],times=Array.from({length:flying?241:121},(_,i)=>duration*i/(flying?240:120));
  tracks.push(new T.VectorKeyframeTrack('Motion.position',times,times.flatMap(t=>[0,flying?.35+.055*Math.sin(t*Math.PI*2):.008*(1-Math.cos(t*Math.PI/3)),0])));
  tracks.push(quaternionTrack(head,times,times.map(t=>[.025*Math.sin(t*Math.PI*2/duration),.09*Math.sin(t*Math.PI*2/duration),.018*Math.sin(t*Math.PI*4/duration)])));
  antennas.forEach((antenna,i)=>tracks.push(quaternionTrack(antenna,times,times.map(t=>[.06*Math.sin(t*Math.PI*4/duration+i),0,(i?1:-1)*.08*Math.sin(t*Math.PI*2/duration)]))));
  wings.forEach((wing,i)=>{
    const side=i?1:-1;tracks.push(quaternionTrack(wing,times,times.map(t=>flying?[0,side*.05,side*(.1+.7*Math.sin(t*Math.PI*12))]:[0,side*1.27,side*.06])));
    tracks.push(new T.VectorKeyframeTrack(`${wing.name}.scale`,[0,duration],flying?[1,1,1,1,1,1]:[.04,.04,.04,.04,.04,.04]));
  });
  covers.forEach((cover,i)=>tracks.push(quaternionTrack(cover,[0,duration],[[0,(i?1:-1)*(flying?.42:0),(i?1:-1)*(flying?.65:0)],[0,(i?1:-1)*(flying?.42:0),(i?1:-1)*(flying?.65:0)]])));
  legs.forEach(({leg,side,i})=>tracks.push(quaternionTrack(leg,times,times.map(t=>[flying?-.28:.018*Math.sin(t*Math.PI*2/duration+i),0,side*(flying?.45:.025*Math.sin(t*Math.PI*4/duration+i))]))));
  const blinkTimes=flying?[0,.7,.76,.82,.88,2]:[0,1.6,1.68,1.76,1.84,4.35,4.43,4.51,4.59,6];
  eyes.forEach(eye=>tracks.push(new T.VectorKeyframeTrack(`${eye.name}.scale`,blinkTimes,blinkTimes.flatMap((_,i)=>[1,(flying?i===2:i===2||i===6)?.06:1,1]))));
  clips.push(new T.AnimationClip(flying?'Fly':'Sit',duration,tracks));
}
const glb=await new GLTFExporter().parseAsync(root,{binary:true,animations:clips,onlyVisible:false});
writeFileSync(new URL('./firefly-animated.glb',import.meta.url),Buffer.from(glb));
writeFileSync(new URL('./kirby-game/public/models/firefly-animated.glb',import.meta.url),Buffer.from(glb));
let triangles=0;root.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
console.log(JSON.stringify({bytes:glb.byteLength,triangles,animations:clips.map(c=>c.name),glowMaterial:glow.name}));
