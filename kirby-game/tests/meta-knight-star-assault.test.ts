import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {startKnightBattle,advanceKnightBattle,knightPosition,knightDanger,knightAttack,type KnightBattle,type KnightActor} from '../src/meta-knight-battle';
import {STAR_SEQUENCE,STAR_FLIGHTS,starSequence,starFlightCount,nearestCrystalChord,planStarRoute,lockStarFlight,lockStarCross,crossTriangles,crossBoundaries,crossEscapePoint,crossWarningDuration,STAR_ASSAULT,STAR_LANDING_STEP,STAR_FALL_STEP,STAR_SHIELD_STEP,crossLine,crossLines,crossPairs,ricochetCurve,ricochetCountdown,starImpactProgress,starOpening,starFacing,ricochetCrystal} from '../src/meta-knight-star-assault';
import {MetaKnightCrossZonesView} from '../src/meta-knight-cross-zones-view';
import {MetaKnightStarAssaultView} from '../src/meta-knight-star-assault-view';
import {MetaKnightPressureWave} from '../src/meta-knight-shield-view';
import {MetaKnightCrystalLightning,CRYSTAL_LIGHTNING_SEGMENTS_PER_LINK} from '../src/meta-knight-crystal-lightning';
import {SHIELD,chooseShieldCrystal,crystalPoint,crystalBroken,shieldWaves,shieldWaveAngle,shieldWaveGap,shieldCountdown,constrainKnightShield} from '../src/meta-knight-shield';

const actor:KnightActor={id:'a',p:[12,0,12],yaw:0,available:true};
function battle(){const s=startKnightBattle([{...actor,p:[0,0,-2]}],'a',1000)!;Object.assign(s,{phase:3,hp:4,stage:'transition',since:1000,until:2500});return s;}
function stage(s:KnightBattle,step:number){const [name,duration]=STAR_SEQUENCE[step];Object.assign(s,{pattern:'star',stage:name,step,cycle:1,yaw:.3,since:5000,until:5000+duration});}

test('golden charging bolts stay attached to the moving sword and actual crystals, flicker and reuse their geometry',()=>{
 const s=battle();stage(s,1);s.starCross={pairs:[[0,4],[1,6]],side:0};const before=JSON.stringify(s),tip=new T.Vector3(3,8,-2),view=new MetaKnightCrystalLightning();
 view.update(s,5500,tip);assert(view.group.visible);assert.equal(view.cores.count,176);assert.equal(view.cores.material.toneMapped,false);
 const geometry=view.cores.geometry,matrix=new T.Matrix4(),ends=()=>crossPairs(s).flat().forEach((crystal,i)=>{
  view.cores.getMatrixAt(i*CRYSTAL_LIGHTNING_SEGMENTS_PER_LINK,matrix);assert(new T.Vector3(0,-.5,0).applyMatrix4(matrix).distanceTo(tip)<.00001);
  view.cores.getMatrixAt(i*CRYSTAL_LIGHTNING_SEGMENTS_PER_LINK+31,matrix);assert(new T.Vector3(0,.5,0).applyMatrix4(matrix).distanceTo(new T.Vector3().fromArray(crystalPoint(crystal)))<.00001);
 });ends();const first=view.cores.instanceMatrix.array.slice();
 view.update(s,5560,tip);assert.notDeepEqual(view.cores.instanceMatrix.array,first,'the paths have changing lightning kinks');assert.equal(view.cores.geometry,geometry);
 tip.set(-4,10,7);view.update(s,5600,tip);ends();assert.equal(JSON.stringify(s),before,'decoration does not alter targets, timing or damage');
 s.stage='cross';view.update(s,5700,tip);assert(!view.group.visible);view.dispose();
});

