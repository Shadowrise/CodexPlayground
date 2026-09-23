import {KIRBY_VARIANTS} from './variants';
import {chatText,type LogEntry} from './world-log';
export class MeadowChat{
 readonly panel=document.createElement('section');
 readonly composer=document.createElement('form');
 private input=document.createElement('input');
 private list=document.createElement('div');private signature='';
 get open(){return !this.composer.hidden;}
 constructor(send:(text:string)=>void){
  this.panel.id='meadow-chat';this.panel.setAttribute('aria-label','Чат и события поляны');
  const title=document.createElement('div');title.className='chat-title';title.textContent='Полянка · чат и события';
  this.list.className='chat-messages';this.list.setAttribute('role','log');this.list.setAttribute('aria-live','polite');this.panel.append(title,this.list);
  this.composer.id='chat-composer';this.composer.hidden=true;this.composer.setAttribute('aria-label','Написать в чат');
  const label=document.createElement('label');label.htmlFor='chat-input';label.textContent='Сообщение на полянку';
  this.input.id='chat-input';this.input.maxLength=255;this.input.autocomplete='off';this.input.placeholder='Напиши что-нибудь доброе…';
  const hint=document.createElement('small');hint.textContent='Enter — отправить · Escape — отменить · до 255 символов';
  this.composer.append(label,this.input,hint);document.body.append(this.panel,this.composer);
  this.composer.addEventListener('submit',e=>{e.preventDefault();const text=chatText(this.input.value);if(text)send(text);this.close();});
  this.input.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();this.close();}if(e.key==='Enter'&&!e.isComposing){e.preventDefault();this.composer.requestSubmit();}});
 }
 show(){this.composer.hidden=false;this.input.focus();}
 close(){this.composer.hidden=true;this.input.value='';this.input.blur();}
 render(entries:LogEntry[],settings:boolean){
  const changedSettings=this.panel.classList.contains('chat-scroll')!==settings;this.panel.classList.toggle('chat-scroll',settings);this.list.tabIndex=settings?0:-1;
  const latest=entries.slice(-10),signature=JSON.stringify(latest);
  if(signature!==this.signature){this.signature=signature;this.list.replaceChildren(...latest.map(e=>{const row=document.createElement('p');row.style.color=KIRBY_VARIANTS[e.variant]?.[1]??'#e4edf7';row.textContent=e.name+(e.chat?': ':' ')+e.text;return row;}));this.list.scrollTop=this.list.scrollHeight;}
  if(changedSettings)this.list.scrollTop=this.list.scrollHeight;
 }
}
