import {createRequire} from 'node:module';
const clientRequire=createRequire(new URL('../../kirby-game/package.json',import.meta.url));clientRequire('tsx/cjs');
const {centipedeTarget,centipedeWheel,CENTIPEDE_TIMES,CENTIPEDE_STEP}=clientRequire('./src/centipede-event.ts');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
/** Complete the real, server-authoritative task rather than forge its achievement. */
export async function finishCentipede(client,baseActor){
 const trail=Array.from({length:12},(_,i)=>{const angle=(i-11)*CENTIPEDE_STEP/21;return [140+Math.sin(angle)*21,-45+Math.cos(angle)*21];});
 const actor={...baseActor,p:[143,0,-24],q:[0,0,0,1]},send=events=>client.socket.send(JSON.stringify({type:'frame',actor,events}));
 send([{type:'centipede-start',trail}]);let q=(await client.wait(m=>m.type==='room'&&m.room.centipede?.stage==='invite')).room.centipede;
 async function advance(){
  const old=q.stage;
  await pause(Math.max(0,q.stageAt+CENTIPEDE_TIMES[q.stage]+50-Date.now()));send([{type:'centipede-step'}]);
  q=(await client.wait(m=>m.type==='room'&&m.room.centipede?.startedAt===q.startedAt&&m.room.centipede.stage!==old)).room.centipede;
 }
 for(let hit=0;hit<9;hit++){
  actor.p=[140,5,-45];actor.state='Idle';send([]);
  while(!['exhausted','back','dizzy'].includes(q.stage))await advance();
  const target=centipedeTarget(q),wheel=centipedeWheel(q,Date.now());actor.p=[target[0],q.stage==='back'?2.9:0,target[2]+(q.stage==='dizzy'?0:1)];
  const yaw=q.stage==='dizzy'?Math.atan2(wheel.x-actor.p[0],wheel.z-actor.p[2]):Math.PI;actor.q=[0,Math.sin(yaw/2),0,Math.cos(yaw/2)];actor.state=q.stage==='back'?'Jump':'Push';send([{type:'hit'}]);
  q=(await client.wait(m=>m.type==='room'&&m.room.centipede?.startedAt===q.startedAt&&m.room.centipede.hits===hit+1)).room.centipede;
 }
 actor.p=[140,5,-45];actor.state='Idle';send([]);while(q.stage!=='celebrate')await advance();
 return client.wait(m=>m.type==='centipede-progress'&&m.completed);
}
