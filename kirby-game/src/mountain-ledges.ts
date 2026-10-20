import * as T from 'three';
import type { CharacterController } from './controller';
import { createMountainTexture } from './mountain-texture';
import { BIOME_TERRAIN } from './biome-style';
import { MEADOW_HALF_SIZE,MOUNTAIN_WIDTH, constrainToMeadow } from './world-bounds';
import { mountainSurfaceHeight } from './mountain-surface';
import {MountainRecovery,type MountainSound} from './mountain-recovery';
import { standingFootprint, footprintOverlapsRect } from './standing-footprint';
import {
  MOUNTAIN_LEDGE_SITE as SITE, MOUNTAIN_LEDGE_YAW as YAW, MOUNTAIN_STEPS as STEPS, MOUNTAIN_SUMMIT as SUMMIT,
  MOUNTAIN_PEAK as SEAL_NICHE,mountainCourseEnvelope,
  LEDGE_STAND_SECONDS, LEDGE_RETRACT_SECONDS, LEDGE_HIDDEN_SECONDS, LEDGE_EXTEND_SECONDS, LEDGE_RETRACT_DISTANCE,
  mountainFace, mountainLocal, mountainWorld, mountainLedgePose, mountainLedgeOutline, mountainOutlineContains, type MountainLedge,
} from './mountain-ledges-layout';

type Phase = 'ready' | 'retracting' | 'hidden' | 'extending';
const PHASES: Phase[] = ['ready', 'retracting', 'hidden', 'extending'];
const durations = { ready: 0, retracting: LEDGE_RETRACT_SECONDS, hidden: LEDGE_HIDDEN_SECONDS, extending: LEDGE_EXTEND_SECONDS };
const EMBED_DEPTH = 5;
type Step = { mesh: T.Mesh; phase: Phase; elapsed: number; standing: number; slide: number };

/** Individual ledges attach to the existing mountain slope; no extra cliff mesh. */
export class MountainLedges {
  readonly group = new T.Group();
  readonly steps: Step[] = [];
  readonly entry: T.Vector3;
  readonly summit: T.Mesh;
  readonly sealNiche: T.Mesh;
  readonly peak:T.Mesh;
  readonly recovery:MountainRecovery;
  get active(){return this.recovery.active;}
  prompt(c:CharacterController){return this.recovery.prompt(c);}
  start(c:CharacterController){return this.recovery.start(c);}
  cancel(){this.recovery.cancel();this.resetPlayer();}
  private base = 0;
  private fall: number | undefined;
  private time = 0;
  private readonly cameraDelta=new T.Vector3();

  constructor(mountainMaterial?: T.MeshStandardMaterial,sound?:(kind:MountainSound)=>void) {
    this.group.name = 'Mountain corner retracting ledges';
    this.group.position.set(SITE.x, 0, SITE.z); this.group.rotation.y = YAW;
    const material = mountainMaterial?.clone() ?? new T.MeshStandardMaterial({ map: createMountainTexture(), roughness: 1 });
    material.vertexColors = true;
    STEPS.forEach((p, i) => {
      const mesh = new T.Mesh(this.slab(p, .78, i), material);
      mesh.name = 'Retracting mountain step ' + (i + 1); mesh.position.set(p.tangent, p.y, p.radial);
      mesh.receiveShadow = mesh.castShadow = true; this.group.add(mesh);
      this.steps.push({ mesh, phase: 'ready', elapsed: 0, standing: 0, slide: 0 });
    });
    this.summit = new T.Mesh(this.slab(SUMMIT, 1.25, 20), material); this.summit.name = 'Mountain corner overlook';
    this.summit.position.set(SUMMIT.tangent, SUMMIT.y, SUMMIT.radial); this.summit.receiveShadow = this.summit.castShadow = true; this.group.add(this.summit);
    // Retain a queryable landing footprint; the visible surface belongs to the
    // mountain heightfield, including its snow, normals and rounded shoulders.
    this.sealNiche=new T.Mesh(new T.CircleGeometry(SEAL_NICHE.width/2,96).rotateX(-Math.PI/2),material);this.sealNiche.name='Mountain true peak safe platform';this.peak=this.sealNiche;
    this.sealNiche.position.set(SEAL_NICHE.tangent,SEAL_NICHE.y,SEAL_NICHE.radial);this.sealNiche.visible=false;this.group.add(this.sealNiche);
    const start = mountainWorld(STEPS[0].tangent, mountainFace(0, STEPS[0].tangent) - 3);
    this.entry = new T.Vector3(start.x, 0, start.z);
    this.recovery=new MountainRecovery(this.entry,sound);
    // Recovery uses world coordinates, independently of the rotated rock group.
    this.group.add(this.recovery.group);this.recovery.group.position.set(-SITE.x/Math.SQRT2+SITE.z/Math.SQRT2,0,-(SITE.x+SITE.z)/Math.SQRT2);this.recovery.group.rotation.y=-YAW;
  }