test('stationary targets across the entire floor must dodge both crosses and all three flights after any three crystal breaks',()=>{
 for(let mask=0;mask<256;mask++){
  if(mask.toString(2).replaceAll('0','').length>3)continue;
  for(const radius of [0,24,41.7])for(let i=0;i<(radius?16:1);i++){
   const angle=i*Math.PI/8,p:[number,number,number]=[Math.sin(angle)*radius,0,Math.cos(angle)*radius],s=battle();s.brokenCrystals=mask;
   for(const step of [1,3]){stage(s,step);lockStarCross(s,p);assert(s.starCross);s.stage='cross';assert(knightDanger(s,{...actor,p},s.since+100),`cross targets mask ${mask}, radius ${radius}, angle ${i}`);
    const escape=crossEscapePoint(s,p);assert(escape,'the unlit sector has a reachable point inside the arena');assert(Math.hypot(escape[0],escape[2])<=40.60001);assert(!knightDanger(s,{...actor,p:escape},s.since+100),'the full body clears both beams and the filled sector');assert(Math.hypot(escape[0]-p[0],escape[2]-p[2])<=3.4*(crossWarningDuration(s,p)/1000-.7),'ordinary walking leaves reaction time, including near broken edge crystals');
   }
   planStarRoute(s,p);
   for(let j=0;j<3;j++){stage(s,5+j*2);lockStarFlight(s,p);const locked=ricochetCurve(s,j,.5);assert(Math.hypot(locked[0]-p[0],locked[2]-p[2])<.00001);s.stage='ricochet';const middle=(s.since+s.until)/2;assert(knightDanger(s,{...actor,p},middle,middle-50),`flight ${j} targets mask ${mask}, radius ${radius}, angle ${i}`);}
   assert.equal(new Set(s.starRoute).size,4,'a stationary player cannot force three identical chords');
  }
 }
});

test('retargeting a curve rebuilds its ribbon even when the endpoint crystals are unchanged',()=>{
 const s=battle(),view=new MetaKnightStarAssaultView();stage(s,5);s.starRoute=[0,4,1,5];s.starAims=[[20,0,12],[20,0,12],[20,0,12]];view.update(s,s.since+400,new T.Vector3());const positions=Array.from(view.routes[0].mesh.geometry.getAttribute('position').array);
 s.starAims[0]=[-20,0,-12];view.update(s,s.since+400,new T.Vector3());assert.notDeepEqual(Array.from(view.routes[0].mesh.geometry.getAttribute('position').array),positions);view.dispose();
});

test('the flying sword follows each curved tangent and turns continuously from conducting into the first warning',()=>{
 const s=battle();s.starRoute=[0,4,1,5];s.starAims=[[30,0,12],[10,0,-20],[-25,0,22]];s.from=crystalPoint(0,STAR_ASSAULT.ricochetRadius,STAR_ASSAULT.hover);lockStarCross(s,[30,0,12]);stage(s,4);const before=starFacing(s,s.until);stage(s,5);const after=starFacing(s,s.since);assert(Math.abs(Math.atan2(Math.sin(after-before),Math.cos(after-before)))<.0001);
 for(let i=0;i<3;i++){stage(s,6+i*2);for(const t of [.1,.3,.5,.7,.9]){const a=ricochetCurve(s,i,t-.001),b=ricochetCurve(s,i,t+.001),yaw=starFacing(s,s.since+t*(s.until-s.since)),length=Math.hypot(b[0]-a[0],b[2]-a[2]);assert((Math.sin(yaw)*(b[0]-a[0])+Math.cos(yaw)*(b[2]-a[2]))/length>.99999);}}
});
test('third phase performs two crystal beams, three aimed curved flights and a centre plunge before shielding',()=>{
 const s=battle();s.players.a.invulnerable=1e12;advanceKnightBattle(s,[actor],2500);
 for(let i=0;i<STAR_SEQUENCE.length;i++){
  assert.equal(s.pattern,'star');assert.equal(s.stage,STAR_SEQUENCE[i][0]);assert.equal(s.step,i);assert.equal(s.until-s.since,STAR_SEQUENCE[i][1]);
  if(i===STAR_SHIELD_STEP)break;const end=knightPosition(s,s.until);advanceKnightBattle(s,[actor],s.until);const start=knightPosition(s,s.since);assert(Math.hypot(...end.map((v,j)=>v-start[j]))<.001,`continuous movement at ${s.stage}`);
 }
 assert(starOpening(s));assert.equal(s.stage,'shield');assert.equal(typeof s.activeCrystal,'number');assert.equal(s.until-s.since,1e12);
});
test('every phase-three warning is safe; beam and curved sweep damage match their marked footprints',()=>{
 const s=battle();for(const step of [1,3,...Array.from({length:STAR_FLIGHTS},(_,i)=>5+i*2),STAR_LANDING_STEP]){stage(s,step);assert(!knightDanger(s,{...actor,p:[0,0,0]},s.until-1));}
 stage(s,2);const [a,b]=crossLine(s),x=(a[0]+b[0])/2,z=(a[2]+b[2])/2;
 for(const height of [0,1.45,2.9,8])assert(knightDanger(s,{...actor,p:[x,height,z]},5100),'crystal beams cannot be jumped');
 for(let i=0;i<STAR_FLIGHTS;i++){stage(s,6+i*2);const p=ricochetCurve(s,i,.5);for(const height of [0,1.45,2.9,8])assert(knightDanger(s,{...actor,p:[p[0],height,p[2]]},s.since+(s.until-s.since)*.55,s.since+(s.until-s.since)*.45),'curved flights cannot be jumped');}
});

