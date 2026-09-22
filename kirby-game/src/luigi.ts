import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const idleStates=new WeakMap<T.Group,{time:number;nextBlink:number;blinkStart:number;head:T.Group;eyes:T.Group;lids:T.Mesh[]}>();
export function updateLuigiIdle(model:T.Group,dt:number) {
  const state=idleStates.get(model);if(!state)return;
  state.time+=dt;
  if(state.time>=state.nextBlink){state.blinkStart=state.time;state.nextBlink=state.time+3.2+(Math.sin(state.time*2.7)+1)*1.1;}
  const phase=(state.time-state.blinkStart)/.22;
  const blink=phase>=0 && phase<1?Math.sin(Math.PI*phase)**.8:0;
  state.eyes.scale.y=Math.max(.015,1-blink);
  for(const lid of state.lids){lid.visible=blink>.02;lid.scale.y=.157*blink;}
  // Slow, clearly visible glances to both sides, with a slight nod.
  state.head.rotation.set(Math.sin(state.time*.9)*.035,Math.sin(state.time*.57)*.32,Math.sin(state.time*.71)*.025);
}

/** Seated, fully modelled passenger; face and clothing details are geometry. */
export function makeLuigi() {
  const g=new T.Group();g.name='Luigi · permanent passenger';
  const mats=new Map<string,T.MeshStandardMaterial>();
  const sphere=new T.SphereGeometry(1,28,20);
  const mat=(c:string)=>{if(!mats.has(c))mats.set(c,new T.MeshStandardMaterial({color:c,roughness:c==='#154ca2'?.8:.57}));return mats.get(c)!;};
  const ball=(name:string,c:string,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{
    const m=new T.Mesh(sphere,mat(c));m.name=name;m.position.set(x,y,z);m.scale.set(sx,sy,sz);g.add(m);return m;
  };
  const box=(name:string,c:string,x:number,y:number,z:number,w:number,h:number,d:number,r=.04)=>{
    const m=new T.Mesh(new RoundedBoxGeometry(w,h,d,3,r),mat(c));m.name=name;m.position.set(x,y,z);g.add(m);return m;
  };
  const line=(name:string,c:string,points:number[][],r:number)=>{
    const m=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p as [number,number,number]))),16,r,8,false),mat(c));m.name=name;g.add(m);
  };
  const skin='#f3be8d',green='#219445',blue='#154ca2',hair='#45281c';
  ball('Green shirt',green,0,.92,0,.44,.57,.32);
  ball('Overalls hips',blue,0,.43,.05,.43,.34,.33);
  box('Denim bib',blue,0,.87,.303,.57,.55,.075);
  box('Bib pocket','#2364b6',0,.76,.35,.3,.19,.028,.02);
  for(const s of [-1,1]) {
    ball('Bent trouser thigh',blue,s*.25,.29,.33,.22,.22,.41);
    ball('Trouser cuff',blue,s*.28,.12,.63,.195,.19,.18);
    ball('Brown shoe','#69422a',s*.29,-.04,.79,.25,.19,.38);
    ball('Shoe sole','#35281f',s*.29,-.16,.8,.26,.045,.39);
    line('Shoe seam','#a67849',[[s*.29-.14,.025,.96],[s*.29,.05,1.08],[s*.29+.14,.025,.96]],.008);
    const shoulder=new T.Vector3(s*.42,1.13,.04),elbow=new T.Vector3(s*.48,.68,.15),wrist=new T.Vector3(s*.29,.56,.4);
    for(const [name,a,b,r] of [['Sleeve',shoulder,elbow,.175],['Forearm',elbow,wrist,.145]] as const) {
      const center=a.clone().add(b).multiplyScalar(.5);
      const arm=ball(name,green,center.x,center.y,center.z,r,a.distanceTo(b)*.62,r);
      arm.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());
    }
    ball('Glove cuff','#ece7d9',s*.29,.56,.4,.14,.1,.07);
    ball('Gloved palm','#fff9ed',s*.28,.55,.5,.16,.09,.17);
    for(let f=0;f<4;f++)ball('Glove finger','#fff9ed',s*.28+(f-1.5)*.067,.515,.64,.044,.055,.105);
    ball('Glove thumb','#fff9ed',s*.15,.55,.5,.07,.065,.12);
    for(let f=0;f<3;f++)line('Glove stitching','#d6d2c7',[[s*.28+(f-1)*.05,.64,.46],[s*.28+(f-1)*.05,.63,.55]],.007);
    box('Overall strap',blue,s*.22,1.17,.285,.12,.48,.07);
    ball('Brass button','#f6c34a',s*.22,1.03,.345,.062,.062,.018);
    line('Denim seam','#74a0ce',[[s*.36,.38,.29],[s*.35,.62,.28],[s*.27,.99,.35]],.008);
  }
  ball('Neck',skin,0,1.44,0,.17,.21,.17);
  const headStart=g.children.length;
  ball('Hair back',hair,0,1.84,-.045,.43,.48,.34);
  const face=ball('Face',skin,0,1.83,.105,.39,.45,.32);
  // A single tapered lower face avoids a separate protruding jaw/chin sphere.
  face.geometry=sphere.clone();
  const vertices=face.geometry.getAttribute('position');
  for(let i=0;i<vertices.count;i++) {
    const lower=Math.max(0,-vertices.getY(i));
    vertices.setXYZ(i,vertices.getX(i)*(1-.18*lower),vertices.getY(i),vertices.getZ(i)*(1-.12*lower)-.08*lower);
  }
  face.geometry.computeVertexNormals();
  for(const s of [-1,1]) {
    ball('Ear',skin,s*.405,1.82,.04,.12,.17,.09);
    ball('Ear inner','#d38d67',s*.448,1.82,.102,.054,.097,.018);
    ball('Sideburn',hair,s*.35,1.94,.19,.052,.16,.048);
    ball('Eye white','#fffef4',s*.145,1.965,.391,.114,.155,.035);
    ball('Blue iris','#368fc2',s*.132,1.957,.423,.052,.087,.014);
    ball('Pupil','#172b35',s*.129,1.957,.436,.028,.063,.009);
    ball('Eye highlight','#ffffff',s*.129-.013,1.99,.447,.013,.021,.006);
    line('Eyebrow',hair,[[s*.065,2.105,.415],[s*.15,2.145,.407],[s*.25,2.115,.376]],.033);
    ball('Cheek',skin,s*.22,1.73,.315,.125,.115,.055);
  }
  line('Smile','#723e2d',[[-.115,1.625,.338],[0,1.595,.349],[.115,1.625,.338]],.011);
  for(const s of [-1,1]) {
    const moustache=ball('Luigi moustache','#352016',s*.12,1.725,.405,.15,.06,.043);
    moustache.rotation.z=s*.2;
  }
  ball('Nose',skin,0,1.825,.5,.155,.145,.175);
  ball('Cap crown',green,0,2.22,.015,.47,.27,.38);
  ball('Cap band','#147635',0,2.14,.04,.465,.08,.36);
  ball('Cap visor',green,0,2.12,.385,.44,.065,.3);
  line('Visor edge','#145e2e',[[-.39,2.12,.47],[-.2,2.11,.64],[0,2.11,.675],[.2,2.11,.64],[.39,2.12,.47]],.013);
  ball('White cap badge','#fffbea',0,2.28,.352,.14,.135,.025);
  box('L vertical',green,-.035,2.29,.381,.035,.15,.015,.006);
  box('L foot',green,.007,2.223,.381,.115,.033,.015,.006);
  line('Cap seam','#187b36',[[-.32,2.28,.24],[0,2.47,.01],[.32,2.28,-.2]],.009);
  const head=new T.Group();head.name='Luigi head pivot';head.position.set(0,1.44,0);
  for(const part of g.children.slice(headStart)){head.add(part);part.position.y-=1.44;}
  g.add(head);
  const eyes=new T.Group();eyes.name='Luigi blinking eyes';eyes.position.y=1.965-1.44;
  for(const part of [...head.children])if(['Eye white','Blue iris','Pupil','Eye highlight'].includes(part.name)){
    eyes.add(part);part.position.y-=eyes.position.y;
  }
  head.add(eyes);
  const lids:T.Mesh[]=[];
  for(const s of [-1,1]) {
    const lid=ball('Luigi eyelid',skin,s*.145,1.965,.45,.118,.157,.023);
    head.add(lid);lid.position.y-=1.44;lid.visible=false;lids.push(lid);
  }
  idleStates.set(g,{time:0,nextBlink:2.3,blinkStart:-10,head,eyes,lids});
  g.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
  return g;
}
