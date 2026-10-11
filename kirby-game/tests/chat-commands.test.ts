import assert from 'node:assert/strict';
import {test} from 'node:test';
import {commandSuggestions,parseChatCommand,TELE_ALIASES} from '../src/chat-commands';
import {setLocale} from '../src/i18n';
import type {Destination} from '../src/navigation';

const places:Destination[]=[
 {id:'maze',name:'Радужный лабиринт',x:80,z:-40},
 {id:'boss-arena',name:'Арена Топотушки',x:0,z:120},
 ...Object.keys(TELE_ALIASES).filter(id=>id!=='maze'&&id!=='boss-arena').map(id=>({id,name:id,x:5,z:6})),
];
test('size parses full numbers within 30–1000%, never partial or non-finite values',()=>{
 for(const [input,size] of [['/size 30',.3],['/size 1000',10],[' /SIZE   125 ',1.25],['/size 30.5',.305],['/size 30,5',.305]] as const){
  assert.deepEqual(parseChatCommand(input,true,places),{command:{kind:'size',size}});
 }
 for(const argument of ['', '29.999','1000.1','-30','0','NaN','Infinity','1e2','100abc','100 200']){
  assert(parseChatCommand('/size '+argument,true,places)?.error,argument);
 }
});
test('single-player gating covers every command and ordinary chat is preserved',()=>{
 assert.equal(parseChatCommand('Hello /size 1000',false,places),undefined);
 for(const input of ['/size 1000','/tele mz','/unlock bandana','/']){
  assert(parseChatCommand(input,false,places)?.error);assert.deepEqual(commandSuggestions(input,false,places),[]);
 }
 assert(parseChatCommand('/other',true,places)?.error);
});
test('every destination has a unique Latin alias and teleports use original coordinates',()=>{
 const aliases=Object.values(TELE_ALIASES);assert.equal(aliases.length,new Set(aliases).size);
 assert(aliases.every(a=>/^[a-z]+$/.test(a)));
 for(const destination of places){assert.deepEqual(parseChatCommand(`/tele ${TELE_ALIASES[destination.id].toUpperCase()}`,true,places),{command:{kind:'tele',destination}});}
 assert(parseChatCommand('/tele mz garbage',true,places)?.error);
 assert(parseChatCommand('/tele nowhere',true,places)?.error);
 assert(parseChatCommand('/tele mz',true,[])?.error);
});
test('suggestions complete command names, filter tele prefixes and localize without altering aliases',()=>{
 setLocale('ru');assert.deepEqual(commandSuggestions('/',true,places).map(s=>s.value),['/size ','/tele ','/unlock ']);
 assert.deepEqual(commandSuggestions('/si',true,places).map(s=>s.value),['/size ']);
 assert.deepEqual(commandSuggestions('/size 100',true,places),[]);
 assert.equal(commandSuggestions('/tele',true,places).length,places.length);
 assert.deepEqual(commandSuggestions('/tele M',true,places).map(s=>s.label),['mz','ml']);
 for(const locale of ['ru','en','bg'] as const){
  setLocale(locale);const option=commandSuggestions('/tele mz',true,places)[0];
  assert.equal(option.value,'/tele mz');assert.equal(option.label,'mz');assert(option.complete);
  if(locale==='ru')assert.equal(option.description,'Радужный лабиринт');else assert.notEqual(option.description,'Радужный лабиринт');
 }
 setLocale('ru');
});

test('unlock accepts the complete English name and suggests it in every language',()=>{
 for(const text of ['/unlock bandana',' /UNLOCK   BANDANA '])assert.deepEqual(parseChatCommand(text,true,places),{command:{kind:'unlock',character:'bandana'}});
 for(const text of ['/unlock','/unlock ban','/unlock бандана','/unlock bandana extra','/unlock other'])assert(parseChatCommand(text,true,places)?.error,text);
 assert.deepEqual(commandSuggestions('/un',true,places).map(s=>s.value),['/unlock ']);
 assert.deepEqual(commandSuggestions('/unlock other',true,places),[]);
 for(const locale of ['ru','en','bg'] as const){
  setLocale(locale);
  for(const text of ['/unlock','/unlock ','/unlock BAN']){
   const [option]=commandSuggestions(text,true,places);assert.equal(option.value,'/unlock bandana');assert.equal(option.label,'bandana');assert(option.complete);
   assert.equal(option.description,locale==='en'?'Bandana':'Бандана');
  }
 }
 setLocale('ru');
});