test('phase-three marked zones and segmented waves remove a heart at every player height',()=>{
 for(const height of [0,1.45,2.9,8])for(const attack of ['cross','ricochet','landing','wave'] as const){
  const s=battle();let now:number,point:KnightActor['p'];
  if(attack==='cross'){stage(s,2);s.starCross={pairs:[[0,4],[2,6]],side:0};now=s.since+100;point=[12,height,12];}
  else if(attack==='ricochet'){stage(s,6);now=s.since+(s.until-s.since)/2;const p=ricochetCurve(s,0,.5);point=[p[0],height,p[2]];}
  else if(attack==='landing'){stage(s,STAR_SHIELD_STEP);now=s.since;point=[0,height,0];}
  else {stage(s,STAR_SHIELD_STEP);now=s.since+4500;const w=shieldWaves(s,now)[0],angle=w.angle+Math.PI/8;point=[Math.sin(angle)*w.radius,height,Math.cos(angle)*w.radius];}
  s.checked=now-25;const a={...actor,p:point};advanceKnightBattle(s,[a],now);assert.equal(s.players.a.hp,4,`${attack} at height ${height}`);
  advanceKnightBattle(s,[a],now+25);assert.equal(s.players.a.hp,4,'normal hit invulnerability still applies');
 }
});
test('centre landing countdown is continuous and the outer floor no longer has star damage',()=>{
 const s=battle();stage(s,STAR_LANDING_STEP);assert.equal(starImpactProgress(s,s.since),0);const launch=starImpactProgress(s,s.until);stage(s,STAR_FALL_STEP);assert.equal(starImpactProgress(s,s.since),launch);assert.equal(starImpactProgress(s,s.until),1);
 stage(s,STAR_SHIELD_STEP);const since=s.since;assert(knightDanger(s,{...actor,p:[0,0,0]},since,since-25));assert(!knightDanger(s,{...actor,p:[0,0,0]},since+100,since+75));
 for(let i=0;i<24;i++){const a=i*Math.PI/12;assert(!knightDanger(s,{...actor,p:[Math.sin(a)*29,0,Math.cos(a)*29]},since,since-25),'no lingering star rays');}
});
test('all three route timers count to their own launch and future routes never become active early',()=>{
 const s=battle();stage(s,5);assert.equal(ricochetCountdown(s,s.since,0),0);assert.equal(ricochetCountdown(s,s.until,0),1);assert.equal(ricochetCountdown(s,s.until,1),0);assert.equal(ricochetCountdown(s,s.until,2),0);
 for(let index=1;index<STAR_FLIGHTS;index++){stage(s,5+index*2);assert.equal(ricochetCountdown(s,s.until,index),1);}
});
test('four different random crystals, each broken once, drain the last four health and win',()=>{
 const s=battle(),a:KnightActor={...actor,p:[36,0,0]};s.players.a.invulnerable=1e12;advanceKnightBattle(s,[a],2500);const seen=new Set<number>();
 for(let cycle=0;cycle<4;cycle++){
  for(let guard=0;s.stage!=='shield'&&guard<32;guard++)advanceKnightBattle(s,[a],s.until);
  assert.equal(s.stage,'shield');const index=s.activeCrystal!;assert(!seen.has(index));seen.add(index);assert(!crystalBroken(s,index));
  const p=crystalPoint(index),d=Math.hypot(p[0],p[2]);a.p=[p[0]*(d-3)/d,0,p[2]*(d-3)/d];a.yaw=Math.atan2(p[0]-a.p[0],p[2]-a.p[2]);
  const now=s.since+900;assert(knightAttack(s,a,now));advanceKnightBattle(s,[a],now+150);assert.equal(s.hp,3-cycle);assert(crystalBroken(s,index));assert.equal(s.activeCrystal,undefined);
  assert.equal(s.stage,'crystal-break');assert.equal(s.until-s.since,1000);advanceKnightBattle(s,[a],s.until);if(cycle<3){assert.equal(s.stage,'get-up');advanceKnightBattle(s,[a],s.until);assert.equal(s.stage,'star-rise');}else assert.equal(s.stage,'won');
 }
 assert.equal(s.players.a.hits,4);assert.equal(seen.size,4);
});
test('rendered paths reuse geometry and every shown footprint carries the shared countdown',()=>{
 const s=battle(),view=new MetaKnightStarAssaultView();stage(s,5);view.update(s,5400,new T.Vector3(0,8,0));
 const geometry=view.routes[0].mesh.geometry;assert(view.routes[0].mesh.visible);assert(view.routes[0].mesh.material.uniforms.progress.value>0&&view.routes[0].mesh.material.uniforms.progress.value<1);assert(view.routes.slice(1).every(r=>!r.mesh.visible),'future routes must not display a stale aim');
 view.update(s,5500,new T.Vector3(0,8,0));assert.equal(view.routes[0].mesh.geometry,geometry);
 stage(s,STAR_LANDING_STEP);view.update(s,5600,new T.Vector3(0,9,0));const disc=view.group.getObjectByName('Star assault centre impact countdown') as T.Mesh<T.PlaneGeometry,T.ShaderMaterial>;assert(disc.visible);assert.equal(disc.material.uniforms.progress.value,starImpactProgress(s,5600));
 stage(s,STAR_SHIELD_STEP);view.update(s,5250,new T.Vector3());assert(view.shield.group.visible);assert.equal(view.group.getObjectByName('Star assault star countdown 1'),undefined);view.dispose();assert(!view.group.parent);
});

