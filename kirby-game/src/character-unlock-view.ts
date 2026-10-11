import {onLocaleChange,t} from './i18n';
import {styleVariant,type KirbyVariant} from './variants';

/** A short notification, with no scene geometry or rendering-loop work. */
export class CharacterUnlockView {
 readonly element=document.createElement('button');
 private heading=document.createElement('strong');
 private name=document.createElement('span');
 private detail=document.createElement('span');
 private variant?:KirbyVariant;
 private timer?:ReturnType<typeof setTimeout>;
 private fade?:Animation;
 constructor(private celebrate:()=>void){
  this.element.id='character-unlock';this.element.type='button';this.element.hidden=true;this.element.dataset.i18nIgnore='';
  this.element.setAttribute('aria-live','polite');this.element.setAttribute('aria-atomic','true');
  this.element.addEventListener('click',()=>this.dismiss());
  const portrait=document.createElement('span');portrait.className='unlock-portrait';portrait.setAttribute('aria-hidden','true');
  portrait.innerHTML='<span class="mini-kirby"><i class="mini-feet"></i><i class="mini-body"><i class="mini-eyes"></i><i class="mini-mouth"></i></i></span>';
  const text=document.createElement('span');text.className='unlock-copy';
  this.heading.className='unlock-heading';this.name.className='unlock-name';this.detail.className='unlock-detail';text.append(this.heading,this.name,this.detail);
  this.element.append(portrait,text);document.body.append(this.element);
  onLocaleChange(()=>this.localize());this.localize();
 }
 private localize(){
  this.heading.textContent=t('Персонаж разблокирован!');this.name.textContent=this.variant?t(this.variant[0]):'';
  this.detail.textContent=t('Теперь его можно выбрать в меню.');
 }
 show(variant:KirbyVariant){
  this.hide();
  this.variant=variant;styleVariant(this.element,variant);this.localize();
  this.element.hidden=false;this.celebrate();
  this.timer=setTimeout(()=>this.dismiss(),10000);
 }
 private dismiss(){
  if(this.element.hidden||this.fade)return;
  clearTimeout(this.timer);this.timer=undefined;
  this.fade=this.element.animate([{opacity:getComputedStyle(this.element).opacity},{opacity:0}],{duration:600,easing:'ease-out',fill:'forwards'});
  this.fade.onfinish=()=>this.hide();
 }
 hide(){clearTimeout(this.timer);this.timer=undefined;this.fade?.cancel();this.fade=undefined;this.element.hidden=true;}
}