  private geometry(vertices: number[], indices: number[], seed: number, greenBase = false, origin?: MountainLedge) {
    const geometry = new T.BufferGeometry(), uv: number[] = [], colors: number[] = [];
    const rock = new T.Color(BIOME_TERRAIN.orchard.rock), green = new T.Color(BIOME_TERRAIN.orchard.foothill);
    for (let i = 0; i < vertices.length; i += 3) {
      const [x, y, z] = vertices.slice(i, i + 3);
      const world = mountainWorld(x + (origin?.tangent ?? 0), z + (origin?.radial ?? 0));
      const radius = Math.max(Math.abs(world.x), Math.abs(world.z));
      // Continue the corner UVs and layer scale of createMountains itself.
      uv.push(world.x >= world.z ? 24 + 8 * world.z / radius : 40 - 8 * world.x / radius, (radius - MEADOW_HALF_SIZE) / 16 + (y + (origin?.y ?? 0)) / 24);
      const c = greenBase ? green.clone().lerp(rock, T.MathUtils.smoothstep(y, 0, 12)) : rock.clone();
      c.lerp(new T.Color('#edf1f3'),T.MathUtils.smoothstep(y+(origin?.y??0),62,77));
      c.multiplyScalar(.9 + .075 * Math.sin(x * 2.7 + y * 1.8 + z + seed)); colors.push(c.r, c.g, c.b);
    }
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
  }

  private slab(p: MountainLedge, thickness: number, seed: number) {
    if(p.seam)return this.fittedSlab(p,thickness,seed);
    const w = p.width / 2, front = -p.depth / 2, back = p.depth / 2 + (p.embedDepth??EMBED_DEPTH), cut = .16;
    const outline = p.shape === 'semicircle'
      ? [...Array.from({length:33},(_,i)=>{const angle=Math.PI*i/32;return [Math.cos(angle)*w,p.depth/2-Math.sin(angle)*w];}),[-w,back],[w,back]]
      : [[-w + cut, front], [w - cut, front], [w, front + cut], [w, back], [-w, back], [-w, front + cut]];
    const vertices = [0, 0, (front + back) / 2], indices: number[] = [];
    for (const [x, z] of outline) vertices.push(x, 0, z);
    for (let i = 0; i < outline.length; i++) {
      if(p.shape==='semicircle')indices.push(0,1+i,1+(i+1)%outline.length);
      else indices.push(0,1+(i+1)%outline.length,1+i);
    }
    const lower = vertices.length / 3;
    for (const [x, z] of outline) vertices.push(x * .84, -thickness * (.9 + .1 * Math.sin(x * 3 + seed)), p.embedDepth===undefined?z+.24:Math.min(z+.24,back));
    for (let i = 0; i < outline.length; i++) {
      const next = (i + 1) % outline.length;
      if(p.shape==='semicircle')indices.push(1+i,lower+i,1+next,1+next,lower+i,lower+next);
      else indices.push(1 + i, 1 + next, lower + i, 1 + next, lower + next, lower + i);
    }
    for (let i = 1; i < outline.length - 1; i++) {
      if(p.shape==='semicircle')indices.push(lower,lower+i+1,lower+i);
      else indices.push(lower, lower + i, lower + i + 1);
    }
    // Separate face normals give rock edges a crisp profile without extra meshes.
    const indexed = this.geometry(vertices, indices, seed, false, p), geometry = indexed.toNonIndexed(); indexed.dispose(); geometry.computeVertexNormals(); return geometry;
  }

