import type {KnightBattle} from './meta-knight-battle';
import {knightBattleActive} from './meta-knight-battle';
import {HELPER,helperLocked,type HelperAbility,type KnightSide} from './meta-knight-helper';
import {knightArenaRoster,type KnightProfile} from './meta-knight-party-hud';
import {KIRBY_VARIANTS} from './variant-palette';
import {t} from './i18n';
import {type KnightSideChoices} from './meta-knight-side-choice';
import {knightCosmicAlly} from './meta-knight-cosmic-ally';
import './meta-knight-helper.css';

const icons=[
 '<path d="M13 7c22-2 31 26 4 35 13-11 14-22-4-35Z"/>',
 '<path d="m10 29 14-15 14 15-6 6-8-9-8 9Z"/><path d="M8 13h9M5 20h7M8 38h9"/>',
 '<circle cx="24" cy="24" r="9"/><circle cx="24" cy="5" r="3"/><circle cx="41" cy="14" r="3"/><circle cx="41" cy="34" r="3"/><circle cx="24" cy="43" r="3"/><circle cx="7" cy="34" r="3"/><circle cx="7" cy="14" r="3"/>',
 '<path d="m10 8 7 11-4 3 9 13M38 8l-7 11 4 3-9 13M24 4l-5 16h8l-6 23 16-27H25l5-12Z"/>',
];
export class MetaKnightHelperHud{
 readonly choice=document.createElement('section');readonly dock=document.createElement('div');
 private title=document.createElement('strong');private detail=document.createElement('p');private timer=document.createElement('p');private row=document.createElement('div');private sides:HTMLButtonElement[]=[];private buttons:HTMLButtonElement[]=[];
 private padSide=0;private _choosing=false;get choosing(){return this._choosing;}
 constructor(private side:(side:KnightSide)=>void,private ability:(slot:HelperAbility)=>void){
  this.choice.id='knight-side-choice';this.choice.className='panel';this.choice.dataset.i18nIgnore='';this.choice.hidden=true;this.choice.setAttribute('aria-label',t('Выбери сторону'));
  for(const [i,label] of ['За игроков','За Метакнайта'].entries()){const button=document.createElement('button');button.type='button';button.dataset.side=i?'boss':'players';button.addEventListener('click',()=>this.side(i?'boss':'players'));this.sides.push(button);this.row.append(button);button.textContent=t(label);}
  this.timer.className='knight-choice-timer';this.choice.setAttribute('role','status');this.choice.setAttribute('aria-live','polite');this.choice.append(this.title,this.detail,this.timer,this.row);this.dock.id='knight-helper-actions';this.dock.hidden=true;
  icons.forEach((icon,i)=>{const button=document.createElement('button');button.type='button';button.className='player-action-badge';button.dataset.icon='helper';button.innerHTML=`<span class="player-action-face"><i class="player-action-shine"></i><svg class="player-action-symbol" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${icon}</svg><kbd class="player-action-key">${i+1}</kbd><strong class="player-action-countdown" hidden></strong></span>`;button.addEventListener('click',()=>this.ability(i+1 as HelperAbility));this.buttons.push(button);this.dock.append(button);});
  document.body.append(this.choice,this.dock);
 }
 pad(direction:-1|0|1,confirm:boolean){if(!this.choosing)return;this.padSide=direction<0?0:direction>0?1:this.padSide;this.sides.forEach((button,i)=>button.dataset.padSelected=String(i===this.padSide));if(confirm)this.side(this.padSide?'boss':'players');}
 digit(digit:number){if(this.choosing){if(digit===1||digit===2)this.side(digit===1?'players':'boss');return true;}return false;}
 update(s:KnightBattle|undefined,id:string,profiles:readonly KnightProfile[],side:KnightSide|undefined,now:number,visible:boolean,scheme:'keyboard'|'gamepad'|'touch',choices?:KnightSideChoices){
  const ids=new Set(knightArenaRoster(id,profiles,s)),roster=profiles.filter(p=>ids.has(p.id)),isKnight=(p:KnightProfile)=>KIRBY_VARIANTS[p.variant]?.[0]==='Meta Knight',eligible=roster.some(isKnight),me=roster.find(p=>p.id===id);
  this._choosing=visible&&s?.stage==='side-choice'&&!!me&&isKnight(me)&&eligible&&side===undefined;
  const pending=eligible?roster.filter(p=>isKnight(p)&&!(choices?.knightSides?.[p.id]??(p.id===id?side:undefined))):[],waiting=visible&&s?.stage==='side-choice'&&!!me&&!this._choosing&&pending.length>0;
  this.choice.hidden=!this._choosing&&!waiting;this.row.hidden=!this._choosing;this.choice.setAttribute('aria-label',t(waiting?'Ждём выбора стороны':'Выбери сторону'));this.title.textContent=t(waiting?'Ждём выбора стороны':'Выбери сторону');
  this.detail.textContent=waiting?t('{0} выбирает, на чьей стороне сражаться',[pending.map(p=>p.name).join(', ')]):t(scheme==='gamepad'?'← → — выбор · A — подтвердить':'Выбери сторону для этой дуэли');
  const remaining=s?.stage==='side-choice'?Math.max(0,Math.ceil((s.until-now)/1000)):Infinity;this.timer.hidden=!Number.isFinite(remaining);this.timer.textContent=Number.isFinite(remaining)?t('Осталось {0} с · затем автоматически за игроков',[remaining]):'';
  this.sides.forEach((button,i)=>{button.textContent=`${scheme==='keyboard'?`${i+1} · `:''}${t(i?'За Метакнайта':'За игроков')}`;button.setAttribute('aria-pressed',String(side===(i?'boss':'players')));});
  const player=s?.players[id],h=player?.helper,shown=visible&&knightBattleActive(s)&&!!h&&!player?.withdrawn;
  this.dock.hidden=!shown;this.dock.dataset.scheme=scheme;if(!shown||!h||!s||!player)return;
  const names=[t(s.phase===4?'Метеор':'Полумесяц'),t('Боевой рывок'),t('Шесть шаров'),t('Совместная гроза')],ritual=!!knightCosmicAlly(s,id,now);
  this.buttons.forEach((button,i)=>{const remaining=Math.max(0,(h.cooldowns[i]??0)-now)/1000,pending=i===3&&s.duet?.owner===id&&s.duet.stage==='queued',disabled=ritual||pending||i<3&&s.duet?.owner===id||player.hp<=0||i<3&&helperLocked(h,now)||i===3&&!!s.duet||['intro','transition','cosmic-surge','cosmic-lift','cosmic-rise','cosmic-descent'].includes(s.stage)||remaining>0;button.disabled=disabled;button.dataset.state=disabled?'cooldown':'ready';button.dataset.active=String(h.cast?.ability===i+1&&now<h.cast.end);button.title=pending?t('Ждём завершения подфазы босса'):names[i];button.setAttribute('aria-label',`${names[i]}${remaining>0?` · ${t('Через {0} с',[Math.ceil(remaining)])}`:''}`);button.querySelector('kbd')!.textContent=scheme==='gamepad'?['←','↑','→','↓'][i]:String(i+1);const counter=button.querySelector('strong')!;counter.hidden=remaining<=0;counter.textContent=pending?'…':String(Math.ceil(remaining));counter.hidden=!pending&&remaining<=0;button.style.setProperty('--cooldown-progress',String(1-remaining/(HELPER.cooldowns[i]/1000)));});
 }
 dispose(){this.choice.remove();this.dock.remove();}
}