test('shield ignores boss, wrong, distant and spent crystal attacks',()=>{
 const s=battle();stage(s,STAR_SHIELD_STEP);s.activeCrystal=2;s.from=s.to=[0,0,0];s.checked=5000;
 const a:KnightActor={...actor,p:[0,0,3],yaw:Math.PI};knightAttack(s,a,5300);advanceKnightBattle(s,[a],5450);assert.equal(s.hp,4);
 a.p=[0,0,42];a.yaw=0;knightAttack(s,a,6200);advanceKnightBattle(s,[a],6350);assert.equal(s.hp,4,'wrong crystal');
 a.p=[36,0,0];a.yaw=Math.PI/2;knightAttack(s,a,7100);advanceKnightBattle(s,[a],7250);assert.equal(s.hp,4,'outside melee reach');
 a.p=[42,0,0];knightAttack(s,a,8000);advanceKnightBattle(s,[a],8150);assert.equal(s.hp,3);advanceKnightBattle(s,[a],8200);assert.equal(s.hp,3,'a press cannot break twice');
});

test('inward waves launch every three seconds in alternating crystal sectors with swept damage',()=>{
 const s=battle();stage(s,STAR_SHIELD_STEP);const at=s.since;
 assert.equal(shieldWaves(s,at+2999).length,0);assert.equal(shieldWaves(s,at+3000)[0].radius,SHIELD.crystalRadius);assert.equal(shieldWaves(s,at+6000).length,2);
 assert.equal(shieldCountdown(s,at+1500),.5);assert.equal(shieldCountdown(s,at+3000),0);
 const now=at+4500,w=shieldWaves(s,now)[0],r=w.radius,point=(a:number):KnightActor=>({...actor,p:[Math.sin(a)*r,0,Math.cos(a)*r]});
 assert(r<SHIELD.crystalRadius);assert.equal(w.angle%(Math.PI/4),0,'arc endpoints align with neighboring crystals');
 for(let i=0;i<4;i++)for(const height of [0,1.45,2.9,8]){const arc=w.angle+i*Math.PI/2,safe=point(arc+3*Math.PI/8),danger=point(arc+Math.PI/8);safe.p[1]=danger.p[1]=height;assert(!knightDanger(s,safe,now,now-100),'the angular gaps remain safe at every height');assert(knightDanger(s,danger,now,now-100),'segmented waves cannot be jumped');assert(!shieldWaveGap(arc+Math.PI/4+.001,w.angle,r,.65),'the body cannot clip a rounded end');}
 assert(!shieldWaveGap(w.angle+3*Math.PI/8,shieldWaveAngle(s,1),r,.65),'the next wave fills the previous gaps');
 assert(knightDanger(s,point(w.angle+Math.PI/8),now+60,now-60),'swept front cannot skip a player');
 assert.equal(shieldWaves(s,at+6101).length,1,'an absorbed wave is removed');
 const near={...actor,p:[Math.sin(w.angle+Math.PI/8)*11.2,0,Math.cos(w.angle+Math.PI/8)*11.2] as [number,number,number]};
 assert(knightDanger(s,near,at+6150,at+6050),'last swept contact is checked even when a wave reaches the dome between ticks');
 assert(!knightDanger(s,near,at+6300,at+6275),'absorbed waves do not leave invisible damage');
});

