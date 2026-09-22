import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeLuigi, updateLuigiIdle } from './luigi';
import { cloneVariant, remainingVariants, type KirbyVariant } from './variants';
import type { CharacterController } from './controller';

export const STATION = new T.Vector3(0,0,222);
export function createCoasterCurve() {
  const p=[[0,2,232],[25,3,232],[50,28,232],[76,72,232],[88,82,232],[94,79,232],[103,48,232],[114,13,232],[140,7,232],[165,27,232],[188,9,232],[220,15,220],[230,32,178],[223,8,145],[220,12,115],[220,12,90]].map(v=>new T.Vector3(...v as [number,number,number]));
  // Separate entrance and exit sideways so the returning rail cannot cross riders' heads.
  for(let i=0;i<=56;i++){const u=i/56,a=u*Math.PI*2;p.push(new T.Vector3(220+18*u,12+24*(1-Math.cos(a)),70-24*Math.sin(a)-14*u));}
  const add=(points:number[][])=>p.push(...points.map(v=>new T.Vector3(...v as [number,number,number])));
  add([[238,12,35],[226,39,-10],[236,8,-50],[222,46,-100],[231,12,-145],[213,28,-210],[165,8,-220],[140,8,-220]]);
  // North-side loop, with separated entry and exit lanes.
  for(let i=0;i<=56;i++){const u=i/56,a=u*Math.PI*2;p.push(new T.Vector3(110-24*Math.sin(a)-14*u,8+24*(1-Math.cos(a)),-220-18*u));}
  add([[65,8,-238],[25,35,-229],[-15,10,-237],[-60,42,-224],[-105,9,-235],[-145,22,-232]]);
  // One and a half climbing spiral turns; the pitch leaves headroom between coils.
  for(let i=0;i<=84;i++){const u=i/84,a=u*Math.PI*3;p.push(new T.Vector3(-189+24*Math.cos(a),28+36*u,-207+24*Math.sin(a)));}
  add([[-215,65,-223],[-231,61,-226],[-242,51,-210],[-238,20,-171],[-228,9,-142],[-218,9,-125]]);
  for(let i=0;i<=56;i++){const u=i/56,a=u*Math.PI*2;p.push(new T.Vector3(-218-18*u,9+22*(1-Math.cos(a)),-95+22*Math.sin(a)+14*u));}
  add([[-236,9,-45],[-225,39,-10],[-237,8,35],[-221,43,80],[-235,10,130],[-225,32,178],[-205,9,221],[-160,30,232],[-115,8,225],[-75,23,234],[-40,5,232],[-20,2,232]]);
  const curve=new T.CatmullRomCurve3(p,true,'centripetal');
  curve.arcLengthDivisions=6000;
  return curve;
}

