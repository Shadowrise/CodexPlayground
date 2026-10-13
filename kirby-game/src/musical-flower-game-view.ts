import * as T from 'three';
import {getLocale,t} from './i18n';
import {CentipedeFireworks} from './centipede-fireworks';
import {MusicalFlowerButton} from './musical-flower-button';
import {MUSICAL_FLOWER_SITE as SITE,MUSICAL_FLOWERS} from './musical-flower-site';
import {advanceFlowerGame,flowerPlayback,FLOWER_ROUNDS,FLOWER_EMPTY_MS,type FlowerGame} from './musical-flower-game';

const NOTE='<svg viewBox="0 0 32 40" aria-hidden="true"><path d="M19 4v24c-1 6-15 9-16 2-1-6 9-9 13-7V3h4c1 5 12 4 9 14-1-5-7-4-9-7v18h-1Z" fill="currentColor"/><path class="note-cross" d="m3 5 26 30M29 5 3 35" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
export class MusicalFlowerGameView {
 readonly group=new T.Group();
 readonly button=new MusicalFlowerButton();
 readonly hud=document.createElement('div');
 private title=document.createElement('strong');private message=document.createElement('div');private notes=document.createElement('div');
 private fireworks=new CentipedeFireworks();private signature='';private stageKey='';private heard=new Set<string>();private playback:{index:number;at:number}[]=[];
 constructor(private play:(index:number)=>void,private feedback:(kind:'wrong'|'round'|'finish')=>void){
  this.group.name='Flower memory adventure';this.fireworks.mesh.name='Flower melody celebration fireworks';this.group.add(this.button.group,this.fireworks.mesh);
  this.hud.id='flower-game-hud';this.hud.className='event-hud';this.hud.hidden=true;this.hud.setAttribute('role','status');
  this.notes.className='flower-game-notes';this.hud.append(this.title,this.message,this.notes);document.body.append(this.hud);
 }
 update(state:FlowerGame|undefined,id:string,now:number,position:T.Vector3,visible:boolean){
  const q=advanceFlowerGame(state,now);this.button.update(!!q&&q.stage!=='repeat',now);
  const nearby=Math.hypot(position.x-SITE.x,position.z-SITE.z)<SITE.radius+10;
  this.fireworks.update(!!q&&q.stage==='celebrate',(now-(q?.stageAt??now))/1000,SITE.x,SITE.z);
  if(!q){this.hud.hidden=true;return;}
  const stageKey=`${q.startedAt}:${q.stageAt}:${q.stage}`;if(this.stageKey!==stageKey){this.stageKey=stageKey;this.heard.clear();this.playback=flowerPlayback(q);}
  const once=(key:string,at:number,play:()=>void)=>{if(now<at||this.heard.has(key))return;this.heard.add(key);if(now-at<400&&nearby&&visible)play();};
  let active=-1;
  for(const [i,note] of this.playback.entries()){
   once(`${q.stageAt}:${q.stage}:${i}`,note.at,()=>this.play(note.index));
   if(now>=note.at&&now<note.at+340)active=i;
  }
  if(q.stage==='error')once('wrong:'+q.stageAt,q.stageAt,()=>this.feedback('wrong'));
  if(q.stage==='echo')once('round:'+q.stageAt,q.stageAt,()=>this.feedback('round'));
  if(q.stage==='celebrate')once('finish:'+q.stageAt,q.stageAt,()=>this.feedback('finish'));
  this.hud.hidden=!visible||(!nearby&&!q.players.includes(id));if(this.hud.hidden)return;
  const seconds=q.emptySince===undefined?0:Math.max(0,Math.ceil((q.emptySince+FLOWER_EMPTY_MS-now)/1000));
  const text=seconds?t('Вернитесь на цветочную полянку! Игра сбросится через {0} с.',[seconds]):t(q.stage==='listen'?'Слушай мелодию и смотри, какие цветочки загораются.':q.stage==='repeat'?'Повтори нотки по порядку. Подойди к цветочку и нажми действие.':q.stage==='error'?'Не та нотка! Сейчас цветочки сыграют ещё раз.':q.stage==='echo'?'Правильно! Переходим к следующему шагу.':'Мелодия получилась! Отличная память!');
  const signature=JSON.stringify([getLocale(),q.round,q.cursor,q.stage,text,active]);if(signature===this.signature)return;this.signature=signature;
  this.title.textContent=t(q.stage==='celebrate'?'Цветочная мелодия · Готово!':'Цветочная мелодия · Этап {0}/{1}',[q.round,FLOWER_ROUNDS]);this.message.textContent=text;
  this.notes.replaceChildren();
  for(let i=0;i<q.round;i++){
   const note=document.createElement('span');note.innerHTML=NOTE;
   const done=i<q.cursor,wrong=q.stage==='error'&&i===q.cursor;
   note.className=wrong?'wrong':done?'correct':i===active?'playing':'';
   note.style.setProperty('--note-color',MUSICAL_FLOWERS[this.playback[i]?.index??0].color);
   note.setAttribute('aria-label',t(wrong?'Нотка {0}: ошибка':done?'Нотка {0}: верно':'Нотка {0}',[i+1]));this.notes.append(note);
  }
 }
 reset(){this.hud.hidden=true;this.signature='';this.stageKey='';this.heard.clear();this.playback=[];this.fireworks.mesh.visible=false;this.button.update(false,0);}
}
