import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {startKnightBattle,setKnightPhase,advanceKnightBattle,type KnightActor} from '../src/meta-knight-battle';
import {COSMIC,cosmicHeight} from '../src/meta-knight-cosmic';
import {COSMIC_REFUGE as R,refugeApproach,refugeDirection,refugeSweepMs,refugeAngle,refugeStar,refugeActive,refugeOpen,insideRefuge,refugePlanet,refugePlanetAngle,refugeContactAngle,refugeDanger,refugeStrike,refugeForehead,refugeRebound} from '../src/meta-knight-cosmic-refuge';
import {CharacterController} from '../src/controller';import {MetaKnightBattleMotion} from '../src/meta-knight-battle-motion';
import {refugeGravityPaths} from '../src/meta-knight-refuge-gravity';
import {MetaKnightRefugeGlow} from '../src/meta-knight-refuge-glow';
import {planetFractureGeometry} from '../src/meta-knight-planet-fracture';
import {detailedPlanetGeometry} from '../src/meta-knight-planet-detail';
import {MetaKnightGravityCharge} from '../src/meta-knight-gravity-charge';
import {CosmicLightning} from '../src/meta-knight-cosmic-view';
const a:KnightActor={id:'a',p:[0,180,41],yaw:Math.PI,available:true};

test('the gravity charge grows across shared stages and pulling bolts start on its moving surface',()=>{
 const s=fixture(),charge=new MetaKnightGravityCharge(),arcs=new CosmicLightning(true),root=new T.Group(),blade=new T.Group(),out=new T.Vector3();root.add(charge.group,arcs.group);blade.position.set(2010,187,4);blade.scale.setScalar(3.3);root.position.x=2000;
 let previous=0;
 for(const [stage,at,duration] of [['cosmic-star-draw',0,R.drawMs],['cosmic-star-open',R.drawMs,R.openMs],['cosmic-planet-draw',R.drawMs+R.openMs,R.pullMs],['cosmic-planet-sweep',R.drawMs+R.openMs+R.pullMs,R.sweepMs]] as const){
  s.stage=stage;s.since=s.cosmicRefuge!.at+at;s.until=s.since+duration;
  for(let frame=0;frame<=12;frame++){
   const now=s.since+duration*frame/12;arcs.begin(1,now/1000);charge.update(s,now,blade,root,arcs);arcs.end();assert(charge.group.visible);assert(charge.radius>=previous-1e-8);previous=charge.radius;assert(arcs.hot.count>60);
   const center=blade.localToWorld(new T.Vector3(-.315,1.75,0));root.worldToLocal(center);assert(charge.group.position.distanceTo(center)<1e-8);
   const target=new T.Vector3(40,180,-20);charge.originToward(target,out);assert(Math.abs(out.distanceTo(center)-charge.radius*.96)<1e-8);assert(out.distanceTo(target)<center.distanceTo(target));
   // Replaying a server snapshot must not restart or accumulate the charge.
   charge.update(s,now,blade,root,arcs);assert.equal(charge.radius,previous);
  }
 }
 assert(charge.radius>3);s.stage='cosmic-star-strike';charge.update(s,s.until,blade,root,arcs);assert(!charge.group.visible);charge.dispose();arcs.dispose();
});

