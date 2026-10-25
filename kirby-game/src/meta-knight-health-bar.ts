import type {KnightBattle} from './meta-knight-battle';
import {knightHealthPhases} from './meta-knight-health';
import {onLocaleChange,t} from './i18n';

/** One compact track; wider golden breaks separate the four groups of hits. */
export class MetaKnightHealthBar{
 readonly element=document.createElement('div');
 private sections=knightHealthPhases(undefined).map(p=>{
  const element=document.createElement('span');element.className='knight-health-phase';element.dataset.phase=String(p.phase);element.setAttribute('aria-hidden','true');
  const cells=Array.from({length:p.maximum},()=>{const cell=document.createElement('i');cell.className='knight-health-hit';element.append(cell);return cell;});
  return {element,cells};
 });
 private state?:Pick<KnightBattle,'phase'|'hp'>;
 private unsubscribe=onLocaleChange(()=>this.update(this.state));
 constructor(){
  this.element.className='knight-health';this.element.setAttribute('role','progressbar');this.element.setAttribute('aria-valuemin','0');
  this.sections.forEach((p,i)=>{if(i){const divider=document.createElement('span');divider.className='knight-health-divider';divider.setAttribute('aria-hidden','true');this.element.append(divider);}this.element.append(p.element);});this.update(undefined);
 }
 update(s:Pick<KnightBattle,'phase'|'hp'>|undefined){
  this.state=s?{phase:s.phase,hp:s.hp}:undefined;const phases=knightHealthPhases(s),remaining=phases.reduce((n,p)=>n+p.remaining,0),maximum=phases.reduce((n,p)=>n+p.maximum,0);
  this.element.setAttribute('aria-label',t('Здоровье Метакнайта'));this.element.setAttribute('aria-valuemax',String(maximum));this.element.setAttribute('aria-valuenow',String(remaining));
  this.element.setAttribute('aria-valuetext',phases.map(p=>t('Фаза {0}: осталось попаданий {1} из {2}',[p.phase,p.remaining,p.maximum])).join('. '));
  phases.forEach((p,i)=>{const section=this.sections[i];section.element.dataset.state=p.state;section.cells.forEach((cell,hit)=>cell.dataset.filled=String(hit<p.remaining));});
 }
 dispose(){this.unsubscribe();this.element.remove();}
}