test('solid dome blocks walking, rising into the shell and fast crossing, then releases on shatter',()=>{
 const s=battle();stage(s,STAR_SHIELD_STEP);const p:[number,number,number]=[2,0,0];assert(constrainKnightShield(s,p));assert(Math.abs(p[0]-SHIELD.radius-.65)<.001);
 const fast:[number,number,number]=[20,0,0];assert(constrainKnightShield(s,fast,[-20,0,0]));assert(fast[0]<-SHIELD.radius);
 const air:[number,number,number]=[0,4,0];assert(constrainKnightShield(s,air));assert(Math.hypot(air[0],air[2])>9);
 s.stage='crystal-break';assert(!constrainKnightShield(s,[0,0,0]));
});

test('random choice survives snapshots and destroyed crystals never recharge or become flight destinations',()=>{
 const s=battle();stage(s,STAR_SHIELD_STEP);s.brokenCrystals=(1<<0)|(1<<3)|(1<<6);const choices=new Set<number>();
 for(let i=0;i<30;i++){s.id=1000+i;const selected=chooseShieldCrystal(s);assert(!crystalBroken(s,selected));assert.equal(selected,chooseShieldCrystal(structuredClone(s)));choices.add(selected);}
 assert(choices.size>=4);
 for(let step=1;step<STAR_LANDING_STEP;step++){s.step=step;assert(crossPairs(s).flat().every(i=>!crystalBroken(s,i)));for(let j=0;j<starFlightCount(s);j++)assert(!crystalBroken(s,ricochetCrystal(s,j)));}
 const view=new MetaKnightStarAssaultView();s.activeCrystal=2;view.update(s,s.since+1000,new T.Vector3());assert(!view.group.getObjectByName('Star assault crystal 0')!.visible);const gem=view.group.getObjectByName('Star assault crystal 2')! as T.Mesh<T.OctahedronGeometry,T.MeshStandardMaterial>;assert(gem.scale.y>3.2);assert(gem.material.emissiveIntensity>=5);assert(view.group.getObjectByName('Active violet crystal beacon')!.visible);assert(view.group.getObjectByName('Violet crystal drifting mist')!.visible);assert(view.group.getObjectByName('Broken arena crystal rubble')!.visible);s.stage='crystal-break';view.update(s,s.since+1200,new T.Vector3());assert(!view.group.getObjectByName('Active violet crystal beacon')!.visible);view.dispose();
});

