import {AnimationClip} from 'three';
let pending:Promise<AnimationClip[]>|undefined;
export function loadMetapidgieBossClips(){
 if(!pending)pending=fetch(import.meta.env.BASE_URL+'models/metapidgie-boss-phase1.json?v=1').then(async response=>{
  if(!response.ok)throw Error('Модель Мета Пиджи ещё не загрузилась');
  const data=await response.json();if(data.version!==1||!Array.isArray(data.clips))throw Error('Модель Мета Пиджи ещё не загрузилась');
  return data.clips.map((clip:Parameters<typeof AnimationClip.parse>[0])=>AnimationClip.parse(clip));
 }).catch(error=>{pending=undefined;throw error;});
 return pending;
}
