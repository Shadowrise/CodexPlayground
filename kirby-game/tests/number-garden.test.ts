import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startNumberGame,createNumberProblems,numberAnswer,pressNumberGame,advanceNumberGame,numberDeadline,validNumberGame,validNumberProblem,NUMBER_EMPTY_MS,type NumberActor,type NumberGame} from '../src/number-garden-game';
import {NUMBER_DIGITS,NUMBER_GARDEN_SITE as SITE,canPressNumber,outsideNumberGarden} from '../src/number-garden-site';
import {numberSound} from '../src/number-garden-sounds';
import {NUMBER_GLYPHS,numberGlyphGeometry} from '../src/number-garden';
import {achievementPoints,awardFirst,scoreOf,type ScoreAction} from '../src/score';
import {flatGround,BRIDGES} from '../src/pond-layout';
import {MEADOW_HALF_SIZE} from '../src/world-bounds';
import {Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
const actor=(id='a'):NumberActor=>({id,p:[SITE.buttonX,0,SITE.buttonZ+1.7],size:1});
const near=(digit:number,id='a'):NumberActor=>({...actor(id),p:[NUMBER_DIGITS[digit].x,0,NUMBER_DIGITS[digit].z+1.7]});
const examples=[{left:7,right:5,operator:'+'},{left:9,right:4,operator:'−'},{left:23,right:46,operator:'+'},{left:97,right:24,operator:'−'},{left:58,right:64,operator:'+'},{left:92,right:17,operator:'−'}] as NumberGame['problems'];

test('six random rounds keep single digits first, then two digits without and with carrying/borrowing',()=>{
 let seed=78;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
 const variants=new Set<string>();
 for(const rng of [()=>0,()=>.999999999,random])for(let i=0;i<400;i++){
  const problems=createNumberProblems(rng);assert.equal(problems.length,6);variants.add(JSON.stringify(problems));
  const q=startNumberGame(undefined,actor(),100,rng)!;assert(validNumberGame(q));
  problems.forEach((p,index)=>{assert.equal(p.operator,index%2?'−':'+');assert.equal(String(p.left).length,index<2?1:2);assert.equal(String(p.right).length,index<2?1:2);assert(validNumberProblem(p,index+1));if(index%2)assert(p.left>p.right);assert(Number(numberAnswer(p))>=0);});
  for(const p of problems.slice(0,2)){assert(p.left>=1&&p.left<=9);assert(p.right>=1&&p.right<=9);}
 }
 assert(variants.size>350);assert.equal(numberAnswer({left:99,right:99,operator:'+'}),'198');assert.equal(numberAnswer({left:0,right:0,operator:'+'}),'0');
 assert(!validNumberProblem({left:58,right:64,operator:'+'},3));assert(!validNumberProblem({left:92,right:17,operator:'−'},4));assert(!validNumberProblem({left:23,right:46,operator:'+'},5));assert(!validNumberProblem({left:97,right:24,operator:'−'},6));assert(!validNumberProblem({left:123,right:456,operator:'+'},5));
 assert(!validNumberProblem({left:0,right:4,operator:'+'},1));assert(!validNumberProblem({left:4,right:0,operator:'+'},1));assert(!validNumberProblem({left:4,right:0,operator:'−'},2));
});
test('answers are entered left to right, mistakes cross only the failing slot and retry the same problem',()=>{
 let q={...startNumberGame(undefined,actor(),100)!,problems:examples};
 assert.equal(pressNumberGame(q,1,near(9),200),q,'remote key rejected');
 q=pressNumberGame(q,1,near(1),200)!;assert.equal(q.cursor,1);assert.equal(q.stage,'answer');
 q=pressNumberGame(q,3,near(3),400)!;assert.equal(q.stage,'error');assert.equal(q.cursor,1);assert.equal(q.wrongDigit,3);assert(validNumberGame(q));
 assert.equal(pressNumberGame(q,2,near(2),500),q,'feedback cannot be skipped by another key');
 q=advanceNumberGame(q,numberDeadline(q))!;assert.equal(q.cursor,0);assert.equal(q.stage,'answer');assert.deepEqual(q.problems,examples);
 assert.equal(startNumberGame(q,actor(),2000),q,'start cannot replace an active challenge');
});
test('six complete answers include zeros and repeated digits, and award twelve points once',()=>{
 let q={...startNumberGame(undefined,actor(),100)!,problems:examples},now=100;
 for(let round=1;round<=6;round++){
  assert.equal(q.round,round);
  for(const char of numberAnswer(q.problems[round-1])){now+=250;q=pressNumberGame(q,Number(char),near(Number(char)),now)!;assert(validNumberGame(q));}
  if(round<6){assert.equal(q.stage,'round');assert.deepEqual(q.winners,[]);now=numberDeadline(q);q=advanceNumberGame(q,now)!;}else assert.equal(q.stage,'celebrate');
 }
 assert.deepEqual(q.winners,['a']);const a={fruitsEaten:0,achievements:new Set<ScoreAction>()};assert(awardFirst(a,'numbers'));assert.equal(scoreOf(a),12);assert(!awardFirst(a,'numbers'));assert.equal(achievementPoints(a.achievements),12);
 assert.equal(advanceNumberGame(q,numberDeadline(q)),undefined);
 const zero={...startNumberGame(undefined,actor(),100)!,round:3,problems:[...examples.slice(0,2),{left:20,right:20,operator:'+' as const},...examples.slice(3)]};
 const prefix=pressNumberGame(zero,4,near(4),350)!;assert.equal(pressNumberGame(prefix,0,near(0),600)?.stage,'round','zero remains available in answers to two-digit problems');
});
test('leave countdown starts once, returning cancels it, and ten seconds away resets the challenge',()=>{
 let q=startNumberGame(undefined,actor(),100)!,far={...actor(),p:[0,0,0]};
 q=advanceNumberGame(q,200,[far])!;assert.equal(q.emptySince,200);assert.equal(advanceNumberGame(q,300,[far]),q);
 q=advanceNumberGame(q,9000,[actor()])!;assert.equal(q.emptySince,undefined);
 q=advanceNumberGame(q,10000,[far])!;assert.equal(advanceNumberGame(q,10000+NUMBER_EMPTY_MS,[far]),undefined);
 assert.equal(startNumberGame(undefined,far,100),undefined);assert.equal(startNumberGame(undefined,{...actor(),available:false},100),undefined);
 assert(!canPressNumber(0,{x:NaN,y:0,z:0},1));assert(!canPressNumber(10,{x:0,y:0,z:0},1));assert(!outsideNumberGarden(SITE.x,SITE.z));
});
test('the extended platform reaches the mountain, leaves the bridge approach open and keeps every key on dry ground',()=>{
 assert(SITE.z-SITE.halfDepth<-MEADOW_HALF_SIZE);assert(SITE.z+SITE.halfDepth>SITE.buttonZ+2);
 for(const d of NUMBER_DIGITS)assert(flatGround(d.x,d.z,2),'all key approaches remain on dry lawn');
 assert(flatGround(SITE.buttonX,SITE.buttonZ,2));
 const bridge=BRIDGES.reduce((a,b)=>Math.hypot(a.x-SITE.x,a.z-SITE.z)<Math.hypot(b.x-SITE.x,b.z-SITE.z)?a:b);
 const endpoint={x:bridge.x+9.8*Math.cos(bridge.yaw),z:bridge.z-9.8*Math.sin(bridge.yaw)};
 const other={x:bridge.x-9.8*Math.cos(bridge.yaw),z:bridge.z+9.8*Math.sin(bridge.yaw)};
 const north=endpoint.z<other.z?endpoint:other;assert(outsideNumberGarden(north.x,north.z,.3));assert(Math.hypot(north.x-SITE.buttonX,north.z-SITE.buttonZ)>4,'space after the bridge before the start button');
});
test('shared participants cooperate, while spectators and departed players receive no reward',()=>{
 let q={...startNumberGame(undefined,actor(),100)!,problems:examples,round:5};const a=near(1),b=near(2,'b');
 q=pressNumberGame(q,1,a,200,[a,b])!;q=pressNumberGame(q,2,b,500,[a,b])!;q=pressNumberGame(q,2,b,800,[a,b])!;
 q=advanceNumberGame(q,numberDeadline(q))!;q=pressNumberGame(q,7,near(7),2100,[a,b])!;
 q=pressNumberGame(q,5,near(5,'b'),2400,[{...a,p:[0,0,0]},near(5,'b'),actor('spectator')])!;
 assert.deepEqual(q.winners,['b']);assert.deepEqual(q.players,['a','b']);
 assert(!validNumberGame({...q,round:7}));assert(!validNumberGame({...q,problems:[{left:1,right:99,operator:'−'},...examples.slice(1)]}));
});
test('ten joined block glyphs retain readable holes; bells are finite, gentle and fade to silence',()=>{
 assert.equal(new Set(Object.values(NUMBER_GLYPHS).slice(0,10).map(g=>g.join(''))).size,10);
 for(let digit=0;digit<10;digit++){
  const g=numberGlyphGeometry(String(digit));g.computeBoundingBox();assert(g.boundingBox!.max.z>g.boundingBox!.min.z);assert(g.attributes.position.count<15000);g.dispose();
  const samples=numberSound(digit);let peak=0,energy=0;for(const sample of samples){assert(Number.isFinite(sample));peak=Math.max(peak,Math.abs(sample));energy+=sample*sample;}
  assert(peak<.5&&peak>.08);assert(energy/samples.length>.0001);assert(Math.abs(samples.at(-1)!)<.00001);
 }
 for(const kind of ['correct','wrong','finish'] as const){const s=numberSound(kind);assert(s.every(Number.isFinite));assert(Math.max(...s)<.8);}
});
test('block joints are filled, the seven has a connected stem, and zero/eight counters remain open',()=>{
 const material=new MeshBasicMaterial();
 const hits=(digit:string,x:number,y:number)=>{
  const geometry=numberGlyphGeometry(digit),mesh=new Mesh(geometry,material),ray=new Raycaster(new Vector3(x,y,2),new Vector3(0,0,-1));
  const hit=ray.intersectObject(mesh).length>0;geometry.dispose();return hit;
 };
 assert(hits('0',-.215,.86));assert(hits('0',.215,.86),'adjacent blocks leave no gap across a horizontal stroke');
 assert(hits('0',.43,.215),'vertical strokes stay solid at block joints');assert(hits('7',.43,.215),'the diagonal step connects to the stem');
 assert(!hits('0',0,0));assert(!hits('8',0,.43));assert(!hits('8',0,-.43));material.dispose();
});
