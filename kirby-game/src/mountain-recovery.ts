import * as T from 'three';
import type {CharacterController} from './controller';
import {MOUNTAIN_SUMMIT,MOUNTAIN_PEAK,mountainWorld} from './mountain-ledges-layout';
import {LeafPile} from './leaf-pile';

export type MountainSound='bounce'|'checkpoint'|'leaves';
const rests=[MOUNTAIN_SUMMIT,MOUNTAIN_PEAK];
export class MountainRecovery{
  readonly group=new T.Group();
  readonly trampoline=new T.Group();
  readonly upper=new T.Group();
  readonly landing:T.Vector3;
  private readonly leaves=new LeafPile(4.7,4.2);
  private readonly flags:T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>[]=[];
  private readonly fabrics:T.Mesh[]=[];
  private travel?:{rider:CharacterController;from:T.Vector3;pad:T.Vector3;to:T.Vector3;elapsed:number;launched:boolean;down:boolean;fabric:T.Mesh;landed:boolean};
  get active(){return !!this.travel;}

  constructor(entry:T.Vector3,private sound:(kind:MountainSound)=>void=()=>{}){
    this.group.name='Mountain checkpoint flags and recovery trampoline';
    this.trampoline.name='Mountain recovery trampoline';this.trampoline.position.copy(entry).add(new T.Vector3(-2.5,0,-2.5));this.group.add(this.trampoline);
    const top=mountainWorld(MOUNTAIN_PEAK.tangent+2.4,MOUNTAIN_PEAK.radial+.7);
    this.upper.name='Mountain peak descent trampoline';this.upper.position.set(top.x,MOUNTAIN_PEAK.y,top.z);this.group.add(this.upper);
    this.landing=this.trampoline.position.clone().add(new T.Vector3(-12,0,-12));this.leaves.group.position.copy(this.landing);this.group.add(this.leaves.group);
    const metal=new T.MeshStandardMaterial({color:'#adbdcf',metalness:.7,roughness:.25});
    const springGeometry=new T.TorusGeometry(.07,.018,5,10),legGeometry=new T.CylinderGeometry(.055,.075,.5,7);
    for(const frame of [this.trampoline,this.upper]){
      const rim=new T.Mesh(new T.TorusGeometry(1.55,.16,10,40),new T.MeshStandardMaterial({color:'#ffc45f',roughness:.5}));rim.rotation.x=Math.PI/2;rim.position.y=.55;frame.add(rim);
      const fabric=new T.Mesh(new T.CylinderGeometry(1.4,1.4,.08,40),new T.MeshStandardMaterial({color:'#6056a1',roughness:.8}));fabric.name='Spring pad';fabric.position.y=.52;frame.add(fabric);this.fabrics.push(fabric);
      for(let i=0;i<16;i++){
        const a=i*Math.PI/8,spring=new T.Mesh(springGeometry,metal);spring.position.set(Math.cos(a)*1.44,.5,Math.sin(a)*1.44);spring.rotation.set(Math.PI/2,0,a);frame.add(spring);
        if(i%2===0){const leg=new T.Mesh(legGeometry,metal);leg.position.set(Math.cos(a)*1.3,.25,Math.sin(a)*1.3);frame.add(leg);}
      }
    }
    rests.forEach((rest,i)=>{
      const p=mountainWorld(rest.tangent-rest.width*.2,rest.radial-.5),flag=new T.Group();flag.name=i?'Mountain peak checkpoint flag':'Mountain bread checkpoint flag';flag.position.set(p.x,rest.y,p.z);this.group.add(flag);
      const pole=new T.Mesh(new T.CylinderGeometry(.045,.055,2.2,8),metal);pole.position.y=1.1;flag.add(pole);
      const banner=new T.Mesh(new T.PlaneGeometry(1.2,.65),new T.MeshBasicMaterial({color:'#fff2b8',side:T.DoubleSide}));banner.position.set(.6,1.85,0);flag.add(banner);this.flags.push(banner);
    });
    this.group.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=o.receiveShadow=true;});
  }
  reach(c:CharacterController,checkpoint:number){
    if(checkpoint<=c.mountainCheckpoint)return;
    c.mountainCheckpoint=checkpoint;this.sound('checkpoint');
  }
  prompt(c:CharacterController){
    if(this.active||c.flight.active||c.roll.active)return '';
    if(Math.abs(c.actor.position.y-MOUNTAIN_PEAK.y)<.5&&c.actor.position.distanceTo(this.upper.position)<2.8)return 'E — прыгнуть с вершины в листья';
    if(c.actor.position.y>.5||c.actor.position.distanceTo(this.trampoline.position)>=3.4+.9*Math.max(0,c.actor.scale.x-1))return '';
    return c.mountainCheckpoint===2?'E — вернуться к флажку на вершине':c.mountainCheckpoint===1?'E — вернуться к флажку у хлебушка':'';
  }
  target(c:CharacterController){return c.actor.position.y>1?this.upper:this.trampoline;}
  start(c:CharacterController){
    if(!this.prompt(c))return false;
    const down=c.actor.position.y>1,frame=down?this.upper:this.trampoline,rest=rests[Math.max(0,c.mountainCheckpoint-1)],p=mountainWorld(rest.tangent,rest.radial);
    this.travel={rider:c,from:c.actor.position.clone(),pad:frame.position.clone().add(new T.Vector3(0,.56,0)),to:down?this.landing.clone():new T.Vector3(p.x,rest.y,p.z),elapsed:0,launched:false,down,fabric:this.fabrics[down?1:0],landed:false};
    c.setActivity('Trampoline');c.swimming=false;return true;
  }
  cancel(){this.travel?.rider.setActivity('Idle');this.travel=undefined;for(const fabric of this.fabrics)fabric.position.y=.52;}
  update(dt:number,c?:CharacterController){
    this.leaves.update(dt);
    this.flags.forEach((flag,i)=>flag.material.color.set((c?.mountainCheckpoint??0)>i?'#65ffb5':'#fff2b8'));
    const travel=this.travel;if(!travel)return;
    const {rider,from,pad,to,fabric,down}=travel;travel.elapsed+=dt;rider.mixer.update(dt);
    if(travel.elapsed<.55){const u=travel.elapsed/.55;rider.actor.position.lerpVectors(from,pad,u);rider.actor.position.y+=Math.sin(u*Math.PI)*1.4;return;}
    if(travel.elapsed<.73){const press=Math.sin((travel.elapsed-.55)/.18*Math.PI)*.16;fabric.position.y=.52-press;rider.actor.position.copy(pad);rider.actor.position.y-=press;return;}
    fabric.position.y=.52;
    if(!travel.launched){travel.launched=true;this.sound('bounce');}
    const flightTime=travel.elapsed-.73,u=Math.min(1,flightTime/3.2),ease=(t:number)=>t*t*(3-2*t),horizontal=ease(T.MathUtils.clamp(down?u/.6:(u-.38)/.5,0,1));
    rider.actor.position.lerpVectors(pad,to,horizontal);
    // Rise in front of the slope before moving over the lower mountain steps.
    rider.actor.position.y=down?pad.y*(1-ease(T.MathUtils.clamp((u-.3)/.7,0,1)))+Math.sin(u*Math.PI)*10:pad.y+(to.y-pad.y)*ease(Math.min(1,u/.6))+Math.sin(u*Math.PI)*8;
    if(u===1){
      rider.actor.position.copy(to);
      if(down&&!travel.landed){travel.landed=true;this.leaves.burst();this.sound('leaves');}
      if(!down||flightTime>=3.85){rider.setActivity('Idle');rider.surfaceY=to.y;this.travel=undefined;}
    }
  }
}
