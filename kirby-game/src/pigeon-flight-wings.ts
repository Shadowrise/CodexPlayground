import {AnimationClip,AnimationMixer,Group,LoopRepeat,Object3D,PropertyBinding,Quaternion,Vector3} from 'three';

/** Keep flight wings running independently of the bird's one-shot chest peck. */
export class PigeonFlightWings {
  private readonly mixer:AnimationMixer;
  private readonly sampleRoot=new Group();
  private readonly poses:{node:Object3D;sample:Object3D;p:Vector3;q:Quaternion;s:Vector3}[];
  private applied=false;
  constructor(model:Object3D,flight:AnimationClip){
    const clip=flight.clone();clip.name='Air push wings';
    clip.tracks=clip.tracks.filter(track=>/^(Left|Right)_wing(_vane)?$/.test(PropertyBinding.parseTrackName(track.name).nodeName));
    const names=new Set(clip.tracks.map(track=>PropertyBinding.parseTrackName(track.name).nodeName));
    // Sample on four empty nodes: a second mixer on the real rig would skip
    // constant tracks after the main mixer has changed them (e.g. vane scale).
    this.poses=[...names].map(name=>{
      const sample=new Object3D();sample.name=name;this.sampleRoot.add(sample);
      return {node:model.getObjectByName(name)!,sample,p:new Vector3(),q:new Quaternion(),s:new Vector3()};
    });
    this.mixer=new AnimationMixer(this.sampleRoot);
    this.mixer.clipAction(clip).setLoop(LoopRepeat,Infinity).play();
  }
  clear(){
    if(!this.applied)return;
    for(const {node,p,q,s} of this.poses){node.position.copy(p);node.quaternion.copy(q);node.scale.copy(s);}
    this.applied=false;
  }
  update(time:number,flying:boolean){
    this.clear();if(!flying)return;
    for(const {node,p,q,s} of this.poses){p.copy(node.position);q.copy(node.quaternion);s.copy(node.scale);}
    this.mixer.setTime(time);
    for(const {node,sample} of this.poses){node.position.copy(sample.position);node.quaternion.copy(sample.quaternion);node.scale.copy(sample.scale);}
    this.applied=true;
  }
  dispose(){this.clear();this.mixer.stopAllAction();this.mixer.uncacheRoot(this.sampleRoot);}
}
