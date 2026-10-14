import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FLOWER_MELODIES,FLOWER_EMPTY_MS,FLOWER_BEAT_MS,FLOWER_SUCCESS_MS,FLOWER_FINAL_LEAD_MS,FLOWER_FINAL_TAIL_MS,flowerFinalEnd,flowerDeadline,flowerPlayback,startFlowerGame,replayFlowerGame,playFlowerGame,advanceFlowerGame,validFlowerGame,type FlowerActor,type FlowerGame} from '../src/musical-flower-game';
import {FLOWER_FULL_MELODIES} from '../src/musical-flower-melodies';
import {MUSICAL_FLOWERS,MUSICAL_FLOWER_SITE as SITE} from '../src/musical-flower-site';
import {awardFirst,scoreOf,type ScoreAction} from '../src/score';
const actor=(id='a'):FlowerActor=>({id,p:[SITE.x,0,SITE.z+2],size:1});
const moveTo=(a:FlowerActor,index:number)=>{const f=MUSICAL_FLOWERS[index];a.p=[f.x+Math.sin(f.yaw),0,f.z+Math.cos(f.yaw)];};

test('ten distinct ten-note phrases use only the flowers and retain their rhythms',()=>{
 assert.equal(FLOWER_MELODIES.length,10);assert.equal(new Set(FLOWER_MELODIES.map(m=>m.notes.join(','))).size,10);
 for(let i=0;i<10;i++){
  const melody=FLOWER_MELODIES[i];assert.equal(melody.notes.length,10);assert.equal(melody.beats.length,10);assert(melody.notes.every(n=>n>=0&&n<7));
  const q={...startFlowerGame(undefined,actor(),1000,()=>i/10)!,round:10};assert.equal(q.melody,i);assert(validFlowerGame(q));
  const schedule=flowerPlayback(q);for(let j=1;j<10;j++)assert.equal(schedule[j].at-schedule[j-1].at,melody.beats[j-1]*FLOWER_BEAT_MS);
 }
});

