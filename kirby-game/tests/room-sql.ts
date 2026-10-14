import {DatabaseSync} from 'node:sqlite';

// Exercise the room's actual SQL against SQLite; clear() models deleteAll().
export function roomSql(){
 const db=new DatabaseSync(':memory:');
 return {
  exec(query:string,...bindings:(string|number|null)[]){const rows=db.prepare(query).all(...bindings);return {toArray:()=>rows};},
  clear(){db.exec('DROP TABLE IF EXISTS room_chat');},
  close(){db.close();}
 };
}
