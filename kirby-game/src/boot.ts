import {initializeLocale,localizeDOM,onLocaleChange,t} from './i18n';
import {preloadGameAssets} from './game-assets';
preloadGameAssets(import.meta.env.BASE_URL);
let languageStorage:Storage|undefined;try{languageStorage=localStorage;}catch{}
initializeLocale(languageStorage,navigator.languages?.length?navigator.languages:[navigator.language]);
const updateTitle=()=>{document.title=t('Кирби: Полянка друзей');};
updateTitle();onLocaleChange(updateTitle);
localizeDOM();
/** Paint the lightweight loading screen before importing the procedural scene. */
const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
const blocked=[...document.body.children].filter((el):el is HTMLElement=>el instanceof HTMLElement&&el.id!=='startup-loader'&&!el.inert);
blocked.forEach(el=>el.inert=true);
const retry=document.querySelector<HTMLButtonElement>('#loading-retry')!;
retry.addEventListener('click',()=>location.reload());
let menuShown=false;
const showMenu=()=>{
 menuShown=true;localizeDOM();document.querySelector<HTMLElement>('#character-select')!.inert=false;
 document.body.classList.remove('loading');document.body.setAttribute('aria-busy','false');
 document.querySelector<HTMLElement>('#startup-loader')!.hidden=true;
 document.querySelector<HTMLButtonElement>('#new-game')?.focus();
 performance.mark('kirby-menu-ready');
};
document.addEventListener('kirby-menu-ready',showMenu,{once:true});
try {
 await frame();await frame();
 const game=await import('./main');
 await game.ready;
 blocked.forEach(el=>el.inert=false);
 if(!menuShown)showMenu();
 performance.mark('kirby-game-ready');
} catch(error) {
 document.dispatchEvent(new Event('kirby-startup-failed'));
 console.error('Game startup failed',error);
 document.body.classList.add('loading');document.querySelector<HTMLElement>('#startup-loader')!.hidden=false;
 document.querySelector('#loading-title')!.textContent=t('Не удалось загрузить игру');
 document.querySelector('#loading-detail')!.textContent=t('Проверь подключение и попробуй ещё раз.');
 document.querySelector<HTMLElement>('.loading-orbit')!.hidden=true;
 retry.hidden=false;retry.focus();
}
export {};
