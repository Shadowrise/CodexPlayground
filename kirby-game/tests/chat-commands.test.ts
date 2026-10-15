import assert from 'node:assert/strict';
import {test} from 'node:test';
import {commandSuggestions,parseChatCommand,TELE_ALIASES} from '../src/chat-commands';
import {setLocale,t} from '../src/i18n';
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
 for(const input of ['/size 1000','/tele mz','/unlock bandana','/unlock pidgie','/unlock meta-knight','/time 12','/']){
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
 setLocale('ru');assert.deepEqual(commandSuggestions('/',true,places).map(s=>s.value),['/size ','/tele ','/unlock ','/time ']);
 assert.deepEqual(commandSuggestions('/si',true,places).map(s=>s.value),['/size ']);
 assert.deepEqual(commandSuggestions('/size 100',true,places),[]);
 assert.equal(commandSuggestions('/tele',true,places).length,places.length);
 assert.deepEqual(commandSuggestions('/tele M',true,places).map(s=>s.label),['mz','mk','ml']);
 for(const locale of ['ru','en','bg'] as const){
  setLocale(locale);const option=commandSuggestions('/tele mz',true,places)[0];
  assert.equal(option.value,'/tele mz');assert.equal(option.label,'mz');assert(option.complete);
  if(locale==='ru')assert.equal(option.description,'Радужный лабиринт');else assert.notEqual(option.description,'Радужный лабиринт');
 }
 setLocale('ru');
});

test('time accepts every whole hour from 0 through 23 and rejects malformed or out-of-range arguments',()=>{
 for(let hour=0;hour<24;hour++)assert.deepEqual(parseChatCommand(`/time ${hour}`,true,places),{command:{kind:'time',hour}});
 assert.deepEqual(parseChatCommand(' /TIME   07 ',true,places),{command:{kind:'time',hour:7}});
 for(const argument of ['', '-1','24','100','12.5','12,5','12.0','+12','1e1','0xC','NaN','Infinity','12abc','12 13','12:00']){
  const result=parseChatCommand('/time '+argument,true,places);
  assert(result?.error,argument);assert.match(result.error,/\/time/);
 }
 assert.match(parseChatCommand('/other',true,places)!.error!,/\/time/);
});

test('time suggestions and validation messages are localized while the command stays unchanged',()=>{
 for(const locale of ['ru','en','bg'] as const){
  setLocale(locale);
  const [option]=commandSuggestions('/ti',true,places);
  assert.equal(option.value,'/time ');assert.equal(option.label,'/time');assert.equal(option.complete,false);
  assert.match(option.description,/0–23/);
  const error=parseChatCommand('/time 24',true,places)!.error!;
  assert.match(t(error),/\/time 12/);
  if(locale!=='ru'){assert.notEqual(option.description,'Установить час в игре: 0–23');assert.notEqual(t(error),error);}
 }
 assert.deepEqual(commandSuggestions('/time 12',true,places),[]);
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

test('Pidgie unlock requires its complete Latin name; partial names remain suggestions and errors explain both targets',()=>{
 for(const text of ['/unlock pidgie',' /UNLOCK   PIDGIE '])assert.deepEqual(parseChatCommand(text,true,places),{command:{kind:'unlock',character:'pidgie'}});
 for(const text of ['/unlock pi','/unlock pid','/unlock pidg','/unlock пиджи','/unlock pidgie extra']){
  const result=parseChatCommand(text,true,places);assert(result?.error,text);
  assert.match(result.error,/\/unlock bandana/);assert.match(result.error,/\/unlock pidgie/);
 }
 assert.deepEqual(commandSuggestions('/unlock ',true,places).map(s=>s.value),['/unlock bandana','/unlock pidgie','/unlock meta-knight']);
 for(const locale of ['ru','en','bg'] as const){
  setLocale(locale);
  for(const prefix of ['p','PI','pidg','pidgie']){
   const options=commandSuggestions('/unlock '+prefix,true,places);assert.equal(options.length,1);
   assert.equal(options[0].value,'/unlock pidgie');assert.equal(options[0].label,'pidgie');assert(options[0].complete);
   assert.equal(options[0].description,locale==='en'?'Pidgie':'Пиджи');
  }
  const error=parseChatCommand('/unlock',true,places)!.error!;
  assert.match(t(error),/\/unlock bandana/);assert.match(t(error),/\/unlock pidgie/);
 }
 setLocale('ru');
});

test('Meta Knight unlock requires its complete alias and offers localized menu suggestions',()=>{
 for(const text of ['/unlock meta-knight',' /UNLOCK   META-KNIGHT '])assert.deepEqual(parseChatCommand(text,true,places),{command:{kind:'unlock',character:'meta-knight'}});
 for(const text of ['/unlock meta','/unlock meta knight','/unlock мета-найт','/unlock meta-knight extra']){
  const result=parseChatCommand(text,true,places);assert(result?.error,text);assert.match(result.error,/\/unlock meta-knight/);
 }
 try{
  for(const locale of ['ru','en','bg'] as const){
   setLocale(locale);
   for(const prefix of ['m','META','meta-','meta-knight'])assert.deepEqual(commandSuggestions('/unlock '+prefix,true,places),[{
    value:'/unlock meta-knight',label:'meta-knight',description:'Meta Knight',complete:true,
   }]);
   const error=parseChatCommand('/unlock',true,places)!.error!;
   assert.match(t(error),/\/unlock meta-knight/);
   if(locale!=='ru')assert.notEqual(t(error),error);
  }
 }finally{setLocale('ru');}
});
