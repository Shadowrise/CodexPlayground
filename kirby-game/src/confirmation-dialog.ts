import {t} from './i18n';

export class ConfirmationDialog {
 readonly element=document.createElement('dialog');
 private readonly cancelButton=document.createElement('button');
 private readonly confirmButton=document.createElement('button');
 private readonly hint=document.createElement('p');
 private resolve:((confirmed:boolean)=>void)|undefined;
 private usingGamepad:boolean|undefined;
 constructor(id:string,title:string,message:string,confirmLabel:string){
  const dialog=this.element;dialog.id=id;dialog.className='confirmation-dialog';
  const heading=document.createElement('h2');heading.id=id+'-title';heading.textContent=t(title);
  const description=document.createElement('p');description.id=id+'-description';description.className='confirmation-description';description.textContent=t(message);
  dialog.setAttribute('aria-labelledby',heading.id);dialog.setAttribute('aria-describedby',description.id);dialog.setAttribute('aria-modal','true');
  const actions=document.createElement('div');actions.className='confirmation-actions';
  this.cancelButton.type=this.confirmButton.type='button';this.cancelButton.textContent=t('Отмена');this.cancelButton.autofocus=true;
  this.confirmButton.textContent=t(confirmLabel);this.confirmButton.className='confirmation-primary';
  this.cancelButton.addEventListener('click',()=>dialog.close('cancel'));this.confirmButton.addEventListener('click',()=>dialog.close('confirm'));
  actions.append(this.cancelButton,this.confirmButton);this.hint.className='confirmation-hint';dialog.append(heading,description,actions,this.hint);document.body.append(dialog);
  dialog.addEventListener('close',()=>{const resolve=this.resolve;this.resolve=undefined;resolve?.(dialog.returnValue==='confirm');});
  dialog.addEventListener('keydown',event=>{
   // Modal keys must not reach the settings toggle or gameplay shortcuts.
   event.stopPropagation();
   if(event.key==='Escape'){event.preventDefault();dialog.close('cancel');}
   else if(event.key==='Tab'){event.preventDefault();this.navigate(event.shiftKey?-1:1);}
   else if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(event.key)){event.preventDefault();this.navigate(event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1);}
   else if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!event.repeat)this.confirmFocused();}
  });
  this.setGamepad(false);
 }
 get open(){return this.element.open;}
 ask(usingGamepad=false):Promise<boolean>{
  if(this.resolve)return Promise.resolve(false);
  this.setGamepad(usingGamepad);this.element.returnValue='';
  return new Promise(resolve=>{this.resolve=resolve;this.element.showModal();this.cancelButton.focus({preventScroll:true});});
 }
 setGamepad(active:boolean){
  if(this.usingGamepad===active)return;this.usingGamepad=active;this.element.classList.toggle('gamepad-navigation',active);
  this.hint.textContent=t(active?'Стик / крестовина — выбрать · A — подтвердить · B — отмена':'← / → — выбрать · Enter — подтвердить · Esc — отмена');
 }
 gamepad(pressed:ReadonlySet<number>,direction:number){
  if(!this.open)return;
  if(pressed.has(1)||pressed.has(9))this.element.close('cancel');
  else {if(direction)this.navigate(direction);if(pressed.has(0))this.confirmFocused();}
 }
 private navigate(direction:number){
  const buttons=[this.cancelButton,this.confirmButton],index=buttons.indexOf(document.activeElement as HTMLButtonElement);
  buttons[index<0?0:(index+direction+buttons.length)%buttons.length].focus({preventScroll:true});
 }
 private confirmFocused(){
  (document.activeElement===this.confirmButton?this.confirmButton:this.cancelButton).click();
 }
}
