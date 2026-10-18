import test from 'node:test';
import assert from 'node:assert/strict';
import {KNIGHT,startKnightBattle,advanceKnightBattle,setKnightPhase,knightDashHalfWidth,knightAttack,knightDanger,knightPosition,knightProjectile,knightShotOrigin,knightShotPath,knightImpactProgress,knightStartCount,knightJumpOpening,cancelKnightBattle,knightBattleActive,knightArenaSide,type KnightActor,type KnightBattle} from '../src/meta-knight-battle';
import {META_KNIGHT_ARENA as ARENA} from '../src/meta-knight-arena-site';
import {metaKnightVictoryLog} from '../src/world-log';
import {CharacterUnlocks} from '../src/character-unlocks';
import {chooseShieldCrystal,crystalPoint} from '../src/meta-knight-shield';
const actor=(id='a'):KnightActor=>({id,p:[0,0,-2],yaw:Math.PI,available:true});
function battle(){return startKnightBattle([actor()],'a',1000)!;}
function setStage(s:KnightBattle,stage:KnightBattle['stage'],now=2000){Object.assign(s,{stage,since:now,until:now+2000,checked:now,from:[0,0,0],to:[0,0,0],yaw:0,height:0,openHit:false});}
function shotContact(s:KnightBattle){const origin=knightShotOrigin(s);return s.since+KNIGHT.shotReleaseMs+Math.hypot(s.to[0]-origin[0],s.to[2]-origin[2])/KNIGHT.projectileSpeed;}

test('both first-phase sword sweeps stay at ground height even if their warning catches the player mid-jump',()=>{
 const s=battle(),a=actor();setStage(s,'approach');Object.assign(s,{pattern:'sword',step:-1,to:[0,0,0]});a.p=[0,2.2,8];s.players.a.invulnerable=1e12;
 for(const step of [0,2]){
  advanceKnightBattle(s,[a],s.until);assert.equal(s.stage,'slash-warn');assert.equal(s.step,step);assert.equal(s.height,0);
  advanceKnightBattle(s,[a],s.until);assert.equal(s.stage,'slash');assert.equal(s.height,0);assert(!knightDanger(s,a,s.since+100),'a sufficiently high jump clears either blade');assert(knightDanger(s,{...a,p:[0,0,8]},s.since+100),'standing in the lit cone still hurts');
 }
});

test('duel captures every arena player up to the edge, excludes the portal landing, and locks sides until the whole fight ends',()=>{
 const owner=actor(),edge={...actor('edge'),p:[41.5,0,0] as KnightActor['p']},waiting={...actor('waiting'),p:[ARENA.exitX,0,ARENA.exitZ] as KnightActor['p']};
 const s=startKnightBattle([owner,edge,waiting],'a',1000)!;
 assert.deepEqual(Object.keys(s.players).sort(),['a','edge']);assert.equal(knightArenaSide(s,'waiting'),'annex');assert.equal(knightArenaSide(s,'edge'),'arena');
 assert(!knightAttack(s,waiting,5000));cancelKnightBattle(s,'edge',5000);assert.equal(knightArenaSide(s,'edge'),'arena','withdrawal cannot reopen a running duel gate');
 assert.equal(knightArenaSide(s,'late arrival'),'annex');cancelKnightBattle(s,'a',5001);assert.equal(knightArenaSide(s,'edge'),undefined);assert.equal(knightArenaSide(s,'waiting'),undefined);
});

