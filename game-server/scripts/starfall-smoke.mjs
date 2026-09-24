import assert from 'node:assert/strict';
const base=process.env.SERVER_URL||'http://127.0.0.1:8787';
const clients=[];const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function join(variant){const socket=new WebSocket(base.replace('http','ws')+'/ws?build=meadow-network-3&variant='+variant),messages=[];socket.onmessage=e=>{if(e.data!=='pong')messages.push(JSON.parse(e.data));};await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});const wait=async predicate=>{for(let i=0;i<100;i++){const found=messages.find(predicate);if(found)return found;await pause(30);}throw Error('No message');};const welcome=await wait(m=>m.type==='welcome');const client={socket,messages,wait,welcome};clients.push(client);return client;}
const actor={p:[0,0,0],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:'Финал',variant:0,star:0};
try{
 const a=await join(0),b=await join(1);b.socket.send(JSON.stringify({type:'frame',actor:{...actor,name:'Друг',variant:1}}));await pause(100);
 a.socket.send(JSON.stringify({type:'frame',actor:{...actor,achievements:['mill','sleep','coaster','bench','balloon','treehouse','swing','leaves','trampoline','star','swim','firefly']}}));
 const f=(await b.wait(m=>m.type==='room'&&m.room.festival)).room.festival;assert.equal(Object.keys(f.players).length,2);
 const c=await join(2);assert.equal(c.welcome.room.festival.startsAt,f.startsAt);a.socket.close();await b.wait(m=>m.type==='room'&&m.room.host!==a.welcome.playerId);
 await pause(Math.max(0,f.startsAt+3200-Date.now()));b.socket.send(JSON.stringify({type:'frame',events:[{type:'festival-star',index:0},{type:'festival-star',index:0}]}));
 const awarded=(await b.wait(m=>m.type==='room'&&m.room.festival?.players[b.welcome.playerId]?.bonus===1)).room.festival;assert.equal(awarded.players[b.welcome.playerId].collected.length,1);
 console.log('PASS live countdown, late join, host departure, personal reward and duplicate rejection');
}finally{for(const c of clients)c.socket.close();}
