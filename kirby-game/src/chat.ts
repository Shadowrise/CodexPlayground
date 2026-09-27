import {KIRBY_VARIANTS} from './variants';
import {chatText,type LogEntry} from './world-log';
export class MeadowChat{
 readonly panel=document.createElement('section');
 readonly composer=document.createElement('form');
 private input=document.createElement('input');
 private list=document.createElement('div');private shownIds:string[]=[];
 get open(){return !this.composer.hidden;}
 constructor(send:(text:string)=>void){
  this.panel.id='meadow-chat';this.panel.setAttribute('aria-label','Чат и события поляны');
  this.list.className='chat-messages';this.list.setAttribute('role','log');this.list.setAttribute('aria-live','polite');this.panel.append(this.list);
  this.composer.id='chat-composer';this.composer.hidden=true;this.composer.setAttribute('aria-label','Написать в чат');
  const label=document.createElement('label');label.htmlFor='chat-input';label.textContent='Сообщение на полянку';
  this.input.id='chat-input';this.input.maxLength=255;this.input.autocomplete='off';this.input.placeholder='Напиши что-нибудь доброе…';
  const hint=document.createElement('small');hint.textContent='Enter — отправить · Escape — отменить · до 255 символов';
  this.composer.append(label,this.input,hint);document.body.append(this.panel,this.composer);
  const buttons=document.createElement('div');buttons.className='touch-chat-buttons';
  const submit=document.createElement('button');submit.type='submit';submit.textContent='Отправить';
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Отмена';cancel.addEventListener('click',()=>this.close());
  buttons.append(submit,cancel);this.composer.append(buttons);
  if(document.body.classList.contains('touch-ui'))new ResizeObserver(()=>{
   if(!this.panel.classList.contains('chat-scroll'))this.list.scrollTop=this.list.scrollHeight;
  }).observe(this.list);
  this.composer.addEventListener('submit',e=>{e.preventDefault();const text=chatText(this.input.value);if(text)send(text);this.close();});
  this.input.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();this.close();}if(e.key==='Enter'&&!e.isComposing){e.preventDefault();this.composer.requestSubmit();}});
 }
 show(){this.composer.hidden=false;this.input.focus();}
 close(){this.composer.hidden=true;this.input.value='';this.input.blur();}
 render(entries:LogEntry[],settings:boolean){
  const changedSettings=this.panel.classList.contains('chat-scroll')!==settings;
  if(changedSettings){this.panel.classList.toggle('chat-scroll',settings);this.list.tabIndex=settings?0:-1;}
  const start=Math.max(0,entries.length-10),count=entries.length-start;
  let same=count===this.shownIds.length;
  if(same)for(let i=0;i<count;i++)if(entries[start+i].id!==this.shownIds[i]){same=false;break;}
  if(!same){
   const hadMessages=this.shownIds.length>0;
   const latest=entries.slice(start);
   this.shownIds=latest.map(entry=>entry.id);
   const oldRows=new Map([...this.list.children].map(el=>[(el as HTMLElement).dataset.id!,el as HTMLElement]));
   const positions=new Map([...oldRows].map(([id,row])=>[id,row.getBoundingClientRect().top]));
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