test('both forward dashes pass through every arena edge target without rotating the locked line or stopping short',()=>{
 for(const start of [[0,0,-9],[-35,0,-14],[40,0,0]] as KnightActor['p'][])for(let i=0;i<32;i++){
  const yaw=i*Math.PI/16,a=actor(),s=battle();a.p=[Math.sin(yaw)*41.7,0,Math.cos(yaw)*41.7];
  setStage(s,'approach');Object.assign(s,{phase:2,pattern:'flight',step:-1,from:[...start],to:[...start]});advanceKnightBattle(s,[a],s.until);assert.equal(s.stage,'dash-warn');
  for(let flight=0;flight<2;flight++){
   const dx=s.to[0]-s.from[0],dz=s.to[2]-s.from[2],distance=Math.hypot(dx,dz),px=a.p[0]-s.from[0],pz=a.p[2]-s.from[2],along=(px*dx+pz*dz)/distance;
   assert(Math.abs(px*dz-pz*dx)<1e-5,'the destination stays on the player ray');assert(distance>along+8,'the blade crosses past the edge player');assert(Math.hypot(s.to[0],s.to[2])<=ARENA.radius+6+1e-8);
   advanceKnightBattle(s,[a],s.until);assert.equal(s.stage,'dash');const contact=s.since+(s.until-s.since)*along/distance;
   assert(knightDanger(s,a,contact,contact-20),'the actual swept blade reaches the edge');
   if(flight===0){advanceKnightBattle(s,[a],s.until);assert.equal(s.stage,'dash-warn');}
  }
 }
});

test('crescent release covers the space between boss and blade tip without pre-release damage or lingering invisible contact',()=>{
 for(let i=0;i<12;i++)for(const gap of [0,1,5,9]){
  const a=actor(),s=battle(),yaw=i*Math.PI/6;setStage(s,'shot');Object.assign(s,{pattern:'crescent',step:1,height:KNIGHT.hoverHeight,yaw});a.p=[Math.sin(yaw)*gap,0,Math.cos(yaw)*gap];
  const release=s.since+KNIGHT.shotReleaseMs;advanceKnightBattle(s,[a],release-1);assert.equal(s.players.a.hp,5);
  advanceKnightBattle(s,[a],release+1);assert.equal(s.players.a.hp,5,'normal parry grace applies at point blank');advanceKnightBattle(s,[a],release+KNIGHT.parryGraceMs+2);assert.equal(s.players.a.hp,4,`close contact ${gap} at heading ${i}`);
 }
 const a=actor(),s=battle();setStage(s,'shot');s.pattern='crescent';s.step=1;a.p=[15,0,0];const late=s.since+KNIGHT.shotReleaseMs+KNIGHT.shotLaunchMs+200;advanceKnightBattle(s,[a],late);a.p=[0,0,0];advanceKnightBattle(s,[a],late+25);advanceKnightBattle(s,[a],late+200);assert.equal(s.players.a.hp,5,'the release flash cannot hurt after it disappears');
});

test('crescents reach every edge heading even when the sword tip starts beyond a nearby edge target',()=>{
 for(const from of [[0,0,0],[31,0,0],[-22,0,22]] as KnightActor['p'][])for(let i=0;i<32;i++){
  const a=actor(),s=battle(),heading=i*Math.PI/16;a.p=[Math.sin(heading)*41.7,0,Math.cos(heading)*41.7];setStage(s,'shot');Object.assign(s,{pattern:'crescent',step:1,from,height:KNIGHT.hoverHeight,yaw:Math.atan2(a.p[0]-from[0],a.p[2]-from[2])});
  const finish=s.since+KNIGHT.shotReleaseMs+knightShotPath(s).duration+KNIGHT.parryGraceMs+50;s.until=finish+100;
  for(let now=s.since;now<=finish;now+=20)advanceKnightBattle(s,[a],now);
  assert.equal(s.players.a.hp,4,`edge heading ${i} from ${from}`);
 }
});

test('a player facing the boss can still parry a point-blank release during its contact grace',()=>{
 for(const gap of [0,1,5]){
  const a=actor(),s=battle();setStage(s,'shot');Object.assign(s,{pattern:'crescent',step:1,height:KNIGHT.hoverHeight});a.p=[0,0,gap];
  const release=s.since+KNIGHT.shotReleaseMs;advanceKnightBattle(s,[a],release+1);assert(knightAttack(s,a,release+60));advanceKnightBattle(s,[a],release+60);
  assert.equal(s.stage,'return');assert.equal(s.players.a.hp,5);assert.equal(s.players.a.reflects,1);
 }
});