export class Coaster {
  readonly group=new T.Group();
  readonly curve=createCoasterCurve();
  readonly length=this.curve.getLength();
  private frames:T.Quaternion[]=[];
  private carts:{group:T.Group; distance:number; wait:number; speed:number; wheels:T.Object3D[]; occupied:boolean}[]=[];
  private passengerMixers:T.AnimationMixer[]=[];
  private kirbysAdded=false;
  private luigi?:T.Group;
  private rider?:CharacterController;
  private ridden?:typeof this.carts[number];
  private riderParent?:T.Object3D;
  private sampleCount=2400;
  get riding(){return !!this.rider;}
  readonly rideMotion={speed:0,slope:0,inverted:false,turn:0};
  constructor() {
    this.group.name='Mountain circuit roller coaster';
    let right=new T.Vector3(0,0,-1);
    for(let i=0;i<=this.sampleCount;i++) {
      const tangent=this.curve.getTangentAt(i/this.sampleCount).normalize();
      right.addScaledVector(tangent,-right.dot(tangent)).normalize();
      const up=new T.Vector3().crossVectors(tangent,right).normalize();
      this.frames.push(new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(right,up,tangent)));
    }
    // Spread residual transport twist around the loop for a seamless station joint.
    const end=this.frames[this.sampleCount],start=this.frames[0];
    const correction=end.clone().invert().multiply(start);
    for(let i=1;i<=this.sampleCount;i++)this.frames[i].multiply(new T.Quaternion().slerp(correction,i/this.sampleCount));
    const colors=new Map<string,T.MeshStandardMaterial>();
    const box=new T.BoxGeometry(1,1,1),pole=new T.CylinderGeometry(1,1,1,8);
    const material=(c:string)=>{if(!colors.has(c))colors.set(c,new T.MeshStandardMaterial({color:c,roughness:.65,metalness:c==='#becbd0'?.7:.15}));return colors.get(c)!;};
    const parts:T.Mesh[]=[];
    const add=(geometry:T.BufferGeometry,color:string,pos:T.Vector3,scale:T.Vector3,q=new T.Quaternion())=>{
      const m=new T.Mesh(geometry,material(color));m.position.copy(pos);m.scale.copy(scale);m.quaternion.copy(q);m.updateMatrix();parts.push(m);return m;
    };
    const beam=(a:T.Vector3,b:T.Vector3,r:number,c:string)=>add(pole,c,a.clone().add(b).multiplyScalar(.5),new T.Vector3(r,a.distanceTo(b),r),new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()));
    for(const offset of [-1.2,1.2]) {
      const points=Array.from({length:this.sampleCount+1},(_,i)=>this.curve.getPointAt(i/this.sampleCount).add(new T.Vector3(offset,0,0).applyQuaternion(this.frames[i])));
      const rail=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points,true),2400,.13,6,true),material('#becbd0'));rail.castShadow=true;this.group.add(rail);
    }
    for(let d=0;d<this.length;d+=2.4) {
      const pose=this.pose(d);add(box,'#307f88',pose.p,new T.Vector3(3,.18,.32),pose.q);
      for(const x of [-1.2,1.2])add(box,'#596671',pose.p.clone().add(new T.Vector3(x,.15,0).applyQuaternion(pose.q)),new T.Vector3(.25,.15,.4),pose.q);
    }
    for(let d=0;d<this.length;d+=15) {
      const {p}=this.pose(d);
      // The loop uses exterior portal supports, never columns through its interior.
      if((p.x>210 && p.z>25 && p.z<120) || (p.z<-210 && p.x>55 && p.x<145)
        || (p.x<-205 && p.z>-130 && p.z<-45) || (p.x<-155 && p.z<-175))continue;
      for(const sign of [-1,1]) {const base=new T.Vector3(p.x+sign*2.2,.1,p.z);
        add(box,'#a1a39a',base,new T.Vector3(2,.3,2));beam(base,p.clone().add(new T.Vector3(sign*.9,-.2,0)),.18,'#426a70');}
      if(p.y>8)beam(new T.Vector3(p.x-2.2,1,p.z),new T.Vector3(p.x+1,p.y*.72,p.z),.1,'#577e7f');
    }
    for(const z of [36,90]) {
      for(const x of [208,248]) {
        add(box,'#a1a39a',new T.Vector3(x,.15,z),new T.Vector3(3,.3,3));
        beam(new T.Vector3(x,0,z),new T.Vector3(x,69,z),.35,'#426a70');
      }
      beam(new T.Vector3(208,69,z),new T.Vector3(248,69,z),.35,'#426a70');
    }
    // Portal frames span the extra loops, with columns outside their swept volume.
    for(const x of [70,128]) {
      for(const z of [-251,-205])beam(new T.Vector3(x,.1,z),new T.Vector3(x,73,z),.3,'#426a70');
      beam(new T.Vector3(x,73,-251),new T.Vector3(x,73,-205),.3,'#426a70');
    }
    for(const z of [-118,-63]) {
      for(const x of [-250,-204])beam(new T.Vector3(x,.1,z),new T.Vector3(x,71,z),.3,'#426a70');
      beam(new T.Vector3(-250,71,z),new T.Vector3(-204,71,z),.3,'#426a70');
    }
    // The spiral is carried by an inner tower; arms sit below each coil.
    for(const x of [-195,-183])for(const z of [-213,-201])beam(new T.Vector3(x,0,z),new T.Vector3(x,65,z),.3,'#426a70');
    for(let i=0;i<12;i++) {
      const u=i/12,a=u*Math.PI*3;
      beam(new T.Vector3(-189,20+36*u,-207),new T.Vector3(-189+24*Math.cos(a),27.6+36*u,-207+24*Math.sin(a)),.18,'#577e7f');
    }
    // Open boarding platform: no canopy obscures the rider or follow camera.
    add(box,'#b9a582',new T.Vector3(0,.35,224),new T.Vector3(24,.7,10));
    for(let i=0;i<3;i++)add(box,'#a7987c',new T.Vector3(0,.12+i*.1,217+i*.7),new T.Vector3(7,.24+i*.2,.8));
    for(const x of [-11,-5,5,11]) {
      for(const z of [220,225])if(Math.abs(x)>6)beam(new T.Vector3(x,.7,z),new T.Vector3(x,1.8,z),.07,'#d6cba6');
    }
    for(const x of [-10,10])beam(new T.Vector3(x,.7,228),new T.Vector3(x,20,228),.2,'#355f69');
    add(box,'#efbd54',new T.Vector3(0,18,228),new T.Vector3(26,6.5,.55));
    if(typeof document!=='undefined') {
      const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=384;
      const ctx=canvas.getContext('2d')!;
      ctx.fillStyle='#224956';ctx.fillRect(0,0,1536,384);
      ctx.strokeStyle='#ffce66';ctx.lineWidth=16;ctx.strokeRect(15,15,1506,354);
      ctx.textAlign='center';ctx.fillStyle='#fff4d3';ctx.font='bold 150px sans-serif';ctx.fillText('ДЕПО',768,190);
      ctx.font='bold 58px sans-serif';ctx.fillStyle='#ffce66';ctx.fillText('АМЕРИКАНСКИЕ ГОРКИ',768,292);
      const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
      const sign=new T.Mesh(new T.PlaneGeometry(25.5,6.1),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));
      sign.name='Depot sign';sign.position.set(0,18,227.7);sign.rotation.y=Math.PI;this.group.add(sign);
      const back=sign.clone();back.position.z=228.3;back.rotation.y=0;this.group.add(back);
    }
    for(const x of [-8,8])add(box,'#d1a15b',new T.Vector3(x,1.15,222),new T.Vector3(4,.25,1));
    const batches=new Map<string,T.Mesh[]>();
    for(const m of parts){const k=m.geometry.uuid+(m.material as T.Material).uuid;if(!batches.has(k))batches.set(k,[]);batches.get(k)!.push(m);}
    for(const list of batches.values()){const m=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);list.forEach((p,i)=>m.setMatrixAt(i,p.matrix));m.castShadow=true;m.receiveShadow=true;this.group.add(m);}
    for(const [i,c] of ['#e74b6b','#f3b62d','#48bccc','#9357d8','#70ba47','#f17b38','#dd538f','#4a91de','#bd76df','#c4d947','#dd7657','#48b798'].entries()) {
      const g=new T.Group(),wheels:T.Object3D[]=[];
      g.name=`Rounded coaster cart ${i+1}`;
      const part=(size:number[],pos:number[],color:string)=>{const m=new T.Mesh(new RoundedBoxGeometry(size[0],size[1],size[2],4,Math.min(.3,...size.map(s=>s*.45))),material(color));m.position.set(...pos as [number,number,number]);g.add(m);m.castShadow=true;return m;};
      part([2.6,.3,3.1],[0,.4,0],'#3c4b53');part([2.65,.8,3.25],[0,.85,0],c);
      for(const x of [-1.22,1.22])part([.3,.65,2.95],[x,1.35,0],c);
      part([2.6,1, .35],[0,1.35,-1.4],c);part([2.6,.7,.65],[0,1.15,1.3],c);
      part([1.9,.15,1.65],[0,1.22,-.2],'#eedbb9');part([1.9,.8,.22],[0,1.65,-1.15],'#eedbb9');
      part([2.1,.09,.09],[0,1.65,.65],'#becbd0');
      for(const x of [-1.45,1.45])for(const z of [-1,1]) {const w=new T.Mesh(new T.CylinderGeometry(.32,.32,.25,14),material('#303b43'));w.rotation.z=Math.PI/2;w.position.set(x,.15,z);g.add(w);wheels.push(w);}
      if(i===11){
        const luigi=makeLuigi();luigi.position.set(0,1.35,-.1);g.add(luigi);this.luigi=luigi;
        const letter=new T.Shape();
        letter.moveTo(-.32,.34);letter.lineTo(-.13,.34);letter.lineTo(-.13,-.15);
        letter.lineTo(.32,-.15);letter.lineTo(.32,-.34);letter.lineTo(-.32,-.34);letter.closePath();
        const geometry=new T.ShapeGeometry(letter),white=material('#ffffff');
        for(const side of [-1,1]) {
          const emblem=new T.Mesh(geometry,white);emblem.name='Luigi door L';
          emblem.position.set(side*1.376,1.22,0);emblem.rotation.y=side*Math.PI/2;
          g.add(emblem);
        }
        const hood=new T.Mesh(geometry,white);hood.name='Luigi hood L';
        hood.position.set(0,1.507,1.3);hood.rotation.x=-Math.PI/2;hood.scale.set(1.25,.55,1);
        g.add(hood);
      }
      this.group.add(g);this.carts.push({group:g,distance:i*this.length/12,wait:i===0?2.5:0,speed:i===0?0:64,wheels,occupied:i%2===1 || i===10});
    }
  }
  addKirbyPassengers(template:T.Object3D,clips:T.AnimationClip[],selected:KirbyVariant) {
    if(this.kirbysAdded)return;this.kirbysAdded=true;
    const variants=remainingVariants(selected);
    for(const [i,index] of [1,3,5,7,9,10].entries()) {
      const model=cloneVariant(template,variants[i],true);model.name=`Permanent Kirby passenger ${i+1}`;
      model.position.set(0,1.3,0);this.carts[index].group.add(model);
      const mixer=new T.AnimationMixer(model),clip=clips.find(c=>c.name==='Idle');
      if(clip)mixer.clipAction(clip).play();this.passengerMixers.push(mixer);
    }
  }
  pose(distance:number) {
    const u=((distance/this.length)%1+1)%1,f=u*this.sampleCount,i=Math.floor(f);
    return {p:this.curve.getPointAt(u),q:this.frames[i].clone().slerp(this.frames[i+1],f-i)};
  }
  prompt(player:CharacterController) {
    if(this.riding)return 'E — выйти из тележки в депо';
    if(player.actor.position.distanceTo(STATION)>12* Math.min(player.actor.scale.x,2))return '';
    return this.carts.some(c=>c.wait>0 && !c.occupied)?'E — сесть в тележку':'Депо · ожидаем свободную тележку';
  }
  board(player:CharacterController) {
    if(this.riding || !['Idle','Run','WalkBackward'].includes(player.state) || !this.prompt(player))return false;
    const cart=this.carts.find(c=>c.wait>0 && !c.occupied);if(!cart)return false;
    player.update(0,{forward:false,left:false,right:false});
    this.rider=player;this.ridden=cart;this.riderParent=player.actor.parent!;
    cart.wait=1.2;cart.speed=0;cart.group.scale.setScalar(Math.max(1,player.actor.scale.x));return true;
  }
  disembark() {
    if(!this.rider || !this.ridden)return;
    const player=this.rider;this.riderParent!.add(player.actor);
    player.actor.position.set(0,0,214);player.actor.quaternion.identity();player.yaw=0;
    this.ridden.group.scale.setScalar(1);
    this.rider=undefined;this.ridden=undefined;this.rideMotion.speed=0;
  }
  update(dt:number) {
    if(this.luigi)updateLuigiIdle(this.luigi,dt);
    for(const mixer of this.passengerMixers)mixer.update(dt);
    this.rideMotion.speed=0;this.rideMotion.slope=0;this.rideMotion.inverted=false;this.rideMotion.turn=0;
    for(const cart of this.carts) {
      if(cart.wait>0){cart.wait=Math.max(0,cart.wait-dt);cart.speed=0;}
      else {
        const t=this.curve.getTangentAt(cart.distance/this.length);
        const remaining=this.length-cart.distance;
        const cruisingSpeed=2*(remaining<35?Math.max(7,remaining):Math.max(13,32-t.y*22));
        const ahead=this.carts.filter(c=>c!==cart).map(c=>({cart:c,gap:(c.distance-cart.distance+this.length)%this.length})).sort((a,b)=>a.gap-b.gap)[0];
        const gap=ahead.gap;
        // Five metres between ordinary cart centres; grown riders keep extra room.
        const spacing=1.7*(cart.group.scale.x+ahead.cart.group.scale.x)+1.6;
        const space=Math.max(0,gap-spacing);
        // Follow a moving cart at its speed instead of braking as if it were a wall.
        const target=Math.min(cruisingSpeed,Math.sqrt(2*24*remaining),Math.sqrt(ahead.cart.speed**2+2*24*Math.max(0,space-.03)));
        const oldSpeed=cart.speed;
        cart.speed+=Math.max(-32*dt,Math.min(12*dt,target-cart.speed));
        const travel=Math.min((oldSpeed+cart.speed)*.5*dt,space);
        if(travel<cart.speed*dt*.5)cart.speed=dt>0?travel/dt:0;
        cart.distance+=travel;
        if(cart===this.ridden)this.rideMotion.speed=dt>0?travel/dt:0;
        for(const wheel of cart.wheels)wheel.rotateY(travel/.32);
        if(cart.distance>=this.length-.02) {
          cart.distance=0;cart.wait=(cart.occupied || cart===this.ridden) ? .4 : 2.5;cart.speed=0;
        }
      }
      const pose=this.pose(cart.distance);cart.group.position.copy(pose.p);cart.group.quaternion.copy(pose.q);
      if(cart===this.ridden && this.rider) {
        this.rideMotion.slope=this.curve.getTangentAt(cart.distance/this.length).y;
        this.rideMotion.turn=this.curve.getTangentAt(cart.distance/this.length).angleTo(this.curve.getTangentAt(((cart.distance+3)%this.length)/this.length))/3;
        this.rideMotion.inverted=new T.Vector3(0,1,0).applyQuaternion(pose.q).y<0;
        const player=this.rider;
        player.actor.position.copy(new T.Vector3(0,1.3,0).multiplyScalar(cart.group.scale.x).applyQuaternion(pose.q).add(pose.p));
        player.actor.quaternion.copy(pose.q);player.yaw=Math.atan2(this.curve.getTangentAt(cart.distance/this.length).x,this.curve.getTangentAt(cart.distance/this.length).z);
        player.mixer.update(dt);
      }
    }
  }
}
