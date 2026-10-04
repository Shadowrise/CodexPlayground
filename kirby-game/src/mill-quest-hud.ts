import {MILL_COLORS,MILL_COLOR_NAMES,type MillQuest} from './mill-quest';

/** Same event plaque as the starfall; DOM changes only when the instruction changes. */
export class MillQuestHud {
 readonly element=document.createElement('div');
 private title=document.createElement('strong');
 private message=document.createElement('div');
 private order=document.createElement('div');
 private signature='';
 constructor(){
  this.element.id='mill-quest-hud';this.element.hidden=true;this.element.setAttribute('role','status');
  this.element.className='event-hud';this.order.className='mill-bag-order';
  this.element.append(this.title,this.message,this.order);document.body.append(this.element);
 }
 update(q:MillQuest,id:string,now:number,pushKey:string,visible:boolean){
  this.element.hidden=!visible||q.owner!==id||q.stage==='idle'||q.stage==='running'&&now-q.deliveredAt>8000;
  if(this.element.hidden)return;
  const wrong=q.rejectedAt>0&&now-q.rejectedAt<1800;
  const text=q.stage==='clear'?`Толкни веточки (${pushKey}) · ${q.branches.filter(Boolean).length}/3`
   :q.stage==='flow'?q.gate===1?`Верно! Удержи поток · ${Math.max(0,3-Math.floor((now-q.steadyAt)/1000))} с`:`Переключай рычаг: ${q.gate===2?'слишком сильный поток':'слишком мало воды'} → зелёная зона`
   :q.stage==='bags'?wrong?'Не тот цвет — мешочек вернулся на полянку':`Нужен ${MILL_COLOR_NAMES[q.order[q.delivered]]} мешочек · ${q.carried<0?'найди его на полянке':'отнеси мешочек к воронке'} · ${q.delivered}/3`
   :'Мельница работает! Радужные пузыри для всей полянки';
  const signature=JSON.stringify([q.stage,text,q.order,q.delivered]);if(signature===this.signature)return;this.signature=signature;
  this.title.textContent=q.stage==='running'?'Радужная мельница · Готово!':`Радужная мельница · Шаг ${q.stage==='clear'?1:q.stage==='flow'?2:3}/3`;
  this.message.textContent=text;this.order.replaceChildren();this.order.hidden=q.stage!=='bags';
  if(q.stage==='bags')q.order.forEach((color,i)=>{const chip=document.createElement('span');chip.style.setProperty('--bag-color',MILL_COLORS[color]);chip.textContent=i<q.delivered?'✓':String(i+1);chip.className=i===q.delivered?'current':'';chip.title=MILL_COLOR_NAMES[color];chip.setAttribute('aria-label',`${i+1}: ${MILL_COLOR_NAMES[color]}${i<q.delivered?', загружен':''}`);this.order.append(chip);});
 }
}
