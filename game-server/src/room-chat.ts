import type {LogEntry} from '../../kirby-game/src/world-log';

type ChatSql={exec(query:string,...bindings:(string|number|null)[]):{toArray():Record<string,unknown>[]}};
export type RoomChatEntry=LogEntry&{seq:number;at:number};
export type ChatCursor={after?:number;before?:number};
const PAGE_SIZE=100;

export function initRoomChat(sql:ChatSql,recent:LogEntry[]=[]){
 sql.exec('CREATE TABLE IF NOT EXISTS room_chat (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, at INTEGER NOT NULL, entry TEXT NOT NULL)');
 // Retain the recent snapshot when upgrading an already occupied room.
 for(const entry of recent)writeRoomChat(sql,entry);
}
export function writeRoomChat(sql:ChatSql,entry:LogEntry){
 sql.exec('INSERT OR IGNORE INTO room_chat (id,at,entry) VALUES (?,?,?)',entry.id,Date.now(),JSON.stringify(entry));
}
export function roomChatPage(sql:ChatSql,cursor:ChatCursor={}){
 const forward=cursor.after!==undefined,where=forward?'WHERE seq > ?':cursor.before!==undefined?'WHERE seq < ?':'';
 const bindings=forward?[cursor.after!]:cursor.before!==undefined?[cursor.before]:[];
 const rows=sql.exec(`SELECT seq,at,entry FROM room_chat ${where} ORDER BY seq ${forward?'ASC':'DESC'} LIMIT ?`,...bindings,PAGE_SIZE+1).toArray();
 const more=rows.length>PAGE_SIZE,entries=rows.slice(0,PAGE_SIZE).map(row=>({...JSON.parse(row.entry as string),seq:Number(row.seq),at:Number(row.at)} as RoomChatEntry));
 if(!forward)entries.reverse();
 return {entries,more};
}
