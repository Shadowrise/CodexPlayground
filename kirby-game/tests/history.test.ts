import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {adminToken,validAdminToken,samePassword,adminCookie} from '../../game-server/src/admin-auth';
import {initHistory,historyPage,writeVisits,soloVisit,type Visit} from '../../game-server/src/history-store';
import {deviceInfo,validSoloReport} from '../src/history-types';
import {newVisitProgress} from '../src/visit-stats';

test('device families distinguish phone, tablet, desktop and selected controls',()=>{
 assert.equal(deviceInfo('Mozilla iPhone Safari/600',5).os,'iOS / iPadOS');assert.equal(deviceInfo('Mozilla Android Mobile Chrome/130',5).type,'phone');
 assert.equal(deviceInfo('Mozilla Macintosh Safari/600',5).type,'tablet');assert.equal(deviceInfo('Mozilla Android Chrome/130',5).type,'tablet');
 assert.equal(deviceInfo('Windows Chrome/130 Edg/130',0,1920,1080,'gamepad').browser,'Edge');assert.equal(deviceInfo('Linux Firefox/130',0).type,'computer');
 assert.equal(deviceInfo('iPhone CriOS/130 Safari/600',5).browser,'Chrome');assert.equal(deviceInfo('Macintosh Safari/600',0).os,'macOS');
});

test('history migrates existing rows without inventing counters and preserves the newest stats',()=>{
 const db=new DatabaseSync(':memory:');const sql={exec:(query:string,...args:(string|number|null)[])=>{const rows=db.prepare(query).all(...args);return {toArray:()=>rows};}};
 try{
  initHistory(sql);const now=Date.now(),payload={id:crypto.randomUUID(),seq:0,name:'Архив',variant:0,startedAt:now-10000,activeMs:1000,startScore:4,score:4,tasksDone:0,tasksTotal:13,end:false,device:deviceInfo('Windows')};
  const old=soloVisit(payload,now);writeVisits(sql,[old]);db.exec('ALTER TABLE visits DROP COLUMN stats');
  initHistory(sql);initHistory(sql);
  assert.equal(historyPage(sql,{}).rows[0].stats,null);assert.equal(historyPage(sql,{}).rows[0].score,4);
  const stats={...newVisitProgress().stats,seals:2,feathers:4,knightStarted:3,knightWon:1,pidgeyStarted:2,pidgeyWon:1};
  const report={...payload,id:crypto.randomUUID(),stats};assert(validSoloReport(report));
  for(const invalid of [{...stats,knightWon:4},{...stats,feathers:-1},{...stats,seals:4},null,{}])assert(!validSoloReport({...report,stats:invalid}));
  const visit=soloVisit(report,now);writeVisits(sql,[visit]);
  writeVisits(sql,[{...visit,seq:2,endedAt:now+100,status:'left',stats:{...stats,pidgeyWon:2}}]);
  writeVisits(sql,[{...visit,seq:1,stats:newVisitProgress().stats},{...visit,seq:3,stats:newVisitProgress().stats}]);
  const row=historyPage(sql,{}).rows.find(row=>row.id===visit.id)!;
  assert.deepEqual(row.stats,{...stats,pidgeyWon:2});assert.equal(row.status,'left');
 }finally{db.close();}
});
test('admin session expires, rejects tampering and changes when password is rotated',async()=>{
 const now=100000,token=await adminToken('test-only-password',now);
 assert(await validAdminToken(token,'test-only-password',now+1000));assert(!await validAdminToken(token,'different-password',now));
 assert(!await validAdminToken(token+'0','test-only-password',now));assert(!await validAdminToken(token,'test-only-password',now+12*3600000));
 assert(await samePassword('abc','abc'));assert(!await samePassword('abc','abcd'));assert(!await validAdminToken(token,'',now));
 assert.match(adminCookie(token,true),/HttpOnly; SameSite=Strict/);assert.match(adminCookie(token,true),/; Secure/);
});
test('history SQL retains closed visits, rejects stale checkpoints and paginates all rows without duplication',()=>{
 const db=new DatabaseSync(':memory:');const sql={exec:(query:string,...args:(string|number|null)[])=>{const rows=db.prepare(query).all(...args);return {toArray:()=>rows};}};
 try{
  initHistory(sql);const now=Date.now();
  const payload={id:crypto.randomUUID(),seq:0,name:'Тест',variant:0,startedAt:now-60000,activeMs:10000,startScore:8,score:11,tasksDone:2,tasksTotal:13,end:false,device:deviceInfo('Windows Chrome/130')};assert(validSoloReport(payload));
  assert(!validSoloReport({...payload,tasksDone:14}));assert(!validSoloReport({...payload,score:Infinity}));
  const visit=soloVisit(payload,now);writeVisits(sql,[visit]);
  writeVisits(sql,[{...visit,seq:2,activeMs:25000,score:17,tasksDone:4,lastSeen:now+15000,endedAt:now+15000,status:'left'}]);
  writeVisits(sql,[{...visit,seq:1},{...visit,seq:3,score:0}]);
  let rows=historyPage(sql,{name:'  ТЕСТ '}).rows;assert.equal(rows.length,1);assert.equal(rows[0].score,17);assert.equal(rows[0].tasks_done,4);assert.equal(rows[0].start_score,8);assert.equal(rows[0].active_ms,25000);assert.equal(rows[0].status,'left');
  for(let i=0;i<57;i++)writeVisits(sql,[{...visit,id:'visit-'+String(i).padStart(3,'0'),mode:'online',name:'Другой',roomId:'room',startedAt:now-100+i,status:'finished',endedAt:now,completed:true,place:2} as Visit]);
  const page1=historyPage(sql,{mode:'online'});assert.equal(page1.rows.length,50);assert(page1.next);
  const page2=historyPage(sql,{mode:'online',cursor:page1.next as {time:number;id:string}});assert.equal(page2.rows.length,7);assert.equal(page2.next,null);
  assert.equal(new Set([...page1.rows,...page2.rows].map(r=>r.id)).size,57);
  assert.equal(historyPage(sql,{name:"' OR 1=1 --"}).rows.length,0);
  assert.equal(historyPage(sql,{from:now+1}).rows.length,0);
 }finally{db.close();}
});
