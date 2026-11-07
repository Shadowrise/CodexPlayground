import {AnimationClip} from 'three';
let pending:Promise<AnimationClip[]>|undefined;
export function loadMetapidgieBossClips(){
 if(!pending)pending=Promise.all(['metapidgie-boss-phase1.json?v=1','metapidgie-boss-phase2.json?v=1','metapidgie-boss-late.json?v=2'].map(async file=>{const response=await fetch(import.meta.env.BASE_URL+'models/'+file);
  if(!response.ok)throw Error('Модель Мета Пиджи ещё не загрузилась');
  const data=await response.json();if(data.version!==1||!Array.isArray(data.clips))throw Error('Модель Мета Пиджи ещё не загрузилась');
  return data;
 })).then(parts=>{
  if(parts.some(p=>p.sourceSha256!==parts[0].sourceSha256))throw Error('Модель Мета Пиджи ещё не загрузилась');
  return [...new Map(parts.flatMap(data=>data.clips).map((clip:Parameters<typeof AnimationClip.parse>[0])=>[clip.name,AnimationClip.parse(clip)])).values()];
 }).catch(error=>{pending=undefined;throw error;});
 return pending;
}