test('phase commands select 12/8/4 health, clear pending attacks and restart that phase without healing the player',()=>{
 const s=battle(),a=actor();s.players.a.hp=2;
 for(const [phase,hp] of [[3,4],[2,8],[1,12]] as const){
  setStage(s,'shot');s.shotContacts={a:1900};s.returnFrom=[0,1,20];s.players.a.attackAt=1950;s.players.a.handled=0;
  assert(setKnightPhase(s,phase,[a],2100));assert.equal(s.phase,phase);assert.equal(s.hp,hp);assert.equal(s.stage,'transition');
  assert.equal(s.checked,2100);assert.equal(s.players.a.hp,2);assert.equal(s.shotContacts,undefined);assert.equal(s.returnFrom,undefined);
  assert.equal(s.players.a.handled,s.players.a.attackAt);assert.equal(s.cycle,0);
  advanceKnightBattle(s,[a],3600);assert.equal(s.phase,phase);assert.equal(s.hp,hp);assert.equal(s.cycle,1);
 }
 for(const stage of ['lost','won','cancelled'] as const){s.stage=stage;const old=structuredClone(s);assert(!setKnightPhase(s,2,[a],5000));assert.deepEqual(s,old);}
});

test('godmode blocks sword, dash, impact and wave damage while the normal rules still hurt',()=>{
 for(const stage of ['slash','dash','slam','wave'] as const){
  const s=battle(),a=actor();setStage(s,stage);s.to=[10,0,0];
  a.p=stage==='slash'?[0,0,2]:stage==='dash'?[5,0,0]:stage==='wave'?[0,0,7]:[0,0,1];
  const now=stage==='dash'?3000:stage==='wave'?2500:2001,normal=structuredClone(s);
  advanceKnightBattle(normal,[a],now);assert.equal(normal.players.a.hp,4,stage);
  advanceKnightBattle(s,[a],now,'a');assert.equal(s.players.a.hp,5,stage);assert.equal(s.players.a.invulnerable,0);
 }
});

test('godmode consumes crescent contact without delayed damage and still allows a reflection',()=>{
 const s=battle(),a=actor();setStage(s,'shot');s.pattern='crescent';s.step=1;s.to=[0,0,28];a.p=[0,0,28];
 const contact=shotContact(s);advanceKnightBattle(s,[a],contact,'a');assert.equal(s.players.a.hp,5);assert.equal(s.shotContacts?.a,contact);
 advanceKnightBattle(s,[a],contact+KNIGHT.parryGraceMs+1,'a');assert.equal(s.shotContacts?.a,-1);
 advanceKnightBattle(s,[a],contact+KNIGHT.parryGraceMs+2);assert.equal(s.players.a.hp,5,'disabling godmode cannot replay the protected contact');
 const good=battle();setStage(good,'shot');good.pattern='crescent';good.step=1;good.to=[0,0,28];
 assert(knightAttack(good,a,contact-100));advanceKnightBattle(good,[a],contact,'a');assert.equal(good.stage,'return');assert.equal(good.players.a.reflects,1);
 advanceKnightBattle(good,[a],contact+450,'a');assert.equal(good.hp,11);assert.equal(good.players.a.hp,5);
 const grace=battle();setStage(grace,'shot');grace.pattern='crescent';grace.step=1;grace.to=[0,0,28];
 advanceKnightBattle(grace,[a],contact,'a');assert(knightAttack(grace,a,contact+50));advanceKnightBattle(grace,[a],contact+50,'a');
 assert.equal(grace.stage,'return');assert.equal(grace.players.a.reflects,1,'godmode retains the normal contact grace for reflections');
});

