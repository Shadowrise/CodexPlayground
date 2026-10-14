import {MIN_BODY_SIZE,MAX_BODY_SIZE} from './body-size';
import type {Destination} from './navigation';
import {t} from './i18n';

/** Stable Latin aliases: display names may change with the selected language. */
export const TELE_ALIASES:Readonly<Record<string,string>>={
 'boss-arena':'ar',fountain:'fn','sky-trail':'sky',home:'hm',treehouse:'th',
 swing:'sw',mill:'ml',depot:'rc',maze:'mz','balloon-0':'bf','balloon-1':'bs','balloon-2':'bc',
 'musical-flowers':'fl',
};
export type ChatCommand={kind:'size';size:number}|{kind:'tele';destination:Destination}|{kind:'unlock';character:'bandana'|'pidgie'}|{kind:'time';hour:number};
export type CommandResult={command:ChatCommand;error?:never}|{error:string;command?:never};
export type CommandSuggestion={value:string;label:string;description:string;complete:boolean};
export type ChatCommandOptions={
 enabled:()=>boolean;
 destinations:()=>readonly Destination[];
 execute:(command:ChatCommand)=>void;
};
const commands=[
 {name:'size',description:'Изменить размер Кирби: 30–1000%'},
 {name:'tele',description:'Телепортироваться к приключению'},
 {name:'unlock',description:'Разблокировать персонажа'},
 {name:'time',description:'Установить час в игре: 0–23'},
];
const unlockCharacters=[{character:'bandana',name:'Бандана'},{character:'pidgie',name:'Пиджи'}] as const;
function parts(text:string){return /^\/(\S*)(?:\s+(.*))?$/.exec(text.trimStart());}

export function parseChatCommand(text:string,enabled:boolean,destinations:readonly Destination[]):CommandResult|undefined{
 if(!text.trimStart().startsWith('/'))return;
 if(!enabled)return {error:'Команды доступны только в одиночной игре.'};
 const match=parts(text.trim());
 const name=match?.[1].toLowerCase(),argument=match?.[2]?.trim()??'';
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
  const target=unlockCharacters.find(entry=>entry.character===argument.toLowerCase());
  return target?{command:{kind:'unlock',character:target.character}}:{error:'Введи /unlock bandana, чтобы открыть Бандану, или /unlock pidgie, чтобы открыть Пиджи.'};
 }
 return {error:'Доступные команды: /size, /tele, /unlock и /time.'};
}

export function commandSuggestions(text:string,enabled:boolean,destinations:readonly Destination[]):CommandSuggestion[]{
 if(!enabled)return [];
 const match=parts(text);if(!match)return [];
 const name=match[1].toLowerCase(),argument=match[2]?.trim().toLowerCase()??'';
 if(name==='tele')return destinations.filter(d=>TELE_ALIASES[d.id]?.startsWith(argument)).map(d=>({
  value:`/tele ${TELE_ALIASES[d.id]}`,label:TELE_ALIASES[d.id],description:t(d.name),complete:true,
 }));
 if(name==='unlock')return unlockCharacters.filter(entry=>entry.character.startsWith(argument)).map(entry=>({value:`/unlock ${entry.character}`,label:entry.character,description:t(entry.name),complete:true}));
 if(match[2]!==undefined)return [];
 return commands.filter(c=>c.name.startsWith(name)).map(c=>({value:`/${c.name} `,label:`/${c.name}`,description:t(c.description),complete:false}));
}
