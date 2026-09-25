import * as T from 'three';
import {LeafPile} from './leaf-pile';
import {awardFirst} from './score';
import type {CharacterController} from './controller';
import {SKY_TRAIL_SITE as SITE,SKY_PLATFORMS as PLATFORMS,SKY_CHECKPOINTS as CHECKPOINTS,SKY_COLORS as COLORS,rainbowHeight,skySurfaces,SKY_RAINBOW_START,SKY_RAINBOW_END,platformThickness} from './sky-trail-layout';
export type SkySound='bounce'|'checkpoint'|'star'|'leaves';
function starGeometry(){const s=new T.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.43:1;if(i)s.lineTo(Math.cos(a)*r,Math.sin(a)*r);else s.moveTo(Math.cos(a)*r,Math.sin(a)*r);}s.closePath();return new T.ExtrudeGeometry(s,{depth:.22,bevelEnabled:true,bevelSize:.07,bevelThickness:.06,bevelSegments:2,steps:1});}
export class SkyTrail{
 readonly group=new T.Group();readonly entry=new T.Vector3(SITE.x+PLATFORMS[0].x,0,SITE.z+PLATFORMS[0].z-6);
 readonly landing=new T.Vector3(SITE.x,0,SITE.z);
 readonly lower=new T.Group();readonly upper=new T.Group();
 private leaves=new LeafPile(4.7,4.2);private star=new T.Group();private cores:T.Object3D[]=[];private time=0;private flags:{mesh:T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>;checkpoint:number}[]=[];
 private fall:number|undefined;private base=0;private inCourse=false;
 private rider?:CharacterController;private travel?:{from:T.Vector3;to:T.Vector3;elapsed:number;duration:number;leaves:boolean;landed:boolean;pad:T.Vector3;trampoline:T.Group;launched:boolean};
 get active(){return !!this.rider;}
 constructor(private sound:(kind:SkySound)=>void=()=>{}){
  this.group.name='Небесная тропа — сияющие ступени';this.group.position.set(SITE.x,0,SITE.z);
  const cube=new T.BoxGeometry(1,1,1),edges=new T.EdgesGeometry(cube),crystal=new T.OctahedronGeometry(.5),star=starGeometry();
  const glowing=COLORS.map(color=>new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.9,roughness:.22,metalness:.15}));
  const glass=COLORS.map(color=>new T.MeshPhysicalMaterial({color,transparent:true,opacity:.32,roughness:.12,metalness:.1,clearcoat:1,depthWrite:false}));
  PLATFORMS.forEach((p,i)=>{
   const thickness=platformThickness(i),lift=thickness/2;
   const g=new T.Group();g.position.set(p.x,p.y-lift,p.z);this.group.add(g);
   const body=new T.Mesh(cube,glass[i%7]);body.scale.set(p.size,thickness,p.size);g.add(body);
   const frame=new T.LineSegments(edges,new T.LineBasicMaterial({color:COLORS[i%7],transparent:true,opacity:.9}));frame.scale.copy(body.scale);g.add(frame);
   const top=new T.Mesh(new T.PlaneGeometry(p.size-.12,p.size-.12),new T.MeshStandardMaterial({color:COLORS[i%7],emissive:COLORS[i%7],emissiveIntensity:.22,transparent:true,opacity:.4,side:T.DoubleSide,depthWrite:false}));top.rotation.x=-Math.PI/2;top.position.y=lift+.005;g.add(top);
   const core=new T.Mesh(crystal,glowing[i%7]);core.scale.set(.7,.9,.7);g.add(core);this.cores.push(core);
   const ring=new T.Mesh(new T.TorusGeometry(.68,.025,5,28),glowing[(i+2)%7]);ring.rotation.x=Math.PI/2;g.add(ring);
   if(CHECKPOINTS.includes(i)){
    const pole=new T.Mesh(new T.CylinderGeometry(.045,.055,2.2,8),glowing[i%7]);pole.position.set(-p.size/2+.35,lift+1.05,-p.size/2+.3);g.add(pole);
    const flag=new T.Mesh(new T.PlaneGeometry(1.2,.65),new T.MeshBasicMaterial({color:'#fff2b8',side:T.DoubleSide}));flag.position.copy(pole.position).add(new T.Vector3(.55,.7,0));g.add(flag);this.flags.push({mesh:flag,checkpoint:CHECKPOINTS.indexOf(i)+1});
    this.label(g,'✓ '+(CHECKPOINTS.indexOf(i)+1),[-p.size/2+.9,lift+1.75,-p.size/2+.32],1,.5);
   }
  });
  // Seven adjacent curved ribbons form one walkable rainbow surface.
  const start=PLATFORMS[SKY_RAINBOW_START],end=PLATFORMS[SKY_RAINBOW_END];
  COLORS.forEach((color,lane)=>{
   const points:number[]=[],indices:number[]=[];
   for(let j=0;j<=48;j++){const x=T.MathUtils.lerp(start.x,end.x,j/48),y=rainbowHeight(x)!;for(const side of [0,1])points.push(x,y,start.z-1.75+(lane+side)*.5);if(j<48){const k=j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3));geo.setIndex(indices);geo.computeVertexNormals();
   const ribbon=new T.Mesh(geo,new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.48,roughness:.24,side:T.DoubleSide}));this.group.add(ribbon);
  });
  for(let j=0;j<=12;j++)for(const side of [-1,1]){const x=T.MathUtils.lerp(start.x,end.x,j/12),s=new T.Mesh(new T.SphereGeometry(.07,6,4),glowing[j%7]);s.position.set(x,rainbowHeight(x)!+.1,start.z+side*1.8);this.group.add(s);}
  // Hollow ornaments stay outside the jump route; only the summit reward is a star.
  const ornaments=[new T.TorusGeometry(.55,.07,7,32),new T.TorusGeometry(.55,.07,7,4),new T.TorusGeometry(.55,.07,7,6)];
  for(let i=0;i<56;i++){const a=i*2.399,r=21+(i%3)*.6;const m=new T.Mesh(ornaments[i%3],glowing[i%7]);m.name='Sky Trail decorative ornament';m.position.set(Math.cos(a)*r,10+i*.63,Math.sin(a)*r);m.scale.setScalar(.85);this.group.add(m);this.cores.push(m);}
  const summit=PLATFORMS.at(-1)!;const reward=new T.Mesh(star,new T.MeshStandardMaterial({color:'#fff08a',emissive:'#ffd12e',emissiveIntensity:1.1,metalness:.3,roughness:.15}));this.star.add(reward);
  const orbit=new T.Mesh(new T.TorusGeometry(1.5,.035,6,48),glowing[2]);orbit.rotation.x=Math.PI/2;this.star.add(orbit);this.star.position.set(summit.x-1,summit.y+2,summit.z);this.group.add(this.star);
  this.lower.position.set(PLATFORMS[0].x-5,0,PLATFORMS[0].z);this.upper.position.set(summit.x+1,summit.y,summit.z);this.group.add(this.lower,this.upper);this.trampoline(this.lower);this.trampoline(this.upper);
  this.leaves.group.position.copy(this.landing).sub(this.group.position);this.group.add(this.leaves.group);
  const entrance=new T.Group();entrance.name='Sky Trail entrance sign';entrance.position.set(PLATFORMS[0].x,0,PLATFORMS[0].z-3.6);entrance.rotation.y=Math.PI;this.group.add(entrance);
  const sign=new T.Mesh(new T.BoxGeometry(7,.9,.2),new T.MeshStandardMaterial({color:'#263d66',roughness:.65}));sign.position.set(0,4,0);entrance.add(sign);this.label(entrance,'НЕБЕСНАЯ ТРОПА',[0,4,.12],6.7,.65);
  for(const x of [-3,3]){const post=new T.Mesh(new T.CylinderGeometry(.07,.07,4,8),glowing[3]);post.position.set(x,2,0);entrance.add(post);}
 }
 private label(parent:T.Group,text:string,position:number[],width:number,height:number){
  if(typeof document==='undefined')return;const c=document.createElement('canvas');c.width=768;c.height=96;const ctx=c.getContext('2d');if(!ctx)return;ctx.fillStyle='#fff8dd';ctx.font='bold 42px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,384,48,750);
  const mesh=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,side:T.DoubleSide,depthWrite:false}));mesh.position.fromArray(position);parent.add(mesh);
 }
 private trampoline(parent:T.Group){
  const metal=new T.MeshStandardMaterial({color:'#adbdcf',metalness:.7,roughness:.25});
  const rim=new T.Mesh(new T.TorusGeometry(1.55,.16,10,40),new T.MeshStandardMaterial({color:'#ffc45f',emissive:'#ad6616',emissiveIntensity:.2}));rim.rotation.x=Math.PI/2;rim.position.y=.55;parent.add(rim);
  const pad=new T.Mesh(new T.CylinderGeometry(1.4,1.4,.08,40),new T.MeshStandardMaterial({color:'#6056a1',roughness:.8}));pad.name='Spring pad';pad.position.y=.52;parent.add(pad);
  for(let i=0;i<16;i++){const a=i*Math.PI/8;const spring=new T.Mesh(new T.TorusGeometry(.07,.018,5,10),metal);spring.position.set(Math.cos(a)*1.44,.5,Math.sin(a)*1.44);spring.rotation.set(Math.PI/2,0,a);parent.add(spring);if(i%2===0){const leg=new T.Mesh(new T.CylinderGeometry(.055,.075,.5,7),metal);leg.position.set(Math.cos(a)*1.3,.25,Math.sin(a)*1.3);parent.add(leg);}}
 }
 contains(p:T.Vector3){return Math.hypot(p.x-SITE.x,p.z-SITE.z)<SITE.radius;}
 handles(c:CharacterController){return this.active||this.contains(c.actor.position)||(this.inCourse&&c.actor.position.y>0);}
 savePosition(c:CharacterController){return this.handles(c)?this.entry.clone():undefined;}
 prompt(c:CharacterController){if(this.active)return '';const p=c.actor.position;if(c.skyCheckpoint>0&&p.distanceTo(this.lower.position.clone().add(this.group.position))<3.4&&p.y<1&&!c.flight.active)return `E — вернуться к чекпойнту ${c.skyCheckpoint}`;const top=this.upper.position.clone().add(this.group.position);return p.distanceTo(top)<2.8&&!c.flight.active?'E — прыгнуть с вершины в листья':'';}
 target(c:CharacterController){return c.actor.position.y>10?this.upper:this.lower;}
 start(c:CharacterController){if(!this.prompt(c)||this.active)return false;const down=c.actor.position.y>10;const i=c.skyCheckpoint?CHECKPOINTS[c.skyCheckpoint-1]:0,p=PLATFORMS[i];const to=down?this.landing.clone():new T.Vector3(SITE.x+p.x,p.y,SITE.z+p.z);this.rider=c;this.travel={from:c.actor.position.clone(),to,elapsed:0,duration:down?3.2:2.6,leaves:down,landed:false,pad:(down?this.upper:this.lower).position.clone().add(this.group.position).add(new T.Vector3(0,.56,0)),trampoline:down?this.upper:this.lower,launched:false};c.setActivity('Trampoline');this.fall=undefined;return true;}
 update(dt:number,c?:CharacterController){
  this.time+=dt;this.leaves.update(dt);for(const f of this.flags)f.mesh.material.color.set((c?.skyCheckpoint??0)>=f.checkpoint?'#65ffb5':'#fff2b8');for(const core of this.cores){core.rotation.y+=dt*.5;core.rotation.z=Math.sin(this.time*.6+core.id)*.18;}
  this.star.rotation.y+=dt*.8;this.star.position.y=PLATFORMS.at(-1)!.y+2+Math.sin(this.time*2)*.22;this.star.visible=!c?.achievements.has('skyStar');
  const rider=this.rider,t=this.travel;if(!rider||!t)return;
  t.elapsed+=dt;rider.mixer.update(dt);
  // First land on the fabric, compress it, then launch from its centre.
  if(t.elapsed<.55){const u=t.elapsed/.55;rider.actor.position.lerpVectors(t.from,t.pad,u);rider.actor.position.y+=Math.sin(u*Math.PI)*1.4;return;}
  const fabric=t.trampoline.getObjectByName('Spring pad')!;
  if(t.elapsed<.73){const compression=Math.sin((t.elapsed-.55)/.18*Math.PI)*.16;fabric.position.y=.52-compression;rider.actor.position.copy(t.pad);rider.actor.position.y-=compression;return;}
  fabric.position.y=.52;
  if(!t.launched){t.launched=true;this.sound('bounce');}
  const flightTime=t.elapsed-.73,u=Math.min(1,flightTime/t.duration),blend=u*u*(3-2*u);rider.actor.position.lerpVectors(t.pad,t.to,blend);rider.actor.position.y+=Math.sin(u*Math.PI)*(t.leaves?9:Math.max(3,(t.to.y-t.pad.y)*.35));
  for(const side of ['Left','Right']){const arm=rider.actor.getObjectByName(`${side}_shoulder`);if(arm)arm.rotation.z=(side==='Left'?-1:1)*(1+.15*Math.sin(u*18));}
  if(u===1){if(!t.landed){t.landed=true;if(t.leaves){this.leaves.burst();this.sound('leaves');}else this.sound('checkpoint');}rider.actor.position.copy(t.to);if(!t.leaves||flightTime>t.duration+.65){rider.setActivity('Idle');rider.surfaceY=this.base=t.to.y;this.inCourse=this.contains(t.to);this.rider=undefined;this.travel=undefined;}}
 }
 /** Swept foot-height tests land on tops only; stepping off an edge starts real gravity. */
 apply(c:CharacterController,previous:T.Vector3,dt:number){
  if(this.active)return;
  if(!this.handles(c)){this.base=0;this.fall=undefined;this.inCourse=false;return;}
  this.inCourse=true;c.swimming=false;const p=c.actor.position,localX=p.x-SITE.x,localZ=p.z-SITE.z;
  const surfaces=[{height:0,index:-2},...skySurfaces(localX,localZ)].sort((a,b)=>b.height-a.height);
  if(this.fall!==undefined){c.flight.reset();c.cloud.visible=false;this.fall-=24*dt;p.y=previous.y+this.fall*dt;}
  let support=surfaces.find(s=>previous.y>=s.height-.03&&p.y<=s.height+.03&&p.y<=previous.y+.01);
  if(this.fall===undefined&&!c.flight.active){support=surfaces.find(s=>Math.abs(s.height-this.base)<.65&&Math.abs(previous.y-this.base)<.08);}
  if(support){
   p.y=support.height;c.surfaceY=this.base=support.height;this.fall=undefined;
   if(c.flight.active){c.setActivity('Idle');c.surfaceY=support.height;}
   const checkpoint=CHECKPOINTS.indexOf(support.index)+1;if(checkpoint>c.skyCheckpoint){c.skyCheckpoint=checkpoint;this.sound('checkpoint');}
   if(support.index===PLATFORMS.length-1&&Math.hypot(localX-this.star.position.x,localZ-this.star.position.z)<2.8&&awardFirst(c,'skyStar'))this.sound('star');
  }else if(!c.flight.active&&this.fall===undefined){this.fall=0;c.surfaceY=0;}
  else if(c.flight.active)c.surfaceY=this.base;
  if(p.y<=0&&!c.flight.active){p.y=0;c.surfaceY=this.base=0;this.fall=undefined;this.inCourse=this.contains(p);}
 }
}