test('godmode also protects against third-phase beams, ricochets and the shield landing',()=>{
 for(const stage of ['cross','ricochet','shield'] as const){
  const s=battle(),a=actor();setStage(s,stage);s.pattern='star';s.phase=3;s.step=stage==='ricochet'?6:stage==='shield'?13:2;s.cycle=1;
  const now=stage==='ricochet'?3000:2001,pos=knightPosition(s,now);a.p=stage==='ricochet'?[pos[0],0,pos[2]]:[0,0,0];
  const normal=structuredClone(s);advanceKnightBattle(normal,[a],now);assert.equal(normal.players.a.hp,4,stage);
  advanceKnightBattle(s,[a],now,'a');assert.equal(s.players.a.hp,5,stage);
 }
});
test('duel requires proximity and an available grounded player; fresh attempts restore both health pools',()=>{
 assert(!startKnightBattle([{...actor(),p:[30,0,30]}],'a',1000));assert(!startKnightBattle([{...actor(),available:false}],'a',1000));
 const s=battle();assert.equal(s.hp,12);assert.equal(s.players.a.hp,5);assert.equal(s.stage,'intro');
 s.hp=1;s.players.a.hp=0;const retry=battle();assert.equal(retry.hp,12);assert.equal(retry.players.a.hp,5);
});
test('warnings leave the boss stationary and lock destinations; actual jump/dash/dive use those destinations',()=>{
 const s=battle();setStage(s,'dash-warn');s.to=[10,0,0];s.height=2;
 assert.deepEqual(knightPosition(s,2900),[0,2,0]);s.stage='dash';assert.deepEqual(knightPosition(s,3000),[5,2,0]);
 s.stage='jump';s.height=0;assert.deepEqual(knightPosition(s,3000),[5,5,0]);
});
test('sword sectors, swept flight lanes, impact circles and low waves have distinct honest hit regions',()=>{
 const s=battle();setStage(s,'slash');const a=actor();a.p=[0,0,3];assert(knightDanger(s,a,2100));a.p=[4,0,0];assert(!knightDanger(s,a,2100));a.p=[0,2.9,3];assert(!knightDanger(s,a,2100));
 setStage(s,'dash');s.to=[10,0,0];a.p=[5,0,0];assert(knightDanger(s,a,3200,2800));a.p=[5,0,KNIGHT.laneHalfWidth+1];assert(!knightDanger(s,a,3200,2800));
 setStage(s,'slam');a.p=[0,0,1];assert(knightDanger(s,a,2100));a.p=[0,3,1];assert(!knightDanger(s,a,2100));
 setStage(s,'wave');a.p=[0,0,KNIGHT.waveSpeed*500];assert(knightDanger(s,a,2500,2450));a.p[1]=1.2;assert(!knightDanger(s,a,2500,2450));
});
test('phase two forward flights have a 50% wider lane at every heading with the same height limits',()=>{
 for(const yaw of [0,Math.PI/2,Math.PI,Math.PI/4]){
  const s=battle(),a=actor();setStage(s,'dash');s.phase=2;s.pattern='flight';s.height=1.2;s.to=[Math.sin(yaw)*10,0,Math.cos(yaw)*10];
  assert.equal(knightDashHalfWidth(s),4.5);
  const beside=(offset:number,height=0):KnightActor['p']=>[Math.sin(yaw)*5+Math.cos(yaw)*offset,height,Math.cos(yaw)*5-Math.sin(yaw)*offset];
  for(const side of [-1,1]){
   a.p=beside(side*4);assert(knightDanger(s,a,3200,2800),'the newly widened strip is dangerous');
   a.p=beside(side*(4.5+KNIGHT.bodyRadius-.01));assert(knightDanger(s,a,3200,2800));
   a.p=beside(side*(4.5+KNIGHT.bodyRadius+.01));assert(!knightDanger(s,a,3200,2800),'the outer edge remains safe');
  }
  a.p=beside(4,2.71);assert(!knightDanger(s,a,3200,2800),'flying above the attack still avoids damage');
  a.p=beside(4);s.stage='dash-warn';assert(!knightDanger(s,a,3200,2800));s.stage='dash';
  const normal=structuredClone(s);normal.phase=1;assert.equal(knightDashHalfWidth(normal),3);assert(!knightDanger(normal,a,3200,2800));
  normal.phase=3;assert.equal(knightDashHalfWidth(normal),3);assert(!knightDanger(normal,a,3200,2800));
  advanceKnightBattle(s,[a],3200);assert.equal(s.players.a.hp,4,'shared battle rules apply damage in the wider strip');
 }
});

