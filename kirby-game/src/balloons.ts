import { awardFirst } from './score';
import * as T from 'three';
import { CharacterController } from './controller';
import type { KirbyNpc } from './npcs';
import { BALLOON_SITES } from './balloon-sites';
export { BALLOON_SITES } from './balloon-sites';
type Passenger=CharacterController|KirbyNpc;
export type BalloonSound='burner'|'arrival'|'departure';
type Balloon={group:T.Group;flame:T.Group;station:number;destination:number;time:number;phase:'parked'|'boarding'|'flying'|'exiting';passenger?:Passenger;from:T.Vector3;start:T.Vector3;end:T.Vector3;wait:number;nextSound:number;scale:number};
const smooth=(u:number)=>{u=T.MathUtils.clamp(u,0,1);return u*u*(3-2*u);};
const ASCENT_SECONDS=9;
const CRUISE_SECONDS=20;
export const BALLOON_TRIP_SECONDS=ASCENT_SECONDS*2+CRUISE_SECONDS;

export class Balloons {
  readonly group=new T.Group();
  readonly balloons:Balloon[]=[];
  private clock=0;
  private npcAfter=18;
  private approach?:{npc:KirbyNpc;balloon:Balloon;health:number;elapsed:number};
  get riding(){return this.balloons.some(b=>b.passenger instanceof CharacterController);}
  owns(npc:KirbyNpc){return this.approach?.npc===npc || this.balloons.some(b=>b.passenger===npc);}
  savePosition(passenger:Passenger){const b=this.balloons.find(b=>b.passenger===passenger);return b?this.dock(b.station,this.balloons.indexOf(b)).add(new T.Vector3(0,-.28,6)):undefined;}
  private dock(station:number,index:number){const site=BALLOON_SITES[station];return new T.Vector3(site.x+(index-1)*12,.28,site.z);}
  constructor(private sound:(kind:BalloonSound,position:T.Vector3)=>void=()=>{},private random= Math.random){
    this.group.name='Three colourful balloon ports';
    const geometries={box:new T.BoxGeometry(1,1,1),pole:new T.CylinderGeometry(1,1,1,12),ball:new T.SphereGeometry(1,12,8),ring:new T.TorusGeometry(1,.035,6,32)};
    const materials=new Map<string,T.MeshStandardMaterial>();
    const part=(parent:T.Group,kind:keyof typeof geometries,color:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,rx=0,ry=0,rz=0)=>{
      if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.78}));
      const p=new T.Mesh(geometries[kind],materials.get(color));p.position.set(x,y,z);p.scale.set(sx,sy,sz);p.rotation.set(rx,ry,rz);parent.add(p);return p;
    };
    const beam=(parent:T.Group,a:number[],b:number[],r:number,color:string)=>{
      const start=new T.Vector3(...a),end=new T.Vector3(...b),v=end.clone().sub(start);
      const p=part(parent,'pole',color,...start.add(end).multiplyScalar(.5).toArray(),r,v.length(),r);p.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());
    };
    const batch=(parent:T.Group)=>{
      const groups=new Map<string,T.Mesh[]>();for(const p of [...parent.children])if(p instanceof T.Mesh && Object.values(geometries).includes(p.geometry)){p.updateMatrix();const key=p.geometry.uuid+(p.material as T.Material).uuid;if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(p);}
      for(const list of groups.values()){const mesh=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);list.forEach((p,i)=>{mesh.setMatrixAt(i,p.matrix);parent.remove(p);});mesh.castShadow=mesh.receiveShadow=true;mesh.computeBoundingSphere();parent.add(mesh);}
    };
    BALLOON_SITES.forEach((site,index)=>{
      const port=new T.Group();port.position.set(site.x,0,site.z);port.name=site.name;this.group.add(port);
      for(let i=0;i<79;i++)part(port,'box',i%3?'#b88b53':'#ca9e67',-16+i*.41,.12,0,.39,.24,8);
      for(const x of [-12,0,12]){
        part(port,'ring','#f2d590',x,.255,0,2.5,2.5,2.5,Math.PI/2);
        for(const z of [-3.7,3.7]){part(port,'pole','#805f3c',x,.65,z,.12,1.3,.12);part(port,'ball','#dfc695',x,1.32,z,.16,.1,.16);}
      }
      for(let i=0;i<4;i++)part(port,'box','#b48b58',0,.08,4.4+i*.42,3.5,.16,.38);
      for(const x of [-3.8,3.8])part(port,'pole','#685039',x,2.4,-5,.12,4.8,.12);
      part(port,'box','#365c64',0,3.8,-5,8.5,1.6,.2);
      if(typeof document!=='undefined'){
        const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;const ctx=canvas.getContext('2d');
        if(ctx){ctx.fillStyle='#365c64';ctx.fillRect(0,0,768,160);ctx.strokeStyle='#e7c98d';ctx.lineWidth=7;ctx.strokeRect(5,5,758,150);ctx.fillStyle='#fff1c8';ctx.textAlign='center';ctx.font='bold 47px sans-serif';ctx.textBaseline='middle';ctx.fillText(site.name.toUpperCase(),384,80);
          const sign=new T.Mesh(new T.PlaneGeometry(8.3,1.5),new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas)}));sign.position.set(0,3.8,-4.88);port.add(sign);}
      }
      for(let i=0;i<30;i++){const a=i*2.399,x=Math.cos(a)*14,z=Math.sin(a)*9;part(port,'pole','#42683a',x,.3,z,.025,.6,.025);for(let j=0;j<5;j++)part(port,'ball',['#f1c454','#ce91c9','#d67a63'][index],x+Math.sin(j*1.256)*.13,.64,z+Math.cos(j*1.256)*.13,.13,.055,.13);}
      for(const x of [-12,12]){part(port,'pole','#657070',x,1,-4,.35,2,.35);part(port,'ball','#bea773',x,2,-4,.38,.15,.38);}
      batch(port);
    });
    const hue=this.random();
    for(let index=0;index<3;index++){
      const group=new T.Group(),flame=new T.Group();group.name=`Balloon ${index+1}`;this.group.add(group);
      // Smooth pear-shaped cloth with sixteen colourful gores and stitched seams.
      const profile=new T.CatmullRomCurve3([[.9,5.6],[1.8,7],[3.7,10],[4.7,13],[4.5,15.5],[3.1,18],[.05,19]].map(([x,y])=>new T.Vector3(x,y,0)));
      const points=profile.getPoints(48).map(p=>new T.Vector2(Math.max(.05,p.x),p.y));
      const envelope=new T.LatheGeometry(points,96),colors:number[]=[],color=new T.Color(),base=(hue+index*.3333)%1;
      for(let i=0;i<envelope.attributes.position.count;i++){
        const u=envelope.attributes.uv.getX(i),v=envelope.attributes.uv.getY(i),stripe=Math.floor(u*16)%4;
        color.setHSL((base+(stripe===1?.065:stripe===3?-.05:0)+1)%1,stripe===2?.45:.8,stripe===2?.78:.51+.08*Math.sin(v*Math.PI));colors.push(color.r,color.g,color.b);
      }
      envelope.setAttribute('color',new T.Float32BufferAttribute(colors,3));
      const cloth=new T.Mesh(envelope,new T.MeshStandardMaterial({vertexColors:true,roughness:.53,side:T.DoubleSide}));cloth.castShadow=true;group.add(cloth);
      const seamMaterial=new T.MeshStandardMaterial({color:'#e6d4ae',roughness:.8});
      for(let i=0;i<16;i++){
        const a=i*Math.PI/8,path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(Math.sin(a)*(p.x+.015),p.y,Math.cos(a)*(p.x+.015))));
        group.add(new T.Mesh(new T.TubeGeometry(path,48,.024,4,false),seamMaterial));
      }
      part(group,'ball','#e9dba7',0,19,0,.32,.12,.32);
      part(group,'ring','#5c5241',0,5.6,0,.9,.9,.9,Math.PI/2);
      // Woven basket: separate horizontal reeds, upright stakes, rolled rim and floor.
      part(group,'box','#9e743f',0,.12,0,3,.24,2.65);
      for(let row=0;row<12;row++)for(const sign of [-1,1]){
        part(group,'box',row%2?'#c99a58':'#b58a4f',0,.27+row*.08,sign*1.3,3,.065,.095);
        part(group,'box',row%2?'#c99a58':'#b58a4f',sign*1.46,.27+row*.08,0,.095,.065,2.6);
      }
      for(let i=0;i<19;i++)for(const sign of [-1,1])part(group,'pole','#dfb777',-1.43+i*.159,.72,sign*1.35,.024,1.05,.024);
      for(let i=0;i<17;i++)for(const sign of [-1,1])part(group,'pole','#dfb777',sign*1.51,.72,-1.27+i*.159,.024,1.05,.024);
      for(const sign of [-1,1]){
        beam(group,[-1.5,1.26,sign*1.32],[1.5,1.26,sign*1.32],.1,'#e4bf82');
        beam(group,[sign*1.5,1.26,-1.32],[sign*1.5,1.26,1.32],.1,'#e4bf82');
      }
      for(const x of [-1.4,1.4])for(const z of [-1.2,1.2]){
        beam(group,[x,1.2,z],[x*.47,5.7,z*.47],.043,'#d8c38e');
        part(group,'ball','#b9945e',x*1.14,.6,z*1.17,.26,.4,.2);
        beam(group,[x,1.22,z],[x*1.14,.9,z*1.17],.025,'#544b37');
      }
      for(const x of [-.7,.7])beam(group,[x,3.8,-.6],[x,3.8,.6],.065,'#535c5a');
      for(const x of [-.971,.971])for(const z of [-.833,.833])beam(group,[x,3.8,z],[0,3.8,0],.045,'#535c5a');
      beam(group,[-.7,3.8,0],[.7,3.8,0],.065,'#535c5a');
      part(group,'pole','#72797a',0,4,0,.27,.5,.27);
      flame.position.y=4.2;group.add(flame);
      for(let i=0;i<2;i++){const f=new T.Mesh(new T.SphereGeometry(1,10,8),new T.MeshBasicMaterial({color:i?'#fff5b1':'#ffad43',transparent:true,opacity:.8,depthWrite:false}));f.position.y=.4;f.scale.set(i?.16:.28,i?.55:.85,i?.16:.28);flame.add(f);}
      batch(group);
      group.position.copy(this.dock(index,index));
      this.balloons.push({group,flame,station:index,destination:index,time:0,phase:'parked',from:new T.Vector3(),start:group.position.clone(),end:group.position.clone(),wait:0,nextSound:0,scale:1});
    }
  }
  networkBlocked=new Set<number>();
  networkKey(position:T.Vector3){const b=this.balloons.find(b=>b.passenger instanceof CharacterController)??this.nearby(position);return b?'balloon:'+this.balloons.indexOf(b):undefined;}
  networkState():(number|string)[][]{return this.balloons.map(b=>[b.time,b.phase,b.station,b.destination,b.wait,b.scale,...b.start.toArray(),...b.end.toArray(),...b.group.position.toArray(),b.passenger && !(b.passenger instanceof CharacterController)?b.passenger.index:-1]);}
  networkApply(rows:(number|string)[][],npcs:readonly KirbyNpc[]){rows.forEach((v,i)=>{const b=this.balloons[i];if(!b||!v||b.passenger instanceof CharacterController)return;b.time=v[0] as number;b.phase=v[1] as Balloon['phase'];b.station=v[2] as number;b.destination=v[3] as number;b.wait=v[4] as number;b.scale=v[5] as number;b.start.fromArray(v.slice(6,9) as number[]);b.end.fromArray(v.slice(9,12) as number[]);b.group.position.fromArray(v.slice(12,15) as number[]);b.group.scale.setScalar(b.scale);b.passenger=npcs.find(n=>n.index===v[15]);});}
  outlineBalloon(position:T.Vector3){return this.nearby(position)?.group;}
  private nearby(position:T.Vector3){return this.balloons.find(b=>b.phase==='parked' && !this.networkBlocked.has(this.balloons.indexOf(b)) && b!==this.approach?.balloon && position.distanceTo(b.group.position)<5.5);}
  prompt(position:T.Vector3){const riding=this.balloons.find(b=>b.passenger instanceof CharacterController);if(riding)return `Летим: ${BALLOON_SITES[riding.destination].name} · посадка автоматически`;const b=this.nearby(position);return b?'E — отправиться на воздушном шаре':'';}
  board(character:CharacterController){const b=this.nearby(character.actor.position);if(!b || this.riding || character.flight.active)return false;this.boardPassenger(b,character);return true;}
  private boardPassenger(b:Balloon,passenger:Passenger){
    b.passenger=passenger;b.from.copy(passenger.actor.position);b.time=0;b.phase='boarding';b.destination=(b.station+1+Math.floor(this.random()*2))%3;
    b.scale=Math.max(1,passenger.actor.scale.x*.85);b.group.scale.setScalar(b.scale);
    if(passenger instanceof CharacterController)passenger.setActivity('Balloon');else passenger.beginBalloon();
    passenger.cloud.visible=false;passenger.flight.reset();
  }
  private launch(b:Balloon,index:number){b.start.copy(this.dock(b.station,index));b.end.copy(this.dock(b.destination,index));b.phase='flying';b.time=0;b.nextSound=0;this.sound('departure',b.group.position);}
  update(dt:number,npcs:readonly KirbyNpc[]=[],player?:CharacterController){
    this.clock+=dt;this.npcAfter-=dt;
    for(const [index,b] of this.balloons.entries()){
      b.time+=dt;
      if(b.phase==='parked'){
        b.group.position.copy(this.dock(b.station,index));b.group.rotation.set(0,0,Math.sin(this.clock*.6+index)*.006);
        b.wait+=dt;
        if(b.station!==index && b.wait>14 && b!==this.approach?.balloon && (!player || player.actor.position.distanceTo(b.group.position)>14)){b.destination=index;this.launch(b,index);}
      }else if(b.phase==='boarding'){
        if(b.time>=1)this.launch(b,index);
      }else if(b.phase==='flying'){
        const t=b.time,travel=smooth((t-ASCENT_SECONDS)/CRUISE_SECONDS),height=(64+index*24)*smooth(t/ASCENT_SECONDS)*(1-smooth((t-ASCENT_SECONDS-CRUISE_SECONDS)/ASCENT_SECONDS));
        b.group.position.lerpVectors(b.start,b.end,travel);b.group.position.y=.28+height;
        b.group.rotation.set(Math.sin(this.clock*.7+index)*.014,0,Math.sin(this.clock*.55)*.018);
        if(t>=BALLOON_TRIP_SECONDS){b.station=b.destination;b.group.position.copy(b.end);b.group.rotation.set(0,0,0);b.time=0;b.wait=0;b.phase=b.passenger?'exiting':'parked';this.sound('arrival',b.group.position);}
      }
      const burning=b.phase==='boarding' || (b.phase==='flying' && (b.time<9 || Math.sin(this.clock*1.5)> .65));
      b.flame.visible=burning;b.flame.scale.y=1+.18*Math.sin(this.clock*29);
      if(burning && this.clock>=b.nextSound){this.sound('burner',b.group.position);b.nextSound=this.clock+3.5;}
      const p=b.passenger;if(!p)continue;
      p.mixer.update(dt);b.group.updateWorldMatrix(true,false);
      const basket=b.group.localToWorld(new T.Vector3(0,.24,0));
      if(b.phase==='boarding')p.actor.position.lerpVectors(b.from,basket,smooth(b.time));
      else if(b.phase==='exiting')p.actor.position.lerpVectors(basket,this.dock(b.station,index).add(new T.Vector3(0,-.28,6)),smooth(b.time));
      else p.actor.position.copy(basket);
      const heading=Math.atan2(b.end.x-b.start.x,b.end.z-b.start.z);
      p.yaw+=Math.atan2(Math.sin(heading-p.yaw),Math.cos(heading-p.yaw))*(1-Math.exp(-dt*2));p.actor.rotation.set(b.group.rotation.x,p.yaw,b.group.rotation.z);
      for(const side of ['Left','Right']){const arm=p.actor.getObjectByName(`${side}_shoulder`);if(arm){arm.rotation.x=-.25;arm.rotation.z=(side==='Left'?-1:1)*(.35+.07*Math.sin(this.clock*2));}}
      if(b.phase==='exiting' && b.time>=1){awardFirst(p,'balloon');p.actor.rotation.set(0,p.yaw,0);if(p instanceof CharacterController)p.setActivity('Idle');else {p.endBalloon();this.npcAfter=35+this.random()*25;}b.passenger=undefined;b.phase='parked';b.time=0;b.scale=1;b.group.scale.setScalar(1);}
    }
    if(this.approach){
      const {npc,balloon:b,health}=this.approach;this.approach.elapsed+=dt;
      if(this.networkBlocked.has(this.balloons.indexOf(b)) || npc.health!==health || npc.isDown || this.approach.elapsed>65 || b.phase!=='parked'){if(npc.state==='BalloonWalk')npc.endBalloon();this.approach=undefined;}
      else {
        const delta=b.group.position.clone().sub(npc.actor.position);delta.y=0;const distance=delta.length();
        if(distance<3){this.boardPassenger(b,npc);this.approach=undefined;}
        else {npc.yaw=Math.atan2(delta.x,delta.z);npc.actor.rotation.y=npc.yaw;npc.actor.position.addScaledVector(delta,Math.min(distance,2.4*npc.actor.scale.x*dt)/distance);npc.mixer.update(dt);}
      }
    }
    if(!this.approach && this.npcAfter<=0 && !this.balloons.some(b=>b.passenger && !(b.passenger instanceof CharacterController))){
      this.npcAfter=35+this.random()*25;
      const candidates=this.balloons.filter(b=>b.phase==='parked' && !this.networkBlocked.has(this.balloons.indexOf(b)) && (!player || player.actor.position.distanceTo(b.group.position)>12));
      for(const b of candidates){const npc=[...npcs].filter(n=>n.canBoardBalloon && !this.owns(n) && n.actor.position.distanceTo(b.group.position)<100).sort((a,c)=>a.actor.position.distanceToSquared(b.group.position)-c.actor.position.distanceToSquared(b.group.position))[0];
        if(npc){npc.beginBalloon(true);this.approach={npc,balloon:b,health:npc.health,elapsed:0};break;}}
    }
  }
  nearestDistance(position:T.Vector3){return Math.round(Math.min(...BALLOON_SITES.map(p=>Math.hypot(position.x-p.x,position.z-p.z))));}
}
