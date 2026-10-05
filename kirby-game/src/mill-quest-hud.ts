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
 update(q:MillQuest,id:string,now:number,pushKey:string,actionKey:string,visible:boolean){
  this.element.hidden=!visible||q.owner!==id||q.stage==='idle'||q.stage==='running'&&now-q.deliveredAt>8000;
  if(this.element.hidden)return;
  const wrong=q.rejectedAt>0&&now-q.rejectedAt<1800;
  const needed=MILL_COLOR_NAMES[q.order[q.delivered]];
  const text=q.stage==='clear'?`Подойди к веточкам в ручье и толкни их: нажми ${pushKey} · Убрано ${q.branches.filter(Boolean).length}/3`
   :q.stage==='flow'?q.gate===1?`Не трогай рычаг. Подожди ещё ${Math.max(0,3-Math.floor((now-q.steadyAt)/1000))} с`:`Нажимай ${actionKey} у рычага, пока стрелка не попадёт в зелёную зону`
   :q.stage==='bags'?wrong?`Этот цвет не подошёл. Найди ${needed} мешочек и подойди к нему`
    :q.carried<0?`Найди ${needed} мешочек на полянке. Подойди к нему, чтобы взять · ${q.delivered}/3`
    :q.carried!==q.order[q.delivered]?`Верни этот мешочек в воронку (${actionKey}), затем найди ${needed}`
    :`Отнеси ${needed} мешочек к воронке и нажми ${actionKey} · Загружено ${q.delivered}/3`
   :'Ты запустил мельницу! Полюбуйся радужными пузырями';
  const signature=JSON.stringify([q.stage,text,q.order,q.delivered]);if(signature===this.signature)return;this.signature=signature;
  this.title.textContent=q.stage==='running'?'Радужная мельница · Готово!':`Радужная мельница · Шаг ${q.stage==='clear'?1:q.stage==='flow'?2:3}/3`;
  this.message.textContent=text;this.order.replaceChildren();this.order.hidden=q.stage!=='bags';
  if(q.stage==='bags')q.order.forEach((color,i)=>{const chip=document.createElement('span');chip.style.setProperty('--bag-color',MILL_COLORS[color]);chip.textContent=i<q.delivered?'✓':String(i+1);chip.className=i===q.delivered?'current':'';chip.title=MILL_COLOR_NAMES[color];chip.setAttribute('aria-label',`${i+1}: ${MILL_COLOR_NAMES[color]}${i<q.delivered?', загружен':''}`);this.order.append(chip);});
 }
}