test('detailed planet and uneven crust fragments have finite relief and closed volumetric boundaries',()=>{
 const hero=detailedPlanetGeometry(0),p=hero.getAttribute('position'),v=new T.Vector3();let lo=Infinity,hi=0;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);lo=Math.min(lo,v.length());hi=Math.max(hi,v.length());}assert(p.count>16000);assert(hi-lo>.1);hero.dispose();
 const geometry=planetFractureGeometry(),positions=geometry.getAttribute('position'),seeds=geometry.getAttribute('pieceSeed'),interior=geometry.getAttribute('pieceInterior'),pieces=new Map<number,{box:T.Box3;edges:Map<string,number>}>();
 const point=(i:number)=>[positions.getX(i),positions.getY(i),positions.getZ(i)],key=(p:number[])=>p.map(x=>x.toFixed(4)).join(',');let cutFaces=0;
 for(let i=0;i<positions.count;i+=3){const id=seeds.getX(i),part=pieces.get(id)??{box:new T.Box3(),edges:new Map<string,number>()};pieces.set(id,part);const points=[point(i),point(i+1),point(i+2)];for(const p of points){assert(p.every(Number.isFinite));part.box.expandByPoint(new T.Vector3(...p));}for(let j=0;j<3;j++){const a=key(points[j]),b=key(points[(j+1)%3]),edge=[a,b].sort().join('|');part.edges.set(edge,(part.edges.get(edge)??0)+1);}if(interior.getX(i)>0)cutFaces++;}
 assert.equal(pieces.size,140);assert(cutFaces>15000);const sizes=[...pieces.values()].map(p=>p.box.getSize(new T.Vector3()).length());assert(Math.max(...sizes)>Math.min(...sizes)*1.6);for(const piece of pieces.values())assert([...piece.edges.values()].every(count=>count===2),'crust fragments must close at rough cut faces');geometry.dispose();
});

test('gravity grips approach tangentially and every segment stays outside planets of every size',()=>{
 for(const radius of [19,36,75,120])for(let frame=0;frame<80;frame++){
  const center=new T.Vector3(16,181,7),tip=center.clone().add(new T.Vector3(Math.sin(frame)*1.3,.5,Math.cos(frame)).normalize().multiplyScalar(radius+2+frame)),paths=refugeGravityPaths(tip,center,radius,frame*.13);
  for(const path of paths)for(let i=1;i<path.length;i++){const start=path[i-1],delta=path[i].clone().sub(start),t=T.MathUtils.clamp(center.clone().sub(start).dot(delta)/delta.lengthSq(),0,1),closest=start.clone().addScaledVector(delta,t);assert(closest.distanceTo(center)>radius+.4);}
 }
});

test('the star starts at the collision, reaches the forehead and rebounds outward without teleporting',()=>{
 const s=fixture();s.cosmicRefuge!.impactAt=s.since+R.drawMs+R.openMs+R.pullMs+R.sweepMs;const at=s.cosmicRefuge!.impactAt,star=refugeStar(s,at),hit=refugeForehead(s),end=refugeStrike(s,at+R.strikeMs);
 assert.deepEqual(refugeStrike(s,at),star);assert.deepEqual(end,hit);assert(new T.Vector3(...refugeStrike(s,at+16)).distanceTo(new T.Vector3(...star))>.1);
 s.cosmicRefuge!.hitAt=at+R.strikeMs;const target=[200,240,-300];assert.deepEqual(refugeRebound(s,s.cosmicRefuge!.hitAt,target),hit);
 const next=refugeRebound(s,s.cosmicRefuge!.hitAt+20,target);assert(next[1]>hit[1]);assert(next[0]*hit[0]+next[2]*hit[2]>hit[0]**2+hit[2]**2);assert.deepEqual(refugeRebound(s,s.cosmicRefuge!.hitAt+R.stunMs+R.retreatMs,target),target);
});

