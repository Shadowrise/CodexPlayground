import {SCORE_ACTIONS,type ScoreAction,type ActiveScoreAction} from './score';
import {getLocale,t} from './i18n';
export const TASK_NAMES:Record<ActiveScoreAction,string>={
 centipede:'Подружиться с Топотушкой',
 boat:'Проплыть 10% круга на лодочке',
 fountain:'Покупаться в радужном фонтане',
 skyStar:'Добыть звёздочку Небесной тропы',millQuest:'Запустить радужную мельницу',sleep:'Поспать в домике Кирби',coaster:'Проехать круг на горках',bench:'Посидеть на лавочке',balloon:'Полетать на воздушном шаре',treehouse:'Подняться в домик на дереве',swing:'Покачаться на качелях',leaves:'Прыгнуть с дерева в листья',trampoline:'Прыгнуть на батуте в лабиринте',star:'Найти звёздочку в лабиринте',firefly:'Покататься на светлячке',
};
const alphabets={ru:new Intl.Collator('ru'),en:new Intl.Collator('en'),bg:new Intl.Collator('bg')};
export function sortedTasks(done:ReadonlySet<ScoreAction>){return SCORE_ACTIONS.map(id=>({id,name:t(TASK_NAMES[id]),done:done.has(id)})).sort((a,b)=>Number(a.done)-Number(b.done)||alphabets[getLocale()].compare(a.name,b.name));}
export class TaskList {
 private signature='';
 private rows=new Map<ScoreAction,{row:HTMLLIElement;mark:HTMLElement;state:HTMLElement;label:Text}>();
 constructor(private list:HTMLOListElement,private count:HTMLElement,button:HTMLButtonElement){
  button.addEventListener('click',()=>{const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));list.hidden=!open;});
  this.update(new Set());
 }
 update(done:ReadonlySet<ScoreAction>){
  const signature=getLocale()+SCORE_ACTIONS.map(id=>done.has(id)?'1':'0').join('');if(signature===this.signature)return;
  const animate=this.signature!=='' && !this.list.hidden && this.list.getClientRects().length>0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const before=new Map<ScoreAction,number>();
  for(const [id,{row}] of this.rows){if(animate)before.set(id,row.getBoundingClientRect().top);row.getAnimations().forEach(a=>a.cancel());}
  this.signature=signature;
  const tasks=sortedTasks(done);this.count.textContent=`${tasks.filter(t=>t.done).length} / ${tasks.length}`;
  for(const task of tasks){
   let entry=this.rows.get(task.id);
   if(!entry){
    const row=document.createElement('li'),mark=document.createElement('span'),text=document.createElement('span'),state=document.createElement('span');
    const label=document.createTextNode(task.name);mark.className='task-check';mark.setAttribute('aria-hidden','true');state.className='sr-only';text.append(label,state);row.append(mark,text);
    entry={row,mark,state,label};this.rows.set(task.id,entry);
   }
   entry.label.textContent=task.name;entry.row.className=task.done?'task done':'task';entry.mark.textContent=task.done?'✓':'';entry.state.textContent=t(task.done?' — выполнено':' — ещё не выполнено');
   this.list.append(entry.row);
  }
  // FLIP: keep each existing row at its old visual position, then slide to the new order.
  if(animate)for(const task of tasks){
   const {row}=this.rows.get(task.id)!,oldTop=before.get(task.id);if(oldTop===undefined)continue;
   const offset=oldTop-row.getBoundingClientRect().top;if(Math.abs(offset)<1)continue;
   row.animate([{transform:`translateY(${offset}px)`,zIndex:task.done?2:1},{transform:'translateY(0)',zIndex:task.done?2:1}],{duration:650,easing:'cubic-bezier(.22,1,.36,1)'});
  }
 }
}
