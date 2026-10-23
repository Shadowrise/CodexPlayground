import {onLocaleChange,t} from './i18n';

export const VIEW_DISTANCES=[240,360,750] as const;
export const DEFAULT_VIEW_DISTANCE=360;
const STORAGE_KEY='kirby-view-distance-v1';
export function parseViewDistance(value:string|null){const distance=Number(value);return VIEW_DISTANCES.find(d=>d===distance)??DEFAULT_VIEW_DISTANCE;}

/** The same setting controls fog and CPU culling; a culled object is already
 * fully covered by fog. Keep the camera range for the sun, moon and sky dome. */
export function createViewDistanceControl(change:(distance:number)=>void){
 let stored:string|null=null;try{stored=localStorage.getItem(STORAGE_KEY);}catch{}
 const label=document.createElement('label');label.className='input-device';
 const text=document.createElement('span'),select=document.createElement('select');select.id='view-distance';
 for(const distance of VIEW_DISTANCES)select.add(new Option('',String(distance)));
 select.value=String(parseViewDistance(stored));
 const localize=()=>{
  text.textContent=t('Дальность видимости');select.setAttribute('aria-label',t('Дальность видимости'));
  const names=['Близко · 240 м','Средняя · 360 м','Далеко · 750 м'];
  for(let i=0;i<names.length;i++)select.options[i].text=t(names[i]);
 };
 localize();onLocaleChange(localize);
 select.addEventListener('change',()=>{
  const distance=parseViewDistance(select.value);try{localStorage.setItem(STORAGE_KEY,String(distance));}catch{}
  change(distance);
 });
 label.append(text,select);change(parseViewDistance(select.value));return label;
}
