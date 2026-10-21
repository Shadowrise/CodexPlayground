import * as T from 'three';
import {CentipedeFireworks} from './centipede-fireworks';
import {NUMBER_GARDEN_SITE as SITE,NUMBER_COLORS} from './number-garden-site';
import {advanceNumberGame,numberAnswer,NUMBER_ROUNDS,NUMBER_EMPTY_MS,type NumberGame} from './number-garden-game';
import {getLocale,t} from './i18n';
export class NumberGardenView {
 readonly group=new T.Group();readonly hud=document.createElement('div');
 private title=document.createElement('strong');private message=document.createElement('div');private equation=document.createElement('div');
 private fireworks=new CentipedeFireworks();private signature='';private heard='';
 constructor(private feedback:(kind:'correct'|'wrong'|'finish')=>void){
  this.group.name='Number garden celebration';this.group.add(this.fireworks.mesh);
  this.hud.id='number-game-hud';this.hud.className='event-hud';this.hud.hidden=true;this.hud.setAttribute('role','status');this.equation.className='number-game-equation';this.hud.append(this.title,this.message,this.equation);document.body.append(this.hud);
 }
 update(state:NumberGame|undefined,id:string,now:number,p:T.Vector3,visible:boolean,audible=visible){
  const q=advanceNumberGame(state,now),nearby=Math.abs(p.x-SITE.x)<SITE.halfWidth+10&&Math.abs(p.z-SITE.z)<SITE.halfDepth+10;
  this.fireworks.update(q?.stage==='celebrate',(now-(q?.stageAt??now))/1000,SITE.x,SITE.z);
  if(!q){this.hud.hidden=true;this.heard='';return;}
  const soundKey=`${q.startedAt}:${q.stageAt}:${q.stage}:${q.cursor}`;
  if(this.heard!==soundKey){this.heard=soundKey;if(nearby&&audible&&now-q.stageAt<500){if(q.stage==='error')this.feedback('wrong');else if(q.stage==='celebrate')this.feedback('finish');else if(q.cursor>0)this.feedback('correct');}}
  this.hud.hidden=!visible||(!nearby&&!q.players.includes(id));if(this.hud.hidden)return;
  const seconds=q.emptySince===undefined?0:Math.max(0,Math.ceil((q.emptySince+NUMBER_EMPTY_MS-now)/1000));
  const message=seconds?t('Вернись к циферкам! Испытание сбросится через {0} с.',[seconds]):t(q.stage==='celebrate'?'Все примеры решены! +12 очков.':q.stage==='error'?'Не та цифра! Попробуй этот пример ещё раз.':q.stage==='round'?'Верно! Следующий пример…':'Реши пример. Нажимай цифры ответа слева направо.');
  const signature=JSON.stringify([getLocale(),q.startedAt,q.round,q.cursor,q.stage,q.wrongDigit,message]);if(signature===this.signature)return;this.signature=signature;
  this.title.textContent=t(q.stage==='celebrate'?'Звонкие циферки · Готово!':'Звонкие циферки · Раунд {0}/{1}',[q.round,NUMBER_ROUNDS]);this.message.textContent=message;
  const problem=q.problems[q.round-1],answer=numberAnswer(problem);this.equation.replaceChildren(document.createTextNode(`${problem.left} ${problem.operator} ${problem.right} = `));
  for(let i=0;i<answer.length;i++){const slot=document.createElement('span'),wrong=q.stage==='error'&&i===q.cursor,done=i<q.cursor;slot.className=wrong?'wrong':done?'correct':'pending';slot.textContent=wrong?String(q.wrongDigit):done?answer[i]:'?';if(!wrong)slot.style.color=NUMBER_COLORS[(q.round+6)%10];slot.setAttribute('aria-label',t(wrong?'Цифра {0}: ошибка':done?'Цифра {0}: верно':'Цифра {0}: введи ответ',[i+1]));this.equation.append(slot);}
 }
 reset(){this.hud.hidden=true;this.signature='';this.heard='';this.fireworks.mesh.visible=false;}
}
