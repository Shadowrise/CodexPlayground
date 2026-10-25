import type {KnightBattle} from './meta-knight-battle';
import {knightHealthPhases} from './meta-knight-health';
import {onLocaleChange,t} from './i18n';

/** Four stable sections reveal the whole fight, including the six-hit finale. */
export class MetaKnightHealthBar{
 readonly element=document.createElement('div');
 private sections=knightHealthPhases(undefined).map(p=>{
  const element=document.createElement('div'),label=document.createElement('span'),index=document.createElement('b'),count=document.createElement('span'),hits=document.createElement('span');
  element.className='knight-health-phase';element.dataset.phase=String(p.phase);label.className='knight-health-label';index.textContent=['I','II','III','IV'][p.phase-1];count.className='knight-health-count';hits.className='knight-health-hits';label.append(index,count);
  const cells=Array.from({length:p.maximum},()=>{const cell=document.createElement('i');cell.className='knight-health-hit';hits.append(cell);return cell;});element.append(label,hits);element.setAttribute('aria-hidden','true');
  return {element,count,cells};
 });
 private state?:Pick<KnightBattle,'phase'|'hp'>;
 private unsubscribe=onLocaleChange(()=>this.update(this.state));
 constructor(){this.element.className='knight-health';this.element.setAttribute('role','progressbar');this.element.setAttribute('aria-valuemin','0');this.element.append(...this.sections.map(p=>p.element));this.update(undefined);}
 update(s:Pick<KnightBattle,'phase'|'hp'>|undefined){
  this.state=s?{phase:s.phase,hp:s.hp}:undefined;const phases=knightHealthPhases(s),remaining=phases.reduce((n,p)=>n+p.remaining,0),maximum=phases.reduce((n,p)=>n+p.maximum,0);
  this.element.setAttribute('aria-label',t('Здоровье Метакнайта'));this.element.setAttribute('aria-valuemax',String(maximum));this.element.setAttribute('aria-valuenow',String(remaining));
  this.element.setAttribute('aria-valuetext',phases.map(p=>t('Фаза {0}: осталось попаданий {1} из {2}',[p.phase,p.remaining,p.maximum])).join('. '));
  phases.forEach((p,i)=>{const section=this.sections[i];section.element.dataset.state=p.state;section.count.textContent=`${p.remaining}/${p.maximum}`;section.cells.forEach((cell,hit)=>cell.dataset.filled=String(hit<p.remaining));});
 }
 dispose(){this.unsubscribe();this.element.remove();}
}
