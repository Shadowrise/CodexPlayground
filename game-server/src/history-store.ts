import {normalizePlayerName,playerNameKey} from '../../kirby-game/src/player-name';
import {sanitizeDevice,type DeviceInfo,type SoloReport} from '../../kirby-game/src/history-types';
export type Visit={id:string;mode:'solo'|'online';roomId:string|null;playerId:string|null;name:string;variant:number;startedAt:number;lastSeen:number;endedAt:number|null;activeMs:number;startScore:number;score:number;tasksDone:number;tasksTotal:number;status:'playing'|'left'|'lost'|'finished';completed:boolean;place:number|null;device:DeviceInfo;seq:number};
export type HistoryFilter={name?:string;mode?:string;from?:number;to?:number;cursor?:{time:number;id:string}};
type HistorySql={exec(query:string,...bindings:(string|number|null)[]):{toArray():Record<string,unknown>[]}};
type HistoryRow=Record<string,unknown>&{device:DeviceInfo;status:string};
export function initHistory(sql:HistorySql){
 sql.exec(`CREATE TABLE IF NOT EXISTS visits (
 id TEXT PRIMARY KEY, mode TEXT NOT NULL, room_id TEXT, player_id TEXT,
 name TEXT NOT NULL,name_key TEXT NOT NULL,variant INTEGER NOT NULL,
 started_at INTEGER NOT NULL,last_seen INTEGER NOT NULL,ended_at INTEGER,
 active_ms INTEGER NOT NULL,start_score INTEGER NOT NULL,score INTEGER NOT NULL,
 tasks_done INTEGER NOT NULL,tasks_total INTEGER NOT NULL,status TEXT NOT NULL,
 completed INTEGER NOT NULL,place INTEGER,device TEXT NOT NULL,seq INTEGER NOT NULL
 )`);
 sql.exec('CREATE INDEX IF NOT EXISTS visits_time ON visits(started_at DESC,id DESC)');
 sql.exec('CREATE INDEX IF NOT EXISTS visits_name_time ON visits(name_key,started_at DESC,id DESC)');
 sql.exec('CREATE INDEX IF NOT EXISTS visits_mode_time ON visits(mode,started_at DESC,id DESC)');
}
export function soloVisit(a:SoloReport,now=Date.now()):Visit{
 return {...a,id:'solo:'+a.id,mode:'solo',roomId:null,playerId:null,name:normalizePlayerName(a.name),lastSeen:now,endedAt:a.end?now:null,status:a.end?'left':'playing',completed:false,place:null,device:sanitizeDevice(a.device)};
}
export function writeVisits(sql:HistorySql,visits:Visit[]){
 for(const v of visits.slice(0,20))sql.exec(`INSERT INTO visits VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
 ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen,ended_at=excluded.ended_at,
 active_ms=MAX(visits.active_ms,excluded.active_ms),score=excluded.score,tasks_done=excluded.tasks_done,tasks_total=excluded.tasks_total,
 status=excluded.status,completed=excluded.completed,place=excluded.place,device=excluded.device,seq=excluded.seq
 WHERE excluded.seq>visits.seq AND visits.ended_at IS NULL`,
 v.id,v.mode,v.roomId,v.playerId,v.name,playerNameKey(v.name),v.variant,v.startedAt,v.lastSeen,v.endedAt,Math.round(v.activeMs),v.startScore,v.score,v.tasksDone,v.tasksTotal,v.status,Number(v.completed),v.place,JSON.stringify(v.device),v.seq);
}
export function historyPage(sql:HistorySql,f:HistoryFilter){
 const where:string[]=[],args:(number|string)[]=[];
 if(f.name){where.push('name_key = ?');args.push(playerNameKey(f.name));}
 if(f.mode==='solo'||f.mode==='online'){where.push('mode = ?');args.push(f.mode);}
 if(Number.isFinite(f.from)){where.push('started_at >= ?');args.push(f.from!);}
 if(Number.isFinite(f.to)){where.push('started_at < ?');args.push(f.to!);}
 if(f.cursor){where.push('(started_at,id) < (?,?)');args.push(f.cursor.time,f.cursor.id);}
 const rows=sql.exec(`SELECT * FROM visits ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY started_at DESC,id DESC LIMIT 51`,...args).toArray();
 const more=rows.length>50;rows.length=Math.min(50,rows.length);
 return {rows:rows.map((r):HistoryRow=>({...r,device:JSON.parse(String(r.device)),status:r.status==='playing'&&Date.now()-Number(r.last_seen)>150000?'lost':String(r.status)})),next:more?{time:rows.at(-1)!.started_at,id:rows.at(-1)!.id}:null};
}
