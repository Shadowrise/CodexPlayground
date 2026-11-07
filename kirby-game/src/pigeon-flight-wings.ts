import {AnimationClip,AnimationMixer,Group,LoopRepeat,Mesh,Object3D,PropertyBinding,Quaternion,Vector3} from 'three';

/** Keep flight wings running independently of the bird's one-shot chest peck. */
export class PigeonFlightWings {
  private readonly mixer:AnimationMixer;
  private readonly sampleRoot=new Group();
  private readonly poses:{node:Object3D;sample:Object3D;p:Vector3;q:Quaternion;s:Vector3;morph?:{node:Mesh;sample:Mesh;rest:number[]}}[];
  private applied=false;
  constructor(model:Object3D,flight:AnimationClip){
    const clip=flight.clone();clip.name='Air push wings';
    clip.tracks=clip.tracks.filter(track=>/^(Left|Right)_wing(_vane(_sculpt_paint)?)?$/.test(PropertyBinding.parseTrackName(track.name).nodeName));
    const names=new Set(clip.tracks.map(track=>PropertyBinding.parseTrackName(track.name).nodeName));
    // Sample on isolated nodes: a second mixer on the real rig would skip
    // constant tracks after the main mixer has changed them (e.g. vane scale).
    this.poses=[...names].map(name=>{
      const node=model.getObjectByName(name)!;
      const sample=node instanceof Mesh?new Mesh():new Object3D();sample.name=name;this.sampleRoot.add(sample);
      const morph=node instanceof Mesh&&sample instanceof Mesh&&node.morphTargetInfluences?
        {node,sample,rest:[...node.morphTargetInfluences]}:undefined;
      if(morph){morph.sample.morphTargetInfluences=[...morph.rest];morph.sample.morphTargetDictionary={...morph.node.morphTargetDictionary};}
      return {node,sample,p:new Vector3(),q:new Quaternion(),s:new Vector3(),morph};
    });
    this.mixer=new AnimationMixer(this.sampleRoot);
    this.mixer.clipAction(clip).setLoop(LoopRepeat,Infinity).play();
  }
  clear(){
    if(!this.applied)return;
    for(const {node,p,q,s,morph} of this.poses){node.position.copy(p);node.quaternion.copy(q);node.scale.copy(s);if(morph)morph.node.morphTargetInfluences!.splice(0,morph.rest.length,...morph.rest);}
    this.applied=false;
  }
  update(time:number,flying:boolean){
    this.clear();if(!flying)return;
    for(const {node,p,q,s,morph} of this.poses){p.copy(node.position);q.copy(node.quaternion);s.copy(node.scale);if(morph)morph.rest.splice(0,morph.rest.length,...morph.node.morphTargetInfluences!);}
    this.mixer.setTime(time);
    for(const {node,sample,morph} of this.poses){node.position.copy(sample.position);node.quaternion.copy(sample.quaternion);node.scale.copy(sample.scale);if(morph)morph.node.morphTargetInfluences!.splice(0,morph.rest.length,...morph.sample.morphTargetInfluences!);}
    this.applied=true;
  }
  dispose(){this.clear();this.mixer.stopAllAction();this.mixer.uncacheRoot(this.sampleRoot);}
}