test('both crystal lanes cross simultaneously and all three curved flights pass through the locked target',()=>{
 const s=battle();s.cycle=1;s.brokenCrystals=0;
 for(const broken of [0,1,9,73]){s.brokenCrystals=broken;stage(s,2);s.brokenCrystals=broken;const lines=crossLines(s),side=(a:number[],b:number[],p:number[])=>(b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]),[[a,b],[c,d]]=lines;
  assert(side(a,b,c)*side(a,b,d)<0&&side(c,d,a)*side(c,d,b)<0,'the two lanes really intersect');
  for(const [from,to] of lines){const p:KnightActor={...actor,p:[(from[0]+to[0])/2,0,(from[2]+to[2])/2]};assert(knightDanger(s,p,s.since+100));}
  planStarRoute(s,actor.p);for(let i=0;i<STAR_FLIGHTS;i++){const a=ricochetCurve(s,i,0),b=ricochetCurve(s,i,1),p=ricochetCurve(s,i,.5);assert(!crystalBroken(s,s.starRoute![i])&&!crystalBroken(s,ricochetCrystal(s,i)));assert(Math.hypot(b[0]-a[0],b[2]-a[2])>1);assert(Math.hypot(p[0]-actor.p[0],p[2]-actor.p[2])<.001);}
  assert.equal(new Set(s.starRoute).size,4,'three flights visit four distinct crystals');
 }
 const view=new MetaKnightStarAssaultView();stage(s,1);view.update(s,s.since+500,new T.Vector3());assert(view.cross.mesh.visible&&view.cross2.mesh.visible);assert.equal(view.cross.mesh.material.uniforms.progress.value,view.cross2.mesh.material.uniforms.progress.value);view.dispose();
});

test('every cycle performs exactly three flights despite broken crystals, with continuous movement',()=>{
 for(const broken of [0,1,9,73]){const s=battle();s.brokenCrystals=broken;s.players.a.invulnerable=1e12;advanceKnightBattle(s,[actor],2500);const sequence=starSequence(s),visited:number[]=[];
  for(let i=0;i<sequence.length;i++){assert.equal(s.stage,sequence[i][0]);if(s.stage==='ricochet-warn')assert.equal(ricochetCountdown(s,s.until,(i-5)/2),1);if(s.stage==='ricochet')visited.push(ricochetCrystal(s,(i-6)/2));if(s.stage==='shield')break;const end=knightPosition(s,s.until);advanceKnightBattle(s,[actor],s.until);assert(Math.hypot(...knightPosition(s,s.since).map((v,j)=>v-end[j]))<.001);}
  assert.equal(visited.length,3);assert(visited.every(i=>!crystalBroken(s,i)));assert.equal(s.stage,'shield');
  const view=new MetaKnightStarAssaultView();s.step=5;s.stage='ricochet-warn';view.update(s,s.since+200,new T.Vector3());assert.equal(view.routes.filter(r=>r.mesh.visible).length,1);view.dispose();
 }
});

test('rendered inward arcs contract in length with radius and keep both simultaneous waves',()=>{
 const s=battle(),view=new MetaKnightStarAssaultView();stage(s,STAR_SHIELD_STEP);view.update(s,s.since+6000,new T.Vector3());const waves=shieldWaves(s,s.since+6000);
 assert.equal(view.shield.waves.filter(w=>w.body.visible).length,2);assert(view.shield.countdown.geometry.parameters.innerRadius>44);
 const geometry=view.shield.waves[0].body.geometry,p=geometry.getAttribute('position');for(let i=0;i<p.count;i++){const angle=p.getX(i)%(Math.PI/2);assert(angle<Math.PI/4+.0001||angle>Math.PI/2-.0001,'only alternating crystal sectors have geometry');}
 const lengths=waves.map((w,i)=>{assert.equal(view.shield.waves[i].body.material.uniforms.radius.value,w.radius);return w.radius*Math.PI/4;});assert(lengths[0]<lengths[1]);view.update(s,s.since+6300,new T.Vector3());assert.equal(view.shield.waves[0].body.geometry,geometry);assert.equal(view.shield.waves.filter(w=>w.body.visible).length,1);view.dispose();
});

