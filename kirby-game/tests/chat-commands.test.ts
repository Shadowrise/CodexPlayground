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

test('phase and godmode require both solo play and a current duel; godmode has no space or arguments',()=>{
 for(const phase of [1,2,3,4] as const)assert.deepEqual(parseChatCommand(`/phase ${phase}`,true,places,true),{command:{kind:'phase',phase}});
 assert.deepEqual(parseChatCommand(' /GODMODE ',true,places,true),{command:{kind:'godmode'}});
 for(const text of ['/phase 1','/phase 2','/phase 3','/phase 4','/godmode']){
  assert(parseChatCommand(text,true,places,false)?.error,text);
  assert(parseChatCommand(text,false,places,true)?.error,text);
  assert.deepEqual(commandSuggestions(text,false,places,true),[]);
 }
 for(const text of ['/phase','/phase 0','/phase 5','/phase 01','/phase 1.0','/phase 2 extra','/god mode','/godmode 1','/godmode on'])assert(parseChatCommand(text,true,places,true)?.error,text);
 assert.deepEqual(commandSuggestions('/ph',true,places,false),[]);
 assert.deepEqual(commandSuggestions('/god',true,places,false),[]);
 assert.deepEqual(commandSuggestions('/',true,places,true).slice(-2).map(s=>s.value),['/phase ','/godmode']);
 assert.deepEqual(commandSuggestions('/phase ',true,places,true).map(s=>s.value),['/phase 1','/phase 2','/phase 3','/phase 4','/phase 4-1','/phase 4-2','/phase 4-3']);
 for(const locale of ['ru','en','bg'] as const){
  setLocale(locale);assert.equal(commandSuggestions('/phase 2',true,places,true)[0].description,locale==='en'?'Phase 2':'Фаза 2');
  const option=commandSuggestions('/godmode',true,places,true)[0];assert.equal(option.value,'/godmode');assert(option.complete);
  const error=parseChatCommand('/phase 2',true,places,false)!.error!;if(locale!=='ru')assert.notEqual(t(error),error);
 }
 setLocale('ru');
});

test('direct cosmic subphases use hyphens, keep the full phase command, and stay solo/duel gated',()=>{
 for(const subphase of [1,2,3] as const){const text=`/phase 4-${subphase}`;assert.deepEqual(parseChatCommand(text,true,places,true),{command:{kind:'phase',phase:4,subphase}});assert(parseChatCommand(text,false,places,true)?.error);assert(parseChatCommand(text,true,places,false)?.error);}
 for(const text of ['/phase 4/1','/phase 4/2','/phase 4-0','/phase 4-4','/phase 1-1','/phase 4 - 1','/phase 4-1 extra'])assert(parseChatCommand(text,true,places,true)?.error,text);
 assert.deepEqual(commandSuggestions('/phase 4-',true,places,true).map(s=>s.value),['/phase 4-1','/phase 4-2','/phase 4-3']);
 assert.deepEqual(parseChatCommand('/phase 4',true,places,true),{command:{kind:'phase',phase:4}});
});
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
 for(const input of ['/size 1000','/tele mz','/unlock bandana','/unlock pidgie','/unlock meta-knight','/unlock snowball','/time 12','/portal 1','/portal 0','/']){
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
 setLocale('ru');assert.deepEqual(commandSuggestions('/',true,places).map(s=>s.value),['/size ','/tele ','/unlock ','/time ','/portal ']);
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

test('portal accepts only English 0/1 commands and localizes complete suggestions',()=>{
 assert.deepEqual(parseChatCommand('/portal 1',true,places),{command:{kind:'portal',open:true}});
 assert.deepEqual(parseChatCommand(' /PORTAL   0 ',true,places),{command:{kind:'portal',open:false}});
 for(const argument of ['','open','close','2','-1','01','1.0','true','0 extra'])assert(parseChatCommand('/portal '+argument,true,places)?.error,argument);
 assert(parseChatCommand('/портал 1',true,places)?.error);
 try{
  for(const locale of ['ru','en','bg'] as const){
   setLocale(locale);
   assert.deepEqual(commandSuggestions('/por',true,places).map(s=>s.value),['/portal ']);
   assert.deepEqual(commandSuggestions('/portal ',true,places).map(s=>s.value),['/portal 1','/portal 0']);
   const [option]=commandSuggestions('/portal 0',true,places);assert.equal(option.value,'/portal 0');assert(option.complete);
   if(locale!=='ru')assert.notEqual(option.description,'Закрыть портал');
   assert.match(t(parseChatCommand('/portal 2',true,places)!.error!),/\/portal 1/);
  }
 }finally{setLocale('ru');}
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
 assert.deepEqual(commandSuggestions('/unlock ',true,places).map(s=>s.value),['/unlock bandana','/unlock pidgie','/unlock meta-knight','/unlock snowball','/unlock cinder','/unlock ginger']);
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

test('Snowball unlock accepts its full alias and localizes suggestions and usage in every language',()=>{
 for(const text of ['/unlock snowball',' /UNLOCK   SNOWBALL '])assert.deepEqual(parseChatCommand(text,true,places),{command:{kind:'unlock',character:'snowball'}});
 for(const text of ['/unlock snow','/unlock снежок','/unlock snowball extra'])assert(parseChatCommand(text,true,places)?.error,text);
 try{
  for(const locale of ['ru','en','bg'] as const){
   setLocale(locale);
   for(const prefix of ['s','SNO','snowball'])assert.deepEqual(commandSuggestions('/unlock '+prefix,true,places),[{
    value:'/unlock snowball',label:'snowball',description:locale==='en'?'Snowball':locale==='bg'?'Снежко':'Снежок',complete:true,
   }]);
   const error=parseChatCommand('/unlock',true,places)!.error!;
   assert.match(t(error),/\/unlock snowball/);if(locale!=='ru')assert.notEqual(t(error),error);
  }
 }finally{setLocale('ru');}
});

test('Cinder and Ginger use English unlock aliases in every locale while retaining stable character IDs',()=>{
 try{
  for(const [id,alias,names] of [['ugolyok','cinder',['Уголёк','Cinder','Въгленчо']],['ryzhik','ginger',['Рыжик','Ginger','Рижко']]] as const){
   for(const [i,locale] of (['ru','en','bg'] as const).entries()){
    setLocale(locale);
    for(const text of [`/unlock ${alias}`,` /UNLOCK   ${alias.toUpperCase()} `])assert.deepEqual(parseChatCommand(text,true,places),{command:{kind:'unlock',character:id}});
    for(const text of [`/unlock ${alias.slice(0,3)}`,`/unlock ${names[0]}`,`/unlock ${names[2]}`,`/unlock ${alias} extra`,`/unlock ${id}`])assert(parseChatCommand(text,true,places)?.error,text);
    assert(parseChatCommand(`/unlock ${alias}`,false,places)?.error);assert.deepEqual(commandSuggestions(`/unlock ${alias}`,false,places),[]);
    for(const prefix of [alias[0],alias.slice(0,3).toUpperCase(),alias])assert.deepEqual(commandSuggestions('/unlock '+prefix,true,places),[{value:`/unlock ${alias}`,label:alias,description:names[i],complete:true}]);
    assert.deepEqual(commandSuggestions('/unlock '+id,true,places),[]);
    const error=t(parseChatCommand('/unlock',true,places)!.error!);assert.match(error,new RegExp('/unlock '+alias));assert.doesNotMatch(error,/ugolyok|ryzhik/i);
    if(locale!=='ru')assert.notEqual(error,parseChatCommand('/unlock',true,places)!.error!);
   }
  }
 }finally{setLocale('ru');}
});
