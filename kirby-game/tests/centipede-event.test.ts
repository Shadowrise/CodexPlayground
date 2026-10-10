import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {BOSS_ARENA as A} from '../src/boss-arena-site';
import {ArenaCentipede,centipedeRoam,centipedeRoute} from '../src/arena-centipede';
import {Vector3} from 'three';
import {startCentipede,advanceCentipede,pushCentipede,bumpCentipede,completedCentipede,centipedeSegments,centipedeTail,chargePoint,centipedeBalls,centipedeContact,centipedeTarget,centipedePhase,centipedeWheel,centipedeWaves,CENTIPEDE_BALLS,CENTIPEDE_TIMES,CENTIPEDE_STEP,type CentipedeActor,type CentipedeEvent,type Point} from '../src/centipede-event';
import {centipedeSound} from '../src/centipede-sounds';
import {CentipedeFireworks} from '../src/centipede-fireworks';
import {CentipedeBallsView} from '../src/centipede-balls-view';
import {CentipedeChallengesView} from '../src/centipede-challenges-view';
const trail=(seconds=0)=>{const d=centipedeRoam(seconds).distance;return Array.from({length:12},(_,i)=>{const p=centipedeRoute(d-(11-i)*CENTIPEDE_STEP,new Vector3());return [p.x+A.x,p.z+A.z] as Point;});};
const actor=(id='a',t=trail()):CentipedeActor=>({id,p:[t.at(-1)![0]+3,0,t.at(-1)![1]],yaw:0,size:1,available:true,done:false,points:0});
function next(q:CentipedeEvent,a:CentipedeActor[]){return advanceCentipede(q,q.stageAt+CENTIPEDE_TIMES[q.stage]+1,a).event!;}
function atTail(q:CentipedeEvent,a:CentipedeActor){const tail=centipedeTail(q);a.p=[tail[0],0,tail[1]+2];a.yaw=Math.PI;}
function atTarget(q:CentipedeEvent,a:CentipedeActor){
 const p=centipedeTarget(q);a.p=[p[0],q.stage==='back'?2.9:0,p[2]+(q.stage==='dizzy'?0:1)];const target=q.stage==='dizzy'?centipedeWheel(q,q.stageAt):{x:p[0],z:p[2]};a.yaw=Math.atan2(target.x-a.p[0],target.z-a.p[2]);
}
function vulnerable(q:CentipedeEvent,a:CentipedeActor[]){let steps=0;while(!['exhausted','back','dizzy','celebrate'].includes(q.stage)){assert(++steps<30);q=next(q,a);}return q;}
test('three cooperative phases credit friendship only after finale; cooldown lasts a minute and replays give no points',()=>{
 const a=actor(),b=actor('b');assert.equal(startCentipede([],a,1),undefined);assert.equal(startCentipede(trail(),{...a,p:[0,0,0]},1),undefined);
 let q=startCentipede(trail(),a,1)!;b.p=[A.x+5,5,A.z];
 for(let hit=0;hit<9;hit++){
  q=vulnerable(q,[a,b]);assert.equal(centipedePhase(q),1+Math.floor(hit/3));assert.equal(q.stage,['exhausted','back','dizzy'][Math.floor(hit/3)]);
  atTarget(q,a);assert(pushCentipede(q,a,q.stageAt+1));assert(!pushCentipede(q,a,q.stageAt+2),'one hit per window');assert(!completedCentipede(q,a.id),'no early task or fireworks');
  if(hit===2||hit===5){q=next(q,[a,b]);assert.equal(centipedePhase(q),hit===2?2:3);assert(!completedCentipede(q,b.id));}
 }
 q=vulnerable(q,[a,b]);assert.equal(q.stage,'celebrate');assert(completedCentipede(q,a.id));assert(completedCentipede(q,b.id));assert.equal(q.players.a.hits,9);assert(q.players.b.dodges>=6);assert.equal(q.players.a.points,12);
 q=next(q,[a,b]);assert.equal(q.stage,'rest');assert(advanceCentipede(q,q.stageAt+59999,[]).event,'rest is not cancelled when everyone leaves the arena');assert.equal(advanceCentipede(q,q.stageAt+60000,[]).event,undefined);
 const repeat={...actor(),done:true,points:q.players.a.points};let again=startCentipede(trail(),repeat,q.stageAt+61000)!;
 for(let hit=0;hit<9;hit++){again=vulnerable(again,[repeat]);atTarget(again,repeat);assert(pushCentipede(again,repeat,again.stageAt+1));}
 again=vulnerable(again,[repeat]);assert(completedCentipede(again,repeat.id));assert.equal(again.players.a.points,repeat.points);assert.equal(again.players.a.first,false);
});
test('charge contact is a single springy bump per cycle; flying avoids it and inactivity resets the event',()=>{
 const a=actor();let q=startCentipede(trail(),a,1)!;q=next(q,[a]);q=next(q,[a]);
 const now=q.stageAt+CENTIPEDE_TIMES.charge/2,p=chargePoint(q,.5);a.p=[p[0],0,p[1]];assert(bumpCentipede(q,a,now));assert(!bumpCentipede(q,a,now));
 assert(!bumpCentipede(q,{...a,id:'flying',p:[p[0],5,p[1]]},now));
 q=next(q,[a]);assert.equal(q.players.a.dodges,0,'a bumped player is not credited for dodging');
 assert.equal(advanceCentipede(q,q.stageAt+CENTIPEDE_TIMES.balls+1,[{...a,p:[0,0,0]}]).event,undefined);
});
test('targeted charge paths remain inside the arena with a separated, following tail',()=>{
 for(const time of [0,8,25,37,62,83,105]){
  const t=trail(time),a=actor('a',t);let q=startCentipede(t,a,1)!;const coverage:Point[]=[];
  for(let cycle=0;cycle<4;cycle++){
   a.p=[A.x+(cycle%2?15:-15),0,A.z+(cycle%2?12:-12)];q=next(q,[a]);assert.equal(q.stage,'warning');q=next(q,[a]);
   const path=Array.from({length:81},(_,i)=>chargePoint(q,i/80));let travelled=0,turns=0;
   for(let i=1;i<path.length;i++){const dx=path[i][0]-path[i-1][0],dz=path[i][1]-path[i-1][1];travelled+=Math.hypot(dx,dz);if(i>1){const px=path[i-1][0]-path[i-2][0],pz=path[i-1][1]-path[i-2][1];turns+=Math.abs(Math.atan2(px*dz-pz*dx,px*dx+pz*dz));}}
   assert(travelled>75,'long run rather than a short charge');assert(turns>3,'visible wide turns');assert(path.some(p=>Math.hypot(p[0]-A.x,p[1]-A.z)>30));coverage.push(...path);
   assert(q.route!.length<=8,'compact knots, not a stream of transforms');
   for(let step=0;step<=80;step++){
    const segments=centipedeSegments(q,q.stageAt+CENTIPEDE_TIMES.charge*step/80);
    for(const s of segments)assert(Math.hypot(s.x-A.x,s.z-A.z)<A.playRadius-3,'body stays well inside arena');
    for(let i=0;i<12;i++)for(let j=i+3;j<12;j++)assert(Math.hypot(segments[i].x-segments[j].x,segments[i].z-segments[j].z)>1.9,`body crosses itself at ${time}/${cycle}/${step}`);
   }
   q=next(q,[a]);assert.equal(q.stage,'balls');q=next(q,[a]);assert.equal(q.stage,'exhausted');
  }
  for(const axis of [0,1])assert(Math.max(...coverage.map(p=>p[axis]))-Math.min(...coverage.map(p=>p[axis]))>57,'runs cover the arena in both directions');
 }
});
test('three telegraphed ball fans are deterministic; each wave bumps once and levitation avoids them',()=>{
 const a=actor(),b={...actor('b'),p:[A.x,5,A.z]};let q=startCentipede(trail(),a,1)!;
 q=next(q,[a,b]);q=next(q,[a,b]);q=next(q,[a,b]);assert.equal(q.stage,'balls');
 const keys=new Set<string>();
 for(let wave=0;wave<CENTIPEDE_BALLS.waves;wave++){
  const previewTime=q.stageAt+wave*CENTIPEDE_BALLS.interval+100;
  const preview=centipedeBalls(q,previewTime).find(b=>b.wave===wave)!;assert(!preview.active);
  a.p=[preview.x,0,preview.z];assert(!centipedeContact(q,a,previewTime),'preview is harmless');
  const now=q.stageAt+wave*CENTIPEDE_BALLS.interval+CENTIPEDE_BALLS.launch+800;
  const balls=centipedeBalls(q,now),ball=balls.find(b=>b.wave===wave&&b.index%CENTIPEDE_BALLS.perWave===2)!;
  assert.deepEqual(balls,centipedeBalls(JSON.parse(JSON.stringify(q)),now),'late joins derive exactly the same balls from wire state');
  for(const b of balls)assert(Math.hypot(b.x-A.x,b.z-A.z)<=A.playRadius-CENTIPEDE_BALLS.radius);
  a.p=[ball.x,0,ball.z];assert(!bumpCentipede(q,{...a,p:[ball.x,5,ball.z]},now));assert(!bumpCentipede(q,{...a,available:false},now));
  const contact=centipedeContact(q,a,now)!;assert(contact);keys.add(contact.key);
  assert(bumpCentipede(q,a,now,false));assert(!((q.players.a.ballBumps??0)&(1<<wave)),'read-only contact does not mutate shared state');
  assert(bumpCentipede(q,a,now));assert(!bumpCentipede(q,a,now+10),'one soft bump per wave');
 }
 assert.equal(keys.size,3);assert.equal(q.players.a.ballBumps,7);
 q=next(q,[a,b]);assert.equal(q.stage,'exhausted');assert.equal(q.players.a.dodges,0);assert.equal(q.players.b.dodges,2);
 a.available=false;q=next(q,[a,b]);assert.equal(q.stage,'warning');assert.equal(q.players.a.ballBumps,0,'next cycle clears the wave guard even for a player still rolling');
});
test('striped balls and their warnings use at most two instanced draws and disappear with the stage',()=>{
 const a=actor();let q=startCentipede(trail(),a,1)!;q=next(q,[a]);q=next(q,[a]);q=next(q,[a]);
 const view=new CentipedeBallsView();assert.equal(view.group.children.length,2);
 view.update(q,q.stageAt+100);assert.equal(view.balls.count,0);assert.equal(view.warnings.count,5);
 view.update(q,q.stageAt+CENTIPEDE_BALLS.interval+CENTIPEDE_BALLS.launch+100);assert(view.balls.count>0&&view.balls.count<=15);assert(!view.balls.castShadow);assert(!view.warnings.castShadow);
 view.update(undefined,0);assert(!view.group.visible);
 for(const m of [view.balls,view.warnings]){m.geometry.dispose();(m.material as any).dispose();}
});
test('stomp waves have real safe gaps, support flight and bump only once per ring',()=>{
 const a=actor();let q=startCentipede(trail(),a,1)!;q.phase=2;q.stage='stomp';q.cycle=4;q.stageAt=1000;
 const now=3000,wave=centipedeWaves(q,now)[0];assert(wave);assert.deepEqual(centipedeWaves(q,now),centipedeWaves(JSON.parse(JSON.stringify(q)),now));
 a.p=[A.x+Math.cos(wave.angle)*wave.radius,0,A.z+Math.sin(wave.angle)*wave.radius];assert(!centipedeContact(q,a,now),'gap is safe');
 a.p=[A.x+Math.cos(wave.angle+1)*wave.radius,0,A.z+Math.sin(wave.angle+1)*wave.radius];assert(!bumpCentipede(q,{...a,p:[a.p[0],1.2,a.p[2]]},now),'jump clears the ground ring');
 assert(centipedeContact(q,a,now)?.ring===0);assert(bumpCentipede(q,a,now));assert(!bumpCentipede(q,a,now));
 q.stage='back';atTarget(q,a);assert(!pushCentipede(q,{...a,p:[a.p[0],0,a.p[2]]},now),'the back bell needs an actual flight');assert(pushCentipede(q,a,now));
});
test('final wheel combines grounded and airborne hazards; rainbow ball requires approaching and aiming',()=>{
 const a=actor();let q=startCentipede(trail(),a,1)!;q.phase=3;q.hits=6;q.stage='curl';q.to=[A.x,A.z];q=next(q,[a]);assert.equal(q.stage,'wheelWarning');q=next(q,[a]);
 const now=q.stageAt+4100,wheel=centipedeWheel(q,now);a.p=[wheel.x,2.9,wheel.z];assert(bumpCentipede(q,a,now),'normal flight cannot pass through a tall wheel');assert(!bumpCentipede(q,a,now));
 assert(!bumpCentipede(q,{...a,p:[wheel.x+Math.cos(wheel.yaw)*8,0,wheel.z-Math.sin(wheel.yaw)*8]},now),'sideways dodge is safe');assert(centipedeWaves(q,now).length>0);
 const positions=Array.from({length:41},(_,i)=>centipedeWheel(q,q.stageAt+i/40*CENTIPEDE_TIMES.wheelRoll));assert(Math.max(...positions.map(p=>p.x))-Math.min(...positions.map(p=>p.x))>35);
 q=next(q,[a]);assert.equal(q.stage,'dizzy');atTarget(q,a);assert(!pushCentipede(q,{...a,yaw:a.yaw+Math.PI},q.stageAt+1));assert(!pushCentipede(q,{...a,p:[0,0,0]},q.stageAt+1));assert(pushCentipede(q,a,q.stageAt+1));assert.equal(q.stage,'ballShot');assert(!completedCentipede(q,a.id));
 const view=new CentipedeChallengesView();view.update(q,q.stageAt+500);assert(view.ball.visible);assert(view.ball.position.y>3);assert(!view.ball.castShadow);view.update(undefined,0);assert(!view.group.visible);
 for(const m of [view.ball,view.stomp,view.wheel]){m.geometry.dispose();(m.material as any).dispose();}
});
test('event soundtrack and each boss cue have headroom and soft edges',()=>{
 const wav=readFileSync(new URL('../public/audio/topotushka-play.wav',import.meta.url));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt16LE(22),2);const duration=wav.readUInt32LE(40)/wav.readUInt32LE(28);assert(duration>60&&duration<70);
 let peak=0;for(let i=44;i<wav.length;i+=2)peak=Math.max(peak,Math.abs(wav.readInt16LE(i)));assert(peak<24000&&peak>16000);
 for(const stage of Object.keys(CENTIPEDE_TIMES) as (keyof typeof CENTIPEDE_TIMES)[]){const data=centipedeSound(stage);assert.equal(data[0],0);assert(Math.abs(data.at(-1)!)<.001);let peak=0,jump=0;data.forEach((s,i)=>{assert(Number.isFinite(s));peak=Math.max(peak,Math.abs(s));if(i)jump=Math.max(jump,Math.abs(s-data[i-1]));});assert(peak>.01&&peak<.6);assert(jump<.15);}
 const victory=readFileSync(new URL('../public/audio/topotushka-victory.wav',import.meta.url));assert.equal(victory.readUInt16LE(22),2);assert.equal(victory.readUInt32LE(40)/victory.readUInt32LE(28),10);assert.equal(victory.readInt16LE(44),0);assert.equal(victory.readInt16LE(victory.length-2),0);let vPeak=0;for(let i=44;i<victory.length;i+=2)vPeak=Math.max(vPeak,Math.abs(victory.readInt16LE(i)));assert(vPeak>15000&&vPeak<20000);
});
test('rainbow fireworks use one bounded particle draw and disappear after victory',()=>{
 const fire=new CentipedeFireworks(),mesh=fire.mesh;assert.equal(mesh.geometry.attributes.origin.count,430);assert.equal(mesh.children.length,0);assert(!mesh.castShadow);assert(!(mesh.material as any).depthWrite);
 fire.update(false,2,A.x,A.z);assert(!mesh.visible);fire.update(true,2,A.x,A.z);assert(mesh.visible);assert.equal(mesh.position.x,A.x);assert.equal(mesh.position.z,A.z);fire.update(true,10,A.x,A.z);assert(!mesh.visible);
 mesh.geometry.dispose();(mesh.material as any).dispose();
});