test('the safety blessing clears on leaving shelter and restores the character material',()=>{
 const actor=new T.Group(),material=new T.MeshStandardMaterial({emissive:0x102030,emissiveIntensity:.17}),body=new T.Mesh(new T.SphereGeometry(1),material);actor.add(body);const original=material.emissive.clone(),glow=new MetaKnightRefugeGlow(actor);
 glow.update(3000,true);assert(glow.group.visible);assert(!material.emissive.equals(original));glow.update(3100,false);assert(!glow.group.visible);assert(material.emissive.equals(original));assert.equal(material.emissiveIntensity,.17);glow.update(3200,true);glow.dispose();assert(material.emissive.equals(original));assert(!actor.getObjectByName('Golden refuge safety blessing'));body.geometry.dispose();material.dispose();
});
function fixture(actors=[a]){const ground=actors.map((a,i)=>({...a,p:[i*3,0,-2] as typeof a.p})),s=startKnightBattle(ground,'a',1000)!;setKnightPhase(s,4,actors,5000,3);return s;}
function activate(s:ReturnType<typeof fixture>,actors=[a]){while(s.stage!=='cosmic-star-open')advanceKnightBattle(s,actors,s.until,'a');const now=s.since+500,p=refugeStar(s,now);actors[0].p=[p[0],180,p[2]-3];actors[0].yaw=0;assert(refugeActive(s));assert.equal(s.players[actors[0].id].attackAt,-1e9);}
test('each round picks either planet side and locks the star exactly ninety degrees away from the target',()=>{
 const counts=new Map<string,number>();
 for(let id=1000;id<1128;id++)for(let cycle=0;cycle<8;cycle++){
  const heading=id*.037,setup=refugeApproach(id,cycle,heading),quarter=(setup.angle-heading)/(Math.PI/2),key=`${setup.direction}:${Math.round(quarter)}`;
  assert(Math.abs(Math.abs(quarter)-1)<1e-12);counts.set(key,(counts.get(key)??0)+1);assert.deepEqual(refugeApproach(id,cycle,heading),setup);
 }
 assert.equal(counts.size,4);for(const count of counts.values())assert(count>180&&count<340,'both choices have an independent balanced lottery');
 for(const heading of [-Math.PI,-1.1,0,.7,Math.PI]){
  const actor={...a,p:[Math.sin(heading)*35,180,Math.cos(heading)*35] as typeof a.p},s=fixture([actor]),r=structuredClone(s.cosmicRefuge!);
  const star=refugeStar(s,s.since+R.drawMs),dot=star[0]*actor.p[0]+star[2]*actor.p[2];assert(Math.abs(dot)<1e-8);assert(r.direction===1||r.direction===-1);
  actor.p=[-actor.p[0],180,-actor.p[2]];advanceKnightBattle(s,[actor],s.since+500);assert.deepEqual(s.cosmicRefuge,r,'moving the player cannot move the locked summon');
 }
});
test('the planet turns exactly twenty percent faster while saved sweep windows keep their endpoints',()=>{
 const s=fixture(),arc=2*Math.PI-2*refugeContactAngle;s.cosmicRefuge!.direction=1;Object.assign(s,{stage:'cosmic-planet-sweep',since:10000,until:10000+R.sweepMs});
 const previousSpeed=R.starSpeed+arc/9,currentSpeed=refugePlanetAngle(s,s.since+1000)-refugePlanetAngle(s,s.since);
 assert(Math.abs(currentSpeed/previousSpeed-1.2)<1e-10);assert(R.sweepMs<7500&&R.sweepMs>7000);
 for(const duration of [R.sweepMs,9000]){
  s.until=s.since+duration;const end=refugePlanet(s,s.until);s.stage='cosmic-star-strike';const after=refugePlanet(s,s.until);assert(new T.Vector3(...end).distanceTo(new T.Vector3(...after))<1e-8);s.stage='cosmic-planet-sweep';
 }
});
test('the star activates automatically on arrival and leaves five seconds to reach its moving shared dome',()=>{
 const actors=[structuredClone(a),{...structuredClone(a),id:'b'}],s=fixture(actors);assert.equal(s.stage,'cosmic-star-draw');advanceKnightBattle(s,actors,s.until-1);assert(!refugeActive(s));advanceKnightBattle(s,actors,s.until);assert.equal(s.until-s.since,5000);assert(!refugeOpen(s));assert.equal(s.cosmicRefuge!.activatedAt,s.since);assert.equal(s.cosmicRefuge!.activator,undefined);
 const p=refugeStar(s,s.since);assert(Math.abs(Math.hypot(p[0],p[2])-COSMIC.rim/2)<1e-10);activate(s,actors);const before=refugeStar(s,s.since+1000),after=refugeStar(s,s.since+4000);assert(Math.hypot(before[0]-after[0],before[2]-after[2])>4);
 for(const actor of actors)actor.p=[after[0]+(actor.id==='a'?1:-1),180,after[2]];assert(actors.every(a=>insideRefuge(s,a.p,s.since+4000)));assert.equal(s.hp,6);
});test('both approaches stay tangent to the moving dome and sweep away from it at the same world speed',()=>{
 for(const direction of [1,-1] as const){
  const actor=structuredClone(a),s=fixture([actor]);s.cosmicRefuge!.direction=direction;activate(s,[actor]);while(s.stage!=='cosmic-planet-sweep')advanceKnightBattle(s,[actor],s.until,'a');const duration=s.until-s.since;let previous=refugePlanetAngle(s,s.since);
  assert(Math.abs(duration-refugeSweepMs(s))<1e-8);assert(Math.abs(previous-refugeAngle(s,s.since)-direction*refugeContactAngle)<1e-10);
  for(let i=0;i<=150;i++){const now=s.since+duration*i/150,star=refugeStar(s,now),planet=refugePlanet(s,now),angle=refugePlanetAngle(s,now);if(i)assert((angle-previous)*direction>0);previous=angle;assert(Math.hypot(planet[0]-star[0],planet[2]-star[2])>=R.planetRadius+R.domeRadius);assert(!refugeDanger(s,[star[0],180,star[2]],now,now-25));}
  const speed=refugePlanetAngle(s,s.since+1000)-refugePlanetAngle(s,s.since);assert(Math.abs(speed-direction*R.planetSpeed)<1e-10);
  const end=refugePlanet(s,s.until);s.stage='cosmic-star-strike';assert(new T.Vector3(...end).distanceTo(new T.Vector3(...refugePlanet(s,s.until)))<1e-8);s.stage='cosmic-planet-sweep';
  const mid=s.since+duration*.5,p=refugePlanet(s,mid);assert(refugeDanger(s,[p[0],180,p[2]],mid,mid-150));assert(!refugeDanger(s,[p[0],0,p[2]],mid,mid-150));
 }
 const legacy=fixture();delete legacy.cosmicRefuge!.direction;assert.equal(refugeDirection(legacy),1);assert.equal(refugeSweepMs(legacy),R.sweepMs);
 assert(R.planetOrbit-R.planetRadius>3);assert(R.planetOrbit+R.planetRadius>=COSMIC.rim);
});
test('the automatic dome does not protect players outside it; a sweep still costs only one shared heart',()=>{
 for(const direction of [1,-1] as const)for(const multiplayer of [false,true]){
  const actors=[structuredClone(a),...(multiplayer?[{...structuredClone(a),id:'b'}]:[])],s=fixture(actors);s.cosmicRefuge!.direction=direction;activate(s,actors);while(s.stage!=='cosmic-planet-sweep'){const safe=refugeStar(s,s.until);for(const actor of actors)actor.p=[safe[0],180,safe[2]];advanceKnightBattle(s,actors,s.until);}
  const at=s.since+4000,p=refugePlanet(s,at);for(const actor of actors)actor.p=[p[0],180,p[2]];advanceKnightBattle(s,actors,at);
  for(let i=1;i<12;i++)advanceKnightBattle(s,actors,at+i*100);for(const p of Object.values(s.players))assert.equal(p.hp,4);if(multiplayer)assert.equal(s.teamHp,4);
 }
});test('a single sweep cannot drain repeated hearts; the moving refuge protects teammates and the return star deals one boss hit',()=>{
 const actor=structuredClone(a),s=fixture([actor]);activate(s,[actor]);while(s.stage!=='cosmic-planet-sweep'){const safe=refugeStar(s,s.until);actor.p=[safe[0],180,safe[2]];advanceKnightBattle(s,[actor],s.until,'a');}const now=s.since+(s.until-s.since)*.35,p=refugePlanet(s,now);actor.p=[p[0],180,p[2]];
 advanceKnightBattle(s,[actor],now);assert.equal(s.players.a.hp,4);for(let i=1;i<20;i++)advanceKnightBattle(s,[actor],now+i*100);assert.equal(s.players.a.hp,4);
 const at=s.until;actor.p=[...refugeStar(s,at)] as typeof a.p;actor.p[1]=180;advanceKnightBattle(s,[actor],at);assert.equal(s.stage,'cosmic-star-strike');assert.equal(s.cosmicRefuge!.impactAt,at);assert.equal(s.hp,6);
 advanceKnightBattle(s,[actor],s.until);assert.equal(s.stage,'cosmic-star-stun');assert.equal(s.until-s.since,1000);assert.equal(s.hp,5);assert.equal(s.players.a.hits,1);advanceKnightBattle(s,[actor],s.until);assert.equal(s.stage,'cosmic-star-retreat');advanceKnightBattle(s,[actor],s.until);assert.equal(s.stage,'cosmic-spin-warn');
});
test('six successful refuge rounds complete all three subphases and finish with the common descent',()=>{
 const actor=structuredClone(a),s=fixture([actor]);
 for(let i=0;i<6;i++){activate(s,[actor]);let stages=0;while(!['cosmic-star-retreat','cosmic-descent'].includes(s.stage)&&stages++<12){if(s.stage==='cosmic-planet-sweep'){const p=refugeStar(s,s.until);actor.p=[p[0],180,p[2]];}advanceKnightBattle(s,[actor],s.until,'a');}assert.equal(s.hp,5-i);if(i<5)advanceKnightBattle(s,[actor],s.until,'a');}
 assert.equal(s.stage,'cosmic-descent');assert.equal(cosmicHeight(s,s.since),180);advanceKnightBattle(s,[actor],s.until,'a');assert.equal(s.stage,'won');assert.equal(s.players.a.hits,6);assert.equal(cosmicHeight(s,s.since),0);
});
test('the real conducting sword stays outside the torso through the full planet turn and its joins',async()=>{
 const b=await readFile(new URL('../public/models/meta-knight-animated.glb',import.meta.url)),asset=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''),c=new CharacterController(asset.scene,asset.animations),motion=new MetaKnightBattleMotion(c.actor),body=c.actor.getObjectByName('Body_motion')!,blade=c.actor.getObjectByName('Galaxia')!,p=new T.Vector3();
 for(const direction of [1,-1] as const){const s=fixture();s.cosmicRefuge!.direction=direction;let since=s.since,last:T.Vector3|undefined;
 s.cosmicRefuge!.activatedAt=s.since+R.drawMs;
 for(const [stage,ms] of [['cosmic-star-draw',R.drawMs],['cosmic-star-open',R.openMs],['cosmic-planet-draw',R.pullMs],['cosmic-planet-sweep',refugeSweepMs(s)],['cosmic-star-strike',R.strikeMs],['cosmic-star-stun',R.stunMs],['cosmic-star-retreat',R.retreatMs]] as const){
  Object.assign(s,{stage,since,until:since+ms});for(let i=0;i<=80;i++){motion.clear();c.setActivity('Fly');c.updateActivity(0);motion.apply(s,i/80);c.actor.updateMatrixWorld(true);let closest=Infinity;blade.traverse(o=>{if(o instanceof T.Mesh){const position=o.geometry.getAttribute('position');for(let j=0;j<position.count;j+=3){p.fromBufferAttribute(position,j);o.localToWorld(p);body.worldToLocal(p);closest=Math.min(closest,(p.x/.91)**2+(p.y/.91)**2+(p.z/.79)**2);}}});assert(closest>1.035,`${stage} ${i}: sword enters the torso`);const tip=blade.localToWorld(new T.Vector3(-.315,2.05,0));if(i===0&&last)assert(tip.distanceTo(last)<.15,`${stage}: sword jumps at the stage join`);if(i===80)last=tip;}
  since+=ms;
 }motion.clear();}c.disposeEffects();
});
