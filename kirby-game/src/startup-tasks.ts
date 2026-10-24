let inputPaint:Promise<void>|undefined;
/** Reserve a painted frame for menu feedback before continuing background work. */
export function prioritizeStartupUI(){
 const input=(event:Event)=>{
  if(inputPaint||!document.body.classList.contains('choosing')||!(event.target instanceof Element)||!event.target.closest('#character-select'))return;
  inputPaint=new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{inputPaint=undefined;resolve();})));
 };
 for(const type of ['pointerdown','click','keydown','input'])document.addEventListener(type,input,{capture:true,passive:true});
}
/** Scene preparation stays below input and rendering in the browser's task queue. */
export function startupTask():Promise<void>{
 const scheduler=(globalThis as typeof globalThis&{scheduler?:{postTask:(callback:()=>void|Promise<void>,options:{priority:'background'})=>Promise<void>}}).scheduler;
 return scheduler?scheduler.postTask(()=>inputPaint,{priority:'background'}):new Promise(resolve=>setTimeout(()=>{if(inputPaint)void inputPaint.then(resolve);else resolve();},0));
}
export function startupFrame(){return new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}
/** rAF runs before paint; the following task lets the changed UI reach the screen. */
export async function startupPaint(){await startupFrame();await startupTask();}

/** Spend at most a small part of a frame before returning control to the menu. */
export function startupBudget(milliseconds=6){
 let deadline=performance.now()+milliseconds;
 return ()=>{
  if(performance.now()<deadline)return;
  return startupTask().then(()=>{deadline=performance.now()+milliseconds;});
 };
}
export async function startupWork<T>(work:Generator<unknown,T>):Promise<T>{
 const budget=startupBudget();
 for(;;){const step=work.next();if(step.done)return step.value;const pause=budget();if(pause)await pause;}
}
