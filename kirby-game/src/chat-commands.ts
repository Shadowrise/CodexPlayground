import {MIN_BODY_SIZE,MAX_BODY_SIZE} from './body-size';
import type {Destination} from './navigation';
import {t} from './i18n';

/** Stable Latin aliases: display names may change with the selected language. */
export const TELE_ALIASES:Readonly<Record<string,string>>={
 'meta-knight-portal':'mk','boss-arena':'ar',fountain:'fn','sky-trail':'sky',home:'hm',treehouse:'th',
 swing:'sw',mill:'ml',depot:'rc',maze:'mz','balloon-0':'bf','balloon-1':'bs','balloon-2':'bc',
 'musical-flowers':'fl',
};
export type ChatCommand={kind:'size';size:number}|{kind:'tele';destination:Destination}|{kind:'unlock';character:'bandana'|'pidgie'|'meta-knight'|'snowball'|'ugolyok'|'ryzhik'}|{kind:'time';hour:number}|{kind:'portal';open:boolean}|{kind:'phase';phase:1|2|3}|{kind:'godmode'};
export type CommandResult={command:ChatCommand;error?:never}|{error:string;command?:never};
export type CommandSuggestion={value:string;label:string;description:string;complete:boolean};
export type ChatCommandOptions={
 enabled:()=>boolean;
 duelActive?:()=>boolean;
 destinations:()=>readonly Destination[];
 execute:(command:ChatCommand)=>void;
};
const commands=[
 {name:'size',description:'Изменить размер Кирби: 30–1000%'},
 {name:'tele',description:'Телепортироваться к приключению'},
 {name:'unlock',description:'Разблокировать персонажа'},
 {name:'time',description:'Установить час в игре: 0–23'},
 {name:'portal',description:'Портал Метакнайта: 1 — открыть, 0 — закрыть'},
];
// English command aliases are independent of stable save/network character IDs.
const unlockCharacters=[
 {character:'bandana',alias:'bandana',name:'Бандана'},
 {character:'pidgie',alias:'pidgie',name:'Пиджи'},
 {character:'meta-knight',alias:'meta-knight',name:'Meta Knight'},
 {character:'snowball',alias:'snowball',name:'Снежок'},
 {character:'ugolyok',alias:'cinder',name:'Уголёк'},
 {character:'ryzhik',alias:'ginger',name:'Рыжик'},
] as const;
const duelCommands=[{name:'phase',description:'Переключить фазу Метакнайта: 1–3'},{name:'godmode',description:'Включить или выключить неуязвимость до конца дуэли'}];
function parts(text:string){return /^\/(\S*)(?:\s+(.*))?$/.exec(text.trimStart());}

export function parseChatCommand(text:string,enabled:boolean,destinations:readonly Destination[],duelActive=false):CommandResult|undefined{
 if(!text.trimStart().startsWith('/'))return;
 if(!enabled)return {error:'Команды доступны только в одиночной игре.'};
 const match=parts(text.trim());
 const name=match?.[1].toLowerCase(),argument=match?.[2]?.trim()??'';
 if(name==='phase'||name==='godmode'){
  if(!duelActive)return {error:'Эта команда доступна только во время дуэли с Метакнайтом.'};
  if(name==='godmode')return argument?{error:'Введи /godmode без аргументов.'}:{command:{kind:'godmode'}};
  return /^[123]$/.test(argument)?{command:{kind:'phase',phase:Number(argument) as 1|2|3}}:{error:'Введи /phase 1, /phase 2 или /phase 3.'};
 }
 if(name==='portal'){
  if(argument!=='0'&&argument!=='1')return {error:'Введи /portal 1, чтобы открыть портал, или /portal 0, чтобы закрыть.'};
  return {command:{kind:'portal',open:argument==='1'}};
 }
 if(name==='size'){
  // Reject partial numbers, NaN and out-of-range values rather than silently clamping.
  const percent=/^\d+(?:[.,]\d+)?$/.test(argument)?Number(argument.replace(',','.')):NaN;
  if(!Number.isFinite(percent)||percent<MIN_BODY_SIZE*100||percent>MAX_BODY_SIZE*100)return {error:'Введи /size и число от 30 до 1000. Например: /size 100'};
  return {command:{kind:'size',size:percent/100}};
 }
 if(name==='time'){
  const hour=/^\d+$/.test(argument)?Number(argument):NaN;
  if(!Number.isInteger(hour)||hour<0||hour>23)return {error:'Введи /time и целое число от 0 до 23. Например: /time 12'};
  return {command:{kind:'time',hour}};
 }
 if(name==='tele'){
  const destination=destinations.find(d=>TELE_ALIASES[d.id]===argument.toLowerCase());
  return destination?{command:{kind:'tele',destination}}:{error:'Выбери место из подсказок или введи его сокращение после /tele.'};
 }
 if(name==='unlock'){
  const target=unlockCharacters.find(entry=>entry.alias===argument.toLowerCase());
  return target?{command:{kind:'unlock',character:target.character}}:{error:'Введи /unlock bandana, /unlock pidgie, /unlock meta-knight, /unlock snowball, /unlock cinder или /unlock ginger, чтобы открыть персонажа.'};
 }
 return {error:duelActive?'Доступные команды: /size, /tele, /unlock, /time, /portal, /phase и /godmode.':'Доступные команды: /size, /tele, /unlock, /time и /portal.'};
}

export function commandSuggestions(text:string,enabled:boolean,destinations:readonly Destination[],duelActive=false):CommandSuggestion[]{
 if(!enabled)return [];
 const match=parts(text);if(!match)return [];
 const name=match[1].toLowerCase(),argument=match[2]?.trim().toLowerCase()??'';
 if(name==='phase')return duelActive?[1,2,3].filter(phase=>String(phase).startsWith(argument)).map(phase=>({value:`/phase ${phase}`,label:String(phase),description:t('Фаза {0}',[phase]),complete:true})):[];
 if(name==='portal')return [{value:'1',description:'Открыть портал'},{value:'0',description:'Закрыть портал'}].filter(option=>option.value.startsWith(argument)).map(option=>({value:`/portal ${option.value}`,label:option.value,description:t(option.description),complete:true}));
 if(name==='tele')return destinations.filter(d=>TELE_ALIASES[d.id]?.startsWith(argument)).map(d=>({
  value:`/tele ${TELE_ALIASES[d.id]}`,label:TELE_ALIASES[d.id],description:t(d.name),complete:true,
 }));
 if(name==='unlock')return unlockCharacters.filter(entry=>entry.alias.startsWith(argument)).map(entry=>({value:`/unlock ${entry.alias}`,label:entry.alias,description:t(entry.name),complete:true}));
 if(match[2]!==undefined)return [];
 return [...commands,...(duelActive?duelCommands:[])].filter(c=>c.name.startsWith(name)).map(c=>({value:`/${c.name}${c.name==='godmode'?'':' '}`,label:`/${c.name}`,description:t(c.description),complete:c.name==='godmode'}));
}
