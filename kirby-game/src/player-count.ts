import {t,onLocaleChange} from './i18n';
/** Read-only presence snapshot; this never opens a game connection. */
export async function fetchPlayerCount(base:string,request:typeof fetch=fetch){
 const response=await request(`${base.replace(/\/$/,'')}/players`,{cache:'no-store',signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw new Error('Player count unavailable');
 const data:unknown=await response.json();
 if(!data || typeof data!=='object' || !('players' in data) || !Number.isSafeInteger(data.players) || (data.players as number)<0)throw new Error('Invalid player count');
 return data.players as number;
}
export function watchPlayerCount(label:HTMLElement,menu:HTMLElement,base:string){
 let busy=false;
 let count:number|undefined;
 const render=()=>{label.textContent=t(count===undefined?'— игроков':`${count} игроков`);label.title=t(count===undefined?'Сервер пока недоступен':'Сейчас подключено к сетевой игре');};
 const offLocale=onLocaleChange(render);
 const refresh=async()=>{
  if(busy || menu.hidden || document.hidden)return;
  busy=true;
  try{count=await fetchPlayerCount(base);render();}
  catch{count=undefined;render();}
  finally{busy=false;}
 };
 void refresh();const timer=window.setInterval(()=>void refresh(),60000);
 const onVisible=()=>void refresh();document.addEventListener('visibilitychange',onVisible);
 return ()=>{offLocale();clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);};
}
