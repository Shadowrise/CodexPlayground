import * as T from 'three';
import {PIGEON_CLIPS,type PigeonClipName} from './pigeon-clips';
import {isPigeonGait,PIGEON_GAITS} from './pigeon-locomotion';

type Leg={hip:T.Group;knee:T.Group;foot:T.Group;side:number};
type PigeonRig={
  root:T.Group;rigs:T.Object3D[];motion:T.Group;body:T.Bone;neck:T.Bone;head:T.Bone;
  wings:T.Group[];wingVanes:T.Group[];tail:T.Group;tuft:T.Group;eyelids:T.Group[];pupils:T.Group[];jaw:T.Group;
  legs:Leg[];legPose:(leg:Leg,z:number,lift:number,pitch:number)=>void;
};

/** Bake articulated bird poses, so they also work outside this game's controller. */
export function createPigeonAnimations(rig:PigeonRig){
  const {root,rigs,motion,body,neck,head,wings,wingVanes,tail,tuft,eyelids,pupils,jaw,legs,legPose}=rig;
  const rest=rigs.map(node=>({node,p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone()}));
  const base=new Map(rest.map(row=>[row.node,row]));
  const tau=Math.PI*2,smooth=T.MathUtils.smoothstep,clamp=T.MathUtils.clamp;
  const euler=(node:T.Object3D,x=0,y=0,z=0)=>node.quaternion.copy(base.get(node)!.q).multiply(new T.Quaternion().setFromEuler(new T.Euler(x,y,z)));
  const pulse=(time:number,center:number,width:number)=>Math.max(0,1-Math.abs(time-center)/width)**2;
  const envelope=(u:number,start=.12,end=.88)=>smooth(u,0,start)*(1-smooth(u,end,1));
  const reset=()=>rest.forEach(row=>{row.node.position.copy(row.p);row.node.quaternion.copy(row.q);row.node.scale.copy(row.s);});

  function closeEyes(amount:number,left=amount,right=amount){
    eyelids.forEach((lid,i)=>{
      const close=clamp(i===0?left:right,0,1),visible=smooth(close,0,.18);
      lid.position.y=.17*(1-close);lid.scale.set(visible,close,visible);
    });
  }
  function blink(u:number,centers=[.23,.73],width=.022){
    closeEyes(Math.max(0,...centers.map(center=>clamp(1-Math.abs(u-center)/width,0,1))));
  }
  function look(yaw:number,pitch=0,tilt=0){
    euler(neck,pitch*.38,yaw*.32,tilt*.34);euler(head,pitch*.62,yaw*.68,tilt*.66);
    pupils.forEach(pupil=>{pupil.position.y+=clamp(-pitch*.018,-.018,.018);pupil.position.x+=clamp(-yaw*.022,-.030,.030);});
  }
  function coo(u:number,amount:number,rate=4){
    const syllable=(.5+.5*Math.sin(u*tau*rate))**2;
    euler(jaw,amount*(.12+.88*syllable));
    neck.scale.set(1+amount*.12,1+amount*.05,1+amount*.12);
  }
  // The approved folded-wing sculpt stays untouched. Rotate it about its
  // shoulder rather than its mesh centre, which keeps flight wings attached.
  function openWing(index:number,spread:number,flap=0,pitch=0){
    const wing=wings[index],side=index===0?-1:1;
    const shoulder=new T.Vector3(side*.53,1.06,.16),offset=base.get(wing)!.p.clone().sub(shoulder);
    const q=new T.Quaternion().setFromEuler(new T.Euler(pitch,-side*spread,side*flap,'ZYX'));
    wing.quaternion.copy(q);wing.position.copy(shoulder).add(offset.applyQuaternion(q));
  }
  function flightWing(index:number,beat:number,sweep:number){
    const wing=wings[index],vane=wingVanes[index],side=index===0?-1:1;
    // Folded wings lie in YZ. Rolling their surface by 90 degrees makes XZ
    // the wing plane; the following sweep sends the feather tips outward.
    const roll=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),side*Math.PI/2);
    const yaw=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-side*sweep);
    const flap=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),side*beat);
    const q=flap.multiply(yaw);
    // The folded sculpt inherits the torso's curved side. Flatten only that
    // curvature during flight, retaining its outline, feather paint and UVs.
    vane.scale.x=.30;vane.quaternion.copy(roll);wing.quaternion.copy(q);
  }
  function feetTucked(lift=.29,z=.08){
    for(const leg of legs){leg.hip.position.y=.43;legPose(leg,z,lift,.48);}
  }
  function seated(u:number,depth=.21){
    const phase=u*tau;
    body.position.y-=depth-.006*Math.sin(phase);euler(body,.045,0,.009*Math.sin(phase));
    look(.085*Math.sin(phase),-.025,.022*Math.sin(phase));
    for(const leg of legs){leg.hip.position.y=.32;legPose(leg,.16,.15,-.055);}
    euler(tail,-.10,0,.009*Math.sin(phase));
    blink(u,[.36,.82]);
  }
  function walk(u:number,speed=1,backward=false,strideU=u){
    const phase=u*tau,direction=backward?-1:1,gait=PIGEON_GAITS[backward?'WalkBackward':speed>1?'Run':'Walk'];
    body.position.x=.022*speed*Math.sin(phase);body.position.y+=.022*speed*(1-Math.cos(phase*2));
    euler(body,(.035+.012*Math.sin(phase*2))*speed,.022*Math.sin(phase),.052*Math.sin(phase)*Math.min(1.35,speed));
    euler(neck,.074*Math.sin(phase*2-.4)*speed,0,-.021*Math.sin(phase));
    head.position.z+=.035*Math.sin(phase*2-.4)*speed;
    euler(head,-.056*Math.sin(phase*2-.4)*speed,-.025*Math.sin(phase),-.014*Math.sin(phase));
    wings.forEach((wing,i)=>wing.rotateX((i===0?-1:1)*.020*Math.sin(phase)*speed));
    tail.rotateZ(.028*Math.sin(phase+.6));
    for(const leg of legs){
      leg.hip.position.y=gait.hipHeight;
      const step=(strideU+(leg.side>0?.5:0))%1,reach=gait.reach;
      if(step<gait.stance)legPose(leg,direction*(reach-2*reach*step/gait.stance),0,0);
      else {const swing=(step-gait.stance)/(1-gait.stance);legPose(leg,direction*(-reach+2*reach*smooth(swing,0,1)),.14*speed*Math.sin(Math.PI*swing),-direction*.18*Math.sin(Math.PI*swing));}
    }
  }
  function flight(u:number,amount=1){
    const phase=u*tau,beat=Math.sin(phase*2);
    euler(body,.055*amount,0,.017*Math.sin(phase));body.position.y+=.024*beat*amount;
    euler(neck,-.045*amount,0,-.008*Math.sin(phase));euler(head,-.025*amount,0,.011*Math.sin(phase));
    wings.forEach((_,i)=>flightWing(i,.60*beat,1.45+.065*Math.cos(phase*2)));
    feetTucked(.29*amount,.035);euler(tail,-.12*amount,.016*Math.sin(phase),0);
  }
  function restSleep(u:number,amount=1){
    const breath=.5+.5*Math.sin(u*tau);
    body.position.y-=.13*amount;euler(body,0,0,.024*amount);
    body.scale.set(1+.009*breath*amount,1+.006*breath*amount,1+.008*breath*amount);
    neck.position.y-=.22*amount;neck.position.z-=.075*amount;
    head.position.y-=.025*amount;head.position.z-=.025*amount;
    look(-.18*amount,.19*amount,-.10*amount);closeEyes(amount);
    for(const leg of legs){leg.hip.position.y=.42;legPose(leg,-.045,.27*amount,.32*amount);}
    euler(tail,-.025*amount,0,.015*amount);
    // A bird lies on its flank, with the long torso still running along the
    // mattress. The game's bed only supplies its position and pillow heading.
    pivotMotion(new T.Vector3(0,1.12,-.15),new T.Euler(0,0,Math.PI/2*amount),new T.Vector3(.22*amount,-.178*amount,0));
  }
  function pivotMotion(pivot:T.Vector3,rotation:T.Euler,offset=new T.Vector3()){
    motion.quaternion.setFromEuler(rotation);motion.position.copy(pivot).sub(pivot.clone().applyQuaternion(motion.quaternion)).add(offset);
  }
  function animate(name:PigeonClipName,u:number){
    const phase=u*tau;
    switch(name){
      // The torso also uses the slower phase because its motion reaches the
      // head through the skeleton. Feet retain their original stride clock.
      case 'Walk':walk(u,1,false,u*PIGEON_GAITS.Walk.cyclesPerClip);break;
      case 'Run':walk(u,1.36,false,u*PIGEON_GAITS.Run.cyclesPerClip);euler(body,.10+.025*Math.sin(phase*2),0,.065*Math.sin(phase));wings.forEach((_,i)=>openWing(i,.12,.10+.065*Math.sin(phase*2)));break;
      case 'WalkBackward':walk(u,.8,true,u*PIGEON_GAITS.WalkBackward.cyclesPerClip);look(.16*Math.sin(phase),-.055,.025*Math.sin(phase));break;
      case 'Idle':{
        const breath=.5+.5*Math.sin(phase);
        body.scale.set(1+.004*breath,1+.004*breath,1+.003*breath);
        look(.06*Math.sin(phase),.018*Math.sin(phase*2),.012*Math.sin(phase));
        euler(tuft,.027*Math.sin(phase));blink(u,[.28,.79],.018);break;
      }
      case 'RotateLeft':case 'RotateRight':{
        const direction=name==='RotateLeft'?1:-1;
        root.quaternion.setFromEuler(new T.Euler(0,direction*Math.PI/2*smooth(u,.08,.93),0));
        walk((u*2)%1,.72);look(direction*.12*Math.sin(Math.PI*u),-.02,direction*.035*Math.sin(Math.PI*u));break;
      }
      case 'Jump':{
        const crouch=pulse(u,.13,.14)+pulse(u,.88,.12),air=smooth(u,.18,.34)*(1-smooth(u,.69,.83));
        body.position.y-=.12*crouch;euler(body,-.045*crouch+.055*air);look(0,-.09*air);
        for(const leg of legs){leg.hip.position.y=.49-.09*crouch;legPose(leg,-.035*air,.22*air,.34*air);}
        wings.forEach((_,i)=>openWing(i,.10+.26*air,.08*air));euler(tail,-.085*air);break;
      }
      case 'Fly':flight(u);blink(u,[.61],.025);break;
      case 'Swim':{
        body.position.y-=.18-.012*Math.sin(phase);euler(body,.07,0,.019*Math.sin(phase));look(.035*Math.sin(phase),-.035);
        for(const leg of legs){const paddle=phase+(leg.side>0?Math.PI:0);leg.hip.position.y=.40;legPose(leg,.08*Math.sin(paddle),.075+.04*Math.cos(paddle),.38*Math.cos(paddle));}
        wings.forEach((_,i)=>openWing(i,.025,.015*Math.sin(phase)));euler(tail,-.045);blink(u,[.72]);break;
      }
      case 'Push':case 'Attack':{
        const ready=pulse(u,.19,.22),strike=smooth(u,.27,.48)*(1-smooth(u,.57,.94));
        body.position.z-=.065*ready;body.position.z+=.23*strike;body.position.y-=.065*ready+.045*strike;
        euler(body,-.045*ready+.13*strike);look(0,.09*strike-.04*ready);
        wings.forEach((_,i)=>openWing(i,.09+.23*strike,.07*strike));
        for(const leg of legs){leg.hip.position.y=.48;legPose(leg,leg.side*.052*strike,.015*strike,-.04*strike);}
        closeEyes(.18*strike);coo(u,.20*strike,3);euler(tail,-.09*strike);break;
      }
      case 'Eat':{
        const dip=pulse(u,.25,.19)+pulse(u,.65,.19),recover=envelope(u);
        euler(body,.20*dip);body.position.y-=.075*dip;
        neck.position.y-=.11*dip;euler(neck,.40*dip);euler(head,.20*dip-.045*recover);
        head.position.z+=.07*dip;euler(jaw,.24*pulse(u,.35,.08)+.20*pulse(u,.75,.08));
        closeEyes(.36*dip);euler(tail,-.055*dip);break;
      }
      case 'Death':{
        const fall=smooth(u,.08,.65),kick=(1-smooth(u,.5,.83))*Math.sin(u*tau*3);
        feetTucked(.22,0);closeEyes(.96*smooth(u,.25,.58));
        pivotMotion(new T.Vector3(0,1.13,-.15),new T.Euler(-.07*fall,0,Math.PI*.49*fall),new T.Vector3(0,-.35*fall,0));
        euler(head,.04,0,.13*fall);wings.forEach((_,i)=>openWing(i,.10*fall,.08*fall));
        legs.forEach(leg=>leg.foot.rotateX(.14*kick));break;
      }
      case 'Roll':{
        feetTucked(.28,-.04);neck.position.y-=.10;look(0,.10);closeEyes(.82);
        pivotMotion(new T.Vector3(0,1.15,-.15),new T.Euler(0,0,-tau*u),new T.Vector3(0,-.12+.13*Math.sin(phase*2)**2,0));
        euler(tail,-.08);break;
      }
      case 'Sitting':seated(u);break;
      case 'Swing':{
        seated(u);euler(body,.045+.035*Math.sin(phase),0,.008*Math.sin(phase));
        look(.025*Math.sin(phase),-.025-.045*Math.cos(phase),.026*Math.sin(phase));
        legs.forEach(leg=>legPose(leg,.16+.045*Math.sin(phase),.15,.05*Math.sin(phase)));
        wings.forEach((_,i)=>openWing(i,.12,.08+.025*Math.sin(phase)));euler(tail,-.10-.03*Math.sin(phase));break;
      }
      case 'Cart':{
        seated(u);body.position.y+=.009*Math.sin(phase*4);look(.095*Math.sin(phase),-.055,.025*Math.sin(phase));
        wings.forEach((_,i)=>openWing(i,.11,.075));euler(tuft,.04*Math.sin(phase*4));break;
      }
      case 'Boat':{
        seated(u);euler(body,.04+.015*Math.sin(phase),0,.024*Math.sin(phase));look(.12*Math.sin(phase),-.03,-.015*Math.sin(phase));
        wings.forEach((_,i)=>openWing(i,.03,.018*Math.sin(phase)));break;
      }
      case 'Balloon':{
        seated(u);look(.22*Math.sin(phase),-.10+.025*Math.cos(phase),.032*Math.sin(phase));
        wings.forEach((_,i)=>openWing(i,.075,.04));euler(tuft,-.04);break;
      }
      case 'FireflyRide':{
        seated(u,.18);euler(body,.095,0,.016*Math.sin(phase));look(.07*Math.sin(phase),-.075,-.02*Math.sin(phase));
        legs.forEach(leg=>legPose(leg,.08,.16,.13));wings.forEach((_,i)=>openWing(i,.16,.085+.035*Math.sin(phase)));euler(tail,-.12);break;
      }
      case 'Sleep':restSleep(u);break;
      case 'Wake':{
        const waking=smooth(u,.04,.87),stretch=Math.sin(Math.PI*smooth(u,.25,.91));
        restSleep(u,1-waking);neck.position.y+=.055*stretch;look(-.07*(1-waking),-.11*stretch,-.035*(1-waking));
        closeEyes(1-smooth(u,.14,.36)+.60*pulse(u,.42,.055)+.45*pulse(u,.58,.045));
        wings.forEach((_,i)=>openWing(i,.30*stretch,.17*stretch));euler(jaw,.31*stretch);break;
      }
      case 'Climb':{
        walk(u,.80);euler(body,.12,0,.038*Math.sin(phase));look(0,-.16,.013*Math.sin(phase));
        for(const leg of legs){const step=(u+(leg.side>0?.5:0))%1;leg.hip.position.y=.51;legPose(leg,.11*Math.cos(step*tau),.075+.095*Math.sin(Math.PI*step)**2,-.09*Math.sin(step*tau));}
        wings.forEach((_,i)=>openWing(i,.17,.11+.04*Math.sin(phase*2)));break;
      }
      case 'Lookout':{
        animate('Idle',u);look(.38*Math.sin(phase),-.095-.025*Math.cos(phase),.055*Math.sin(phase));
        neck.position.y+=.035;blink(u,[.32,.78]);break;
      }
      case 'LeafDive':{
        const bounce=.5-.5*Math.cos(phase);
        feetTucked(.20,.01);euler(body,.13+.035*Math.sin(phase));body.position.y-=.09+.055*bounce;
        look(.065*Math.sin(phase),.075,-.02*Math.sin(phase));wings.forEach((_,i)=>openWing(i,.20,.16+.04*Math.sin(phase)));blink(u,[.22,.78]);break;
      }
      case 'Trampoline':{
        const air=smooth(u,.10,.27)*(1-smooth(u,.72,.90)),crouch=pulse(u,0,.12)+pulse(u,1,.12);
        body.position.y-=.11*crouch;euler(body,.04*air-.025*crouch);look(0,-.12*air);
        for(const leg of legs){leg.hip.position.y=.49-.09*crouch;legPose(leg,-.03*air,.23*air,.35*air);}
        wings.forEach((_,i)=>openWing(i,.10+.48*air,.06+.13*air));euler(tail,-.08*air);closeEyes(.25*crouch);break;
      }
      case 'Hello':{
        const active=envelope(u,.11,.86),wave=Math.sin(phase*3);
        look(-.12*active,-.025*active,-.075*active);euler(body,0,0,-.022*active);coo(u,.19*active,3);
        openWing(0,.10*active,.05*active);openWing(1,.70*active,(.47+.20*wave)*active,-.06*active);
        blink(u,[.24,.74]);euler(tail,0,0,.025*active*Math.sin(phase*2));break;
      }
      case 'Joy':{
        const active=envelope(u,.11,.86),hop=.085*Math.max(0,Math.sin(u*tau*3-.3))*active;
        motion.position.y=hop;body.position.y-=.025*active;look(.035*Math.sin(phase*3)*active,-.11*active,.045*Math.sin(phase*3)*active);
        wings.forEach((_,i)=>openWing(i,.34*active,(.20+.11*Math.sin(phase*3))*active));
        legs.forEach(leg=>{leg.hip.position.y=.50;legPose(leg,0,hop*.85,-hop);});
        closeEyes(.62*active);coo(u,.26*active,6);euler(tail,-.05*active,0,.045*Math.sin(phase*3)*active);break;
      }
      case 'Fear':{
        const active=envelope(u,.05,.84),startle=pulse(u,.14,.17),shake=Math.sin(u*tau*15)*active;
        motion.position.y=.065*startle;body.position.z-=.085*active;body.position.y-=.055*active;euler(body,-.055*active,0,.011*shake);
        neck.position.y+=.045*active;look(.055*shake,-.09*active,.018*shake);
        wings.forEach((_,i)=>openWing(i,(.20+.14*startle)*active,(.13+.08*startle)*active));
        pupils.forEach(pupil=>pupil.scale.set(1-.22*active,1-.12*active,1));coo(u,.20*active,8);
        for(const leg of legs){leg.hip.position.y=.48;legPose(leg,-.025*active,.06*startle,.07*startle);}
        euler(tuft,-.16*active);break;
      }
      case 'Anger':{
        const active=envelope(u,.09,.86),stamp=pulse(u,.33,.075)+pulse(u,.58,.075),ruffle=Math.sin(phase*7)*active;
        body.position.y-=.075*active;body.position.z+=.065*active;euler(body,.09*active,0,.012*ruffle);
        look(.028*ruffle,.13*active,-.025*active);closeEyes(.36*active,.29*active,.43*active);
        neck.scale.set(1+.035*active,1-.025*active,1+.04*active);
        wings.forEach((_,i)=>openWing(i,.18*active,.12*active));coo(u,.31*active,5);
        for(const leg of legs){const stomp=leg.side>0?stamp:0;leg.hip.position.y=.46;legPose(leg,.025*active,.10*stomp,-.10*stomp);}
        euler(tuft,-.18*active);euler(tail,.035*active,0,.03*ruffle);break;
      }
      case 'Sad':{
        const active=envelope(u,.14,.84),sigh=.5+.5*Math.sin(phase*2);
        body.position.y-=.09*active;euler(body,.045*active,0,-.025*active);neck.position.y-=.075*active;
        look(-.06*active,.16*active,.09*active);closeEyes(.57*active);coo(u,.085*active*sigh,2);
        wings.forEach((_,i)=>openWing(i,.035*active,-.045*active));euler(tail,.055*active);euler(tuft,.08*active);
        for(const leg of legs){leg.hip.position.y=.46;legPose(leg,0,0,0);}break;
      }
    }
  }

  const clips=PIGEON_CLIPS.map(definition=>{
    const cycles=isPigeonGait(definition.name)?PIGEON_GAITS[definition.name].cyclesPerClip:1;
    const count=(definition.name==='Walk'?84:Math.max(32,Math.ceil(definition.duration/cycles*40)))*cycles;
    const times=Array.from({length:count+1},(_,i)=>i/count*definition.duration);
    const values=rest.map(()=>({p:[] as number[],q:[] as number[],s:[] as number[]}));
    const yaw:number[]=[];
    for(let frame=0;frame<=count;frame++){
      reset();root.quaternion.identity();
      // Exact first/last samples make repeatable wingbeats and rides seamless.
      const u=definition.loop&&frame===count?0:frame/count;
      animate(definition.name,u);
      rest.forEach((row,i)=>{values[i].p.push(...row.node.position.toArray());values[i].q.push(...row.node.quaternion.toArray());values[i].s.push(...row.node.scale.toArray());});
      if(definition.name==='RotateLeft'||definition.name==='RotateRight')yaw.push(...root.quaternion.toArray());
    }
    const tracks:T.KeyframeTrack[]=[];
    rest.forEach((row,i)=>tracks.push(
      new T.VectorKeyframeTrack(`${row.node.name}.position`,times,values[i].p),
      new T.QuaternionKeyframeTrack(`${row.node.name}.quaternion`,times,values[i].q),
      new T.VectorKeyframeTrack(`${row.node.name}.scale`,times,values[i].s),
    ));
    if(yaw.length)tracks.push(new T.QuaternionKeyframeTrack(`${root.name}.quaternion`,times,yaw));
    const clip=new T.AnimationClip(definition.name,definition.duration,tracks);clip.optimize();return clip;
  });
  reset();root.quaternion.identity();return clips;
}
