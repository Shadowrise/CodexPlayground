import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initRoomChat,writeRoomChat,roomChatPage} from '../../game-server/src/room-chat';
import {roomSql} from './room-sql';

test('room chat preserves every entry with stable pagination, live cursors and hibernation seeding',()=>{
 const sql=roomSql(),entry=(i:number)=>({id:'entry-'+i,name:i%2?'Игрок':'Ветерок',variant:i%2?0:-1,text:'Сообщение '+i,chat:true});
 try{
  initRoomChat(sql);
  for(let i=0;i<235;i++)writeRoomChat(sql,entry(i));
  initRoomChat(sql,Array.from({length:10},(_,i)=>entry(225+i)));
  const latest=roomChatPage(sql);assert.equal(latest.entries.length,100);assert.equal(latest.entries[0].text,'Сообщение 135');assert(latest.more);
  const middle=roomChatPage(sql,{before:latest.entries[0].seq});assert.equal(middle.entries.length,100);assert(middle.more);
  const first=roomChatPage(sql,{before:middle.entries[0].seq});assert.equal(first.entries.length,35);assert.equal(first.more,false);
  const all=[...first.entries,...middle.entries,...latest.entries];assert.equal(new Set(all.map(e=>e.id)).size,235);assert(all.every((e,i)=>e.text==='Сообщение '+i));
  assert(all.every(e=>Number.isFinite(e.at)));
  writeRoomChat(sql,entry(235));writeRoomChat(sql,entry(236));
  const live=roomChatPage(sql,{after:latest.entries.at(-1)!.seq});assert.deepEqual(live.entries.map(e=>e.text),['Сообщение 235','Сообщение 236']);assert.equal(live.more,false);
  assert.equal(roomChatPage(sql,{after:0}).more,true);
  sql.clear();initRoomChat(sql);assert.deepEqual(roomChatPage(sql).entries,[]);
 }finally{sql.close();}
});