  private fittedSlab(p:MountainLedge,thickness:number,seed:number){
    const vertices:number[]=[],indices:number[]=[],anchors:number[]=[],w=p.width/2,seam=p.seam!;
    seam.forEach((back,i)=>{
      const x=-w+2*w*i/(seam.length-1),front=p.depth/2-p.depth*Math.sqrt(Math.max(0,1-(x/w)**2)),rear=back-p.radial,lower=p.undersideSeam![i]-p.radial;
      vertices.push(x,0,front,x,0,rear,x,-thickness,front+.12,x,-thickness,lower);
      anchors.push(rear,rear,lower,lower);
      if(i===seam.length-1)return;
      const a=i*4,b=a+4;
      indices.push(a,a+1,b,a+1,b+1,b, a+2,b+2,a+3,a+3,b+2,b+3,
        a,b,a+2,a+2,b,b+2, a+1,a+3,b+1,a+3,b+3,b+1);
    });
    const end=(seam.length-1)*4;
    indices.push(0,2,1,1,2,3,end,end+1,end+2,end+1,end+3,end+2);
    const indexed=this.geometry(vertices,indices,seed,false,p),geometry=indexed.toNonIndexed();indexed.dispose();geometry.computeVertexNormals();
    geometry.userData.retraction={original:new Float32Array(geometry.getAttribute('position').array),anchors:new Float32Array(indices.map(i=>anchors[i])),scale:1};
    return geometry;
  }

  contains(p: T.Vector3, padding = 0) { const local=mountainLocal(p.x,p.z),bounds=mountainCourseEnvelope(SEAL_NICHE.y,0);return local.tangent>bounds.minT-2-padding&&local.tangent<bounds.maxT+2+padding&&local.radial>-17-padding&&local.radial<SEAL_NICHE.radial+SEAL_NICHE.depth/2+8+padding; }
  handles(c: CharacterController) { return this.contains(c.actor.position, c.actor.scale.x) || this.fall !== undefined || this.base > 0; }
  savePosition(c: CharacterController) { return this.handles(c) ? this.entry.clone() : undefined; }
  restorePosition(c: CharacterController) { this.base = this.contains(c.actor.position) ? c.surfaceY : 0; this.fall = undefined; }
  resetPlayer() { this.base = 0; this.fall = undefined; }

  private surface(p: MountainLedge, index: number, tangent: number) {
    const slide = index < STEPS.length ? this.steps[index].slide : 0;
    if (index < STEPS.length && this.steps[index].phase === 'hidden') return undefined;
    if(p.shape==='circle')return {height:p.y,index,tangent:p.tangent,radial:p.radial,halfWidth:p.width/2,halfDepth:p.depth/2};
    if(p.seam){
      const outline=mountainLedgeOutline(p,slide),front=Math.min(...outline.map(v=>v[1])),back=Math.max(...p.seam);
      return {height:p.y,index,tangent:p.tangent,radial:(front+back)/2,halfWidth:p.width/2,halfDepth:(back-front)/2};
    }
    const pose=mountainLedgePose(p,slide),front=pose.radial-p.depth/2*pose.scale;
    let back=pose.radial+p.depth/2*pose.scale;
    if(index<STEPS.length){
      back+=(p.embedDepth??EMBED_DEPTH)*pose.scale;
      // Near a jagged crest the slab can extend beyond the highest adjacent
      // cross-section. Its visible rock remains a real landing surface there.
      try{back=Math.min(back,mountainFace(p.y,tangent));}catch{}
    }
    return back > front ? { height: p.y, index, tangent: p.tangent, radial: (front + back) / 2, halfWidth: p.width / 2, halfDepth: (back - front) / 2 } : undefined;
  }

