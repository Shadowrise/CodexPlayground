import {getLocale,t} from './i18n';
import {WILD_PIGEONS,wildPigeonName} from './wild-pigeons';
import {allPigeonsFed,type PigeonFeedingProgress} from './metapidgie-feeding';
import './metapidgie-feather-hud.css';

/** A shared quest card, revealed when a new friend receives bread. */
export class MetapidgieFeatherHud{
 readonly element=document.createElement('section');
 private title=document.createElement('strong');private counter=document.createElement('span');private message=document.createElement('div');
 private slots:HTMLElement[]=[];private previous=new Set<string>();private noticeUntil=0;private signature='';
 constructor(){
  this.element.id='metapidgie-feather-hud';this.element.hidden=true;this.element.dataset.i18nIgnore='';
  this.element.setAttribute('role','status');this.element.setAttribute('aria-live','polite');this.element.setAttribute('aria-atomic','true');
  const heading=document.createElement('div');heading.className='feather-hud-heading';heading.append(this.title,this.counter);
  const slots=document.createElement('div');slots.className='feather-hud-slots';
  this.slots=WILD_PIGEONS.map(()=>{const slot=document.createElement('span');slot.className='feather-hud-slot';const icon=document.createElement('img');icon.src='/icons/metapidgie-feather.svg';icon.alt='';icon.width=46;icon.height=46;slot.append(icon);slots.append(slot);return slot;});
  this.message.className='feather-hud-message';this.element.append(heading,slots,this.message);document.body.append(this.element);
  const layout=new ResizeObserver(()=>{
   const unlock=document.getElementById('character-unlock');document.body.style.setProperty('--unlock-hud-bottom',unlock&&!unlock.hidden?`${unlock.offsetTop+unlock.offsetHeight+12}px`:'0px');
   if(!this.element.hidden)document.body.style.setProperty('--feather-hud-bottom',`${this.element.offsetTop+this.element.offsetHeight+12}px`);
  });layout.observe(this.element);
  const seals=document.getElementById('meta-knight-seal-hud');if(seals)layout.observe(seals);
  const unlock=document.getElementById('character-unlock');if(unlock)layout.observe(unlock);
 }
 reset(progress:PigeonFeedingProgress){this.previous=new Set(WILD_PIGEONS.filter(id=>progress.fed[id]));this.noticeUntil=0;this.signature='';this.element.hidden=true;this.slots.forEach(slot=>slot.classList.remove('feather-arrive'));}
 update(progress:PigeonFeedingProgress,now:number,visible:boolean){
  const fed=WILD_PIGEONS.filter(id=>progress.fed[id]),gained=fed.some(id=>!this.previous.has(id)),complete=allPigeonsFed(progress);
  if(gained)this.noticeUntil=now+(complete?8000:5000);
  this.slots.forEach((slot,i)=>{const id=WILD_PIGEONS[i];slot.classList.toggle('filled',!!progress.fed[id]);if(progress.fed[id]&&!this.previous.has(id))slot.classList.add('feather-arrive');else if(!progress.fed[id])slot.classList.remove('feather-arrive');});
  this.previous=new Set(fed);this.element.hidden=!visible||!this.noticeUntil||now>=this.noticeUntil+650;
  this.element.dataset.visibility=now<this.noticeUntil?'showing':'leaving';this.element.dataset.complete=String(complete);
  const signature=`${getLocale()}:${fed.join(',')}`;
  if(signature!==this.signature){this.signature=signature;this.title.textContent=t('Перышки Мета Пиджи');this.counter.textContent=`${fed.length} / ${WILD_PIGEONS.length}`;
   this.message.textContent=t(complete?'Все друзья сыты! Портал Мета Пиджи открыт!':'Угостите хлебом всех голубей на поляне');
   this.slots.forEach((slot,i)=>{const label=`${t(wildPigeonName(WILD_PIGEONS[i]))} · ${t(progress.fed[WILD_PIGEONS[i]]?'Сыт':'Ждёт хлебушка')}`;slot.setAttribute('aria-label',label);slot.title=label;});
  }
  return gained;
 }
}
