import {SCORE_ACTIONS,type ScoreAction} from './score';
export const TASK_NAMES:Record<ScoreAction,string>={
 skyStar:'Добыть звёздочку Небесной тропы',mill:'Повернуть рычаг мельницы',sleep:'Поспать в домике Кирби',coaster:'Проехать круг на горках',bench:'Посидеть на лавочке',balloon:'Полетать на воздушном шаре',treehouse:'Подняться в домик на дереве',swing:'Покачаться на качелях',leaves:'Прыгнуть с дерева в листья',trampoline:'Прыгнуть на батуте в лабиринте',star:'Найти звёздочку в лабиринте',swim:'Покупаться в любом озере',firefly:'Покататься на светлячке',
};
const alphabet=new Intl.Collator('ru');
export function sortedTasks(done:ReadonlySet<ScoreAction>){return SCORE_ACTIONS.map(id=>({id,name:TASK_NAMES[id],done:done.has(id)})).sort((a,b)=>Number(a.done)-Number(b.done)||alphabet.compare(a.name,b.name));}
export class TaskList {
 private signature='';
 private rows=new Map<ScoreAction,{row:HTMLLIElement;mark:HTMLElement;state:HTMLElement}>();
 constructor(private list:HTMLOListElement,private count:HTMLElement,button:HTMLButtonElement){
  button.addEventListener('click',()=>{const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));list.hidden=!open;});
  this.update(new Set());
 }
 update(done:ReadonlySet<ScoreAction>){
  const signature=SCORE_ACTIONS.map(id=>done.has(id)?'1':'0').join('');if(signature===this.signature)return;
  const animate=this.signature!=='' && !this.list.hidden && this.list.getClientRects().length>0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const before=new Map<ScoreAction,number>();
  for(const [id,{row}] of this.rows){if(animate)before.set(id,row.getBoundingClientRect().top);row.getAnimations().forEach(a=>a.cancel());}
  this.signature=signature;
  const tasks=sortedTasks(done);this.count.textContent=`${tasks.filter(t=>t.done).length} / ${tasks.length}`;
  for(const task of tasks){
   let entry=this.rows.get(task.id);
   if(!entry){
    const row=document.createElement('li'),mark=document.createElement('span'),text=document.createElement('span'),state=document.createElement('span');
    mark.className='task-check';mark.setAttribute('aria-hidden','true');text.textContent=task.name;state.className='sr-only';text.append(state);row.append(mark,text);
    entry={row,mark,state};this.rows.set(task.id,entry);
   }
   entry.row.className=task.done?'task done':'task';entry.mark.textContent=task.done?'✓':'';entry.state.textContent=task.done?' — выполнено':' — ещё не выполнено';
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
