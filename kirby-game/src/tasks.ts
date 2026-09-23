import {SCORE_ACTIONS,type ScoreAction} from './score';
export const TASK_NAMES:Record<ScoreAction,string>={
 mill:'Повернуть рычаг мельницы',sleep:'Поспать в домике Кирби',coaster:'Проехать круг на горках',bench:'Посидеть на лавочке',balloon:'Полетать на воздушном шаре',treehouse:'Подняться в домик на дереве',swing:'Покачаться на качелях',leaves:'Прыгнуть с дерева в листья',trampoline:'Прыгнуть на батуте в лабиринте',star:'Найти звёздочку в лабиринте',swim:'Покупаться в любом озере',
};
const alphabet=new Intl.Collator('ru');
export function sortedTasks(done:ReadonlySet<ScoreAction>){return SCORE_ACTIONS.map(id=>({id,name:TASK_NAMES[id],done:done.has(id)})).sort((a,b)=>Number(a.done)-Number(b.done)||alphabet.compare(a.name,b.name));}
export class TaskList {
 private signature='';
 constructor(private list:HTMLOListElement,private count:HTMLElement,button:HTMLButtonElement){
  button.addEventListener('click',()=>{const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));list.hidden=!open;});
  this.update(new Set());
 }
 update(done:ReadonlySet<ScoreAction>){
  const signature=SCORE_ACTIONS.map(id=>done.has(id)?'1':'0').join('');if(signature===this.signature)return;this.signature=signature;
  const tasks=sortedTasks(done);this.count.textContent=`${tasks.filter(t=>t.done).length} / ${tasks.length}`;
  const rows=tasks.map(task=>{
   const row=document.createElement('li');row.className=task.done?'task done':'task';
   const mark=document.createElement('span');mark.className='task-check';mark.textContent=task.done?'✓':'';mark.setAttribute('aria-hidden','true');
   const text=document.createElement('span');text.textContent=task.name;
   const state=document.createElement('span');state.className='sr-only';state.textContent=task.done?' — выполнено':' — ещё не выполнено';text.append(state);
   row.append(mark,text);return row;
  });this.list.replaceChildren(...rows);
 }
}
