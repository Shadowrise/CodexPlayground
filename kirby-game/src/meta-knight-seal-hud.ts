import {getLocale,t} from './i18n';
import {SEAL_IDS,allSealsCollected,type SealProgress} from './meta-knight-seal-state';
import './meta-knight-seal-hud.css';

const COMPLETE_MS=1500,OPENING_MS=1100;
type Stage='collecting'|'complete'|'opening'|'open';

/** A room-wide quest display. Restored progress is shown without replaying rewards. */
export class MetaKnightSealHud {
 readonly element=document.createElement('section');
 private title=document.createElement('strong');
 private counter=document.createElement('span');
 private message=document.createElement('div');
 private slots:HTMLElement[]=[];
 private count=0;
 private stage:Stage='collecting';
 private openedAt:number|undefined;
 private ready=false;
 private signature='';
 constructor(){
  this.element.id='meta-knight-seal-hud';this.element.hidden=true;this.element.dataset.i18nIgnore='';
  this.element.setAttribute('role','status');this.element.setAttribute('aria-live','polite');this.element.setAttribute('aria-atomic','true');
  const heading=document.createElement('div');heading.className='seal-hud-heading';heading.append(this.title,this.counter);
  const slots=document.createElement('div');slots.className='seal-hud-slots';slots.setAttribute('aria-hidden','true');
  this.slots=SEAL_IDS.map(()=>{
   const slot=document.createElement('span');slot.className='seal-hud-slot';
   const icon=document.createElement('img');icon.src='/icons/meta-knight-seal.svg';icon.alt='';icon.width=68;icon.height=68;
   slot.append(icon);slots.append(slot);return slot;
  });
  this.message.className='seal-hud-message';
  const portal=document.createElement('span');portal.className='seal-hud-portal';portal.setAttribute('aria-hidden','true');
  this.element.append(heading,slots,portal,this.message);document.body.append(this.element);
  // Other quest cards and the phone sidebar follow the actual panel height,
  // including wrapped translations and the portal reveal.
  new ResizeObserver(()=>{
   if(!this.element.hidden)document.body.style.setProperty('--seal-hud-bottom',`${Math.ceil(this.element.getBoundingClientRect().bottom)+12}px`);
  }).observe(this.element);
 }
 reset(progress:SealProgress,ready=allSealsCollected(progress)){
  this.count=SEAL_IDS.filter(id=>progress.collected[id]).length;this.ready=ready;
  this.openedAt=undefined;this.stage=ready?'open':'collecting';this.signature='';this.element.hidden=true;
  this.slots.forEach((slot,i)=>{slot.classList.toggle('filled',i<this.count);slot.classList.remove('seal-arrive');});
 }
 update(progress:SealProgress,ready:boolean,now:number,visible:boolean){
  const count=SEAL_IDS.filter(id=>progress.collected[id]).length;
  const gained=count>this.count;
  if(count!==this.count)this.slots.forEach((slot,i)=>{
   slot.classList.toggle('filled',i<count);
   if(i>=this.count&&i<count)slot.classList.add('seal-arrive');
   else if(i>=count)slot.classList.remove('seal-arrive');
  });
  this.count=count;
  // The solo /portal override can open a portal with badges still missing.
  if(ready&&!this.ready)this.openedAt=now-(count===SEAL_IDS.length?0:COMPLETE_MS);
  if(!ready)this.openedAt=undefined;
  this.ready=ready;
  const elapsed=this.openedAt===undefined?Infinity:now-this.openedAt;
  this.stage=!ready?'collecting':elapsed<COMPLETE_MS?'complete':elapsed<COMPLETE_MS+OPENING_MS?'opening':'open';
  this.element.hidden=!visible;
  const signature=[getLocale(),count,this.stage].join(':');
  if(signature!==this.signature){
   this.signature=signature;this.element.dataset.stage=this.stage;
   this.title.textContent=t('Значки Метакнайта');this.counter.textContent=`${count} / ${SEAL_IDS.length}`;
   this.message.textContent=t(this.stage==='collecting'?count===SEAL_IDS.length?'Портал пока не работает':'Соберите три значка, чтобы открыть портал':this.stage==='complete'?'Все три значка собраны!':this.stage==='opening'?'Портал открывается…':'Портал на космическую арену открыт!');
  }
  return gained;
 }
}
