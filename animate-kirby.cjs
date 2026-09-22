const fs=require('fs'),path=require('path'),vm=require('vm');
const source=fs.readFileSync(path.join(__dirname,'kirby-detailed.glb'));
const jsonLength=source.readUInt32LE(12);
const g=JSON.parse(source.subarray(20,20+jsonLength).toString());
const originalBin=Buffer.from(source.subarray(28+jsonLength));
const chunks=[originalBin];let byteLength=originalBin.length;
function node(name,translation=[0,0,0],parent=0){const id=g.nodes.length;g.nodes.push({name,translation,children:[]});if(parent!==null)g.nodes[parent].children.push(id);return id;}
const originalNodes=[...g.nodes[0].children];g.nodes[0].children=[];
const body=node('Body motion',[0,1.17,0]);
const limbs={},eyeGroups={};
for(const side of ['Left','Right']){
 const s=side==='Left'?-1:1;
 limbs[side+' foot']=node(side+' foot pivot',[s*.49,.245,.18]);
 limbs[side+' arm']=node(side+' shoulder',[s*.86,-.04,-.015],body);
 eyeGroups[side]=node(side+' eyelid pivot',[s*.255,.37,.72],body);
}
for(const id of originalNodes){const n=g.nodes[id];let parent=body,pivot=[0,1.17,0];
 for(const side of ['Left','Right']){const s=side==='Left'?-1:1;
  if(n.name===side+' foot'){parent=limbs[n.name];pivot=[s*.49,.245,.18];}
  if(n.name===side+' arm'){parent=limbs[n.name];pivot=[s*.86,1.13,-.015];}
  if(n.name.startsWith(side+' eye ')){parent=eyeGroups[side];pivot=[s*.255,1.54,.72];}
 }
 n.translation=pivot.map(v=>-v);g.nodes[parent].children.push(id);
}
const controls=[0,body,...Object.values(limbs),...Object.values(eyeGroups)];
const rest=new Map(controls.map(id=>[id,{translation:g.nodes[id].translation||[0,0,0],rotation:[0,0,0,1],scale:[1,1,1]}]));
function mul(a,b){return[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];}
function quat(x=0,y=0,z=0){return mul(mul([Math.sin(x/2),0,0,Math.cos(x/2)],[0,Math.sin(y/2),0,Math.cos(y/2)]),[0,0,Math.sin(z/2),Math.cos(z/2)]);}
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
function envelope(t,a,b,c){return t<b?smooth((t-a)/(b-a)):1-smooth((t-b)/(c-b));}
function pose(name,t,duration){const p=new Map([...rest].map(([id,r])=>[id,{translation:[...r.translation],rotation:[...r.rotation],scale:[...r.scale]}]));const B=p.get(body),R=p.get(0),phase=t/duration*Math.PI*2;
 const arm=(side,x,z)=>p.get(limbs[side+' arm']).rotation=quat(x,0,z);
 if(name==='Idle'){
  const breath=Math.sin(phase);B.scale=[1-.012*breath,1+.021*breath,1-.01*breath];B.translation[1]+=.018*breath;
  arm('Left',.025*breath,-.045-.025*breath);arm('Right',-.025*breath,.045+.025*breath);
  const blink=envelope(t,1.38,1.48,1.62);for(const id of Object.values(eyeGroups))p.get(id).scale[1]=1-.94*blink;
 }
 if(name==='Walk'||name==='Run'||name==='WalkBackward'){
  const run=name==='Run',backward=name==='WalkBackward',swing=Math.sin(backward?-phase:phase),bounce=(1-Math.cos(phase*2))/2;
  B.translation[1]+=(run?.14:.065)*bounce;B.rotation=quat(backward?-.065:run?.16:.035,(run?.1:.055)*swing,(run?.075:.045)*swing);
  B.scale=[1+(run?.025:.012)*Math.cos(phase*2),1-(run?.04:.018)*Math.cos(phase*2),1];
  for(const side of ['Left','Right']){const s=side==='Left'?-1:1,step=s*swing,F=p.get(limbs[side+' foot']);F.translation[2]+=(run?.43:.27)*step;F.translation[1]+=(run?.25:.13)*Math.max(0,Math.cos(phase+(s===1?0:Math.PI)));F.rotation=quat((run?.55:.28)*step,0,s*.035);arm(side,-(run?.85:.45)*step,s*(run?.14:.04));}
 }
 if(name==='Jump'){
  const crouch=envelope(t,0,.22,.38),land=envelope(t,1.02,1.15,1.42),air=clamp((t-.30)/.80),height=t>=.30&&t<=1.10?1.45*4*air*(1-air):0,stretch=envelope(t,.22,.36,.60);
  R.translation[1]=height;B.scale=[1+.14*crouch+.17*land-.07*stretch,1-.23*crouch-.26*land+.15*stretch,1+.12*crouch+.1*land-.05*stretch];B.translation[1]-=.18*crouch+.20*land;
  const lift=envelope(t,.2,.65,1.22);arm('Left',-.25*lift,-.95*lift);arm('Right',-.25*lift,.95*lift);
  for(const side of ['Left','Right'])p.get(limbs[side+' foot']).rotation=quat(-.3*lift);
 }
 if(name==='Attack'){
  const wind=envelope(t,0,.27,.48),hit=envelope(t,.25,.48,.78),recover=envelope(t,.52,.68,1.05);
  B.rotation=quat(.18*hit,-.35*wind+.40*hit,-.07*hit);B.translation[2]=-.1*wind+.22*hit;B.scale=[1+.055*wind,1-.045*hit,1+.04*hit];
  arm('Left',-.3*wind+.35*hit,-.15*wind);arm('Right',.60*wind-1.6*hit,.3*wind-.50*hit);
  p.get(limbs['Right arm']).scale=[1+.40*hit,1+.12*hit,1+.15*hit];
  p.get(limbs['Right foot']).translation[2]+=.24*hit;p.get(limbs['Left foot']).translation[2]-=.10*wind;B.translation[1]+=.04*recover;
 }
 if(name==='Death'){
  const shock=envelope(t,0,.15,.38),fall=smooth((t-.22)/.85),settle=envelope(t,1.0,1.14,1.40);
  R.rotation=quat(0,0,-Math.PI/2*fall);R.translation[0]=.45*fall;R.translation[1]=.13*shock;
  B.scale=[1+.06*settle,1-.08*settle,1];arm('Left',-.2*shock,-.65*shock+.2*fall);arm('Right',-.2*shock,.65*shock-.2*fall);
  for(const id of Object.values(eyeGroups))p.get(id).scale[1]=1-.95*smooth((t-.1)/.36);
 }
 if(name==='RotateLeft'||name==='RotateRight'){
  const direction=name==='RotateLeft'?1:-1,u=t/duration,turn=smooth(u);
  const activity=Math.sin(Math.PI*u)**2,step=Math.sin(4*Math.PI*u);
  R.rotation=quat(0,direction*Math.PI/2*turn,0);
  B.translation[1]+=.045*activity*(1-Math.cos(8*Math.PI*u))/2;
  B.rotation=quat(0,direction*.10*activity,direction*.04*step*activity);
  for(const side of ['Left','Right']){
   const s=side==='Left'?-1:1,F=p.get(limbs[side+' foot']);
   F.translation[1]+=.12*activity*Math.max(0,s*step);
   F.translation[2]+=direction*s*.10*activity;
   F.rotation=quat(.14*s*step*activity,direction*.16*activity,0);
   arm(side,-.20*s*step*activity,s*.10*activity);
  }
 }
 if(name==='Eat'){
  const inhale=envelope(t,.08,.65,1.35),gulp=envelope(t,1.18,1.43,1.77),satisfied=envelope(t,1.65,1.94,2.4);
  const pulse=Math.sin(t*Math.PI*8)*.012*inhale;
  B.scale=[1+.045*inhale+.13*gulp,1-.035*inhale-.07*gulp,1+.07*inhale+.12*gulp];
  B.translation[2]=.12*inhale;B.translation[1]-=.025*inhale;
  B.rotation=quat(.085*inhale-.07*satisfied,0,.055*Math.sin((t-1.65)*Math.PI*3)*satisfied);
  arm('Left',-.32*inhale,-.32*inhale+.12*gulp);arm('Right',-.32*inhale,.32*inhale-.12*gulp);
  for(const id of Object.values(eyeGroups))p.get(id).scale[1]=1-.16*inhale-.82*satisfied;
  B.scale[0]+=pulse;B.scale[2]+=pulse;
 }
 return p;
}
function values(index){const a=g.accessors[index],v=g.bufferViews[a.bufferView],size={SCALAR:1,VEC3:3,VEC4:4}[a.type],start=(v.byteOffset||0)+(a.byteOffset||0);return Array.from(new (a.componentType===5126?Float32Array:Uint32Array)(originalBin.buffer,originalBin.byteOffset+start,a.count*size));}
const geometry=originalNodes.map(id=>{const prim=g.meshes[g.nodes[id].mesh].primitives[0];return{id,prim,p:values(prim.attributes.POSITION),n:values(prim.attributes.NORMAL),ix:values(prim.indices),colors:prim.attributes.COLOR_0===undefined?null:values(prim.attributes.COLOR_0)};});
// Shape keys keep the enlarged mouth on the curved face instead of scaling it through the body.
const mouthMeshes=geometry.filter(mesh=>/Open smiling mouth|Rounded tongue/.test(g.nodes[mesh.id].name));
for(const mesh of mouthMeshes){const delta=[],normalDelta=[],isTongue=g.nodes[mesh.id].name==='Rounded tongue';
 for(let i=0;i<mesh.p.length;i+=3){const x=mesh.p[i],y=mesh.p[i+1],z=mesh.p[i+2];
  const nx=x*(isTongue?1.15:2.45),v=(y-1.087)/(y>=1.087?.023:.145),ny=isTongue?.825+(y-.996)*1.2:1.055+v*.29;
  const f=Math.sqrt(Math.max(.001,1-nx*nx-((ny-1.17)/.96)**2));
  const nz=.84*f+(isTongue?.033:.017),normal=[nx,(ny-1.17)/(.96*.96),(.84*f)/(.84*.84)],len=Math.hypot(...normal);
  delta.push(nx-x,ny-y,nz-z);normalDelta.push(...normal.map((v,k)=>v/len-mesh.n[i+k]));
 }
 mesh.delta=delta;mesh.normalDelta=normalDelta;mesh.prim.targets=[{POSITION:append(delta,'VEC3'),NORMAL:append(normalDelta,'VEC3')}];
 const m=g.meshes[g.nodes[mesh.id].mesh];m.weights=[0];m.extras={targetNames:['Eat open mouth']};
}
const parents=new Map();g.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parents.set(c,i)));
function rotate(q,v){const u=q.slice(0,3),w=q[3],dot=u[0]*v[0]+u[1]*v[1]+u[2]*v[2],uu=u.reduce((a,x)=>a+x*x,0),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];return v.map((x,i)=>2*dot*u[i]+(w*w-uu)*x+2*w*cross[i]);}
function transform(v,id,p,normal=false){while(id!==undefined){const n=p.get(id)||g.nodes[id],scale=n.scale||[1,1,1];v=v.map((x,i)=>normal?x/scale[i]:x*scale[i]);v=rotate(n.rotation||[0,0,0,1],v);if(!normal)v=v.map((x,i)=>x+(n.translation||[0,0,0])[i]);id=parents.get(id);}return v;}
function floorCorrection(p){let low=Infinity;for(const mesh of geometry){for(let i=0;i<mesh.p.length;i+=18){low=Math.min(low,transform(mesh.p.slice(i,i+3),mesh.id,p)[1]);}}p.get(0).translation[1]-=low;}
function append(data,type){const b=Buffer.from(new Float32Array(data).buffer),view=g.bufferViews.length;g.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:b.length});chunks.push(b);byteLength+=b.length;const a={bufferView:view,componentType:5126,count:data.length/({SCALAR:1,VEC3:3,VEC4:4}[type]),type};if(type==='SCALAR'){a.min=[Math.min(...data)];a.max=[Math.max(...data)];}if(type==='VEC3'){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];data.forEach((v,i)=>{a.min[i%3]=Math.min(a.min[i%3],v);a.max[i%3]=Math.max(a.max[i%3],v);});}g.accessors.push(a);return g.accessors.length-1;}
const clips=[['Idle',2.4,true],['Walk',1.0,true],['Run',.60,true],['Jump',1.5,false],['Attack',1.1,false],['Death',1.8,false],['Eat',2.5,false],['RotateLeft',1.2,false],['RotateRight',1.2,false],['WalkBackward',1.1,true]];
g.animations=[];const snapshots={};
for(const [name,duration,loop] of clips){const count=Math.round(duration*60),times=Array.from({length:count+1},(_,i)=>i/count*duration),frames=times.map(t=>{const p=pose(name,t,duration);if(name==='Death'||name==='Walk'||name==='Run')floorCorrection(p);return p;});if(loop)frames[count]=structuredClone(frames[0]);
 const anim={name,samplers:[],channels:[],extras:{loop,recommendedPlayback:loop?'repeat':'once; clamp on final frame',inPlace:true,durationSeconds:duration}};const input=append(times,'SCALAR');
 for(const id of controls)for(const property of ['translation','rotation','scale']){const data=frames.flatMap(p=>p.get(id)[property]);const output=append(data,property==='rotation'?'VEC4':'VEC3');anim.samplers.push({input,output,interpolation:'LINEAR'});anim.channels.push({sampler:anim.samplers.length-1,target:{node:id,path:property}});}
 for(const mesh of mouthMeshes){const weights=times.map(t=>name==='Eat'?envelope(t,.08,.65,1.35):0);anim.samplers.push({input,output:append(weights,'SCALAR'),interpolation:'LINEAR'});anim.channels.push({sampler:anim.samplers.length-1,target:{node:mesh.id,path:'weights'}});}
 if(name.startsWith('Rotate'))anim.extras.rootRotationDegrees=name==='RotateLeft'?90:-90;
 g.animations.push(anim);snapshots[name]=frames[Math.round(count*({Idle:.2,Walk:.25,Run:.25,Jump:.46,Attack:.44,Death:1,Eat:.26,RotateLeft:.6,RotateRight:.6}[name]))];
 // Verify clean loops, normalized quaternions and finite, positive transforms.
 for(const frame of frames)for(const [,p] of frame){if(Object.values(p).flat().some(x=>!Number.isFinite(x)))throw Error('Invalid transform');if(p.scale.some(x=>x<=0))throw Error('Invalid scale');if(Math.abs(Math.hypot(...p.rotation)-1)>1e-6)throw Error('Non-unit quaternion');}
}
g.buffers=[{byteLength}];g.asset.generator='Kirby animation rig • 60 fps';
let json=Buffer.from(JSON.stringify(g));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const binary=Buffer.concat(chunks),header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);
fs.writeFileSync(path.join(__dirname,'kirby-animated.glb'),Buffer.concat([header,jh,json,bh,binary]));
// Inspect representative poses by rendering the actual animated geometry.
if(process.argv.includes('--preview')){
 const src=fs.readFileSync(path.join(__dirname,'make-kirby.cjs'),'utf8');let render=src.slice(src.indexOf('const W=900'),src.indexOf('let triangles=0;')).replace('const W=900,H=900','const W=600,H=600').replaceAll('285','155').replaceAll('x-450','x-300').replaceAll('y-780','y-510');
 for(const name of ['Eat']){const pose=snapshots[name],parts=geometry.map(mesh=>{const p=[],n=[];for(let i=0;i<mesh.p.length;i+=3){p.push(...transform(mesh.p.slice(i,i+3).map((v,k)=>v+(name==='Eat'&&mesh.delta?mesh.delta[i+k]:0)),mesh.id,pose));n.push(...transform(mesh.n.slice(i,i+3).map((v,k)=>v+(name==='Eat'&&mesh.normalDelta?mesh.normalDelta[i+k]:0)),mesh.id,pose,true));}return{p,n,ix:mesh.ix,colors:mesh.colors,m:mesh.prim.material};});let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const part of parts)for(let i=0;i<part.p.length;i+=3){minX=Math.min(minX,part.p[i]);maxX=Math.max(maxX,part.p[i]);minY=Math.min(minY,part.p[i+1]);maxY=Math.max(maxY,part.p[i+1]);}const framed=render.replace('part.p[i],part.p[i+1]-1.1', 'part.p[i]-'+((minX+maxX)/2)+',part.p[i+1]-'+((minY+maxY)/2)).replaceAll('155',String(Math.min(145,480/(maxX-minX),480/(maxY-minY))));vm.runInNewContext(framed.replace('kirby-preview.png',`kirby-${name.toLowerCase()}-preview.png`),{Buffer,Math,Float32Array,Array,fs,path,__dirname,zlib:require('zlib'),parts,materials:g.materials});}
}
console.log(JSON.stringify({output:'kirby-animated.glb',bytes:28+json.length+binary.length,animations:g.animations.map(a=>({name:a.name,...a.extras})),checks:'Finite transforms, normalized rotations, positive scales, seamless loop endpoints'}));


