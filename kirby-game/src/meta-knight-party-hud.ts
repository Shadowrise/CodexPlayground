import {knightBattleActive,knightPartyHearts,type KnightBattle} from './meta-knight-battle';
import {KIRBY_VARIANTS,styleVariant} from './variants';
import {t} from './i18n';
import {insideKnightFightingArea} from './meta-knight-arena-site';

export type KnightProfile={id:string;name:string;variant:number;location?:'meta-knight-arena';p?:readonly number[]};
/** Local arena positions decide readiness; an active duel keeps its captured team. */
export function knightArenaRoster(localId:string,profiles:readonly KnightProfile[],s?:KnightBattle){return [...new Set(profiles.filter(p=>p.location==='meta-knight-arena'&&(knightBattleActive(s)?!!s!.players[p.id]:!!p.p&&insideKnightFightingArea(p.p))).map(p=>p.id))].sort((a,b)=>Number(b===localId)-Number(a===localId));}
type PartyRow={element:HTMLDivElement;name:HTMLSpanElement;state:HTMLSpanElement;you:HTMLSpanElement;key:string};

function updateHeartCounter(element:HTMLElement,hp:number,label:string){
 if(!element.firstElementChild){
  const heart=document.createElement('span'),count=document.createElement('span');
  heart.className='knight-party-heart';heart.textContent='♥';count.className='knight-party-heart-count';
  heart.setAttribute('aria-hidden','true');count.setAttribute('aria-hidden','true');element.append(heart,count);
 }
 const count=element.lastElementChild as HTMLElement,previous=count.textContent,next=String(hp);
 if(previous!==next){
  count.textContent=next;
  for(const animation of count.getAnimations())animation.cancel();
  if(previous&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
   const offset=hp<Number(previous)?-7:7;
   count.animate([{opacity:.25,transform:`translateY(${offset}px) scale(.86)`},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:260,easing:'cubic-bezier(.16,1,.3,1)'});
  }
 }
 element.setAttribute('aria-label',`${label}. ${t('Сердца: {0}',[hp])}`);
}

/** Stable rows preserve scroll position while the room sends fresh battle snapshots. */
export class MetaKnightPartyHud{
 readonly element=document.createElement('section');
 private title=document.createElement('strong');
 private hearts=document.createElement('div');
 private helperHealth=document.createElement('div');
 private helperBanks=new Map<string,{element:HTMLDivElement;title:HTMLElement;hearts:HTMLDivElement;key:string}>();
 private rosterTitle=document.createElement('span');
 private rosterCount=document.createElement('span');
 private healthKey='';private rosterKey='';
 private list=document.createElement('div');
 private rows=new Map<string,PartyRow>();
 private profiles=new Map<string,KnightProfile>();
 constructor(){
  this.element.id='knight-party-hud';this.element.className='panel';this.element.hidden=true;this.element.dataset.i18nIgnore='';this.element.tabIndex=0;
  const health=document.createElement('div'),meter=document.createElement('div'),roster=document.createElement('div');
  health.className='knight-party-health';this.title.className='knight-party-title';meter.className='knight-party-meter';this.hearts.className='knight-party-hearts';
  this.hearts.setAttribute('role','img');
  meter.append(this.hearts);health.append(this.title,meter);
  roster.className='knight-party-roster';this.rosterCount.setAttribute('aria-hidden','true');roster.append(this.rosterTitle,this.rosterCount);
  this.list.className='knight-party-list';this.list.setAttribute('role','list');
  this.helperHealth.className='knight-helper-health-list';this.helperHealth.hidden=true;
  this.element.append(health,this.helperHealth,roster,this.list);document.body.append(this.element);
 }
 update(s:KnightBattle|undefined,localId:string,profiles:readonly KnightProfile[],visible:boolean){
  this.element.hidden=!visible;if(!visible)return;
  for(const profile of profiles)this.profiles.set(profile.id,profile);
  this.element.setAttribute('aria-label',t('На арене'));this.list.setAttribute('aria-label',t('На арене'));
  const ids=knightArenaRoster(localId,profiles,s);
  const helpers=Object.entries(s?.players??{}).filter(([,p])=>p.side==='boss'&&!p.withdrawn);
  const shared=(s?Object.values(s.players).filter(p=>p.side!=='boss').length:ids.length)>1,hp=knightPartyHearts(s),label=t(helpers.length?'Жизни игроков':shared?'Жизни команды':'Твои жизни');
  const healthKey=`${hp}:${label}:${shared}`;
  if(this.healthKey!==healthKey){
   this.healthKey=healthKey;this.element.dataset.shared=String(shared);this.element.dataset.defeated=String(hp===0);this.title.textContent=label;
   updateHeartCounter(this.hearts,hp,label);
  }
  this.helperHealth.hidden=helpers.length===0;
  for(const [id,bank] of this.helperBanks)if(!helpers.some(([key])=>key===id)){bank.element.remove();this.helperBanks.delete(id);}
  for(const [id,player] of helpers){
   let bank=this.helperBanks.get(id);if(!bank){const element=document.createElement('div'),title=document.createElement('strong'),hearts=document.createElement('div');element.className='knight-party-health knight-helper-health';element.dataset.playerId=id;title.className='knight-party-title';hearts.className='knight-party-hearts knight-helper-hearts';hearts.setAttribute('role','img');element.append(title,hearts);bank={element,title,hearts,key:''};this.helperBanks.set(id,bank);this.helperHealth.append(element);}
   const name=this.profiles.get(id)?.name??t('Метакнайт'),label=`${name} · ${t('За Метакнайта')}`,key=JSON.stringify([label,player.hp]);if(bank.key===key)continue;bank.key=key;bank.title.textContent=label;bank.title.title=label;bank.element.dataset.defeated=String(player.hp===0);updateHeartCounter(bank.hearts,player.hp,label);
  }
  const rosterTitle=t('На арене'),count=String(ids.length),rosterKey=`${rosterTitle}:${count}`;
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
   const name=profile?.name??t('Игрок'),variant=profile?.variant??0,defeated=!!player&&!player.withdrawn&&player.hp===0,state=player?.withdrawn?t('Дуэль прервана'):defeated?t('Сердца закончились'):knightBattleActive(s)&&!player?t('Наблюдает за боем'):player?.side==='boss'?`${t('За Метакнайта')} · ${player.hp}`:'';
   const key=JSON.stringify([name,variant,hp,state,id===localId,t('Ты')]);if(row.key===key)return;row.key=key;
   styleVariant(row.element,KIRBY_VARIANTS[variant]??KIRBY_VARIANTS[0]);row.name.textContent=name;row.name.title=name;row.you.textContent=t('Ты');row.you.hidden=id!==localId;
   row.state.textContent=state;row.state.hidden=!state;row.element.dataset.defeated=String(defeated);row.element.dataset.withdrawn=String(!!player?.withdrawn);
  });
 }
 dispose(){this.element.remove();this.rows.clear();this.profiles.clear();}
}