  surfaces(c: CharacterController) {
    const p = mountainLocal(c.actor.position.x, c.actor.position.z), footprint = standingFootprint(c.actor.scale.x, c.yaw - YAW);
    return [...STEPS, SUMMIT, SEAL_NICHE].flatMap((ledge, i) => {
      if(Math.abs(p.tangent+footprint.dx-ledge.tangent)>ledge.width/2+footprint.extentX)return [];
      const slide=i<STEPS.length?this.steps[i].slide:0,pose=mountainLedgePose(ledge,slide);
      if(pose.scale<=0||p.radial+footprint.dz<pose.radial-ledge.depth/2*pose.scale-footprint.extentZ||p.radial+footprint.dz>(ledge.seam?Math.max(...ledge.seam):pose.radial+(ledge.depth/2+(ledge.embedDepth??EMBED_DEPTH))*pose.scale)+footprint.extentZ)return [];
      const s = this.surface(ledge, i, p.tangent);
      if(!s)return [];
      if(ledge.shape==='circle'){
        const outline=Array.from({length:64},(_,i)=>{const angle=i*Math.PI/32;return [ledge.tangent+Math.cos(angle)*ledge.width/2,ledge.radial+Math.sin(angle)*ledge.depth/2];});
        return this.onOutline(outline,p.tangent,p.radial,footprint)?[s]:[];
      }
      if(ledge.seam)return this.onOutline(mountainLedgeOutline(ledge,slide),p.tangent,p.radial,footprint)?[s]:[];
      if(ledge.shape==='semicircle'){
        return this.onSemicircle(ledge,pose,s.radial+s.halfDepth,p.tangent,p.radial,footprint)?[s]:[];
      }
      return footprintOverlapsRect(p.tangent - s.tangent, p.radial - s.radial, s.halfWidth, s.halfDepth, footprint) ? [s] : [];
    }).sort((a, b) => b.height - a.height);
  }

  private onOutline(outline:number[][],tangent:number,radial:number,f:ReturnType<typeof standingFootprint>){
    if(mountainOutlineContains(outline,tangent+f.dx,radial+f.dz))return true;
    if(f.rx<=0||f.rz<=0)return false;
    const transform=(point:number[])=>{const dx=point[0]-tangent-f.dx,dz=point[1]-radial-f.dz;return [(dx*f.cos-dz*f.sin)/f.rx,(dx*f.sin+dz*f.cos)/f.rz];};
    let previous=transform(outline.at(-1)!);
    for(const point of outline){const next=transform(point),dx=next[0]-previous[0],dz=next[1]-previous[1],length=dx*dx+dz*dz,t=length?T.MathUtils.clamp(-(previous[0]*dx+previous[1]*dz)/length,0,1):0;if((previous[0]+t*dx)**2+(previous[1]+t*dz)**2<=1)return true;previous=next;}
    return false;
  }

  private onSemicircle(ledge:MountainLedge,pose:{radial:number;scale:number},clippedBack:number,tangent:number,radial:number,f:ReturnType<typeof standingFootprint>){
    const radius=ledge.width/2,depth=ledge.depth*pose.scale,embed=(ledge.embedDepth??EMBED_DEPTH)*pose.scale,back=pose.radial+depth/2,x=tangent+f.dx-ledge.tangent,z=radial+f.dz-back;
    if(radial+f.dz<=clippedBack&&Math.abs(x)<=radius&&(z>=0||(x/radius)**2+(z/depth)**2<=1))return true;
    if(f.rx<=0||f.rz<=0)return false;
    let outline=[...Array.from({length:33},(_,i)=>{const a=Math.PI*i/32;return [ledge.tangent+Math.cos(a)*radius,back-Math.sin(a)*depth];}),[ledge.tangent-radius,back+embed],[ledge.tangent+radius,back+embed]];
    // Include the slab's exposed connection to the uneven slope, then clip at
    // the mountain face beside the player rather than at the step's centre.
    if(clippedBack<back+embed){
      const clipped:number[][]=[];let previous=outline.at(-1)!;
      for(const point of outline){
        if((previous[1]<=clippedBack)!==(point[1]<=clippedBack)){
          const t=(clippedBack-previous[1])/(point[1]-previous[1]);
          clipped.push([previous[0]+t*(point[0]-previous[0]),clippedBack]);
        }
        if(point[1]<=clippedBack)clipped.push(point);
        previous=point;
      }
      outline=clipped;
    }
    if(outline.length<3)return false;
    let previous=outline.at(-1)!;
    const transform=(point:number[])=>{const dx=point[0]-tangent-f.dx,dz=point[1]-radial-f.dz;return [(dx*f.cos-dz*f.sin)/f.rx,(dx*f.sin+dz*f.cos)/f.rz];};
    for(const point of outline){const a=transform(previous),b=transform(point),dx=b[0]-a[0],dz=b[1]-a[1],length=dx*dx+dz*dz,t=length?T.MathUtils.clamp(-(a[0]*dx+a[1]*dz)/length,0,1):0;if((a[0]+t*dx)**2+(a[1]+t*dz)**2<=1)return true;previous=point;}
    return false;
  }

