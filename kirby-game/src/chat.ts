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
  this.list.className='chat-messages';this.list.setAttribute('role','log');this.list.setAttribute('aria-live','polite');this.panel.append(this.list);
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
  if(signature!==this.signature){
   const hadMessages=!!this.signature;
   const oldRows=new Map([...this.list.children].map(el=>[(el as HTMLElement).dataset.id!,el as HTMLElement]));
   const positions=new Map([...oldRows].map(([id,row])=>[id,row.getBoundingClientRect().top]));
   this.signature=signature;
   this.list.replaceChildren(...latest.map(e=>{
    const row=oldRows.get(e.id)??document.createElement('p');row.dataset.id=e.id;
    row.style.color=KIRBY_VARIANTS[e.variant]?.[1]??'#e4edf7';
    if(!oldRows.has(e.id)){
     if(e.chat){const name=document.createElement('span');name.textContent=e.name+': ';const text=document.createElement('span');text.className='chat-text';text.textContent=e.text;row.append(name,text);}
     else row.textContent=e.name+' '+e.text;
    }
    return row;
   }));
   this.list.scrollTop=this.list.scrollHeight;
   if(hadMessages&&!matchMedia('(prefers-reduced-motion: reduce)').matches)for(const row of this.list.children as HTMLCollectionOf<HTMLElement>){
    const previous=positions.get(row.dataset.id!);const offset=previous===undefined?22:previous-row.getBoundingClientRect().top;
    row.getAnimations().forEach(a=>a.cancel());
    row.animate([{transform:`translateY(${offset}px)`,opacity:previous===undefined?0:1},{transform:'translateY(0)',opacity:1}],{duration:280,easing:'cubic-bezier(.2,.7,.3,1)'});
   }
  }
  if(changedSettings)this.list.scrollTop=this.list.scrollHeight;
 }
}
