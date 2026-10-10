import {translations} from './i18n-catalog';

export type Locale='ru'|'en'|'bg';
export const LANGUAGE_KEY='kirby-language-v1';
const supported:readonly Locale[]=['ru','en','bg'];
// Pure game modules and save identifiers retain their Russian source language.
// boot.ts selects the browser language before importing the scene.
let locale:Locale='ru';
const listeners=new Set<()=>void>();
let domListenerInstalled=false;
const cache=new Map<string,string>();
const textSources=new WeakMap<Node,{source:string;last:string}>();
const attributeSources=new WeakMap<Element,Map<string,{source:string;last:string}>>();
const reverse=new Map<string,string>();
for(const [source,values] of Object.entries(translations))for(const value of values)if(!value.includes('{'))reverse.set(value,source);
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const templates=Object.entries(translations).filter(([key])=>key.includes('{')).map(([source,values])=>{
 const indices:number[]=[];
 const pattern=source.split(/(\{\d+\})/).map(part=>{const match=part.match(/^\{(\d+)\}$/);if(!match)return escape(part);indices.push(Number(match[1]));return '(.+?)';}).join('');
 return {source,values,indices,pattern:new RegExp('^'+pattern+'$')};
});
// These slots contain domain labels, never player names or player-written chat.
const labelSlots:Record<string,number[]>={
 'Время суток: {0}':[0],'{0} съеден! Размер +10% · {1}%':[0],'Шар: {0}':[0],'Летим: {0} · посадка автоматически':[0],
 'Топотушка переводит дух. Толкни бубенчик на хвосте: {0}':[0],
 'Подлети повыше к бубенчику на спине и толкни: {0}':[0],
 'Колесо устало! Подойди к радужному мячу, повернись к Топотушке и толкни: {0}':[0],
 'Подойди к веточкам в ручье и толкни их: нажми {0} · Убрано {1}/3':[0],
 'Нажимай {0} у рычага, пока стрелка не попадёт в зелёную зону':[0],
 'E — положи {0} мешочек в воронку':[0],'E — верни этот мешочек. Найди {0}':[0],
 'Этот цвет не подошёл. Найди {0} мешочек и подойди к нему':[0],
 'Найди {0} мешочек на полянке. Подойди к нему, чтобы взять · {1}/3':[0],
 'Верни этот мешочек в воронку ({0}), затем найди {1}':[0,1],
 'Отнеси {0} мешочек к воронке и нажми {1} · Загружено {2}/3':[0,1],
};
export function getLocale(){return locale;}
export function detectLocale(stored:string|null|undefined,languages:readonly string[]):Locale{
 if(supported.includes(stored as Locale))return stored as Locale;
 for(const language of languages){const base=language.toLowerCase().split(/[-_]/)[0];if(supported.includes(base as Locale))return base as Locale;}
 return 'en';
}
export function initializeLocale(storage?:Pick<Storage,'getItem'>,languages:readonly string[]=[]){
 let stored:string|null=null;try{stored=storage?.getItem(LANGUAGE_KEY)??null;}catch{/* Private browsers may deny storage. */}
 setLocale(detectLocale(stored,languages));return locale;
}
export function setLocale(next:Locale,storage?:Pick<Storage,'setItem'>){
 if(!supported.includes(next))return;
 try{storage?.setItem(LANGUAGE_KEY,next);}catch{/* Choosing a language must never prevent playing. */}
 if(next===locale)return;
 locale=next;cache.clear();for(const listener of listeners)listener();
}
export function onLocaleChange(listener:()=>void){listeners.add(listener);return ()=>listeners.delete(listener);}
/** Translate presentation text; identifiers and player-authored text never pass here. */
export function t(source:string,params?:readonly (string|number)[]):string{
 if(params){const value=locale==='ru'?source:translations[source]?.[locale==='en'?0:1]??source;return value.replace(/\{(\d+)\}/g,(_,i)=>String(params[Number(i)]??''));}
 if(locale==='ru'||!source)return source;
 const cached=cache.get(source);if(cached!==undefined)return cached;
 let result=translations[source]?.[locale==='en'?0:1];
 if(result===undefined&&/[А-Яа-яЁё]/.test(source)){
  // Canonical network events and domain prompts arrive as rendered Russian templates.
  // Only known templates match; captured player names are kept verbatim.
  for(const entry of templates){const match=entry.pattern.exec(source);if(!match)continue;
   const values:string[]=[];entry.indices.forEach((index,i)=>values[index]=labelSlots[entry.source]?.includes(index)?t(match[i+1]):match[i+1]);
   result=entry.values[locale==='en'?0:1].replace(/\{(\d+)\}/g,(_,i)=>values[Number(i)]??'');break;
  }
 }
 result??=source;if(cache.size>=512)cache.clear();cache.set(source,result);return result;
}
/** Static DOM is translated only at startup or a language switch, never in the render loop. */
export function localizeDOM(root:Element=document.body){
 const skip='[data-i18n-ignore],.stat-name:not(.npc-name),.festival-name,.chat-messages';
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 let node:Node|null;
 while((node=walker.nextNode())){
  const parent=node.parentElement;if(!parent||parent.closest(skip)||parent.closest('script,style,textarea'))continue;
  const raw=node.textContent??'',trimmed=raw.trim(),saved=textSources.get(node);
  const source=saved?.last===trimmed?saved.source:translations[trimmed]?trimmed:reverse.get(trimmed)??trimmed;
  const value=t(source);if(value!==trimmed)node.textContent=raw.replace(trimmed,value);
  if(translations[source])textSources.set(node,{source,last:value});
 }
 for(const el of [root,...root.querySelectorAll('*')]){
  if(el.closest(skip))continue;
  let saved=attributeSources.get(el);if(!saved){saved=new Map();attributeSources.set(el,saved);}
  for(const attr of ['title','aria-label','placeholder','label']){const raw=el.getAttribute(attr);if(!raw)continue;
   const previous=saved.get(attr),source=previous?.last===raw?previous.source:translations[raw]?raw:reverse.get(raw)??raw,value=t(source);
   el.setAttribute(attr,value);if(translations[source])saved.set(attr,{source,last:value});
  }
 }
 document.documentElement.lang=locale;
}
export function createLanguageSwitcher(){
 const group=document.createElement('div');group.className='language-switcher';group.dataset.i18nIgnore='';group.setAttribute('role','radiogroup');
 const names:Record<Locale,string>={ru:'Русский',en:'English',bg:'Български'};
 const update=()=>{group.setAttribute('aria-label',t('Язык'));group.style.setProperty('--language-index',String(supported.indexOf(locale)));for(const button of group.querySelectorAll('button')){const selected=button.dataset.language===locale;button.setAttribute('aria-checked',String(selected));button.tabIndex=selected?0:-1;}};
 for(const code of supported){const button=document.createElement('button');button.type='button';button.dataset.language=code;button.lang=code;button.title=names[code];button.setAttribute('role','radio');button.setAttribute('aria-label',names[code]);
  const flag=document.createElement('span');flag.className=`language-flag flag-${code}`;flag.setAttribute('aria-hidden','true');
  if(code==='en')flag.innerHTML='<svg viewBox="0 0 60 30" preserveAspectRatio="none" aria-hidden="true"><path fill="#173a83" d="M0 0h60v30H0z"/><path d="m0 0 60 30m0-30L0 30" stroke="#fff" stroke-width="6"/><path fill="#d63346" d="m0 0 20 10h4L4 0Zm60 0L40 10h-4L56 0ZM0 30l20-10h4L4 30Zm60 0L40 20h-4l20 10Z"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#d63346" stroke-width="6"/></svg>';
  button.append(flag);
  button.addEventListener('click',()=>{let storage:Storage|undefined;try{storage=localStorage;}catch{}setLocale(code,storage);});group.append(button);
 }
 group.addEventListener('keydown',event=>{let index=supported.indexOf(locale);if(event.key==='ArrowLeft'||event.key==='ArrowUp')index=(index+supported.length-1)%supported.length;else if(event.key==='ArrowRight'||event.key==='ArrowDown')index=(index+1)%supported.length;else if(event.key==='Home')index=0;else if(event.key==='End')index=supported.length-1;else return;event.preventDefault();const button=group.querySelector<HTMLButtonElement>(`[data-language="${supported[index]}"]`)!;button.click();button.focus();});
 if(!domListenerInstalled){domListenerInstalled=true;onLocaleChange(()=>localizeDOM());}
 onLocaleChange(update);update();return group;
}
