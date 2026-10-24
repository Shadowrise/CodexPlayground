import {t,getLocale,onLocaleChange} from './i18n';
import {commandSuggestions,parseChatCommand,type ChatCommandOptions,type CommandSuggestion} from './chat-commands';
import {KIRBY_VARIANTS} from './variants';
import {chatText,type LogEntry} from './world-log';
export class MeadowChat{
 readonly panel=document.createElement('section');
 readonly composer=document.createElement('form');
 private input=document.createElement('input');
 private readonly mobile=document.body.classList.contains('touch-ui');
 private list=document.createElement('div');private shownIds:string[]=[];private language='';
 private commands?:ChatCommandOptions;
 private suggestions=document.createElement('div');
 private error=document.createElement('div');
 private hint=document.createElement('small');
 private choices:CommandSuggestion[]=[];
 private selected=-1;
 get open(){return !this.composer.hidden;}
 constructor(send:(text:string)=>void){
  this.panel.id='meadow-chat';this.panel.setAttribute('aria-label',t('Чат и события поляны'));
  this.list.className='chat-messages';this.list.setAttribute('role','log');this.list.setAttribute('aria-live','polite');this.panel.append(this.list);
  this.composer.id='chat-composer';this.composer.hidden=true;this.composer.setAttribute('aria-label',t('Написать в чат'));
  const label=document.createElement('label');label.htmlFor='chat-input';label.textContent=t('Сообщение на полянку');
  this.input.id='chat-input';this.input.maxLength=255;this.input.autocomplete='off';this.input.placeholder='Напиши что-нибудь доброе…';
  this.input.setAttribute('role','combobox');this.input.setAttribute('aria-autocomplete','list');this.input.setAttribute('aria-controls','chat-command-list');this.input.setAttribute('aria-expanded','false');
  this.suggestions.id='chat-command-list';this.suggestions.setAttribute('role','listbox');this.suggestions.hidden=true;this.suggestions.dataset.i18nIgnore='';
  this.error.id='chat-command-error';this.error.setAttribute('role','status');this.error.hidden=true;this.error.dataset.i18nIgnore='';
  this.input.setAttribute('aria-describedby',this.error.id);
  this.hint.textContent=t('Enter — отправить · Escape — отменить · до 255 символов');
  this.composer.append(label,this.input,this.suggestions,this.error,this.hint);document.body.append(this.panel,this.composer);
  const buttons=document.createElement('div');buttons.className='touch-chat-buttons';
  const submit=document.createElement('button');submit.type='submit';submit.textContent=t('Отправить');
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent=t('Отмена');cancel.addEventListener('click',()=>this.close());
  buttons.append(submit,cancel);this.composer.append(buttons);
  if(this.mobile){
   this.composer.append(this.panel);
   // The visual viewport follows the on-screen keyboard on iOS and Android.
   window.visualViewport?.addEventListener('resize',()=>this.fitViewport());
   window.visualViewport?.addEventListener('scroll',()=>this.fitViewport());
  }
  this.composer.addEventListener('submit',e=>{
   e.preventDefault();const text=chatText(this.input.value);
   const result=parseChatCommand(text,this.commands?.enabled()??false,this.commands?.destinations()??[],this.commands?.duelActive?.()??false);
   if(result?.error){this.error.textContent=t(result.error);this.error.hidden=false;this.input.setAttribute('aria-invalid','true');this.input.focus({preventScroll:true});return;}
   if(result?.command)this.commands!.execute(result.command);else if(text)send(text);
   if(this.mobile){
    // Keep the conversation visible; dismiss only the on-screen keyboard.
    this.input.value='';this.updateSuggestions();this.input.blur();this.fitViewport();
   }else this.close();
  });
  this.input.addEventListener('input',()=>this.updateSuggestions());
  this.input.addEventListener('keydown',e=>{
   e.stopPropagation();if(e.isComposing)return;
   if((e.key==='ArrowDown'||e.key==='ArrowUp')&&this.choices.length){
    e.preventDefault();this.selected=this.selected<0?(e.key==='ArrowDown'?0:this.choices.length-1):(this.selected+(e.key==='ArrowDown'?1:-1)+this.choices.length)%this.choices.length;this.highlight();return;
   }
   if(e.key==='Tab'&&this.choices.length){e.preventDefault();this.acceptSuggestion(false);return;}
   if(e.key==='Escape'){e.preventDefault();if(!this.mobile)this.close();}
   if(e.key==='Enter'){
    e.preventDefault();
    if(this.selected>=0 || (this.choices.length&&!this.choices[0].complete))this.acceptSuggestion(true);
    else this.composer.requestSubmit();
   }
  });
  onLocaleChange(()=>{if(this.open)this.updateSuggestions();});
 }
 configureCommands(options:ChatCommandOptions){this.commands=options;}
 private updateSuggestions(){
  this.error.hidden=true;this.input.removeAttribute('aria-invalid');this.selected=-1;
  this.choices=commandSuggestions(this.input.value,this.commands?.enabled()??false,this.commands?.destinations()??[],this.commands?.duelActive?.()??false);
  this.hint.textContent=t(this.choices.length?'↑↓ — выбрать · Tab — подставить · Enter — подтвердить':'Enter — отправить · Escape — отменить · до 255 символов');
  this.suggestions.hidden=!this.choices.length;this.input.setAttribute('aria-expanded',String(!!this.choices.length));this.input.removeAttribute('aria-activedescendant');
  this.suggestions.replaceChildren(...this.choices.map((choice,i)=>{
   const row=document.createElement('button');row.type='button';row.tabIndex=-1;row.id=`chat-command-${i}`;row.setAttribute('role','option');row.setAttribute('aria-selected','false');
   const name=document.createElement('code');name.textContent=choice.label;const description=document.createElement('span');description.textContent=choice.description;row.append(name,description);
   row.addEventListener('pointerdown',e=>e.preventDefault());row.addEventListener('click',()=>{this.selected=i;this.acceptSuggestion(false);});return row;
  }));
 }
 private highlight(){
  [...this.suggestions.children].forEach((row,i)=>row.setAttribute('aria-selected',String(i===this.selected)));
  const row=this.suggestions.children[this.selected] as HTMLElement;
  this.input.setAttribute('aria-activedescendant',row.id);row.scrollIntoView({block:'nearest'});
 }
 private acceptSuggestion(submit:boolean){
  const choice=this.choices[Math.max(0,this.selected)];if(!choice)return;
  this.input.value=choice.value;this.input.focus({preventScroll:true});this.updateSuggestions();
  if(submit&&choice.complete)this.composer.requestSubmit();
 }
 private fitViewport(){
  if(!this.mobile||!this.open)return;
  const viewport=window.visualViewport;
  this.composer.classList.toggle('chat-compact',(viewport?.height??window.innerHeight)<300);
  this.composer.style.setProperty('--chat-viewport-height',`${viewport?.height??window.innerHeight}px`);
  this.composer.style.setProperty('--chat-viewport-top',`${viewport?.offsetTop??0}px`);
 }
 show(){this.composer.hidden=false;this.updateSuggestions();this.fitViewport();this.input.focus({preventScroll:true});this.list.scrollTop=this.list.scrollHeight;}
 close(){this.composer.hidden=true;this.input.value='';this.updateSuggestions();this.input.blur();}
 render(entries:LogEntry[],settings:boolean){
  const scrollable=this.mobile?this.open:settings;
  const changedSettings=this.panel.classList.contains('chat-scroll')!==scrollable;
  if(changedSettings){this.panel.classList.toggle('chat-scroll',scrollable);this.list.tabIndex=scrollable?0:-1;}
  const start=Math.max(0,entries.length-10),count=entries.length-start;
  const changedLanguage=this.language!==getLocale();this.language=getLocale();
  let same=!changedLanguage&&count===this.shownIds.length;
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
    row.classList.toggle('ugolyok-character',KIRBY_VARIANTS[e.variant]?.[0]==='Уголёк');
    row.classList.toggle('chat-event',!e.chat);
    if(!oldRows.has(e.id)){
     if(e.chat){const name=document.createElement('span');name.className='chat-name';name.textContent=e.name+': ';const text=document.createElement('span');text.className='chat-text';text.textContent=e.text;row.append(name,text);}
    }
    if(!e.chat)row.textContent=(e.name?e.name+' ':'')+t(e.text);
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
