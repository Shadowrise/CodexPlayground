/** Request the whole page, so game controls and dialogs remain in fullscreen. */
export function createFullscreenControls(){
 const panel=document.createElement('div');panel.className='fullscreen-controls';
 const button=document.createElement('button');button.id='fullscreen-toggle';button.type='button';
 const hint=document.createElement('p');hint.id='fullscreen-hint';hint.setAttribute('role','status');
 panel.append(button,hint);
 const supported=!!document.fullscreenEnabled&&typeof document.documentElement.requestFullscreen==='function';
 const standalone=matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone;
 button.hidden=!supported;
 const update=()=>{
  const active=!!document.fullscreenElement;
  button.textContent=active?'Выйти из полного экрана':'⛶ На весь экран';
  button.setAttribute('aria-pressed',String(active));
  hint.textContent=supported?(active?'Вернуться можно этой кнопкой или системной кнопкой «Назад».':'Скроет адресную строку и освободит место для игры.'):
   standalone?'Игра уже открыта как отдельное приложение.':'Браузер не поддерживает кнопку полного экрана. На iPhone открой игру в Safari: «Поделиться» → «На экран Домой», затем запусти с новой иконки. Если предлагается «Открывать как веб-приложение», включи эту опцию.';
 };
 button.addEventListener('click',async()=>{
  button.disabled=true;
  try{
   if(document.fullscreenElement)await document.exitFullscreen();
   else await document.documentElement.requestFullscreen({navigationUI:'hide'});
   update();
  }catch{
   hint.textContent='Браузер не разрешил полный экран. Попробуй открыть игру в отдельной вкладке и нажать ещё раз.';
  }finally{button.disabled=false;}
 });
 document.addEventListener('fullscreenchange',update);update();return panel;
}
