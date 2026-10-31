import {ClientUpdates} from './client-updates';

/** A non-modal notice: opening it never takes focus or pauses the game. */
export function watchClientUpdates(currentVersion:string,base:string){
 const banner=document.querySelector<HTMLElement>('#client-update')!;
 const update=document.querySelector<HTMLButtonElement>('#client-update-reload')!;
 const close=document.querySelector<HTMLButtonElement>('#client-update-close')!;
 let previousFocus:HTMLElement|null=null;
 const checker=new ClientUpdates(currentVersion,new URL('client-version.json',new URL(base,document.baseURI)).href,version=>{
  const restoreFocus=!version&&banner.contains(document.activeElement);
  banner.hidden=!version;
  if(restoreFocus){
   const target=previousFocus?.isConnected&&previousFocus.getClientRects().length?previousFocus:document.querySelector<HTMLElement>(document.body.classList.contains('choosing')?'#new-game':'#game canvas');
   target?.focus({preventScroll:true});
  }
 });
 banner.addEventListener('focusin',event=>{if(event.relatedTarget instanceof HTMLElement&&!banner.contains(event.relatedTarget))previousFocus=event.relatedTarget;});
 banner.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();checker.dismiss();}
  if(['Escape','Enter',' '].includes(event.key))event.stopPropagation();
 });
 close.addEventListener('click',()=>checker.dismiss());
 update.addEventListener('click',()=>{if(checker.availableVersion)location.reload();});
 const refresh=()=>{if(!document.hidden)void checker.check();};
 const timer=window.setInterval(refresh,60000);
 document.addEventListener('visibilitychange',refresh);
 window.addEventListener('online',refresh);
 window.addEventListener('focus',refresh);
 window.addEventListener('pageshow',refresh);
 // A new document checks even if it was opened in a background tab from cache.
 void checker.check();
 return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);for(const event of ['online','focus','pageshow'])window.removeEventListener(event,refresh);};
}
