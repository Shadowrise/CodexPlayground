import {KNIGHT,knightPartyHearts,type KnightBattle} from './meta-knight-battle';
import {KIRBY_VARIANTS,styleVariant} from './variants';
import {t} from './i18n';

export type KnightProfile={id:string;name:string;variant:number};
type PartyRow={element:HTMLDivElement;name:HTMLSpanElement;state:HTMLSpanElement;you:HTMLSpanElement;key:string};

/** Stable rows preserve scroll position while the room sends fresh battle snapshots. */
export class MetaKnightPartyHud{
 readonly element=document.createElement('section');
 private title=document.createElement('strong');
 private hearts=document.createElement('div');
 private count=document.createElement('span');
 private caption=document.createElement('p');
 private rosterTitle=document.createElement('span');
 private rosterCount=document.createElement('span');
 private healthKey='';private rosterKey='';
 private list=document.createElement('div');
 private rows=new Map<string,PartyRow>();
 private profiles=new Map<string,KnightProfile>();
 constructor(){
  this.element.id='knight-party-hud';this.element.className='panel';this.element.hidden=true;this.element.dataset.i18nIgnore='';
  const health=document.createElement('div'),meter=document.createElement('div'),roster=document.createElement('div');
  health.className='knight-party-health';this.title.className='knight-party-title';meter.className='knight-party-meter';this.hearts.className='knight-party-hearts';this.count.className='knight-party-count';this.caption.className='knight-party-caption';
  this.hearts.setAttribute('role','img');
  for(let i=0;i<KNIGHT.hearts;i++){const heart=document.createElement('span');heart.textContent='♥';heart.setAttribute('aria-hidden','true');this.hearts.append(heart);}
  this.count.setAttribute('aria-hidden','true');meter.append(this.hearts,this.count);health.append(this.title,meter,this.caption);
  roster.className='knight-party-roster';this.rosterCount.setAttribute('aria-hidden','true');roster.append(this.rosterTitle,this.rosterCount);
  this.list.className='knight-party-list';this.list.setAttribute('role','list');this.list.tabIndex=0;
  this.element.append(health,roster,this.list);document.body.append(this.element);
 }
 update(s:KnightBattle|undefined,localId:string,profiles:readonly KnightProfile[],visible:boolean){
  this.element.hidden=!visible;if(!visible)return;
  for(const profile of profiles)this.profiles.set(profile.id,profile);
  this.element.setAttribute('aria-label',t('Участники дуэли'));this.list.setAttribute('aria-label',t('Участники дуэли'));
  const ids=s?Object.keys(s.players):[localId];
  const shared=ids.length>1,hp=knightPartyHearts(s),label=t(shared?'Жизни команды':'Твои жизни');
  const healthKey=`${hp}:${label}`;
  if(this.healthKey!==healthKey){
   this.healthKey=healthKey;this.element.dataset.shared=String(shared);this.element.dataset.defeated=String(hp===0);this.title.textContent=label;
   this.hearts.setAttribute('aria-label',`${label}. ${t('Сердца: {0} из 5',[hp])}`);this.count.textContent=`${hp} / ${KNIGHT.hearts}`;
   Array.from(this.hearts.children).forEach((heart,i)=>{heart.classList.toggle('empty',i>=hp);heart.textContent=i<hp?'♥':'♡';});
   this.caption.textContent=t(shared?'Общие для всех участников':'Сердца на эту попытку');
  }
  const rosterTitle=t('Участники дуэли'),count=String(ids.filter(id=>!s?.players[id]?.withdrawn).length),rosterKey=`${rosterTitle}:${count}`;
  if(this.rosterKey!==rosterKey){this.rosterKey=rosterKey;this.rosterTitle.textContent=rosterTitle;this.rosterCount.textContent=count;}
  // Put your own character first and retain the encounter's order for teammates.
  ids.sort((a,b)=>Number(b===localId)-Number(a===localId));
  for(const [id,row] of this.rows)if(!ids.includes(id)){row.element.remove();this.rows.delete(id);}
  ids.forEach((id,index)=>{
   let row=this.rows.get(id);
   if(!row){
    const element=document.createElement('div'),name=document.createElement('span'),state=document.createElement('span'),portrait=document.createElement('span'),you=document.createElement('span');
    element.className='knight-party-row';element.dataset.playerId=id;element.setAttribute('role','listitem');name.className='stat-name';state.className='knight-party-state';you.className='knight-party-you';
    portrait.className='mini-kirby';portrait.setAttribute('aria-hidden','true');portrait.innerHTML='<i class="mini-feet"></i><i class="mini-body"><i class="mini-eyes"></i><i class="mini-mouth"></i></i>';
    const identity=document.createElement('div');identity.className='knight-party-identity';identity.append(name,state);element.append(portrait,identity,you);row={element,name,state,you,key:''};this.rows.set(id,row);
   }
   if(this.list.children[index]!==row.element)this.list.insertBefore(row.element,this.list.children[index]??null);
   const profile=this.profiles.get(id),player=s?.players[id];
   const name=profile?.name??t('Игрок'),variant=profile?.variant??0,state=player?.withdrawn?t('Дуэль прервана'):hp===0?t('Сердца закончились'):'';
   const key=JSON.stringify([name,variant,hp,state,id===localId,t('Ты')]);if(row.key===key)return;row.key=key;
   styleVariant(row.element,KIRBY_VARIANTS[variant]??KIRBY_VARIANTS[0]);row.name.textContent=name;row.name.title=name;row.you.textContent=t('Ты');row.you.hidden=id!==localId;
   row.state.textContent=state;row.state.hidden=!state;row.element.dataset.defeated=String(hp===0);row.element.dataset.withdrawn=String(!!player?.withdrawn);
  });
 }
 dispose(){this.element.remove();this.rows.clear();this.profiles.clear();}
}
