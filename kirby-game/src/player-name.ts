export const PLAYER_NAME_KEY='kirby.player-name';
export function normalizePlayerName(value:string){return value.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g,'').trim().replace(/\s+/g,' ').slice(0,24).trim();}
export function playerNameKey(value:string){return normalizePlayerName(value.normalize('NFKC')).toLowerCase();}
export function readPlayerName(storage:{getItem(key:string):string|null}){try{return normalizePlayerName(storage.getItem(PLAYER_NAME_KEY)??'');}catch{return '';}}
export function rememberPlayerName(storage:{setItem(key:string,value:string):void},value:string){const name=normalizePlayerName(value);if(!name)return false;try{storage.setItem(PLAYER_NAME_KEY,name);return true;}catch{return false;}}