  update(dt: number, actors: readonly CharacterController[] = [], authority = true,localPlayer?:CharacterController) {
    const recovering=this.active;this.recovery.update(dt,localPlayer);
    if(recovering&&!this.active&&localPlayer)this.restorePosition(localPlayer);
    this.time += dt;
    const occupied = new Set<number>();
    if (authority) for (const c of actors) {
      if (c.flight.active || c.roll.active || !this.contains(c.actor.position, c.actor.scale.x)) continue;
      const support = this.surfaces(c).find(s => Math.abs(c.actor.position.y - s.height) < .04);
      if (support && support.index < STEPS.length) occupied.add(support.index);
    }
    this.steps.forEach((step, i) => {
      let remaining = dt;
      if (step.phase === 'ready') {
        if (authority) {
          step.standing = occupied.has(i) ? step.standing + dt : 0;
          if (step.standing >= LEDGE_STAND_SECONDS - 1e-8) {
            remaining = Math.max(0, step.standing - LEDGE_STAND_SECONDS); step.phase = 'retracting'; step.elapsed = step.standing = 0;
          } else remaining = 0;
        } else remaining = 0;
      }
      while (remaining > 0 && step.phase !== 'ready') {
        const duration = durations[step.phase], amount = Math.min(remaining, duration - step.elapsed);
        step.elapsed += amount; remaining -= amount;
        if (step.elapsed >= duration - 1e-8) { step.phase = PHASES[(PHASES.indexOf(step.phase) + 1) % PHASES.length]; step.elapsed = 0; }
      }
      this.pose(step, i);
    });
  }

  private pose(step: Step, i: number) {
    const ease = (t: number) => t * t * (3 - 2 * t);
    step.slide = LEDGE_RETRACT_DISTANCE * (step.phase === 'retracting' ? ease(step.elapsed / LEDGE_RETRACT_SECONDS) : step.phase === 'hidden' ? 1 : step.phase === 'extending' ? 1 - ease(step.elapsed / LEDGE_EXTEND_SECONDS) : 0);
    const pose=mountainLedgePose(STEPS[i],step.slide);
    step.mesh.position.z = pose.radial;
    const fitted=step.mesh.geometry.userData.retraction;
    if(fitted){
      if(fitted.scale!==pose.scale){
        const positions=step.mesh.geometry.getAttribute('position') as T.BufferAttribute;
        for(let vertex=0;vertex<positions.count;vertex++)positions.setZ(vertex,fitted.anchors[vertex]+(fitted.original[vertex*3+2]-fitted.anchors[vertex])*pose.scale);
        positions.needsUpdate=true;step.mesh.geometry.computeVertexNormals();step.mesh.geometry.computeBoundingSphere();fitted.scale=pose.scale;
      }
    }else step.mesh.scale.z=pose.scale;
    step.mesh.position.x = STEPS[i].tangent + (step.phase === 'ready' && step.standing > 2.4 ? Math.sin(this.time * 35) * .025 : 0);
    step.mesh.visible = step.phase !== 'hidden'&&pose.scale>0;
  }
  networkState() { return this.steps.map(s => [PHASES.indexOf(s.phase), s.elapsed, s.standing]); }
  networkApply(rows: number[][]) {
    for(let i=rows.length;i<this.steps.length;i++){const s=this.steps[i];s.phase='ready';s.elapsed=s.standing=0;this.pose(s,i);}
    rows.forEach((row, i) => { const s = this.steps[i]; if (!s || !PHASES[row[0]]) return; s.phase = PHASES[row[0]]; s.elapsed = row[1]; s.standing = row[2]; this.pose(s, i); });
  }

  readonly constrainTravel=(p:T.Vector3,size=1)=>{
    if(p.y<=.05||!this.contains(p,size+2)){constrainToMeadow(p,size);return;}
    const local=mountainLocal(p.x,p.z),bounds=mountainCourseEnvelope(p.y,local.tangent,size);
    const world=mountainWorld(bounds.tangent,T.MathUtils.clamp(local.radial,Math.min(-16,bounds.radial-1),bounds.radial));p.x=world.x;p.z=world.z;
  };

