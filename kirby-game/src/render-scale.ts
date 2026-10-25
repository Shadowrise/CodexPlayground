import {onLocaleChange,t} from './i18n';

export const RENDER_SCALES=[1,1.25] as const;
export const DEFAULT_RENDER_SCALE=1.25;
const KEY='kirby-render-scale-v1';
export function parseRenderScale(value:string|null,mobile=false){return RENDER_SCALES.find(scale=>scale===Number(value))??(mobile?RENDER_SCALES[0]:DEFAULT_RENDER_SCALE);}
export function createRenderScaleControl(change:(scale:number)=>void,mobile=false){
 let stored:string|null=null;try{stored=localStorage.getItem(KEY);}catch{}
 const label=document.createElement('label');label.className='input-device';
 const text=document.createElement('span'),select=document.createElement('select');select.id='render-scale';
 for(const scale of RENDER_SCALES)select.add(new Option('',String(scale)));
 select.value=String(parseRenderScale(stored,mobile));
 const localize=()=>{
  text.textContent=t('Масштаб рендера');select.setAttribute('aria-label',t('Масштаб рендера'));
  const names=['100% · быстрее','125% · чётче'];names.forEach((name,i)=>select.options[i].text=t(name));
 };
 localize();onLocaleChange(localize);
 select.addEventListener('change',()=>{const scale=parseRenderScale(select.value,mobile);try{localStorage.setItem(KEY,String(scale));}catch{}change(scale);});
 label.append(text,select);change(parseRenderScale(select.value,mobile));return label;
}