test('the closest chord targets the player and each visible warning remains locked until its flight ends',()=>{
 const distance=(a:number[],b:number[],p:number[])=>{const dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(dx*dx+dz*dz)));return Math.hypot(p[0]-a[0]-dx*t,p[2]-a[2]-dz*t);},point=(i:number)=>crystalPoint(i,STAR_ASSAULT.ricochetRadius);
 for(const mask of [0,9,73])for(const p of [[0,0,0],[20,0,15],[-28,0,10],[0,0,-36]] as [number,number,number][]){const s=battle();s.brokenCrystals=mask;const [a,b]=nearestCrystalChord(s,p),chosen=distance(point(a),point(b),p);for(let i=0;i<8;i++)for(let j=i+1;j<8;j++)if(!crystalBroken(s,i)&&!crystalBroken(s,j))assert(chosen<=distance(point(i),point(j),p)+.001);}
 const s=battle(),a={...actor,p:[22,0,20] as [number,number,number]};s.players.a.invulnerable=1e12;advanceKnightBattle(s,[a],2500);while(s.stage!=='ricochet-warn')advanceKnightBattle(s,[a],s.until);
 const route=structuredClone(s.starRoute),aims=structuredClone(s.starAims),lane=[ricochetCurve(s,0,0),ricochetCurve(s,0,.5),ricochetCurve(s,0,1)];a.p=[-30,0,-16];advanceKnightBattle(s,[a],s.since+500);assert.deepEqual(s.starRoute,route);assert.deepEqual(s.starAims,aims);assert.deepEqual([ricochetCurve(s,0,0),ricochetCurve(s,0,.5),ricochetCurve(s,0,1)],lane);advanceKnightBattle(s,[a],s.until);assert.equal(s.stage,'ricochet');assert.deepEqual(s.starRoute,route);
 advanceKnightBattle(s,[a],s.until);assert.equal(s.stage,'ricochet-warn');assert.deepEqual(s.starAims![1],a.p);assert.deepEqual(s.starRoute!.slice(0,2),route!.slice(0,2));assert(!s.starRoute!.slice(0,2).includes(s.starRoute![2]));assert.deepEqual(ricochetCurve(s,1,.5),ricochetCurve(structuredClone(s),1,.5),'snapshots preserve the exact locked curve');
});

test('second phase uses a complete golden pressure ring with the original jumpable height',()=>{
 const wave=new MetaKnightPressureWave(),geometry=wave.body.geometry,p=geometry.getAttribute('position'),angles=Array.from({length:p.count},(_,i)=>p.getX(i));
 assert(Math.min(...angles)<.001&&Math.max(...angles)>Math.PI*2-.001);assert(angles.some(a=>a>1.7&&a<1.8),'a full ring has no four angular gaps');wave.update(15,1000,.85/SHIELD.waveHeight);assert.equal(wave.body.material.uniforms.gold.value,1);assert.equal(wave.body.material.uniforms.radius.value,15);assert(wave.group.scale.y*3.7<.85);wave.dispose();assert(!wave.group.parent);
});

test('the two opposite filled triangles hurt away from the beams and leave the other two triangles safe',()=>{
 const s=battle();stage(s,2);s.starCross={pairs:[[0,4],[2,6]],side:0};const hit=(p:[number,number,number])=>knightDanger(s,{...actor,p},s.since+100);
 for(const height of [0,1.45,2.9,8]){assert(hit([12,height,12])&&hit([-12,height,-12]),'filled interiors more than 10m from either beam are dangerous at every height');assert(!hit([12,height,-12])&&!hit([-12,height,12]),'opposite unlit triangles are safe at every height');assert(hit([29,height,29]),'danger continues to the rim without pockets beyond crystal chords');assert(!hit([34,height,34]),'the clipped danger stops beyond the floor');}
 assert(hit([1.5,0,-15]),'the visible beam remains dangerous');s.starCross.side=1;assert(!hit([12,0,12])&&hit([12,0,-12]));stage(s,1);assert(!hit([12,0,-12]),'even filled warning zones are safe until their timer finishes');
});

