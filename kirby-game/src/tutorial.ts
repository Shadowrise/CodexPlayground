import {t,onLocaleChange} from './i18n';
import {TutorialProgress,TUTORIAL_STEPS,type TutorialScheme,type TutorialStep} from './tutorial-state';
import {TASK_ROUTE_ICON} from './tasks';
import './tutorial.css';

const CONTENT:Record<TutorialStep,readonly [string,string]>={
 welcome:['Привет, я Ветерок!','Добро пожаловать на полянку! Я помогу тебе освоиться. Здесь можно играть, исследовать и заводить новых друзей.'],
 score:['Зарабатывай очки!','Кушай фрукты и участвуй в приключениях — так ты зарабатываешь очки. Фрукты съедаются сами, когда ты подходишь совсем близко. Каждый фрукт даёт Кирби энергию и ненадолго ускоряет его. Если Кирби кажется тебе слишком толстым, купание в радужном фонтане позволит ему скинуть лишний вес.'],
 modes:['Два режима игры','В одиночной игре ты соревнуешься по очкам только с другими кирби. Играй сколько хочется — игра не заканчивается.\n\nВ сетевой игре ты соревнуешься по очкам с другими игроками. Когда кто-то первым пройдёт все приключения, начнётся финальный звездопад. После него появятся итоги, и сессия завершится.'],
 interact:['Играй на полянке','Подойди к светлячку, лодочке или другому интерактивному предмету. Когда он подсветится, можно взаимодействовать!'],
 adventures:['Твои приключения','Здесь собраны приключения на полянке. За первое прохождение каждого приключения ты получаешь очки.'],
 route:['Не знаешь, как найти приключение?','Или выбери место в помощнике «Куда пойдём?». Стрелочка над Кирби покажет направление и расстояние.'],
 chat:['Общение с друзьями','Нажми Enter, чтобы открыть чат. Напиши сообщение и снова нажми Enter, чтобы отправить его. Escape — закрыть чат. В онлайн-игре сообщение увидят все игроки.'],
 'good-luck':['Удачи, мой друг!','Тебя ждут друзья и чудесные приключения!'],
};
const TOUCH_CHAT='Коснись кнопки «Чат». Напиши сообщение и нажми «Отправить». Сообщения останутся на экране; «Отмена» закрывает чат. В онлайн-игре сообщение увидят все игроки.';
const PAD_CHAT={keyboard:'Для чата выбери «Клавиатура и мышь» в настройках.',touch:'Для чата выбери «Сенсорный экран» в настройках.'};
const ACTION:Record<TutorialScheme,readonly [string,string]>={
 keyboard:['E','Нажми E, чтобы взаимодействовать.'],
 gamepad:['Y','Нажми Y на геймпаде, чтобы взаимодействовать.'],
 touch:['Действие','Коснись кнопки «Действие». Она появляется рядом с интерактивным предметом.'],
};
const HINT:Record<TutorialScheme,string>={
 keyboard:'Щёлкни в любом месте или нажми E — дальше.',
 gamepad:'Y или A — дальше · B — пропустить.',
 touch:'Коснись экрана в любом месте — дальше.',
};
type Options={scheme:TutorialScheme;storage?:Pick<Storage,'getItem'|'setItem'>;adventures:HTMLElement;route:HTMLElement;onOpen:()=>void;onClose:()=>void};