test('one attack cannot drain multiple hearts; no hearts is a real loss',()=>{
 const s=battle(),a=actor();setStage(s,'slash');a.p=[0,0,2];advanceKnightBattle(s,[a],2001);assert.equal(s.players.a.hp,4);
 advanceKnightBattle(s,[a],2100);assert.equal(s.players.a.hp,4);
 s.players.a.hp=1;s.players.a.invulnerable=0;advanceKnightBattle(s,[a],2200);assert.equal(s.stage,'lost');assert.equal(s.hp,12);
});
test('accurate reflection damages the boss once on arrival without a melee opening or disorientation',()=>{
 const s=battle(),a=actor();setStage(s,'shot');s.pattern='crescent';s.step=1;s.to=[0,0,28];s.height=0;a.p=[0,0,28];a.yaw=Math.PI;
 const contact=shotContact(s);
 assert(knightAttack(s,a,2050));assert(!knightAttack(s,a,2100));advanceKnightBattle(s,[a],contact);assert.equal(s.players.a.hp,5);advanceKnightBattle(s,[a],contact+KNIGHT.parryGraceMs+1);assert.equal(s.players.a.hp,4);assert.equal(s.stage,'shot','a hit does not stop the projectile before the rim');
 const good=battle();setStage(good,'shot');good.pattern='crescent';good.step=1;good.to=[0,0,28];good.height=0;
 assert(knightAttack(good,a,contact-100));advanceKnightBattle(good,[a],contact);assert.equal(good.stage,'return');assert.equal(good.players.a.reflects,1);assert.equal(good.hp,12);assert.equal(good.players.a.hp,5);
 assert(knightProjectile(good,contact+100));advanceKnightBattle(good,[a],contact+449);assert.equal(good.hp,12);
 advanceKnightBattle(good,[a],contact+450);assert.equal(good.hp,11);assert.equal(good.stage,'stunned');assert.equal(good.players.a.hits,0);assert.equal(good.players.a.hp,5);
 advanceKnightBattle(good,[a],contact+451);assert.equal(good.hp,11,'one reflected crescent deals exactly one damage');
});

test('returned crescents can trigger either phase transition or finish the duel',()=>{
 for(const [hp,phase,after,stage] of [[9,1,2,'transition'],[5,2,3,'transition'],[1,3,3,'won']] as const){
  const s=battle(),a=actor();setStage(s,'return');Object.assign(s,{hp,phase,pattern:'crescent',step:1,until:2450,returnFrom:[0,1.2,20]});s.players.a.reflects=1;
  advanceKnightBattle(s,[a],2449);assert.equal(s.hp,hp);advanceKnightBattle(s,[a],2450);assert.equal(s.hp,hp-1);assert.equal(s.phase,phase);assert.equal(s.stage,'stunned');assert.equal(s.players.a.hits,0);
  assert.equal(s.until,3450);advanceKnightBattle(s,[a],3449);assert.equal(s.stage,'stunned');assert.equal(s.hp,hp-1);
  advanceKnightBattle(s,[a],3450);if(hp>1){assert.equal(s.stage,'get-up');advanceKnightBattle(s,[a],s.until);}assert.equal(s.phase,after);assert.equal(s.stage,stage);
 }
});

test('a successful reflection cancels the remaining crescent throws and moves to the next attack',()=>{
 for(const step of [1,3,5]){
  const s=battle();setStage(s,'return');Object.assign(s,{pattern:'crescent',step,cycle:3,until:2450,returnFrom:[0,1.2,20]});
  advanceKnightBattle(s,[actor()],2450);assert.equal(s.hp,11);assert.equal(s.stage,'stunned');assert.equal(s.until-s.since,1000);
  const a={...actor(),p:[s.from[0],0,s.from[2]+2] as KnightActor['p']};assert(knightAttack(s,a,2600));advanceKnightBattle(s,[a],2750);assert.equal(s.hp,11,'post-hit stars do not grant a bonus melee opening');
  advanceKnightBattle(s,[a],s.until);assert.equal(s.stage,'get-up');advanceKnightBattle(s,[a],s.until);assert.equal(s.pattern,'sword');assert.equal(s.stage,'approach');assert.equal(s.hp,11);
 }
});

