import assert from 'node:assert/strict';
export const pause=ms=>new Promise(r=>setTimeout(r,ms));
export async function finishMill(client,baseActor){
 const send=(p,events=[],extra={})=>client.socket.send(JSON.stringify({type:'frame',actor:{...baseActor,p,...extra},events}));
 send([49,0,40.5],[{type:'mill',action:{kind:'start'}}]);
 await client.wait(m=>m.type==='room'&&m.room.millQuest?.stage==='clear');
 for(let i=0;i<3;i++){await pause(130);send([42.8,0,34.5+i*3],[{type:'hit'}]);await client.wait(m=>m.type==='room'&&m.room.millQuest?.branches[i]>0);}
 send([49,0,40.5],[{type:'mill',action:{kind:'gate'}}]);await client.wait(m=>m.type==='room'&&m.room.millQuest?.gate===2);
 send([49,0,40.5],[{type:'mill',action:{kind:'gate'}}]);await client.wait(m=>m.type==='room'&&m.room.millQuest?.gate===1);
 await pause(3100);send([49,0,40.5]);
 const q=(await client.wait(m=>m.type==='room'&&m.room.millQuest?.stage==='bags')).room.millQuest;
 const positions=[[68,0,54],[53,0,65],[76,0,69]];
 const wrong=(q.order[0]+1)%3;send(positions[wrong],[{type:'mill',action:{kind:'pick',index:wrong}}]);await client.wait(m=>m.type==='room'&&m.room.millQuest?.carried===wrong);
 send([56.5,0,39],[{type:'mill',action:{kind:'deliver'}}]);const rejected=await client.wait(m=>m.type==='room'&&m.room.millQuest?.rejected===wrong);assert.equal(rejected.room.millQuest.delivered,0);assert.equal(rejected.room.millQuest.stage,'bags');
 await pause(1250);
 for(let i=0;i<3;i++){const index=q.order[i];send(positions[index],[{type:'mill',action:{kind:'pick',index}}]);await client.wait(m=>m.type==='room'&&m.room.millQuest?.carried===index&&m.room.millQuest.delivered===i);send([56.5,0,39],[{type:'mill',action:{kind:'deliver'}}]);await client.wait(m=>m.type==='room'&&m.room.millQuest?.delivered===i+1);}
 const done=(await client.wait(m=>m.type==='room'&&m.room.millQuest?.stage==='running')).room.millQuest;assert.equal(done.runningUntil-done.updatedAt,60000);
}
