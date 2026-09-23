/** Paint the lightweight loading screen before importing the procedural scene. */
const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
const blocked=[...document.body.children].filter((el):el is HTMLElement=>el instanceof HTMLElement&&el.id!=='startup-loader'&&!el.inert);
blocked.forEach(el=>el.inert=true);
const retry=document.querySelector<HTMLButtonElement>('#loading-retry')!;
retry.addEventListener('click',()=>location.reload());
try {
 await frame();await frame();
 const game=await import('./main');
 await game.ready;
 await frame();await frame();
 blocked.forEach(el=>el.inert=false);
 document.body.classList.remove('loading');document.body.setAttribute('aria-busy','false');
 document.querySelector<HTMLElement>('#startup-loader')!.hidden=true;
 document.querySelector<HTMLButtonElement>('#new-game')?.focus();
} catch(error) {
 console.error('Game startup failed',error);
 document.querySelector('#loading-title')!.textContent='Не удалось загрузить игру';
 document.querySelector('#loading-detail')!.textContent='Проверь подключение и попробуй ещё раз.';
 document.querySelector<HTMLElement>('.loading-orbit')!.hidden=true;
 retry.hidden=false;retry.focus();
}
export {};
