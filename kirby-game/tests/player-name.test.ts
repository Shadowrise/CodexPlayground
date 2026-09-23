import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlayerName,readPlayerName,rememberPlayerName,PLAYER_NAME_KEY} from '../src/player-name';
test('name is required after whitespace and invisible characters are removed',()=>{
 for(const name of ['', '   ', '\t\n', '\u200b\u200f'])assert.equal(normalizePlayerName(name),'');
 assert.equal(normalizePlayerName('  Маша   Кирби  '),'Маша Кирби');assert.equal(normalizePlayerName('a'.repeat(40)).length,24);
});
test('valid name persists between sessions while empty input cannot replace it',()=>{
 const data=new Map<string,string>(),storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};
 assert.equal(readPlayerName(storage),'');assert(rememberPlayerName(storage,' Кирби '));assert.equal(data.get(PLAYER_NAME_KEY),'Кирби');assert.equal(readPlayerName(storage),'Кирби');
 assert(!rememberPlayerName(storage,'  '));assert.equal(readPlayerName(storage),'Кирби');
 assert.equal(readPlayerName({getItem(){throw Error();}}),'');assert(!rememberPlayerName({setItem(){throw Error();}},'Кирби'));
});
