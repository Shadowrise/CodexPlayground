import {onLocaleChange,t} from './i18n';
import {wildPigeonId,wildPigeonObjectName} from './wild-pigeons';

export const PIDGIE_LOCK_HINT='Пиджи — он неуловимый. Если поймаешь Пиджи, сможешь поиграть за Пиджи.';
export const META_KNIGHT_LOCK_HINT='Кто сможет победить Метакнайта, тот станет новым метакнайтом.';
export const SNOWBALL_LOCK_HINT='Угости Дикого Снежка хлебушком, чтобы поиграть за Снежка.';
export function lockedCharacterHint(name:string){
 const id=wildPigeonId(name);if(id==='ugolyok'||id==='ryzhik'){const bird=wildPigeonObjectName(id);return `Угости дикого ${bird} хлебушком, чтобы поиграть за ${bird}.`;}
 return name==='Снежок'?SNOWBALL_LOCK_HINT:name==='Meta Knight'?META_KNIGHT_LOCK_HINT:name==='Пиджи'?PIDGIE_LOCK_HINT:'Пройди все приключения в одиночной или онлайн-игре, чтобы открыть Бандану.';
}

/** Detached from the scrolling picker so the hint cannot be clipped by it. */
export class LockedCharacterTooltip {
 readonly element=document.createElement('div');
 private title=document.createElement('strong');
 private text=document.createElement('p');
 private anchor?:HTMLElement;
 private character='Бандана';
 constructor(){
  this.element.id='locked-character-tooltip';this.element.hidden=true;this.element.dataset.i18nIgnore='';this.element.setAttribute('role','tooltip');
  const header=document.createElement('div');header.className='locked-tooltip-header';
  const icon=document.createElement('span');icon.setAttribute('aria-hidden','true');
  icon.innerHTML='<svg viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="4" y="9" width="16" height="13" rx="4" fill="currentColor"/><path d="M12 14v3" stroke="#253142" stroke-width="2.5" stroke-linecap="round"/></svg>';
  header.append(icon,this.title);this.element.append(header,this.text);document.body.append(this.element);
  onLocaleChange(()=>{this.localize();if(!this.element.hidden)this.layout();});this.localize();
  window.addEventListener('resize',()=>{if(!this.element.hidden)this.layout();});
  window.addEventListener('scroll',()=>{if(!this.element.hidden)this.layout();},true);
  window.addEventListener('pointerdown',event=>{if(this.anchor&&!this.anchor.contains(event.target as Node))this.hide();});
  window.addEventListener('keydown',event=>{if(event.key==='Escape')this.hide();});
 }
 private localize(){
  this.title.textContent=t('Персонаж недоступен');
  this.text.textContent=t(lockedCharacterHint(this.character));
 }
 show(anchor:HTMLElement,name='Бандана'){this.anchor=anchor;this.character=name;this.localize();this.element.hidden=false;this.layout();}
 leave(anchor:HTMLElement){if(document.activeElement!==anchor)this.hide();}
 hide(){this.element.hidden=true;this.anchor=undefined;}
 private layout(){
  if(!this.anchor)return;
  const a=this.anchor.getBoundingClientRect(),b=this.element.getBoundingClientRect(),gap=13,padding=12;
  if(!this.anchor.getClientRects().length||a.bottom<0||a.top>innerHeight){this.hide();return;}
  const left=Math.max(padding,Math.min(innerWidth-b.width-padding,a.left+a.width/2-b.width/2));
  const above=a.top-b.height-gap>=padding;
  const top=Math.max(padding,Math.min(innerHeight-b.height-padding,above?a.top-b.height-gap:a.bottom+gap));
  this.element.style.left=`${left}px`;this.element.style.top=`${top}px`;this.element.dataset.side=above?'above':'below';
  this.element.style.setProperty('--tooltip-arrow',`${Math.max(22,Math.min(b.width-22,a.left+a.width/2-left))}px`);
 }
}