test('every winning melody is complete, includes the learned excerpt, and stays locked through the last note',()=>{
 const a=actor();
 for(let melody=0;melody<FLOWER_MELODIES.length;melody++){
  const fragment=FLOWER_MELODIES[melody],full=FLOWER_FULL_MELODIES[fragment.name];
  assert(full.length>10);assert(full.every(n=>n.index>=0&&n.index<7&&n.beats>0&&n.transpose>=-12&&n.transpose<=12));
  assert(full.some((_,i)=>fragment.notes.every((index,j)=>full[i+j]?.index===index)),fragment.name+' must include the learned phrase');
  const q:FlowerGame={...startFlowerGame(undefined,a,1000,()=>melody/10)!,stage:'celebrate',round:10,cursor:10,winners:['a']};
  const played=flowerPlayback(q);assert.equal(played.length,full.length);assert.equal(played[0].at,q.stageAt+FLOWER_FINAL_LEAD_MS);
  for(let i=0;i<full.length;i++){
   assert.equal(played[i].transpose,full[i].transpose);
   if(i)assert(Math.abs(played[i].at-played[i-1].at-full[i-1].beats*FLOWER_BEAT_MS)<.001);
  }
  assert(flowerDeadline(q)>=flowerFinalEnd(q)+FLOWER_FINAL_TAIL_MS);
  for(const now of [q.stageAt+9600,played.at(-1)!.at,flowerDeadline(q)-1]){
   assert.equal(advanceFlowerGame(q,now,[{...a,p:[200,0,200]}]),q,'the complete performance cannot be cancelled by leaving');
   assert.equal(startFlowerGame(q,a,now),q);assert.equal(replayFlowerGame(q,a,now),q);assert.equal(playFlowerGame(q,0,a,now),q);
  }
  assert.equal(advanceFlowerGame(q,flowerDeadline(q),[a]),undefined);
  assert(startFlowerGame(undefined,a,flowerDeadline(q)));
 }
 assert(FLOWER_FULL_MELODIES['Греби на лодочке'].some(n=>n.transpose===12),'high C stays a high C');
 assert(FLOWER_FULL_MELODIES['Брат Жак'].some(n=>n.transpose===-12),'low bell notes keep their octave');
 assert(FLOWER_FULL_MELODIES['Янки Дудл'].some(n=>n.transpose===1),'the full G-major melody retains F sharp');
});
test('one through ten sounds are demonstrated without replaying successful answers, and the six-point reward is once only',()=>{
 const a=actor(),earned={fruitsEaten:0,achievements:new Set<ScoreAction>()};let q=startFlowerGame(undefined,a,1000,()=>0)!;
 for(let round=1;round<=10;round++){
  assert.equal(q.round,round);assert.equal(q.stage,'listen');assert.equal(flowerPlayback(q).length,round);
  const before=q;moveTo(a,0);assert.equal(playFlowerGame(q,0,a,q.stageAt+700),before,'input during the demonstration is ignored');
  q=advanceFlowerGame(q,flowerDeadline(q),[a])!;assert.equal(q.stage,'repeat');let now=q.stageAt;
  for(let i=0;i<round;i++){now+=250;const note=FLOWER_MELODIES[q.melody].notes[i];moveTo(a,note);q=playFlowerGame(q,note,a,now)!;assert.equal(q.cursor,i+1);}
  if(round<10){
   assert.equal(q.stage,'echo');assert.deepEqual(flowerPlayback(q),[],'no automatic replay of the answered phrase');
   assert.equal(flowerDeadline(q)-q.stageAt,FLOWER_SUCCESS_MS,'success pause does not grow with the phrase');
   assert.equal(advanceFlowerGame(q,flowerDeadline(q)-1,[a])!.round,round);
   q=advanceFlowerGame(q,flowerDeadline(q),[a])!;
  }
 }
 assert.equal(q.stage,'celebrate');assert.deepEqual(q.winners,['a']);assert(awardFirst(earned,'flowers'));assert.equal(scoreOf(earned),6);assert(!awardFirst(earned,'flowers'));assert.equal(scoreOf(earned),6);
 assert.equal(startFlowerGame(q,a,flowerDeadline(q)-1),q);assert.equal(advanceFlowerGame(q,flowerDeadline(q),[a]),undefined);
});
test('a mistake keeps earlier marks briefly and replays the same prefix, without losing the round',()=>{
 const a=actor();let q={...startFlowerGame(undefined,a,1000,()=>0)!,round:3};q=advanceFlowerGame(q,flowerDeadline(q),[a])!;
 moveTo(a,0);q=playFlowerGame(q,0,a,q.stageAt+250)!;moveTo(a,1);q=playFlowerGame(q,1,a,q.stageAt+500)!;
 assert.equal(q.stage,'error');assert.equal(q.cursor,1);assert.equal(q.round,3);assert.equal(advanceFlowerGame(q,flowerDeadline(q)-1,[a])!.stage,'error');
 q=advanceFlowerGame(q,flowerDeadline(q),[a])!;assert.equal(q.stage,'listen');assert.equal(q.cursor,0);assert.equal(q.round,3);assert.deepEqual(flowerPlayback(q).map(n=>n.index),[0,0,4]);
});
test('the centre button replays only the waiting phrase, preserving melody/round and clearing partial input',()=>{
 const a=actor();let q=startFlowerGame(undefined,a,1000,()=>0)!;assert.equal(replayFlowerGame(q,a,1500),q);
 q=advanceFlowerGame({...q,round:4},4000,[a])!;assert.equal(q.stage,'repeat');moveTo(a,0);q=playFlowerGame(q,0,a,4200)!;assert.equal(q.cursor,1);
 assert.equal(replayFlowerGame(q,a,4300),q,'must return to the centre button');a.p=[SITE.x,0,SITE.z+2];const replay=replayFlowerGame(q,a,4400)!;
 assert.equal(replay.stage,'listen');assert.equal(replay.cursor,0);assert.equal(replay.round,4);assert.equal(replay.melody,q.melody);assert.equal(replay.startedAt,q.startedAt);assert.equal(flowerPlayback(replay).length,4);
 assert.equal(replayFlowerGame(replay,a,4450),replay,'pressing during playback cannot restart it');
});
test('players share a phrase; only present participants win, and the countdown starts when the last participant leaves',()=>{
 const a=actor(),b=actor('b'),spectator=actor('spectator');let q=startFlowerGame(undefined,a,1000,()=>0)!;
 assert.equal(startFlowerGame(q,b,1001),q,'simultaneous starts cannot replace an active melody');
 q={...q,stage:'repeat',round:10,cursor:0};let now=2000;
 for(let i=0;i<10;i++){const who=i%2?a:b,note=FLOWER_MELODIES[q.melody].notes[i];moveTo(who,note);q=playFlowerGame(q,note,who,now+=250,[a,b,spectator])!;}
 assert.deepEqual(new Set(q.winners),new Set(['a','b']));assert(!q.winners.includes('spectator'));
 let active:FlowerGame|undefined={...q,stage:'repeat',round:3,cursor:0,winners:[]};a.p=[200,0,200];
 active=advanceFlowerGame(active,now,[a,b]);assert.equal(active!.emptySince,undefined);b.p=[200,0,200];
 active=advanceFlowerGame(active,now,[a,b]);assert.equal(active!.emptySince,now);assert(advanceFlowerGame(active,now+FLOWER_EMPTY_MS-1,[a,b]));
 b.p=[SITE.x,0,SITE.z];active=advanceFlowerGame(active,now+9000,[a,b]);assert.equal(active!.emptySince,undefined);
 b.p=[200,0,200];active=advanceFlowerGame(active,now+10000,[a,b]);assert.equal(advanceFlowerGame(active,now+20000,[a,b]),undefined);
 assert.equal(startFlowerGame(undefined,a,now),undefined,'distant start rejected');
});