  /** Preserve a useful orbit distance; lift the view above a blocking ridge. */
  constrainCamera(position:T.Vector3,target:T.Vector3){
    if(target.y<=.05||!this.contains(target,3))return;
    const delta=this.cameraDelta.copy(position).sub(target),distance=Math.max(1,delta.length()),azimuth=Math.atan2(delta.x,delta.z),initialElevation=Math.atan2(delta.y,Math.hypot(delta.x,delta.z));
    // Camera may look back across the crest. Only actors use the narrower
    // playable envelope; the camera stays within the real rendered map ring.
    const limit=MEADOW_HALF_SIZE+MOUNTAIN_WIDTH-.5;
    const bound=()=>{position.x=T.MathUtils.clamp(position.x,-limit,limit);position.z=T.MathUtils.clamp(position.z,-limit,limit);position.y=Math.max(.35,position.y);};
    const clear=()=>{
      const dx=position.x-target.x,dy=position.y-target.y,dz=position.z-target.z,n=Math.max(24,Math.min(96,Math.ceil(Math.hypot(dx,dy,dz)/.25)));
      for(let i=1;i<=n;i++){const t=i/n;if(mountainSurfaceHeight(target.x+dx*t,target.z+dz*t)>target.y+dy*t-.45)return false;}
      return true;
    };
    bound();if(clear())return;
    for(let elevation=Math.max(.10,initialElevation+.10);elevation<Math.PI/2;elevation+=.10){
      const horizontal=distance*Math.cos(elevation);
      position.set(target.x+horizontal*Math.sin(azimuth),target.y+distance*Math.sin(elevation),target.z+horizontal*Math.cos(azimuth));
      bound();if(clear())return;
    }
    // Directly above the visible standing surface remains clear even beside a
    // very steep face; retaining distance also avoids near-plane body clipping.
    position.set(target.x,target.y+distance,target.z);
  }

  constrain(p: T.Vector3, size = 1) {
    if (!this.contains(p, size)) return;
    const local = mountainLocal(p.x, p.z);
    if(p.y>=SEAL_NICHE.y-.08&&Math.hypot(local.tangent-SEAL_NICHE.tangent,local.radial-SEAL_NICHE.radial)<=SEAL_NICHE.width/2+.55*size)return;
    let face:number;
    try{face=mountainFace(Math.max(0,p.y),local.tangent);}catch{return;}
    if (mountainSurfaceHeight(p.x,p.z)>p.y-.04 && local.radial>face-.35*size) {
      const corrected = mountainWorld(local.tangent,face-.35*size);
      p.x = corrected.x; p.z = corrected.z;
    }
  }

  apply(c: CharacterController, previous: T.Vector3, dt: number, enabled = true) {
    if(this.active)return;
    if (!enabled) { this.resetPlayer(); return; }
    if (!this.handles(c)&&!this.contains(previous,c.actor.scale.x+2)) { this.resetPlayer(); return; }
    const p = c.actor.position;
    this.constrainTravel(p,c.actor.scale.x);
    // Keep the actor outside the existing sloping terrain while climbing/falling.
    this.constrain(p, c.actor.scale.x);
    c.swimming = false;
    if (this.fall !== undefined) {
      c.flight.reset(); c.cloud.visible = false;
      p.y = previous.y + this.fall * dt - 12 * dt * dt; this.fall -= 24 * dt;
    }
    const surfaces = [...this.surfaces(c), { height: 0, index: -1 }];
    const support = surfaces.find(s => previous.y >= s.height - .03 && p.y <= s.height + .03 && p.y <= previous.y + .01);
    if (support) {
      if (c.flight.active) c.setActivity('Idle');
      p.y = c.surfaceY = this.base = support.height; this.fall = undefined;
      if(support.index===STEPS.length||support.index===STEPS.length+1)this.recovery.reach(c,support.index-STEPS.length+1);
    } else if (c.flight.active) c.surfaceY = this.base;
    else if (this.fall === undefined) { this.fall = 0; c.surfaceY = 0; }
    if (p.y <= 0 && !c.flight.active) { p.y = c.surfaceY = this.base = 0; this.fall = undefined; }
    // Gravity and large updates can cross the envelope after controller travel.
    // Recheck with the final foot height, including the final landing frame.
    this.constrainTravel(p,c.actor.scale.x);
  }
}
