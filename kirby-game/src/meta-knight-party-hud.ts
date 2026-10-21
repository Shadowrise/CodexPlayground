import {KNIGHT,type KnightBattle} from './meta-knight-battle';
import {KIRBY_VARIANTS,styleVariant} from './variants';
import {t} from './i18n';

export type KnightProfile={id:string;name:string;variant:number};
type PartyRow={element:HTMLDivElement;name:HTMLSpanElement;hearts:HTMLSpanElement;state:HTMLSpanElement;key:string};

/** Stable rows preserve scroll position while the room sends fresh battle snapshots. */
export class MetaKnightPartyHud{
 readonly element=document.createElement('section');
 private list=document.createElement('div');
 private rows=new Map<string,PartyRow>();
 private profiles=new Map<string,KnightProfile>();
 constructor(){
  this.element.id='knight-party-hud';this.element.className='panel';this.element.hidden=true;this.element.dataset.i18nIgnore='';
  this.list.className='knight-party-list';this.list.setAttribute('role','list');this.list.tabIndex=0;
  this.element.append(this.list);document.body.append(this.element);
 }
 update(s:KnightBattle|undefined,localId:string,profiles:readonly KnightProfile[],visible:boolean){
  this.element.hidden=!visible;if(!visible)return;
  for(const profile of profiles)this.profiles.set(profile.id,profile);
  this.element.setAttribute('aria-label',t('Участники дуэли'));this.list.setAttribute('aria-label',t('Жизни участников'));
  const ids=s?Object.keys(s.players):[localId];
  // Put your own character first and retain the encounter's order for teammates.
  ids.sort((a,b)=>Number(b===localId)-Number(a===localId));
  for(const [id,row] of this.rows)if(!ids.includes(id)){row.element.remove();this.rows.delete(id);}
  ids.forEach((id,index)=>{
   let row=this.rows.get(id);
   if(!row){
    const element=document.createElement('div'),name=document.createElement('span'),hearts=document.createElement('span'),state=document.createElement('span'),portrait=document.createElement('span');
    element.className='knight-party-row';element.dataset.playerId=id;element.setAttribute('role','listitem');name.className='stat-name';hearts.className='knight-party-hearts';state.className='knight-party-state';
    portrait.className='mini-kirby';portrait.setAttribute('aria-hidden','true');portrait.innerHTML='<i class="mini-feet"></i><i class="mini-body"><i class="mini-eyes"></i><i class="mini-mouth"></i></i>';
    const life=document.createElement('div');life.className='knight-party-life';life.append(hearts,state);element.append(name,portrait,life);row={element,name,hearts,state,key:''};this.rows.set(id,row);
   }
   if(this.list.children[index]!==row.element)this.list.insertBefore(row.element,this.list.children[index]??null);
   const profile=this.profiles.get(id),player=s?.players[id],hp=Math.max(0,Math.min(KNIGHT.hearts,player?.hp??KNIGHT.hearts));
   const name=profile?.name??t('Игрок'),variant=profile?.variant??0,state=player?.withdrawn?t('Дуэль прервана'):hp===0?t('Сердца закончились'):'';
   const key=JSON.stringify([name,variant,hp,state,t('Сердца: {0} из 5')]);if(row.key===key)return;row.key=key;
   styleVariant(row.element,KIRBY_VARIANTS[variant]??KIRBY_VARIANTS[0]);row.name.textContent=name;row.name.title=name;row.hearts.textContent='♥'.repeat(hp)+'♡'.repeat(KNIGHT.hearts-hp);row.hearts.setAttribute('aria-label',t('Сердца: {0} из 5',[hp]));
   row.state.textContent=state;row.state.hidden=!state;row.element.dataset.defeated=String(hp===0);row.element.dataset.withdrawn=String(!!player?.withdrawn);
  });
 }
 dispose(){this.element.remove();this.rows.clear();this.profiles.clear();}
}