test('a parry during contact grace cancels all damage, including other players touched by the same crescent',()=>{
 const a=actor(),b=actor('b');a.p=b.p=[0,0,28];const s=startKnightBattle([{...a,p:[0,0,-2]},{...b,p:[0,0,-2]}],'a',1000)!;
 setStage(s,'shot');s.to=[0,0,28];s.height=0;
 const contact=shotContact(s);advanceKnightBattle(s,[a,b],contact);
 assert.equal(s.players.a.hp,5);assert.equal(s.players.b.hp,5);assert(s.shotContacts?.a);
 assert(knightAttack(s,b,contact+50));advanceKnightBattle(s,[a,b],contact+50);
 assert.equal(s.stage,'return');assert.equal(s.players.b.reflects,1);assert(!s.shotContacts);
 advanceKnightBattle(s,[a,b],contact+500);assert.equal(s.players.a.hp,5);assert.equal(s.players.b.hp,5);
});

test('a crescent keeps flying after a hit and cannot damage that player twice',()=>{
 const s=battle(),a=actor();setStage(s,'shot');Object.assign(s,{pattern:'crescent',step:1,to:[0,0,20]});a.p=[0,0,20];
 const flight=knightShotPath(s);s.until=s.since+KNIGHT.shotReleaseMs+flight.duration+KNIGHT.parryGraceMs;
 const contact=shotContact(s);advanceKnightBattle(s,[a],contact);advanceKnightBattle(s,[a],contact+KNIGHT.parryGraceMs+1);
 assert.equal(s.players.a.hp,4);assert.equal(s.stage,'shot');assert(knightProjectile(s,contact+300));
 s.players.a.invulnerable=0;const p=knightProjectile(s,contact+350)!;a.p=[p[0],0,p[2]];
 advanceKnightBattle(s,[a],contact+350);advanceKnightBattle(s,[a],contact+550);assert.equal(s.players.a.hp,4,'the same projectile cannot hit again after invulnerability ends');
});

test('the widened crescent has an honest crosswise hit region at any heading',()=>{
 for(const yaw of [0,.7,Math.PI])for(const cross of [3.1,4.4]){
  const s=battle(),a=actor();setStage(s,'shot');Object.assign(s,{pattern:'crescent',step:1,yaw,to:[Math.sin(yaw)*28,0,Math.cos(yaw)*28]});
  a.p=[s.to[0]+Math.cos(yaw)*cross,0,s.to[2]-Math.sin(yaw)*cross];
  const at=shotContact(s);advanceKnightBattle(s,[a],at);advanceKnightBattle(s,[a],at+KNIGHT.parryGraceMs+1);
  assert.equal(s.players.a.hp,cross<4?4:5);
 }
});

test('the intro lasts three seconds and presents 3, 2, 1, fight before normal combat',()=>{
 const s=battle(),a=actor();assert.equal(s.until-s.since,3000);
 for(const [now,label] of [[1000,'3'],[1999,'3'],[2000,'2'],[3000,'1'],[3999,'1']] as const){advanceKnightBattle(s,[a],now);assert.equal(s.stage,'intro');assert.equal(knightStartCount(s,now),label);assert(!knightAttack(s,a,now));assert.equal(s.players.a.hp,5);}
 advanceKnightBattle(s,[a],4000);assert.equal(s.stage,'approach');assert.equal(knightStartCount(s,4000),'fight');assert.equal(knightStartCount(s,4600),undefined);
});

test('round warning countdown is continuous across launch and finishes exactly at impact',()=>{
 for(const phase of [1,3] as const)for(const dive of [false,true]){
  const s=battle();s.phase=phase;setStage(s,dive?'dive-warn':'jump-warn');
  const duration=Math.max(1300,((dive?1200:1000)-(phase===3?180:0))*1.6);s.until=s.since+duration;
  assert.equal(knightImpactProgress(s,s.since),0);const launch=knightImpactProgress(s,s.until),until=s.until;
  s.stage=dive?'dive':'jump';s.since=until;s.until=until+(dive?450:850);
  assert.equal(knightImpactProgress(s,s.since),launch);assert(launch>0&&launch<1);assert.equal(knightImpactProgress(s,s.until),1);
 }
});

test('phase transitions never repeat the opening fight announcement',()=>{
 for(const phase of [2,3] as const){
  const s=battle();Object.assign(s,{stage:'transition',phase,since:6000,until:7500,checked:6000});
  advanceKnightBattle(s,[actor()],7500);assert.equal(s.stage,phase===3?'star-rise':'approach');assert.equal(s.cycle,1);
  assert.equal(knightStartCount(s,7500),undefined);assert.equal(knightStartCount(s,7700),undefined);
 }
});