/** DOM-only tour: no scene objects, lights, network requests or idle frame work. */
export class MeadowTutorial {
 readonly root=document.createElement('section');
 private progress:TutorialProgress;
 private card=document.createElement('article');
 private shade=document.createElement('div');
 private spotlight=document.createElement('div');
 private heading=document.createElement('h2');
 private message=document.createElement('p');
 private content=document.createElement('div');
 private speaker=document.createElement('strong');
 private counter=document.createElement('span');
 private dots=document.createElement('div');
 private action=document.createElement('div');
 private hint=document.createElement('small');
 private skipButton=document.createElement('button');
 private nextButton=document.createElement('button');
 private scheme:TutorialScheme;
 private readonly mobile=document.body.classList.contains('touch-ui');
 private tasksHidden?:boolean;
 private scrollBefore=0;
 private frame=0;
 private resize=new ResizeObserver(()=>this.scheduleLayout());
 private focusBefore?:HTMLElement;
 get active(){return this.progress.active;}
 constructor(private options:Options){
  this.progress=new TutorialProgress(options.storage);this.scheme=options.scheme;
  this.root.id='meadow-tutorial';this.root.hidden=true;this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');this.root.setAttribute('aria-labelledby','tutorial-heading');this.root.setAttribute('aria-describedby','tutorial-message');
  this.shade.className='tutorial-shade';this.spotlight.className='tutorial-spotlight';this.spotlight.hidden=true;
  this.card.className='tutorial-card';this.card.tabIndex=-1;
  const header=document.createElement('header'),portrait=document.createElement('div'),identity=document.createElement('div');
  portrait.className='breezy-portrait';portrait.setAttribute('aria-hidden','true');
  // A smiling little wind-cloud with a curled forelock and flowing breeze tails.
  portrait.innerHTML='<svg viewBox="0 0 100 100"><defs><linearGradient id="breezy-face" x2=".7" y2="1"><stop stop-color="#f5fcff"/><stop offset="1" stop-color="#93d7e7"/></linearGradient></defs><circle cx="50" cy="50" r="47" fill="#79cfdb18"/><path d="M13 43H3m13 13H7m9 14H2" fill="none" stroke="#9ddde7" stroke-width="3" stroke-linecap="round"/><path d="M22 70C7 65 11 41 25 39c-1-15 15-24 27-19 7-16 32-11 33 6 15 2 17 23 7 32 4 17-12 26-25 22-8 9-28 7-34-1-13 1-22-2-27-7 8 2 12 1 16-2Z" fill="url(#breezy-face)" stroke="#daeff8" stroke-width="2"/><path d="M51 26c15-16 30-1 19 7-7 5-16-3-10-8" fill="none" stroke="#62b8d0" stroke-width="3" stroke-linecap="round"/><g class="breezy-eyes" fill="#214958"><ellipse cx="40" cy="51" rx="3.3" ry="5"/><ellipse cx="69" cy="51" rx="3.3" ry="5"/><circle cx="41" cy="49" r="1" fill="#fff"/><circle cx="70" cy="49" r="1" fill="#fff"/></g><ellipse cx="33" cy="61" rx="6" ry="3.5" fill="#f0a9b8" opacity=".75"/><ellipse cx="77" cy="61" rx="6" ry="3.5" fill="#f0a9b8" opacity=".75"/><path d="M47 62q8 11 16 0" fill="#a84f71" stroke="#335f6e" stroke-width="2" stroke-linecap="round"/><path d="M50 67q6-4 11 0" fill="#ffa9bc"/><path d="M84 18q5-10 12-9-1 10-12 9Z" fill="#a9ce86"/><path d="m84 18 8-5" stroke="#59877c" stroke-width="1.2"/></svg>';
  identity.className='tutorial-speaker';this.speaker.className='tutorial-name';this.counter.className='tutorial-counter';identity.append(this.speaker,this.counter);header.append(portrait,identity);
  this.heading.id='tutorial-heading';this.message.id='tutorial-message';
  this.content.className='tutorial-content';this.content.setAttribute('aria-live','polite');this.content.append(this.heading,this.message,this.action);
  this.action.className='tutorial-action';this.dots.className='tutorial-dots';this.dots.setAttribute('aria-hidden','true');
  TUTORIAL_STEPS.forEach(()=>this.dots.append(document.createElement('i')));
  this.hint.className='tutorial-hint';const buttons=document.createElement('nav');
  this.skipButton.id='tutorial-skip';this.nextButton.id='tutorial-next';this.skipButton.type=this.nextButton.type='button';buttons.append(this.skipButton,this.nextButton);
  this.card.append(header,this.content,this.dots,this.hint,buttons);this.root.append(this.shade,this.spotlight,this.card);document.body.append(this.root);
  // Capture before game handlers, including the last click that closes the tour.
  window.addEventListener('click',e=>{if(!this.active)return;e.preventDefault();e.stopImmediatePropagation();if((e.target as Element)?.closest('#tutorial-skip'))this.skip();else this.next();},true);
  window.addEventListener('contextmenu',e=>{if(!this.active)return;e.preventDefault();e.stopImmediatePropagation();this.next();},true);
  for(const name of ['pointerdown','pointerup','pointermove','mousedown','mouseup','mousemove','wheel'] as const)window.addEventListener(name,e=>{if(this.active){e.stopImmediatePropagation();if(name==='wheel'&&!(e.target as Element)?.closest('.tutorial-card'))e.preventDefault();}},{capture:true,passive:false});
  window.addEventListener('keydown',e=>{
   if(!this.active||e.ctrlKey||e.metaKey||e.altKey)return;
   e.preventDefault();e.stopImmediatePropagation();
   if(e.key==='Tab'){(document.activeElement===this.skipButton?this.nextButton:this.skipButton).focus();return;}
   if(e.repeat)return;
   if(e.code==='Escape')this.skip();
   else if(['KeyE','Enter','Space'].includes(e.code)){if(document.activeElement===this.skipButton&&(e.code==='Enter'||e.code==='Space'))this.skip();else this.next();}
  },true);
  window.addEventListener('keyup',e=>{if(this.active){e.preventDefault();e.stopImmediatePropagation();}},true);
  window.addEventListener('resize',()=>this.scheduleLayout());window.visualViewport?.addEventListener('resize',()=>this.scheduleLayout());
  onLocaleChange(()=>{if(this.active)this.render();});
 }
 open(force=false){
  if(!force&&this.progress.completed)return;
  this.options.onOpen();this.progress.start(force);this.focusBefore=document.activeElement instanceof HTMLElement?document.activeElement:undefined;
  this.scrollBefore=this.options.adventures.parentElement?.scrollTop??0;
  for(const element of [this.options.adventures,this.options.route,this.options.adventures.parentElement?.querySelector('.player-stats')])if(element)this.resize.observe(element);
  this.root.hidden=false;document.body.classList.add('tutorial-open');this.render();this.card.focus({preventScroll:true});
 }
 setScheme(scheme:TutorialScheme){if(this.scheme===scheme)return;this.scheme=scheme;if(this.active)this.render();}
 gamepad(pressed:ReadonlySet<number>){if(!this.active)return;if(pressed.has(1))this.skip();else if(pressed.has(3)||pressed.has(0))this.next();}
 next(){if(!this.active)return;this.progress.next();if(this.active)this.render();else this.close();}
 skip(){if(!this.active)return;this.progress.skip();this.close();}
 cancel(){if(!this.active)return;this.progress.cancel();this.close();}
 private restoreTasks(){
  if(this.tasksHidden===undefined)return;
  this.options.adventures.querySelector<HTMLElement>('#task-list')!.hidden=this.tasksHidden;
  this.options.adventures.querySelector('#tasks-toggle')!.setAttribute('aria-expanded',String(!this.tasksHidden));this.tasksHidden=undefined;
 }
 private close(){
  cancelAnimationFrame(this.frame);this.frame=0;this.resize.disconnect();this.restoreTasks();this.root.hidden=true;document.body.classList.remove('tutorial-open');
  if(this.options.adventures.parentElement)this.options.adventures.parentElement.scrollTop=this.scrollBefore;
  this.options.onClose();this.focusBefore?.focus({preventScroll:true});
 }
 private render(){
  this.restoreTasks();const step=this.progress.step,[title,text]=CONTENT[step];this.root.dataset.step=step;
  this.speaker.textContent=t('Ветерок');this.counter.textContent=t('Шаг {0} из {1}',[this.progress.index+1,TUTORIAL_STEPS.length]);
  this.heading.textContent=t(title);this.message.textContent=t(this.progress.step==='chat'&&this.mobile?TOUCH_CHAT:text);
  if(step==='chat'&&this.scheme==='gamepad')this.message.textContent=t(PAD_CHAT[this.mobile?'touch':'keyboard'])+' '+this.message.textContent;
  this.hint.textContent=t(HINT[this.scheme]);
  this.skipButton.textContent=t('Пропустить обучение');this.nextButton.textContent=t(step==='good-luck'?'Начать приключение':'Дальше');
  [...this.dots.children].forEach((dot,i)=>dot.classList.toggle('current',i===this.progress.index));
  this.action.replaceChildren();this.action.hidden=step!=='interact'&&step!=='route';
  this.content.replaceChildren(this.heading,...(step==='route'?[this.action,this.message]:[this.message,this.action]));this.content.scrollTop=0;
  if(step==='interact'){const [button,label]=ACTION[this.scheme],key=document.createElement('b'),explanation=document.createElement('span');key.textContent=t(button);key.className=this.scheme==='touch'?'touch-action-preview':'action-key';explanation.textContent=t(label);this.action.append(key,explanation);}
  if(step==='route'){
   const icon=document.createElement('span'),explanation=document.createElement('span');icon.className='task-route tutorial-route-preview';icon.setAttribute('aria-hidden','true');icon.innerHTML=TASK_ROUTE_ICON;
   explanation.textContent=t('Нажми такую стрелочку справа от нужного приключения — указатель покажет путь.');this.action.append(icon,explanation);
  }
  if(step==='adventures'){
   const list=this.options.adventures.querySelector<HTMLElement>('#task-list')!;this.tasksHidden=list.hidden;list.hidden=false;this.options.adventures.querySelector('#tasks-toggle')!.setAttribute('aria-expanded','true');
  }
  this.scheduleLayout();
 }
 private scheduleLayout(){if(!this.active)return;cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>{this.frame=0;this.layout();});}
 private layout(){
  if(!this.active)return;
  const target=this.progress.step==='adventures'?this.options.adventures:this.progress.step==='route'?this.options.route:undefined;
  target?.scrollIntoView({block:'nearest',inline:'nearest'});
  const pad=16,gap=18,w=innerWidth,h=innerHeight,card=this.card.getBoundingClientRect();
  let x=(w-card.width)/2,y=(h-card.height)/2;
  this.spotlight.hidden=!target;this.shade.hidden=!!target;
  if(target){
   const box=target.getBoundingClientRect(),left=Math.max(pad/2,box.left-5),top=Math.max(pad/2,box.top-5),right=Math.min(w-pad/2,box.right+5),bottom=Math.min(h-pad/2,box.bottom+5);
   Object.assign(this.spotlight.style,{left:`${left}px`,top:`${top}px`,width:`${right-left}px`,height:`${bottom-top}px`});
   if(left-gap-card.width>=pad){x=left-gap-card.width;y=top;}
   else if(right+gap+card.width<=w-pad){x=right+gap;y=top;}
   else if(bottom+gap+card.height<=h-pad)y=bottom+gap;
   else if(top-gap-card.height>=pad)y=top-gap-card.height;
   else {x=box.left+box.width/2>w/2?pad:w-card.width-pad;y=box.top+box.height/2>h/2?pad:h-card.height-pad;}
  }
  Object.assign(this.card.style,{left:`${Math.max(pad,Math.min(w-card.width-pad,x))}px`,top:`${Math.max(pad,Math.min(h-card.height-pad,y))}px`});
 }
}