test('crystal crosses aim near the player, exclude broken gems and stay fixed until the next warning',()=>{
 for(const broken of [0,1,9,73])for(const p of [[0,0,0],[30,0,10],[-30,0,-10],[10,0,-28]] as [number,number,number][]){const s=battle();s.brokenCrystals=broken;stage(s,1);lockStarCross(s,p);const lines=crossLines(s),triangles=crossTriangles(s),[[a,b],[c,d]]=lines,side=(a:number[],b:number[],p:number[])=>(b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]);assert(crossPairs(s).flat().every(i=>!crystalBroken(s,i)));assert.equal(new Set(crossPairs(s).flat()).size,4);assert(side(a,b,c)*side(a,b,d)<0&&side(c,d,a)*side(c,d,b)<0);assert.deepEqual(triangles[0][0],triangles[1][0]);assert(crossWarningDuration(s,p)>=3600);}
 const s=battle(),a={...actor,p:[30,0,8] as [number,number,number]};s.players.a.invulnerable=1e12;advanceKnightBattle(s,[a],2500);advanceKnightBattle(s,[a],s.until);assert.equal(s.stage,'cross-warn');const locked=structuredClone(s.starCross);a.p=[-30,0,-8];advanceKnightBattle(s,[a],s.since+1500);assert.deepEqual(s.starCross,locked);advanceKnightBattle(s,[a],s.until);assert.equal(s.stage,'cross');assert.deepEqual(s.starCross,locked);advanceKnightBattle(s,[a],s.until);assert.equal(s.stage,'cross-warn');assert.notDeepEqual(s.starCross,locked);assert.deepEqual(crossTriangles(s),crossTriangles(structuredClone(s)),'snapshots retain the exact pair and danger orientation');
});

test('the warning leaves enough time to walk from targeted danger into a safe part of the arena',()=>{
 for(const mask of [0,1,9,73])for(let i=0;i<20;i++){
  const s=battle(),a=i*Math.PI/10,r=i%2?37:21,p:[number,number,number]=[Math.sin(a)*r,0,Math.cos(a)*r];s.brokenCrystals=mask;stage(s,2);lockStarCross(s,p);const reach=3.4*(crossWarningDuration(s,p)/1000-.5);
  let escape=false;for(let j=0;j<96;j++){const angle=j*Math.PI/48,q:[number,number,number]=[p[0]+Math.sin(angle)*reach,0,p[2]+Math.cos(angle)*reach];if(Math.hypot(q[0],q[2])<=41&&!knightDanger(s,{...actor,p:q},s.since+100)){escape=true;break;}}
  assert(escape,`normal walking has a safe exit for mask ${mask}, position ${i}`);
 }
});

test('the rendered triangle buffers and perimeter timers match shared damage, reuse resources and hide after the strike',()=>{
 const s=battle(),view=new MetaKnightCrossZonesView();stage(s,1);lockStarCross(s,[20,0,10]);view.update(s,s.since+(s.until-s.since)*.5);assert(view.group.visible);const geometry=view.triangles[0].geometry;
 crossTriangles(s).forEach((triangle,i)=>{const mesh=view.triangles[i],p=mesh.geometry.getAttribute('position');triangle.forEach((v,j)=>{assert(Math.abs(p.getX(j)-v[0])<.0001&&Math.abs(p.getZ(j)-v[2])<.0001);});assert.equal(mesh.material.uniforms.progress.value,.5);assert.equal(mesh.material.uniforms.attack.value,0);const boundary=crossBoundaries(s)[i];assert.equal(mesh.material.uniforms.sweep.value,boundary.sweep);assert(Math.abs(Math.hypot(boundary.start[0],boundary.start[2])-46)<.001);assert(Math.abs(Math.hypot(boundary.end[0],boundary.end[2])-46)<.001);});
 lockStarCross(s,[-20,0,-10]);view.update(s,s.until);assert.equal(view.triangles[0].geometry,geometry);stage(s,2);view.update(s,s.since+100);assert(view.triangles.every(m=>m.material.uniforms.attack.value===1&&m.material.uniforms.progress.value===1));stage(s,5);view.update(s,s.since);assert(!view.group.visible);view.dispose();
});