test('leap takes off from the current spot and opens immediately for four seconds at impact',()=>{
 const a=actor(),s=battle();setStage(s,'open');s.cycle=1;s.from=s.to=[-8,0,-12];a.p=[8,0,7];
 advanceKnightBattle(s,[a],s.until);assert.equal(s.stage,'jump-warn');assert.deepEqual(s.from,[-8,0,-12]);assert.deepEqual(s.to,a.p);
 const launch=s.until;advanceKnightBattle(s,[a],launch);assert.equal(s.stage,'jump');assert.deepEqual(knightPosition(s,launch),[-8,0,-12]);
 const landing=s.until;advanceKnightBattle(s,[a],landing);assert.equal(s.stage,'open');assert(knightJumpOpening(s));assert.equal(s.until-landing,4000);
 assert.equal(s.players.a.hp,4,'the landing itself still damages players inside the circle');
 assert(!knightDanger(s,a,landing+50,landing+25),'there is no lingering circle or wave damage');
 a.p=[s.from[0],0,s.from[2]+3];a.yaw=Math.PI;
 assert(knightAttack(s,a,landing));advanceKnightBattle(s,[a],landing+140);assert.equal(s.hp,11,'a counter can land immediately after the impact');
});

test('crescent charge tracks the player, locks the aim, takes flight, and produces exactly three sword releases',()=>{
 const s=battle(),a=actor();Object.assign(s,{stage:'approach',pattern:'crescent',step:-1,since:2000,until:2900,from:[0,0,0],to:[0,0,0]});s.players.a.invulnerable=1e12;
 advanceKnightBattle(s,[a],2900);assert.equal(s.stage,'shot-warn');assert.equal(knightPosition(s,2900)[1],0);assert.equal(knightPosition(s,3350)[1],KNIGHT.hoverHeight);
 a.p=[12,0,0];advanceKnightBattle(s,[a],3100);assert.deepEqual(s.to,a.p);assert(Math.abs(s.yaw-Math.PI/2)<1e-6);
 const lock=s.until-KNIGHT.aimLockMs;a.p=[10,0,8];advanceKnightBattle(s,[a],lock-1);const aim=[...s.to],yaw=s.yaw;
 a.p=[-12,0,0];advanceKnightBattle(s,[a],lock+1);assert.deepEqual(s.to,aim);assert.equal(s.yaw,yaw);
 const shots=new Set<number>();for(let now=lock+1;now<14000;now+=25){advanceKnightBattle(s,[a],now);const stage=s.stage as KnightBattle['stage'];if(stage==='shot')shots.add(s.since);if(stage==='rest')break;}
 assert.equal(shots.size,3);assert.equal(s.stage,'rest');
});
test('eight normal openings and four selected crystals win; spam and distant hits fail',()=>{
 const s=battle(),a=actor();let now=2000;const phases=new Set<number>();
 for(let i=0;i<12;i++){
  setStage(s,i<8?'open':'shield',now);a.p=[0,0,2];a.yaw=Math.PI;
  if(i>=8){s.pattern='star';s.cycle=i-7;s.activeCrystal=chooseShieldCrystal(s);const p=crystalPoint(s.activeCrystal);a.p=[p[0]*.94,0,p[2]*.94];a.yaw=Math.atan2(p[0]-a.p[0],p[2]-a.p[2]);}
  assert(knightAttack(s,a,now+10));advanceKnightBattle(s,[a],now+160);phases.add(s.phase);
  const health=s.hp;advanceKnightBattle(s,[a],now+180);assert.equal(s.hp,health);advanceKnightBattle(s,[a],s.until);if(s.stage==='get-up')advanceKnightBattle(s,[a],s.until);phases.add(s.phase);now+=3000;
 }
 assert.deepEqual([...phases],[1,2,3]);assert.equal(s.hp,0);assert.equal(s.stage,'won');assert.equal(s.players.a.hits,12);
 const miss=battle();setStage(miss,'open');a.p=[0,0,12];knightAttack(miss,a,2010);advanceKnightBattle(miss,[a],2200);assert.equal(miss.hp,12);
});

test('a melee hit removes one HP immediately, then holds a one-second stun and gets up before continuing',()=>{
 const s=battle(),a=actor();setStage(s,'open');a.p=[0,0,3];a.yaw=Math.PI;assert(knightAttack(s,a,2100));advanceKnightBattle(s,[a],2250);assert.equal(s.hp,11);assert.equal(s.stage,'stunned');assert.equal(s.until-s.since,1000);
 assert(knightAttack(s,a,2900));advanceKnightBattle(s,[a],3050);assert.equal(s.hp,11,'the post-hit reaction is not another opening');advanceKnightBattle(s,[a],3249);assert.equal(s.stage,'stunned');advanceKnightBattle(s,[a],3250);assert.equal(s.stage,'get-up');assert.equal(s.until-s.since,260);advanceKnightBattle(s,[a],s.until);assert.equal(s.stage,'approach');assert.equal(s.hp,11);
 const phase=battle();phase.hp=9;setStage(phase,'open');knightAttack(phase,a,2100);advanceKnightBattle(phase,[a],2250);assert.equal(phase.phase,1);advanceKnightBattle(phase,[a],phase.until);advanceKnightBattle(phase,[a],phase.until);assert.equal(phase.stage,'transition');assert.equal(phase.phase,2);
});
test('complete attack schedules include sword, jumping, waves, flight, diving and crescents without invisible warning damage',()=>{
 for(const phase of [1,2,3] as const){const s=battle(),a=actor();s.phase=phase;s.players.a.invulnerable=1e12;const seen=new Set<string>();
  for(let now=1000;now<115000;now+=40){advanceKnightBattle(s,[a],now);seen.add(s.stage);if(s.stage.endsWith('-warn'))assert(!knightDanger(s,a,now));}
  for(const stage of phase===1?['slash','jump','shot']:phase===2?['dash','dive','wave','shot']:['cross','ricochet','star-fall','shield'])assert(seen.has(stage),`phase ${phase} missing ${stage}`);
  if(phase===1)assert(!seen.has('wave'),'leap opens at landing instead of waiting for a wave');
 }
});
test('disconnection and late spectators cannot award themselves a victory; loss does not unlock Meta Knight',()=>{
 const s=battle(),late=actor('late');setStage(s,'open');assert(!knightAttack(s,late,2100));advanceKnightBattle(s,[],2200);assert.equal(s.stage,'lost');
 const unlocks=new CharacterUnlocks();assert(unlocks.isLocked('Meta Knight'));assert(unlocks.unlockMetaKnight());assert(!unlocks.isLocked('Meta Knight'));
});
test('requested respect message has no player prefix, treats player names as text and supports literal replacement symbols',()=>{
 const entry=metaKnightVictoryLog('Саша $&');assert.equal(entry.name,'');assert.equal(entry.chat,false);assert.equal(entry.text,'Метакнайт с уважением смотрит на Саша $&.');
});
test('twofold boss and effects share doubled danger radii and lanes',()=>{assert.equal(KNIGHT.modelScale,1.65*2);assert.equal(KNIGHT.slashRadius,5.8*2);assert.equal(KNIGHT.laneHalfWidth,1.5*2);assert.equal(KNIGHT.impactRadius,2.5*2);assert.equal(KNIGHT.waveSpeed,.007*2);});
test('cancelling keeps the player position, never grants victory, and lets friends continue',()=>{
 const a=actor(),b=actor('b'),s=startKnightBattle([a,b],'a',1000)!,position=[...a.p];assert(cancelKnightBattle(s,'a',2100));assert(s.players.a.withdrawn);assert(knightBattleActive(s));assert.deepEqual(a.p,position);assert(!knightAttack(s,a,2200));
 assert(cancelKnightBattle(s,'b',2300));assert.equal(s.stage,'cancelled');assert(!knightBattleActive(s));assert(!advanceKnightBattle(s,[a,b],5000));assert.equal(s.hp,12);assert(!s.rewarded);assert(!cancelKnightBattle(s,'a',2400));
});
